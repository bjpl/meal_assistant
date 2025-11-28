"""
Enhanced Pattern Recommender v2 - Context-Aware ML Model.
Extends the 10-feature model to 17 features for improved accuracy.

New contextual features:
- Weather variations (sunny/rainy/cold/hot)
- Calendar events (holidays, special occasions)
- Social plans (lunch/dinner with others)
- Stress level (user-reported, 1-5)
- Sleep quality (1-5)
- Previous day outcome (success/partial/fail)
- Pattern fatigue (days since variety)
"""
import pickle
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.model_selection import cross_val_score, GridSearchCV
    from sklearn.calibration import CalibratedClassifierCV
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    LabelEncoder = None
    StandardScaler = None

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.data.models import (
    PatternType, DailyContext, DayType, WeatherCondition,
    StressLevel, ActivityLevel, Prediction, PATTERN_CONFIGS
)


class SleepQuality:
    """Sleep quality levels."""
    POOR = 1
    FAIR = 2
    GOOD = 3
    VERY_GOOD = 4
    EXCELLENT = 5


class PreviousDayOutcome:
    """Outcome of previous day's pattern."""
    SUCCESS = "success"       # adherence >= 0.85
    PARTIAL = "partial"       # 0.5 <= adherence < 0.85
    FAIL = "fail"             # adherence < 0.5
    UNKNOWN = "unknown"


@dataclass
class ContextualFeatures:
    """Extended contextual features for pattern recommendation."""
    # Base features (from v1)
    date: date
    day_type: DayType = DayType.WEEKDAY
    weather: WeatherCondition = WeatherCondition.SUNNY
    stress_level: StressLevel = StressLevel.MODERATE
    activity_level: ActivityLevel = ActivityLevel.MODERATE
    has_morning_workout: bool = False
    has_evening_social: bool = False

    # New contextual features
    has_calendar_event: bool = False
    event_type: str = "none"  # meeting, celebration, appointment
    has_social_lunch: bool = False
    has_social_dinner: bool = False
    sleep_quality: int = 3  # 1-5
    sleep_hours: float = 7.0

    # Previous day context
    prev_pattern: Optional[PatternType] = None
    prev_adherence: float = 0.8
    prev_energy: int = 3
    prev_day_outcome: str = PreviousDayOutcome.SUCCESS

    # Pattern history
    days_since_pattern_change: int = 1
    pattern_fatigue_score: float = 0.0  # 0-1, higher = more fatigue
    recent_pattern_variety: int = 3  # unique patterns in last 7 days


@dataclass
class PatternRecommendationV2:
    """Enhanced pattern recommendation with confidence and explanation."""
    pattern: PatternType
    probability: float
    confidence: float  # Calibrated confidence
    reasoning: List[str]
    rank: int
    context_factors: Dict[str, float]  # Feature importance for this prediction
    suggested_modifications: List[str]  # Suggested tweaks to improve success


class PatternRecommenderV2:
    """
    Enhanced ML model with 17 contextual features.

    Features:
    1. day_of_week (0-6)
    2. day_type (weekday/weekend/holiday/wfh)
    3. weather (sunny/cloudy/rainy/hot/cold)
    4. stress_level (1-4)
    5. activity_level (sedentary to very_active)
    6. has_morning_workout (bool)
    7. has_evening_social (bool)
    8. has_calendar_event (bool)
    9. has_social_lunch (bool)
    10. has_social_dinner (bool)
    11. sleep_quality (1-5)
    12. sleep_hours (normalized)
    13. prev_pattern (encoded)
    14. prev_adherence (0-1)
    15. prev_energy (normalized 0-1)
    16. prev_day_outcome (encoded)
    17. pattern_fatigue_score (0-1)

    Target: 90%+ recommendation accuracy
    """

    MODEL_VERSION = "2.0.0"
    TARGET_ACCURACY = 0.90

    FEATURE_NAMES = [
        "day_of_week",
        "day_type",
        "weather",
        "stress_level",
        "activity_level",
        "has_morning_workout",
        "has_evening_social",
        "has_calendar_event",
        "has_social_lunch",
        "has_social_dinner",
        "sleep_quality",
        "sleep_hours",
        "prev_pattern",
        "prev_adherence",
        "prev_energy",
        "prev_day_outcome",
        "pattern_fatigue_score",
    ]

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize the enhanced recommender."""
        self.model: Optional[Any] = None
        self.calibrated_model: Optional[Any] = None
        self.is_fitted = False
        self.model_path = model_path
        self.training_accuracy = 0.0
        self.feature_importances: Dict[str, float] = {}

        # Initialize encoders
        self._init_encoders()

        # Load model if path provided
        if model_path and Path(model_path).exists():
            self.load(model_path)

    def _init_encoders(self) -> None:
        """Initialize label encoders for categorical features."""
        self.scaler = StandardScaler() if SKLEARN_AVAILABLE else SimpleScaler()

        # Categorical encoders
        self.day_type_map = {dt.value: i for i, dt in enumerate(DayType)}
        self.weather_map = {w.value: i for i, w in enumerate(WeatherCondition)}
        self.activity_map = {a.value: i for i, a in enumerate(ActivityLevel)}
        self.pattern_map = {p.value: i for i, p in enumerate(PatternType)}
        self.outcome_map = {
            PreviousDayOutcome.SUCCESS: 2,
            PreviousDayOutcome.PARTIAL: 1,
            PreviousDayOutcome.FAIL: 0,
            PreviousDayOutcome.UNKNOWN: 1,
        }

        # Pattern decoder
        self.patterns = list(PatternType)

    def _extract_features(self, context: ContextualFeatures) -> np.ndarray:
        """Extract 17-feature vector from contextual features."""
        features = [
            context.date.weekday(),
            self.day_type_map.get(context.day_type.value, 0),
            self.weather_map.get(context.weather.value, 0),
            context.stress_level.value,
            self.activity_map.get(context.activity_level.value, 2),
            int(context.has_morning_workout),
            int(context.has_evening_social),
            int(context.has_calendar_event),
            int(context.has_social_lunch),
            int(context.has_social_dinner),
            context.sleep_quality / 5.0,  # Normalize to 0-1
            min(context.sleep_hours / 10.0, 1.0),  # Normalize, cap at 10h
            self.pattern_map.get(
                (context.prev_pattern or PatternType.TRADITIONAL).value, 0
            ),
            context.prev_adherence,
            context.prev_energy / 5.0,  # Normalize to 0-1
            self.outcome_map.get(context.prev_day_outcome, 1),
            context.pattern_fatigue_score,
        ]
        return np.array(features).reshape(1, -1)

    def _calculate_pattern_fatigue(
        self,
        recent_patterns: List[PatternType],
        current_pattern: PatternType,
    ) -> float:
        """
        Calculate pattern fatigue score (0-1).

        Higher score = more likely to need a change.
        """
        if not recent_patterns:
            return 0.0

        # Count consecutive days on same pattern
        consecutive = 0
        for p in reversed(recent_patterns):
            if p == current_pattern:
                consecutive += 1
            else:
                break

        # Calculate variety score
        unique_patterns = len(set(recent_patterns[-7:]))  # Last 7 days
        max_patterns = min(7, len(PatternType))
        variety_score = unique_patterns / max_patterns

        # Fatigue increases with consecutive days, decreases with variety
        # Max fatigue at 5+ consecutive days
        consecutive_factor = min(consecutive / 5.0, 1.0)

        # Low variety (1-2 patterns) increases fatigue
        low_variety_factor = max(0, 1 - (variety_score * 2))

        fatigue = (consecutive_factor * 0.6 + low_variety_factor * 0.4)
        return min(1.0, fatigue)

    def _generate_reasoning(
        self,
        pattern: PatternType,
        context: ContextualFeatures,
        feature_contributions: Dict[str, float],
    ) -> List[str]:
        """Generate human-readable reasoning for recommendation."""
        reasons = []
        config = PATTERN_CONFIGS[pattern]

        # Context-based reasoning
        if context.has_morning_workout and pattern == PatternType.BIG_BREAKFAST:
            reasons.append("Big breakfast supports morning workout recovery")

        if context.has_social_dinner and pattern in [PatternType.IF_NOON, PatternType.MORNING_FEAST]:
            reasons.append("Early eating window leaves flexibility for social dinner")

        if context.has_social_lunch and pattern != PatternType.IF_NOON:
            reasons.append("Pattern accommodates social lunch commitment")

        if context.sleep_quality <= 2:
            if pattern in [PatternType.GRAZING_4_MEALS, PatternType.BIG_BREAKFAST]:
                reasons.append("Smaller, frequent meals help with low energy from poor sleep")

        if context.stress_level.value >= 3:
            if pattern == PatternType.GRAZING_4_MEALS:
                reasons.append("Frequent mini-meals help manage stress-related hunger")
            elif pattern == PatternType.GRAZING_PLATTER:
                reasons.append("Flexible platter reduces mealtime decision stress")

        if context.pattern_fatigue_score > 0.5:
            reasons.append("Variety helps prevent pattern burnout")

        if context.day_type == DayType.WEEKEND:
            if pattern == PatternType.GRAZING_PLATTER:
                reasons.append("Platter grazing fits relaxed weekend schedule")
            elif pattern == PatternType.IF_NOON:
                reasons.append("Late start works well for weekend sleep-in")

        if context.day_type == DayType.WORK_FROM_HOME:
            if pattern == PatternType.GRAZING_PLATTER:
                reasons.append("WFH allows flexible platter access throughout day")

        if context.weather == WeatherCondition.COLD:
            if pattern == PatternType.TRADITIONAL:
                reasons.append("Warm soup breakfast ideal for cold weather")

        if context.weather == WeatherCondition.HOT:
            if pattern == PatternType.IF_NOON:
                reasons.append("Skipping breakfast may feel better in hot weather")

        # Previous day context
        if context.prev_day_outcome == PreviousDayOutcome.FAIL:
            reasons.append("Simplified pattern after challenging previous day")

        if context.prev_adherence < 0.6 and pattern != context.prev_pattern:
            reasons.append("Pattern change may improve adherence")

        # Feature contribution-based reasoning
        top_features = sorted(
            feature_contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:3]

        for feature, contribution in top_features:
            if contribution > 0.1:
                readable_name = feature.replace("_", " ")
                reasons.append(f"Strong positive signal from {readable_name}")

        # Default reasoning if nothing specific
        if not reasons:
            pattern_reasons = {
                PatternType.TRADITIONAL: ["Standard 3-meal structure provides consistent energy"],
                PatternType.REVERSED: ["Heavy dinner option for evening preference"],
                PatternType.IF_NOON: ["Intermittent fasting supports metabolic flexibility"],
                PatternType.GRAZING_4_MEALS: ["Mini-meals prevent energy dips"],
                PatternType.GRAZING_PLATTER: ["Visual variety and eating freedom"],
                PatternType.BIG_BREAKFAST: ["Front-loaded calories for morning energy"],
                PatternType.MORNING_FEAST: ["Completes eating early, long overnight fast"],
            }
            reasons = pattern_reasons.get(pattern, ["Based on historical success patterns"])

        return reasons[:5]  # Limit to 5 reasons

    def _generate_modifications(
        self,
        pattern: PatternType,
        context: ContextualFeatures,
        probability: float,
    ) -> List[str]:
        """Generate suggested modifications to improve success."""
        suggestions = []

        if probability < 0.7:
            suggestions.append("Consider starting with smaller portions if unsure")

        if context.stress_level.value >= 3:
            suggestions.append("Pre-prep meals to reduce decision fatigue")

        if context.sleep_quality <= 2:
            suggestions.append("Allow flexibility in timing today")

        if context.has_social_dinner:
            if pattern == PatternType.TRADITIONAL:
                suggestions.append("Keep dinner lighter; focus protein at lunch")

        if context.pattern_fatigue_score > 0.6:
            suggestions.append("Even small variations (new recipes) help with fatigue")

        if context.has_morning_workout:
            suggestions.append("Ensure pre-workout hydration and post-workout protein")

        return suggestions[:3]

    def fit(
        self,
        X: List[Dict[str, Any]],
        y: List[PatternType],
        **kwargs
    ) -> "PatternRecommenderV2":
        """
        Train the enhanced model on historical data.

        Args:
            X: List of feature dictionaries with extended context
            y: List of successful pattern types
            **kwargs: Additional arguments for the classifier
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for training")

        # Convert to feature matrix
        X_matrix = []
        for record in X:
            context = ContextualFeatures(
                date=record.get("date", date.today()),
                day_type=DayType(record.get("day_type", "weekday")),
                weather=WeatherCondition(record.get("weather", "sunny")),
                stress_level=StressLevel(record.get("stress_level", 2)),
                activity_level=ActivityLevel(record.get("activity_level", "moderate")),
                has_morning_workout=record.get("has_morning_workout", False),
                has_evening_social=record.get("has_evening_social", False),
                has_calendar_event=record.get("has_calendar_event", False),
                has_social_lunch=record.get("has_social_lunch", False),
                has_social_dinner=record.get("has_social_dinner", False),
                sleep_quality=record.get("sleep_quality", 3),
                sleep_hours=record.get("sleep_hours", 7.0),
                prev_pattern=PatternType(record.get("prev_pattern", "traditional")),
                prev_adherence=record.get("prev_adherence", 0.8),
                prev_energy=record.get("prev_energy", 3),
                prev_day_outcome=record.get("prev_day_outcome", PreviousDayOutcome.SUCCESS),
                pattern_fatigue_score=record.get("pattern_fatigue_score", 0.0),
            )
            features = self._extract_features(context)
            X_matrix.append(features.flatten())

        X_array = np.array(X_matrix)
        y_encoded = [self.pattern_map[p.value] for p in y]

        # Scale features
        X_scaled = self.scaler.fit_transform(X_array)

        # Train with hyperparameter tuning
        base_model = GradientBoostingClassifier(random_state=42)

        param_grid = {
            "n_estimators": [100, 150, 200],
            "max_depth": [4, 5, 6],
            "learning_rate": [0.05, 0.1, 0.15],
            "min_samples_split": [2, 5, 10],
        }

        # Use GridSearchCV for hyperparameter tuning
        grid_search = GridSearchCV(
            base_model,
            param_grid,
            cv=min(5, len(X) // 2),
            scoring="accuracy",
            n_jobs=-1,
        )
        grid_search.fit(X_scaled, y_encoded)

        self.model = grid_search.best_estimator_
        self.training_accuracy = grid_search.best_score_

        # Calibrate probabilities for better confidence scores
        self.calibrated_model = CalibratedClassifierCV(
            self.model, cv=3, method="isotonic"
        )
        self.calibrated_model.fit(X_scaled, y_encoded)

        # Store feature importances
        self.feature_importances = dict(
            zip(self.FEATURE_NAMES, self.model.feature_importances_.tolist())
        )

        self.is_fitted = True

        return self

    def predict(
        self,
        context: ContextualFeatures,
        top_k: int = 3,
        include_all: bool = False,
    ) -> List[PatternRecommendationV2]:
        """
        Predict top-k pattern recommendations.

        Args:
            context: Current day's contextual features
            top_k: Number of recommendations to return
            include_all: Include all patterns with probabilities

        Returns:
            List of PatternRecommendationV2 sorted by probability
        """
        features = self._extract_features(context)

        if self.is_fitted and self.calibrated_model is not None:
            features_scaled = self.scaler.transform(features)
            probabilities = self.calibrated_model.predict_proba(features_scaled)[0]

            # Calculate per-prediction feature contributions
            # Using feature importance as proxy
            feature_contributions = self.feature_importances.copy()
        else:
            # Fallback to rule-based
            probabilities = self._rule_based_scores(context)
            feature_contributions = {f: 0.0 for f in self.FEATURE_NAMES}

        # Build recommendations
        pattern_probs = list(zip(self.patterns, probabilities))
        pattern_probs.sort(key=lambda x: x[1], reverse=True)

        if not include_all:
            pattern_probs = pattern_probs[:top_k]

        recommendations = []
        for rank, (pattern, prob) in enumerate(pattern_probs, 1):
            # Calculate confidence (probability spread)
            confidence = self._calculate_confidence(probabilities, prob)

            recommendations.append(PatternRecommendationV2(
                pattern=pattern,
                probability=float(prob),
                confidence=confidence,
                reasoning=self._generate_reasoning(pattern, context, feature_contributions),
                rank=rank,
                context_factors=feature_contributions,
                suggested_modifications=self._generate_modifications(pattern, context, prob),
            ))

        return recommendations

    def _calculate_confidence(
        self,
        all_probs: np.ndarray,
        selected_prob: float,
    ) -> float:
        """Calculate confidence based on probability distribution."""
        # Higher confidence when one pattern clearly dominates
        sorted_probs = sorted(all_probs, reverse=True)

        if len(sorted_probs) < 2:
            return 0.5

        # Gap between top choice and second
        gap = sorted_probs[0] - sorted_probs[1]

        # Confidence increases with gap and absolute probability
        confidence = (selected_prob * 0.5) + (gap * 0.5)
        return min(0.95, max(0.3, confidence))

    def _rule_based_scores(
        self,
        context: ContextualFeatures,
    ) -> List[float]:
        """Generate rule-based scores when model not trained."""
        scores = {p: 0.14 for p in PatternType}  # Base equal probability

        # Morning workout boosts
        if context.has_morning_workout:
            scores[PatternType.BIG_BREAKFAST] += 0.2
            scores[PatternType.TRADITIONAL] += 0.1

        # Social events
        if context.has_social_dinner:
            scores[PatternType.IF_NOON] += 0.15
            scores[PatternType.MORNING_FEAST] += 0.2
            scores[PatternType.REVERSED] -= 0.1

        if context.has_social_lunch:
            scores[PatternType.TRADITIONAL] += 0.1
            scores[PatternType.REVERSED] += 0.1

        # Weekend/WFH flexibility
        if context.day_type in [DayType.WEEKEND, DayType.WORK_FROM_HOME]:
            scores[PatternType.GRAZING_PLATTER] += 0.2
            scores[PatternType.GRAZING_4_MEALS] += 0.1

        # Stress management
        if context.stress_level.value >= 3:
            scores[PatternType.GRAZING_4_MEALS] += 0.15
            scores[PatternType.GRAZING_PLATTER] += 0.1

        # Poor sleep
        if context.sleep_quality <= 2:
            scores[PatternType.GRAZING_4_MEALS] += 0.1
            scores[PatternType.BIG_BREAKFAST] += 0.1
            scores[PatternType.IF_NOON] -= 0.1

        # Pattern fatigue
        if context.pattern_fatigue_score > 0.5:
            # Reduce score for current pattern, boost alternatives
            if context.prev_pattern:
                scores[context.prev_pattern] -= 0.2

        # Activity level
        if context.activity_level in [ActivityLevel.VERY_ACTIVE, ActivityLevel.ACTIVE]:
            scores[PatternType.TRADITIONAL] += 0.1
            scores[PatternType.BIG_BREAKFAST] += 0.1

        # Previous day outcome
        if context.prev_day_outcome == PreviousDayOutcome.FAIL:
            # Suggest simpler patterns
            scores[PatternType.TRADITIONAL] += 0.1
            scores[PatternType.GRAZING_PLATTER] += 0.1

        # Normalize to sum to 1
        total = sum(scores.values())
        return [scores[p] / total for p in self.patterns]

    def predict_with_alternatives(
        self,
        context: ContextualFeatures,
    ) -> Dict[str, Any]:
        """
        Get recommendation with alternatives for different scenarios.

        Returns main recommendation plus alternatives for:
        - If social plans change
        - If energy is lower than expected
        - If time is limited
        """
        main_rec = self.predict(context, top_k=3)

        # Alternative scenarios
        alternatives = {}

        # If social dinner gets cancelled
        if context.has_social_dinner:
            alt_context = ContextualFeatures(
                **{**context.__dict__, "has_social_dinner": False}
            )
            alternatives["no_social_dinner"] = self.predict(alt_context, top_k=1)[0]

        # If energy drops
        low_energy_context = ContextualFeatures(
            **{**context.__dict__, "prev_energy": 2, "sleep_quality": 2}
        )
        alternatives["low_energy"] = self.predict(low_energy_context, top_k=1)[0]

        # Quick/simple option
        simple_context = ContextualFeatures(
            **{**context.__dict__, "stress_level": StressLevel.HIGH}
        )
        alternatives["time_limited"] = self.predict(simple_context, top_k=1)[0]

        return {
            "primary": main_rec[0],
            "secondary": main_rec[1:],
            "alternatives": alternatives,
        }

    def evaluate(
        self,
        X: List[Dict[str, Any]],
        y: List[PatternType],
        cv: int = 5,
    ) -> Dict[str, float]:
        """Evaluate model using cross-validation."""
        if not self.is_fitted:
            raise ValueError("Model must be fitted before evaluation")

        X_matrix = []
        for record in X:
            context = ContextualFeatures(
                date=record.get("date", date.today()),
                day_type=DayType(record.get("day_type", "weekday")),
                weather=WeatherCondition(record.get("weather", "sunny")),
                stress_level=StressLevel(record.get("stress_level", 2)),
                activity_level=ActivityLevel(record.get("activity_level", "moderate")),
                has_morning_workout=record.get("has_morning_workout", False),
                has_evening_social=record.get("has_evening_social", False),
                has_calendar_event=record.get("has_calendar_event", False),
                has_social_lunch=record.get("has_social_lunch", False),
                has_social_dinner=record.get("has_social_dinner", False),
                sleep_quality=record.get("sleep_quality", 3),
                sleep_hours=record.get("sleep_hours", 7.0),
                prev_pattern=PatternType(record.get("prev_pattern", "traditional")),
                prev_adherence=record.get("prev_adherence", 0.8),
                prev_energy=record.get("prev_energy", 3),
                prev_day_outcome=record.get("prev_day_outcome", PreviousDayOutcome.SUCCESS),
                pattern_fatigue_score=record.get("pattern_fatigue_score", 0.0),
            )
            features = self._extract_features(context)
            X_matrix.append(features.flatten())

        X_array = np.array(X_matrix)
        X_scaled = self.scaler.transform(X_array)
        y_encoded = [self.pattern_map[p.value] for p in y]

        scores = cross_val_score(self.model, X_scaled, y_encoded, cv=cv)

        return {
            "accuracy_mean": float(np.mean(scores)),
            "accuracy_std": float(np.std(scores)),
            "meets_target": float(np.mean(scores)) >= self.TARGET_ACCURACY,
            "cv_folds": cv,
            "model_version": self.MODEL_VERSION,
            "feature_count": len(self.FEATURE_NAMES),
        }

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores."""
        return self.feature_importances

    def save(self, path: Path) -> None:
        """Save model to disk."""
        model_data = {
            "model": self.model,
            "calibrated_model": self.calibrated_model,
            "scaler": self.scaler,
            "is_fitted": self.is_fitted,
            "version": self.MODEL_VERSION,
            "feature_importances": self.feature_importances,
            "training_accuracy": self.training_accuracy,
        }
        with open(path, "wb") as f:
            pickle.dump(model_data, f)

    def load(self, path: Path) -> None:
        """Load model from disk."""
        with open(path, "rb") as f:
            model_data = pickle.load(f)

        self.model = model_data["model"]
        self.calibrated_model = model_data.get("calibrated_model")
        self.scaler = model_data["scaler"]
        self.is_fitted = model_data["is_fitted"]
        self.feature_importances = model_data.get("feature_importances", {})
        self.training_accuracy = model_data.get("training_accuracy", 0.0)


class SimpleScaler:
    """Simple standard scaler fallback when sklearn not available."""

    def __init__(self):
        self.mean_ = None
        self.std_ = None

    def fit_transform(self, X):
        self.mean_ = np.mean(X, axis=0)
        self.std_ = np.std(X, axis=0)
        self.std_[self.std_ == 0] = 1
        return (X - self.mean_) / self.std_

    def transform(self, X):
        if self.mean_ is None:
            return X
        return (X - self.mean_) / self.std_
