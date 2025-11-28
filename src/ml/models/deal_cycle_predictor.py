"""
Deal Cycle Predictor.
Analyzes historical sale dates to identify cyclical patterns and predict next sales.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import json

try:
    from scipy import stats
    from scipy.fft import fft
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


@dataclass
class SaleRecord:
    """Historical sale record."""
    item_id: str
    item_name: str
    store_id: str
    store_name: str
    sale_date: date
    original_price: float
    sale_price: float
    discount_percent: float
    deal_type: str = "regular"  # regular, bogo, bulk, seasonal


@dataclass
class CyclePattern:
    """Detected cycle pattern for an item."""
    cycle_type: str  # weekly, biweekly, monthly, seasonal, irregular
    cycle_days: int  # Average days between sales
    confidence: float
    variance_days: float
    seasonality: Optional[str] = None  # spring, summer, fall, winter, holiday
    day_of_week_preference: Optional[int] = None  # 0=Monday, 6=Sunday


@dataclass
class SalePrediction:
    """Prediction for next sale."""
    item_id: str
    item_name: str
    predicted_date: date
    confidence: float
    expected_discount: float
    prediction_range: Tuple[date, date]
    recommendation: str  # buy_now, wait, uncertain
    days_until_sale: int
    reasoning: List[str]


@dataclass
class ItemCycleProfile:
    """Complete cycle profile for an item."""
    item_id: str
    item_name: str
    total_sales_analyzed: int
    average_discount: float
    best_discount: float
    cycle_pattern: CyclePattern
    store_patterns: Dict[str, CyclePattern]
    last_sale: Optional[date]
    next_predicted: Optional[SalePrediction]


class DealCyclePredictor:
    """
    ML model to predict deal cycles for grocery items.

    Features:
    - Analyzes historical sale dates per item
    - Identifies cyclical patterns (weekly, 6-week, seasonal)
    - Predicts next sale date
    - Recommends "wait" vs "buy now"
    """

    MODEL_VERSION = "1.0.0"

    # Cycle detection parameters
    MIN_SALES_FOR_PREDICTION = 3
    WEEKLY_THRESHOLD = 7
    BIWEEKLY_THRESHOLD = 14
    MONTHLY_THRESHOLD = 30
    SIX_WEEK_THRESHOLD = 42

    # Confidence thresholds
    HIGH_CONFIDENCE = 0.8
    MEDIUM_CONFIDENCE = 0.5

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize predictor."""
        self.model_path = model_path
        self.sales_history: Dict[str, List[SaleRecord]] = defaultdict(list)
        self.item_profiles: Dict[str, ItemCycleProfile] = {}
        self.store_patterns: Dict[str, Dict[str, Any]] = defaultdict(dict)

        if model_path and model_path.exists():
            self.load(model_path)

    def add_sale(self, sale: SaleRecord) -> None:
        """Add a sale record to history."""
        self.sales_history[sale.item_id].append(sale)

        # Track store patterns
        store_key = f"{sale.store_id}:{sale.item_id}"
        if store_key not in self.store_patterns:
            self.store_patterns[store_key] = {"dates": [], "discounts": []}
        self.store_patterns[store_key]["dates"].append(sale.sale_date)
        self.store_patterns[store_key]["discounts"].append(sale.discount_percent)

    def analyze_item(self, item_id: str) -> Optional[ItemCycleProfile]:
        """
        Analyze cycle pattern for an item.

        Args:
            item_id: Item identifier

        Returns:
            ItemCycleProfile or None if insufficient data
        """
        sales = self.sales_history.get(item_id, [])

        if len(sales) < self.MIN_SALES_FOR_PREDICTION:
            return None

        # Sort by date
        sales = sorted(sales, key=lambda s: s.sale_date)

        # Calculate intervals
        intervals = []
        for i in range(1, len(sales)):
            delta = (sales[i].sale_date - sales[i-1].sale_date).days
            intervals.append(delta)

        if not intervals:
            return None

        # Detect cycle pattern
        cycle_pattern = self._detect_cycle(intervals, sales)

        # Analyze by store
        store_patterns = self._analyze_store_patterns(item_id, sales)

        # Calculate discount stats
        discounts = [s.discount_percent for s in sales]
        avg_discount = np.mean(discounts)
        best_discount = max(discounts)

        # Predict next sale
        next_prediction = self._predict_next_sale(
            item_id, sales[-1], cycle_pattern, avg_discount
        )

        profile = ItemCycleProfile(
            item_id=item_id,
            item_name=sales[0].item_name,
            total_sales_analyzed=len(sales),
            average_discount=round(avg_discount, 1),
            best_discount=round(best_discount, 1),
            cycle_pattern=cycle_pattern,
            store_patterns=store_patterns,
            last_sale=sales[-1].sale_date,
            next_predicted=next_prediction,
        )

        self.item_profiles[item_id] = profile
        return profile

    def _detect_cycle(
        self,
        intervals: List[int],
        sales: List[SaleRecord],
    ) -> CyclePattern:
        """Detect the cycle pattern from intervals."""
        avg_interval = np.mean(intervals)
        std_interval = np.std(intervals)

        # Determine cycle type
        if avg_interval <= self.WEEKLY_THRESHOLD + 3:
            cycle_type = "weekly"
            cycle_days = 7
        elif avg_interval <= self.BIWEEKLY_THRESHOLD + 4:
            cycle_type = "biweekly"
            cycle_days = 14
        elif avg_interval <= self.MONTHLY_THRESHOLD + 7:
            cycle_type = "monthly"
            cycle_days = 30
        elif avg_interval <= self.SIX_WEEK_THRESHOLD + 10:
            cycle_type = "six_week"
            cycle_days = 42
        else:
            cycle_type = "irregular"
            cycle_days = int(avg_interval)

        # Calculate confidence
        if len(intervals) >= 5:
            # More samples = higher confidence
            cv = std_interval / avg_interval if avg_interval > 0 else 1
            confidence = max(0.3, 1 - cv)  # Lower variance = higher confidence
        else:
            confidence = 0.3 + (len(intervals) * 0.1)

        # Detect day of week preference
        dow_counts = defaultdict(int)
        for sale in sales:
            dow_counts[sale.sale_date.weekday()] += 1

        dow_preference = None
        if dow_counts:
            max_dow = max(dow_counts.items(), key=lambda x: x[1])
            if max_dow[1] >= len(sales) * 0.4:  # At least 40% on same day
                dow_preference = max_dow[0]

        # Detect seasonality
        seasonality = self._detect_seasonality(sales)

        return CyclePattern(
            cycle_type=cycle_type,
            cycle_days=cycle_days,
            confidence=round(min(0.95, confidence), 3),
            variance_days=round(std_interval, 1),
            seasonality=seasonality,
            day_of_week_preference=dow_preference,
        )

    def _detect_seasonality(self, sales: List[SaleRecord]) -> Optional[str]:
        """Detect seasonal patterns in sales."""
        month_counts = defaultdict(int)

        for sale in sales:
            month_counts[sale.sale_date.month] += 1

        if not month_counts:
            return None

        # Check for concentration
        total = sum(month_counts.values())

        # Holiday season (Nov-Dec)
        holiday = (month_counts.get(11, 0) + month_counts.get(12, 0)) / total
        if holiday >= 0.4:
            return "holiday"

        # Summer (Jun-Aug)
        summer = sum(month_counts.get(m, 0) for m in [6, 7, 8]) / total
        if summer >= 0.5:
            return "summer"

        # Spring (Mar-May)
        spring = sum(month_counts.get(m, 0) for m in [3, 4, 5]) / total
        if spring >= 0.5:
            return "spring"

        # Fall (Sep-Nov)
        fall = sum(month_counts.get(m, 0) for m in [9, 10, 11]) / total
        if fall >= 0.5:
            return "fall"

        return None

    def _analyze_store_patterns(
        self,
        item_id: str,
        sales: List[SaleRecord],
    ) -> Dict[str, CyclePattern]:
        """Analyze cycle patterns by store."""
        store_sales: Dict[str, List[SaleRecord]] = defaultdict(list)

        for sale in sales:
            store_sales[sale.store_id].append(sale)

        patterns = {}
        for store_id, store_sales_list in store_sales.items():
            if len(store_sales_list) < 2:
                continue

            intervals = []
            for i in range(1, len(store_sales_list)):
                delta = (store_sales_list[i].sale_date - store_sales_list[i-1].sale_date).days
                intervals.append(delta)

            if intervals:
                patterns[store_id] = self._detect_cycle(intervals, store_sales_list)

        return patterns

    def _predict_next_sale(
        self,
        item_id: str,
        last_sale: SaleRecord,
        pattern: CyclePattern,
        expected_discount: float,
    ) -> SalePrediction:
        """Predict next sale date."""
        today = date.today()
        days_since_last = (today - last_sale.sale_date).days

        # Base prediction
        predicted_days = pattern.cycle_days - days_since_last

        # Adjust for day of week preference
        predicted_date = today + timedelta(days=max(0, predicted_days))

        if pattern.day_of_week_preference is not None:
            # Adjust to preferred day
            current_dow = predicted_date.weekday()
            days_to_preferred = (pattern.day_of_week_preference - current_dow) % 7
            predicted_date += timedelta(days=days_to_preferred)

        # Calculate range
        variance = int(pattern.variance_days)
        range_start = predicted_date - timedelta(days=variance)
        range_end = predicted_date + timedelta(days=variance)

        # Determine recommendation
        days_until = (predicted_date - today).days

        if days_until <= 0:
            recommendation = "buy_now"
            reasoning = ["Sale may be active now or very soon"]
        elif days_until <= 7 and pattern.confidence >= self.HIGH_CONFIDENCE:
            recommendation = "wait"
            reasoning = [f"High confidence sale expected in {days_until} days"]
        elif days_until <= 14 and pattern.confidence >= self.MEDIUM_CONFIDENCE:
            recommendation = "wait"
            reasoning = [f"Likely sale in {days_until} days, consider waiting"]
        elif days_until > 30:
            recommendation = "buy_now"
            reasoning = ["No sale expected soon, buy if needed"]
        else:
            recommendation = "uncertain"
            reasoning = ["Prediction uncertain, monitor for deals"]

        # Add pattern-based reasoning
        if pattern.cycle_type == "weekly":
            reasoning.append(f"This item typically goes on sale weekly")
        elif pattern.cycle_type == "six_week":
            reasoning.append(f"This item has ~6 week sale cycle")

        if pattern.seasonality:
            reasoning.append(f"Item has {pattern.seasonality} seasonal pattern")

        return SalePrediction(
            item_id=item_id,
            item_name=last_sale.item_name,
            predicted_date=predicted_date,
            confidence=pattern.confidence,
            expected_discount=expected_discount,
            prediction_range=(range_start, range_end),
            recommendation=recommendation,
            days_until_sale=max(0, days_until),
            reasoning=reasoning[:4],
        )

    def predict_sale(self, item_id: str) -> Optional[SalePrediction]:
        """
        Get sale prediction for an item.

        Args:
            item_id: Item identifier

        Returns:
            SalePrediction or None if insufficient data
        """
        profile = self.analyze_item(item_id)
        if profile:
            return profile.next_predicted
        return None

    def get_upcoming_sales(
        self,
        days_ahead: int = 14,
        min_confidence: float = 0.5,
    ) -> List[SalePrediction]:
        """
        Get all predicted sales in the next N days.

        Args:
            days_ahead: Days to look ahead
            min_confidence: Minimum confidence threshold

        Returns:
            List of predictions sorted by date
        """
        predictions = []
        cutoff = date.today() + timedelta(days=days_ahead)

        for item_id in self.sales_history:
            prediction = self.predict_sale(item_id)
            if prediction and prediction.confidence >= min_confidence:
                if prediction.predicted_date <= cutoff:
                    predictions.append(prediction)

        predictions.sort(key=lambda p: p.predicted_date)
        return predictions

    def should_buy_now(
        self,
        item_id: str,
        urgency: str = "normal",
    ) -> Dict[str, Any]:
        """
        Recommend whether to buy now or wait.

        Args:
            item_id: Item identifier
            urgency: "urgent", "normal", or "flexible"

        Returns:
            Recommendation with reasoning
        """
        prediction = self.predict_sale(item_id)

        if not prediction:
            return {
                "recommendation": "buy_now",
                "confidence": 0.3,
                "reasoning": ["Insufficient data to predict sales"],
            }

        # Adjust for urgency
        if urgency == "urgent":
            return {
                "recommendation": "buy_now",
                "confidence": 0.9,
                "reasoning": ["Urgent need - buy now regardless of predicted sales"],
                "prediction": prediction,
            }

        if urgency == "flexible" and prediction.days_until_sale <= 21:
            return {
                "recommendation": "wait",
                "confidence": prediction.confidence,
                "reasoning": [
                    f"Flexible timeline allows waiting for predicted sale",
                    f"Expected {prediction.expected_discount:.0f}% off in {prediction.days_until_sale} days"
                ],
                "prediction": prediction,
            }

        # Normal urgency
        return {
            "recommendation": prediction.recommendation,
            "confidence": prediction.confidence,
            "reasoning": prediction.reasoning,
            "prediction": prediction,
            "potential_savings": f"{prediction.expected_discount:.0f}%",
        }

    def get_best_store_for_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Find store with best deal cycle for an item."""
        profile = self.item_profiles.get(item_id)
        if not profile or not profile.store_patterns:
            return None

        best_store = None
        best_score = 0

        for store_id, pattern in profile.store_patterns.items():
            # Score based on frequency and confidence
            score = pattern.confidence / max(pattern.cycle_days, 1) * 100

            if score > best_score:
                best_score = score
                best_store = store_id

        if best_store:
            return {
                "store_id": best_store,
                "pattern": profile.store_patterns[best_store],
                "score": round(best_score, 2),
            }
        return None

    def train(self, sales: List[SaleRecord]) -> Dict[str, Any]:
        """
        Train model on batch of sale records.

        Args:
            sales: List of historical sale records

        Returns:
            Training statistics
        """
        for sale in sales:
            self.add_sale(sale)

        # Analyze all items
        items_analyzed = 0
        for item_id in self.sales_history:
            if self.analyze_item(item_id):
                items_analyzed += 1

        self.save(self.model_path) if self.model_path else None

        return {
            "sales_processed": len(sales),
            "items_analyzed": items_analyzed,
            "profiles_created": len(self.item_profiles),
        }

    def save(self, path: Path) -> None:
        """Save model state."""
        def date_serializer(obj):
            if isinstance(obj, date):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        data = {
            "version": self.MODEL_VERSION,
            "sales_history": {
                item_id: [
                    {
                        "item_id": s.item_id,
                        "item_name": s.item_name,
                        "store_id": s.store_id,
                        "store_name": s.store_name,
                        "sale_date": s.sale_date.isoformat(),
                        "original_price": s.original_price,
                        "sale_price": s.sale_price,
                        "discount_percent": s.discount_percent,
                        "deal_type": s.deal_type,
                    }
                    for s in sales
                ]
                for item_id, sales in self.sales_history.items()
            },
        }

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=date_serializer)

    def load(self, path: Path) -> None:
        """Load model state."""
        with open(path, "r") as f:
            data = json.load(f)

        for item_id, sales_data in data.get("sales_history", {}).items():
            for s in sales_data:
                sale = SaleRecord(
                    item_id=s["item_id"],
                    item_name=s["item_name"],
                    store_id=s["store_id"],
                    store_name=s["store_name"],
                    sale_date=date.fromisoformat(s["sale_date"]),
                    original_price=s["original_price"],
                    sale_price=s["sale_price"],
                    discount_percent=s["discount_percent"],
                    deal_type=s.get("deal_type", "regular"),
                )
                self.add_sale(sale)

    def get_stats(self) -> Dict[str, Any]:
        """Get predictor statistics."""
        return {
            "items_tracked": len(self.sales_history),
            "total_sales": sum(len(s) for s in self.sales_history.values()),
            "profiles_created": len(self.item_profiles),
            "cycle_types": {
                ct: sum(
                    1 for p in self.item_profiles.values()
                    if p.cycle_pattern.cycle_type == ct
                )
                for ct in ["weekly", "biweekly", "monthly", "six_week", "irregular"]
            },
        }
