"""
Store Visit Duration Predictor.
Predicts time spent in each store based on contextual features.
"""
from dataclasses import dataclass, field
from datetime import datetime, time
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
import numpy as np
from pathlib import Path
import json


class StoreType(Enum):
    """Types of grocery stores."""
    SUPERMARKET = "supermarket"  # Walmart, Kroger, etc.
    WAREHOUSE = "warehouse"      # Costco, Sam's Club
    DISCOUNT = "discount"        # Aldi, Lidl
    SPECIALTY = "specialty"      # Whole Foods, Trader Joe's
    PHARMACY = "pharmacy"        # CVS, Walgreens
    CONVENIENCE = "convenience"  # 7-Eleven, gas stations


class CrowdLevel(Enum):
    """Store crowd level."""
    EMPTY = 1       # Early morning, late night
    LIGHT = 2       # Off-peak hours
    MODERATE = 3    # Normal busy
    BUSY = 4        # Peak hours
    PACKED = 5      # Weekends, holidays


class DayOfWeek(Enum):
    """Days of the week."""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6


@dataclass
class StoreVisitFeatures:
    """Features for predicting store visit duration."""
    store_type: StoreType
    item_count: int
    day_of_week: DayOfWeek
    hour_of_day: int  # 0-23
    crowd_level: CrowdLevel
    has_list: bool = True
    store_familiarity: float = 0.5  # 0-1, how well user knows store
    needs_deli_counter: bool = False
    needs_pharmacy: bool = False
    has_self_checkout: bool = True
    is_member: bool = False  # For warehouse stores


@dataclass
class VisitDurationPrediction:
    """Prediction result for store visit duration."""
    estimated_minutes: float
    confidence: float
    breakdown: Dict[str, float]  # Time breakdown by activity
    factors: List[str]  # Key factors affecting prediction
    range_min: float  # Lower bound
    range_max: float  # Upper bound


@dataclass
class HistoricalVisit:
    """Historical store visit data for training."""
    store_id: str
    store_type: StoreType
    item_count: int
    actual_duration_minutes: float
    day_of_week: DayOfWeek
    hour_of_day: int
    crowd_level: CrowdLevel
    timestamp: datetime = field(default_factory=datetime.now)


class StoreVisitPredictor:
    """
    ML model to predict store visit duration.

    Uses a combination of:
    - Base duration by store type
    - Item count scaling
    - Crowd level adjustments
    - Time-of-day patterns
    - User familiarity learning
    """

    # Base visit durations by store type (minutes)
    BASE_DURATIONS = {
        StoreType.SUPERMARKET: 25.0,
        StoreType.WAREHOUSE: 45.0,
        StoreType.DISCOUNT: 15.0,
        StoreType.SPECIALTY: 20.0,
        StoreType.PHARMACY: 10.0,
        StoreType.CONVENIENCE: 5.0,
    }

    # Minutes per item by store type
    MINUTES_PER_ITEM = {
        StoreType.SUPERMARKET: 0.8,
        StoreType.WAREHOUSE: 1.2,
        StoreType.DISCOUNT: 0.6,
        StoreType.SPECIALTY: 1.0,
        StoreType.PHARMACY: 0.5,
        StoreType.CONVENIENCE: 0.3,
    }

    # Crowd level multipliers
    CROWD_MULTIPLIERS = {
        CrowdLevel.EMPTY: 0.7,
        CrowdLevel.LIGHT: 0.85,
        CrowdLevel.MODERATE: 1.0,
        CrowdLevel.BUSY: 1.3,
        CrowdLevel.PACKED: 1.6,
    }

    # Peak hours by store type (higher traffic expected)
    PEAK_HOURS = {
        StoreType.SUPERMARKET: [11, 12, 17, 18, 19],
        StoreType.WAREHOUSE: [10, 11, 12, 13, 14],
        StoreType.DISCOUNT: [10, 11, 17, 18],
        StoreType.SPECIALTY: [12, 13, 17, 18],
        StoreType.PHARMACY: [11, 12, 17, 18],
        StoreType.CONVENIENCE: [7, 8, 12, 17, 18],
    }

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize predictor with optional trained model."""
        self.model_path = model_path
        self.historical_data: List[HistoricalVisit] = []
        self.store_adjustments: Dict[str, float] = {}  # Per-store learned adjustments
        self.user_speed_factor: float = 1.0  # User's shopping speed vs average
        self._load_model()

    def _load_model(self) -> None:
        """Load trained model if available."""
        if self.model_path and self.model_path.exists():
            try:
                with open(self.model_path, 'r') as f:
                    data = json.load(f)
                    self.store_adjustments = data.get('store_adjustments', {})
                    self.user_speed_factor = data.get('user_speed_factor', 1.0)
            except (json.JSONDecodeError, IOError):
                pass

    def save_model(self) -> None:
        """Save learned adjustments."""
        if self.model_path:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.model_path, 'w') as f:
                json.dump({
                    'store_adjustments': self.store_adjustments,
                    'user_speed_factor': self.user_speed_factor,
                }, f, indent=2)

    def predict(self, features: StoreVisitFeatures) -> VisitDurationPrediction:
        """
        Predict store visit duration.

        Args:
            features: Store visit features

        Returns:
            Prediction with estimated duration and confidence
        """
        breakdown = {}
        factors = []

        # 1. Base duration for store type
        base = self.BASE_DURATIONS[features.store_type]
        breakdown['base_time'] = base

        # 2. Item count time
        item_time = features.item_count * self.MINUTES_PER_ITEM[features.store_type]
        breakdown['item_time'] = item_time

        # 3. Familiarity adjustment (unfamiliar stores take longer)
        familiarity_multiplier = 1.0 + (0.3 * (1 - features.store_familiarity))
        if features.store_familiarity < 0.5:
            factors.append("Unfamiliar store layout")

        # 4. Crowd level adjustment
        crowd_multiplier = self.CROWD_MULTIPLIERS[features.crowd_level]
        if features.crowd_level in [CrowdLevel.BUSY, CrowdLevel.PACKED]:
            factors.append(f"High crowd level: {features.crowd_level.name}")

        # 5. No list penalty
        list_multiplier = 1.0 if features.has_list else 1.2
        if not features.has_list:
            factors.append("No shopping list")
            breakdown['no_list_penalty'] = (base + item_time) * 0.2

        # 6. Special counter time
        counter_time = 0
        if features.needs_deli_counter:
            counter_time += 8  # Average deli wait
            factors.append("Deli counter stop")
            breakdown['deli_counter'] = 8
        if features.needs_pharmacy:
            counter_time += 12  # Average pharmacy wait
            factors.append("Pharmacy stop")
            breakdown['pharmacy'] = 12

        # 7. Checkout time based on crowd and self-checkout
        if features.has_self_checkout and features.item_count < 20:
            checkout_time = 3 + (features.item_count * 0.15)
            factors.append("Self-checkout available")
        else:
            checkout_base = 5 if features.crowd_level.value <= 2 else 10
            checkout_time = checkout_base + (features.item_count * 0.2)
        checkout_time *= crowd_multiplier
        breakdown['checkout'] = checkout_time

        # 8. Warehouse store member benefits
        if features.store_type == StoreType.WAREHOUSE and features.is_member:
            factors.append("Member access")

        # 9. Time-of-day adjustment (peak hours)
        peak_hours = self.PEAK_HOURS.get(features.store_type, [])
        is_peak = features.hour_of_day in peak_hours
        peak_multiplier = 1.15 if is_peak else 1.0
        if is_peak:
            factors.append("Peak shopping hours")

        # 10. Weekend adjustment
        is_weekend = features.day_of_week in [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]
        weekend_multiplier = 1.2 if is_weekend else 1.0
        if is_weekend:
            factors.append("Weekend shopping")

        # Calculate total
        shopping_time = (base + item_time) * familiarity_multiplier
        total_time = (shopping_time * list_multiplier + counter_time + checkout_time)
        total_time *= crowd_multiplier * peak_multiplier * weekend_multiplier
        total_time *= self.user_speed_factor

        # Apply learned store adjustments
        store_adj = self.store_adjustments.get(features.store_type.value, 1.0)
        total_time *= store_adj

        # Calculate confidence based on data
        confidence = self._calculate_confidence(features)

        # Calculate range
        variance = 0.2 + (0.1 * (1 - confidence))
        range_min = total_time * (1 - variance)
        range_max = total_time * (1 + variance)

        return VisitDurationPrediction(
            estimated_minutes=round(total_time, 1),
            confidence=confidence,
            breakdown=breakdown,
            factors=factors,
            range_min=round(range_min, 1),
            range_max=round(range_max, 1),
        )

    def _calculate_confidence(self, features: StoreVisitFeatures) -> float:
        """Calculate prediction confidence based on available data."""
        base_confidence = 0.7

        # Higher confidence with more historical data
        relevant_visits = [
            v for v in self.historical_data
            if v.store_type == features.store_type
        ]
        data_bonus = min(0.2, len(relevant_visits) * 0.02)

        # Higher confidence with familiar stores
        familiarity_bonus = features.store_familiarity * 0.1

        return min(0.95, base_confidence + data_bonus + familiarity_bonus)

    def train(self, visits: List[HistoricalVisit]) -> Dict[str, Any]:
        """
        Train model on historical visit data.

        Args:
            visits: List of historical store visits

        Returns:
            Training metrics
        """
        self.historical_data.extend(visits)

        if len(visits) < 5:
            return {"status": "insufficient_data", "visits": len(visits)}

        # Calculate prediction errors for each store type
        errors_by_type: Dict[StoreType, List[float]] = {}
        for visit in visits:
            features = StoreVisitFeatures(
                store_type=visit.store_type,
                item_count=visit.item_count,
                day_of_week=visit.day_of_week,
                hour_of_day=visit.hour_of_day,
                crowd_level=visit.crowd_level,
            )

            # Temporarily disable adjustments for training
            old_adj = self.store_adjustments.copy()
            self.store_adjustments = {}
            prediction = self.predict(features)
            self.store_adjustments = old_adj

            error = visit.actual_duration_minutes / prediction.estimated_minutes

            if visit.store_type not in errors_by_type:
                errors_by_type[visit.store_type] = []
            errors_by_type[visit.store_type].append(error)

        # Calculate adjustments
        for store_type, errors in errors_by_type.items():
            if errors:
                # Use median to reduce outlier impact
                adjustment = float(np.median(errors))
                self.store_adjustments[store_type.value] = adjustment

        # Calculate overall user speed factor
        all_errors = [e for errors in errors_by_type.values() for e in errors]
        if all_errors:
            self.user_speed_factor = float(np.median(all_errors))

        self.save_model()

        return {
            "status": "trained",
            "visits_used": len(visits),
            "store_adjustments": self.store_adjustments,
            "user_speed_factor": self.user_speed_factor,
        }

    def log_visit(self, visit: HistoricalVisit) -> None:
        """Log a completed store visit for learning."""
        self.historical_data.append(visit)

        # Retrain if enough new data
        if len(self.historical_data) % 10 == 0:
            self.train(self.historical_data[-20:])

    def get_optimal_time(
        self,
        store_type: StoreType,
        item_count: int,
        day: DayOfWeek
    ) -> Dict[str, Any]:
        """
        Get optimal time to visit a store.

        Args:
            store_type: Type of store
            item_count: Number of items
            day: Day of week

        Returns:
            Optimal visit time recommendation
        """
        hourly_predictions = []

        for hour in range(6, 22):  # 6 AM to 10 PM
            # Estimate crowd level by hour
            peak_hours = self.PEAK_HOURS.get(store_type, [])
            if hour in peak_hours:
                crowd = CrowdLevel.BUSY
            elif hour < 9 or hour > 20:
                crowd = CrowdLevel.LIGHT
            else:
                crowd = CrowdLevel.MODERATE

            features = StoreVisitFeatures(
                store_type=store_type,
                item_count=item_count,
                day_of_week=day,
                hour_of_day=hour,
                crowd_level=crowd,
            )

            prediction = self.predict(features)
            hourly_predictions.append({
                "hour": hour,
                "time_display": f"{hour:02d}:00",
                "estimated_minutes": prediction.estimated_minutes,
                "crowd_level": crowd.name,
            })

        # Find optimal
        optimal = min(hourly_predictions, key=lambda x: x['estimated_minutes'])

        return {
            "optimal_time": optimal['time_display'],
            "optimal_duration": optimal['estimated_minutes'],
            "hourly_breakdown": hourly_predictions,
            "recommendation": f"Best time to visit: {optimal['time_display']} "
                            f"(estimated {optimal['estimated_minutes']:.0f} min)",
        }

    def predict_crowd_level(
        self,
        store_type: StoreType,
        day: DayOfWeek,
        hour: int
    ) -> CrowdLevel:
        """Predict crowd level for a store at a given time."""
        peak_hours = self.PEAK_HOURS.get(store_type, [])
        is_weekend = day in [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]

        if hour in peak_hours:
            base_level = 4
        elif hour < 8 or hour > 20:
            base_level = 1
        elif hour < 10 or hour > 19:
            base_level = 2
        else:
            base_level = 3

        if is_weekend:
            base_level = min(5, base_level + 1)

        return CrowdLevel(base_level)

    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics."""
        visits_by_type = {}
        for visit in self.historical_data:
            key = visit.store_type.value
            if key not in visits_by_type:
                visits_by_type[key] = 0
            visits_by_type[key] += 1

        return {
            "total_historical_visits": len(self.historical_data),
            "visits_by_store_type": visits_by_type,
            "store_adjustments": self.store_adjustments,
            "user_speed_factor": self.user_speed_factor,
        }
