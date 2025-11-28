"""
Savings Validator.
Compares predicted vs actual savings and learns correction factors.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import json


@dataclass
class SavingsRecord:
    """Record of a shopping trip's savings."""
    trip_id: str
    trip_date: date
    stores_visited: List[str]
    predicted_savings: float
    actual_savings: float
    predicted_time: float  # minutes
    actual_time: float
    predicted_distance: float  # miles
    actual_distance: float
    item_count: int
    strategy: str  # single_store, two_store, multi_store


@dataclass
class ValidationResult:
    """Result of savings validation."""
    accuracy: float  # actual/predicted ratio
    deviation: float  # actual - predicted
    deviation_percent: float
    is_accurate: bool  # within acceptable range
    factors: List[str]


@dataclass
class CorrectionFactor:
    """Learned correction factor for predictions."""
    factor_type: str  # store, category, time_of_day, day_of_week
    factor_value: str
    correction_multiplier: float
    sample_size: int
    confidence: float


@dataclass
class ROIAnalysis:
    """ROI analysis for multi-store shopping."""
    period_start: date
    period_end: date
    total_trips: int
    multi_store_trips: int
    single_store_trips: int
    total_predicted_savings: float
    total_actual_savings: float
    total_extra_time: float
    total_extra_distance: float
    effective_hourly_rate: float
    gas_cost: float
    net_roi: float
    recommendation: str


class SavingsValidator:
    """
    ML model to validate and improve savings predictions.

    Features:
    - Compare predicted vs actual savings
    - Learn correction factors
    - Improve future predictions
    - Track ROI of multi-store shopping
    """

    MODEL_VERSION = "1.0.0"

    # Accuracy thresholds
    ACCURATE_THRESHOLD = 0.15  # Within 15% is accurate
    GOOD_ACCURACY_RATE = 0.8  # 80% of predictions should be accurate

    # Default costs
    DEFAULT_GAS_PRICE = 3.50
    DEFAULT_MPG = 25
    DEFAULT_HOURLY_VALUE = 25.0

    def __init__(
        self,
        model_path: Optional[Path] = None,
        gas_price: float = DEFAULT_GAS_PRICE,
        mpg: float = DEFAULT_MPG,
        hourly_value: float = DEFAULT_HOURLY_VALUE,
    ):
        """Initialize validator."""
        self.model_path = model_path
        self.gas_price = gas_price
        self.mpg = mpg
        self.hourly_value = hourly_value

        # Historical data
        self.savings_records: List[SavingsRecord] = []
        self.correction_factors: Dict[str, CorrectionFactor] = {}

        # Aggregated stats
        self.store_accuracy: Dict[str, List[float]] = defaultdict(list)
        self.strategy_accuracy: Dict[str, List[float]] = defaultdict(list)
        self.day_accuracy: Dict[int, List[float]] = defaultdict(list)

        # Overall metrics
        self.total_predictions = 0
        self.accurate_predictions = 0
        self.cumulative_deviation = 0.0

        if model_path and model_path.exists():
            self.load(model_path)

    def validate(
        self,
        predicted_savings: float,
        actual_savings: float,
        stores: List[str],
        trip_date: date,
    ) -> ValidationResult:
        """
        Validate a single savings prediction.

        Args:
            predicted_savings: What we predicted
            actual_savings: What actually happened
            stores: Stores visited
            trip_date: Date of trip

        Returns:
            ValidationResult with accuracy assessment
        """
        if predicted_savings <= 0:
            return ValidationResult(
                accuracy=0.0,
                deviation=actual_savings,
                deviation_percent=0.0,
                is_accurate=False,
                factors=["No predicted savings to compare"],
            )

        # Calculate metrics
        accuracy = actual_savings / predicted_savings if predicted_savings > 0 else 0
        deviation = actual_savings - predicted_savings
        deviation_percent = (deviation / predicted_savings) * 100 if predicted_savings > 0 else 0

        # Determine if accurate
        is_accurate = abs(deviation_percent) <= self.ACCURATE_THRESHOLD * 100

        # Identify factors
        factors = []
        if deviation > 0:
            factors.append(f"Under-predicted by ${deviation:.2f}")
        elif deviation < 0:
            factors.append(f"Over-predicted by ${-deviation:.2f}")

        if accuracy > 1.2:
            factors.append("Additional unadvertised deals found")
        elif accuracy < 0.8:
            factors.append("Some deals may have been out of stock")

        # Track accuracy by store
        for store in stores:
            self.store_accuracy[store].append(accuracy)

        # Track accuracy by day
        self.day_accuracy[trip_date.weekday()].append(accuracy)

        return ValidationResult(
            accuracy=round(accuracy, 3),
            deviation=round(deviation, 2),
            deviation_percent=round(deviation_percent, 1),
            is_accurate=is_accurate,
            factors=factors,
        )

    def record_trip(self, record: SavingsRecord) -> ValidationResult:
        """
        Record a completed trip and validate predictions.

        Args:
            record: Complete trip record

        Returns:
            Validation result
        """
        self.savings_records.append(record)

        # Validate savings
        result = self.validate(
            record.predicted_savings,
            record.actual_savings,
            record.stores_visited,
            record.trip_date,
        )

        # Update overall stats
        self.total_predictions += 1
        if result.is_accurate:
            self.accurate_predictions += 1
        self.cumulative_deviation += result.deviation

        # Track by strategy
        self.strategy_accuracy[record.strategy].append(result.accuracy)

        # Learn correction factors
        self._learn_from_record(record, result)

        return result

    def _learn_from_record(
        self,
        record: SavingsRecord,
        result: ValidationResult,
    ) -> None:
        """Learn correction factors from a trip record."""
        # Store-level corrections
        for store in record.stores_visited:
            self._update_correction_factor(
                f"store:{store}",
                result.accuracy,
            )

        # Strategy-level correction
        self._update_correction_factor(
            f"strategy:{record.strategy}",
            result.accuracy,
        )

        # Day of week correction
        self._update_correction_factor(
            f"day:{record.trip_date.weekday()}",
            result.accuracy,
        )

        # Item count buckets
        if record.item_count <= 10:
            bucket = "small"
        elif record.item_count <= 25:
            bucket = "medium"
        else:
            bucket = "large"
        self._update_correction_factor(
            f"basket:{bucket}",
            result.accuracy,
        )

    def _update_correction_factor(
        self,
        factor_key: str,
        accuracy: float,
    ) -> None:
        """Update or create a correction factor."""
        if factor_key in self.correction_factors:
            cf = self.correction_factors[factor_key]
            # Running average
            total = cf.correction_multiplier * cf.sample_size + accuracy
            cf.sample_size += 1
            cf.correction_multiplier = total / cf.sample_size
            cf.confidence = min(0.95, 0.5 + (cf.sample_size * 0.02))
        else:
            factor_type, factor_value = factor_key.split(":", 1)
            self.correction_factors[factor_key] = CorrectionFactor(
                factor_type=factor_type,
                factor_value=factor_value,
                correction_multiplier=accuracy,
                sample_size=1,
                confidence=0.5,
            )

    def get_correction_factor(
        self,
        stores: List[str],
        strategy: str,
        trip_date: date,
        item_count: int,
    ) -> float:
        """
        Get combined correction factor for a prediction.

        Args:
            stores: Stores to visit
            strategy: Shopping strategy
            trip_date: Planned date
            item_count: Number of items

        Returns:
            Correction multiplier to apply to prediction
        """
        factors = []
        weights = []

        # Store factors
        for store in stores:
            key = f"store:{store}"
            if key in self.correction_factors:
                cf = self.correction_factors[key]
                factors.append(cf.correction_multiplier)
                weights.append(cf.confidence)

        # Strategy factor
        key = f"strategy:{strategy}"
        if key in self.correction_factors:
            cf = self.correction_factors[key]
            factors.append(cf.correction_multiplier)
            weights.append(cf.confidence * 1.5)  # Higher weight

        # Day factor
        key = f"day:{trip_date.weekday()}"
        if key in self.correction_factors:
            cf = self.correction_factors[key]
            factors.append(cf.correction_multiplier)
            weights.append(cf.confidence)

        # Basket size factor
        if item_count <= 10:
            bucket = "small"
        elif item_count <= 25:
            bucket = "medium"
        else:
            bucket = "large"
        key = f"basket:{bucket}"
        if key in self.correction_factors:
            cf = self.correction_factors[key]
            factors.append(cf.correction_multiplier)
            weights.append(cf.confidence)

        if not factors:
            return 1.0  # No correction

        # Weighted average
        total_weight = sum(weights)
        if total_weight == 0:
            return 1.0

        correction = sum(f * w for f, w in zip(factors, weights)) / total_weight
        return round(correction, 3)

    def adjust_prediction(
        self,
        predicted_savings: float,
        stores: List[str],
        strategy: str,
        trip_date: date,
        item_count: int,
    ) -> Dict[str, Any]:
        """
        Adjust a savings prediction using learned corrections.

        Args:
            predicted_savings: Raw prediction
            stores: Stores to visit
            strategy: Shopping strategy
            trip_date: Planned date
            item_count: Number of items

        Returns:
            Adjusted prediction with confidence
        """
        correction = self.get_correction_factor(
            stores, strategy, trip_date, item_count
        )

        adjusted = predicted_savings * correction

        # Calculate confidence based on data quality
        relevant_records = [
            r for r in self.savings_records
            if any(s in r.stores_visited for s in stores)
        ]
        confidence = min(0.9, 0.4 + (len(relevant_records) * 0.05))

        return {
            "original_prediction": round(predicted_savings, 2),
            "adjusted_prediction": round(adjusted, 2),
            "correction_factor": correction,
            "confidence": round(confidence, 3),
            "based_on_samples": len(relevant_records),
            "adjustment_amount": round(adjusted - predicted_savings, 2),
        }

    def analyze_roi(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> ROIAnalysis:
        """
        Analyze ROI of multi-store shopping over a period.

        Args:
            start_date: Period start (default: 30 days ago)
            end_date: Period end (default: today)

        Returns:
            Comprehensive ROI analysis
        """
        today = date.today()
        start = start_date or (today - timedelta(days=30))
        end = end_date or today

        # Filter records in period
        records = [
            r for r in self.savings_records
            if start <= r.trip_date <= end
        ]

        if not records:
            return ROIAnalysis(
                period_start=start,
                period_end=end,
                total_trips=0,
                multi_store_trips=0,
                single_store_trips=0,
                total_predicted_savings=0,
                total_actual_savings=0,
                total_extra_time=0,
                total_extra_distance=0,
                effective_hourly_rate=0,
                gas_cost=0,
                net_roi=0,
                recommendation="Insufficient data",
            )

        # Calculate totals
        multi_store = [r for r in records if r.strategy in ["two_store", "multi_store"]]
        single_store = [r for r in records if r.strategy == "single_store"]

        total_predicted = sum(r.predicted_savings for r in multi_store)
        total_actual = sum(r.actual_savings for r in multi_store)
        total_extra_time = sum(r.actual_time - 30 for r in multi_store)  # Baseline 30 min
        total_extra_distance = sum(r.actual_distance for r in multi_store)

        # Calculate costs
        gas_cost = (total_extra_distance / self.mpg) * self.gas_price
        time_cost = (total_extra_time / 60) * self.hourly_value

        # Net ROI
        net_roi = total_actual - gas_cost

        # Effective hourly rate
        if total_extra_time > 0:
            hourly_rate = (net_roi / total_extra_time) * 60
        else:
            hourly_rate = 0

        # Generate recommendation
        if net_roi <= 0:
            recommendation = "Multi-store shopping has negative ROI - consider single store"
        elif hourly_rate < 15:
            recommendation = f"Low efficiency (${hourly_rate:.2f}/hr) - reduce store count"
        elif hourly_rate > 30:
            recommendation = f"Excellent efficiency (${hourly_rate:.2f}/hr) - continue strategy"
        else:
            recommendation = f"Good efficiency (${hourly_rate:.2f}/hr) - maintain current approach"

        return ROIAnalysis(
            period_start=start,
            period_end=end,
            total_trips=len(records),
            multi_store_trips=len(multi_store),
            single_store_trips=len(single_store),
            total_predicted_savings=round(total_predicted, 2),
            total_actual_savings=round(total_actual, 2),
            total_extra_time=round(total_extra_time, 0),
            total_extra_distance=round(total_extra_distance, 1),
            effective_hourly_rate=round(hourly_rate, 2),
            gas_cost=round(gas_cost, 2),
            net_roi=round(net_roi, 2),
            recommendation=recommendation,
        )

    def get_accuracy_trend(
        self,
        window_size: int = 10,
    ) -> Dict[str, Any]:
        """
        Get accuracy trend over recent predictions.

        Args:
            window_size: Number of recent records to analyze

        Returns:
            Trend analysis
        """
        if len(self.savings_records) < 2:
            return {
                "trend": "insufficient_data",
                "current_accuracy": 0,
                "improvement": 0,
            }

        recent = self.savings_records[-window_size:]
        older = self.savings_records[:-window_size] if len(self.savings_records) > window_size else []

        # Calculate accuracies
        recent_accuracies = [
            r.actual_savings / r.predicted_savings
            for r in recent
            if r.predicted_savings > 0
        ]
        recent_avg = np.mean(recent_accuracies) if recent_accuracies else 0

        if older:
            older_accuracies = [
                r.actual_savings / r.predicted_savings
                for r in older
                if r.predicted_savings > 0
            ]
            older_avg = np.mean(older_accuracies) if older_accuracies else 0
        else:
            older_avg = recent_avg

        # Calculate improvement
        improvement = recent_avg - older_avg

        if improvement > 0.05:
            trend = "improving"
        elif improvement < -0.05:
            trend = "declining"
        else:
            trend = "stable"

        return {
            "trend": trend,
            "current_accuracy": round(recent_avg, 3),
            "previous_accuracy": round(older_avg, 3),
            "improvement": round(improvement, 3),
            "samples_analyzed": len(recent),
        }

    def get_store_performance(self) -> Dict[str, Any]:
        """Get accuracy performance by store."""
        performance = {}

        for store, accuracies in self.store_accuracy.items():
            if len(accuracies) >= 3:
                avg_accuracy = np.mean(accuracies)
                std_accuracy = np.std(accuracies)

                performance[store] = {
                    "average_accuracy": round(avg_accuracy, 3),
                    "consistency": round(1 - std_accuracy, 3),
                    "sample_size": len(accuracies),
                    "reliability": "high" if avg_accuracy > 0.9 and std_accuracy < 0.2 else "medium" if avg_accuracy > 0.8 else "low",
                }

        # Sort by accuracy
        return dict(
            sorted(
                performance.items(),
                key=lambda x: x[1]["average_accuracy"],
                reverse=True,
            )
        )

    def get_strategy_performance(self) -> Dict[str, Any]:
        """Get accuracy performance by shopping strategy."""
        performance = {}

        for strategy, accuracies in self.strategy_accuracy.items():
            if accuracies:
                avg_accuracy = np.mean(accuracies)

                performance[strategy] = {
                    "average_accuracy": round(avg_accuracy, 3),
                    "sample_size": len(accuracies),
                    "recommended": avg_accuracy > 0.85,
                }

        return performance

    def save(self, path: Path) -> None:
        """Save validator state."""
        def date_serializer(obj):
            if isinstance(obj, date):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        data = {
            "version": self.MODEL_VERSION,
            "total_predictions": self.total_predictions,
            "accurate_predictions": self.accurate_predictions,
            "cumulative_deviation": self.cumulative_deviation,
            "correction_factors": {
                k: {
                    "factor_type": cf.factor_type,
                    "factor_value": cf.factor_value,
                    "correction_multiplier": cf.correction_multiplier,
                    "sample_size": cf.sample_size,
                    "confidence": cf.confidence,
                }
                for k, cf in self.correction_factors.items()
            },
            "store_accuracy": {k: list(v) for k, v in self.store_accuracy.items()},
            "strategy_accuracy": {k: list(v) for k, v in self.strategy_accuracy.items()},
            "savings_records": [
                {
                    "trip_id": r.trip_id,
                    "trip_date": r.trip_date.isoformat(),
                    "stores_visited": r.stores_visited,
                    "predicted_savings": r.predicted_savings,
                    "actual_savings": r.actual_savings,
                    "predicted_time": r.predicted_time,
                    "actual_time": r.actual_time,
                    "predicted_distance": r.predicted_distance,
                    "actual_distance": r.actual_distance,
                    "item_count": r.item_count,
                    "strategy": r.strategy,
                }
                for r in self.savings_records
            ],
        }

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=date_serializer)

    def load(self, path: Path) -> None:
        """Load validator state."""
        with open(path, "r") as f:
            data = json.load(f)

        self.total_predictions = data.get("total_predictions", 0)
        self.accurate_predictions = data.get("accurate_predictions", 0)
        self.cumulative_deviation = data.get("cumulative_deviation", 0.0)

        # Load correction factors
        for k, cf_data in data.get("correction_factors", {}).items():
            self.correction_factors[k] = CorrectionFactor(
                factor_type=cf_data["factor_type"],
                factor_value=cf_data["factor_value"],
                correction_multiplier=cf_data["correction_multiplier"],
                sample_size=cf_data["sample_size"],
                confidence=cf_data["confidence"],
            )

        # Load accuracy tracking
        self.store_accuracy = defaultdict(list, data.get("store_accuracy", {}))
        self.strategy_accuracy = defaultdict(list, data.get("strategy_accuracy", {}))

        # Load savings records
        for r_data in data.get("savings_records", []):
            self.savings_records.append(SavingsRecord(
                trip_id=r_data["trip_id"],
                trip_date=date.fromisoformat(r_data["trip_date"]),
                stores_visited=r_data["stores_visited"],
                predicted_savings=r_data["predicted_savings"],
                actual_savings=r_data["actual_savings"],
                predicted_time=r_data["predicted_time"],
                actual_time=r_data["actual_time"],
                predicted_distance=r_data["predicted_distance"],
                actual_distance=r_data["actual_distance"],
                item_count=r_data["item_count"],
                strategy=r_data["strategy"],
            ))

    def get_stats(self) -> Dict[str, Any]:
        """Get validator statistics."""
        accuracy_rate = (
            self.accurate_predictions / self.total_predictions
            if self.total_predictions > 0
            else 0
        )

        return {
            "total_predictions": self.total_predictions,
            "accurate_predictions": self.accurate_predictions,
            "accuracy_rate": round(accuracy_rate, 3),
            "average_deviation": round(
                self.cumulative_deviation / max(1, self.total_predictions), 2
            ),
            "correction_factors_learned": len(self.correction_factors),
            "stores_tracked": len(self.store_accuracy),
            "meets_target": accuracy_rate >= self.GOOD_ACCURACY_RATE,
        }
