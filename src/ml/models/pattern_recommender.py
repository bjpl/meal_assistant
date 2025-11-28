"""
Pattern Recommender ML Model.
Recommends optimal eating patterns based on context using Gradient Boosting.
"""
import pickle
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.model_selection import cross_val_score
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


class SimpleLabelEncoder:
    """Simple label encoder fallback when sklearn not available."""

    def __init__(self):
        self.classes_ = []
        self._mapping = {}

    def fit(self, values):
        self.classes_ = sorted(set(values))
        self._mapping = {v: i for i, v in enumerate(self.classes_)}
        return self

    def transform(self, values):
        return [self._mapping.get(v, 0) for v in values]

    def inverse_transform(self, indices):
        return [self.classes_[i] for i in indices]


class SimpleScaler:
    """Simple standard scaler fallback when sklearn not available."""

    def __init__(self):
        self.mean_ = None
        self.std_ = None

    def fit_transform(self, X):
        self.mean_ = np.mean(X, axis=0)
        self.std_ = np.std(X, axis=0)
        self.std_[self.std_ == 0] = 1  # Avoid division by zero
        return (X - self.mean_) / self.std_

    def transform(self, X):
        if self.mean_ is None:
            return X
        return (X - self.mean_) / self.std_


@dataclass
class PatternRecommendation:
    """A pattern recommendation with probability."""
    pattern: PatternType
    probability: float
    reasoning: List[str]
    rank: int


class PatternRecommender:
    """
    ML model to recommend eating patterns based on daily context.

    Features used:
    - Day of week (0-6)
    - Day type (weekday/weekend/holiday/wfh)
    - Weather condition
    - Stress level (1-4)
    - Activity level
    - Has morning workout (bool)
    - Has evening social (bool)
    - Previous day's pattern
    - Previous day's adherence score
    - Previous day's energy rating

    Output:
    - Ranked list of pattern recommendations with probabilities
    """

    MODEL_VERSION = "1.0.0"
    FEATURE_NAMES = [
        "day_of_week",
        "day_type",
        "weather",
        "stress_level",
        "activity_level",
        "has_morning_workout",
        "has_evening_social",
        "prev_pattern",
        "prev_adherence",
        "prev_energy",
    ]

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize the recommender."""
        self.model: Optional[Any] = None
        self.is_fitted = False
        self.model_path = model_path

        # Use sklearn encoders if available, otherwise fallback
        EncoderClass = LabelEncoder if SKLEARN_AVAILABLE else SimpleLabelEncoder
        ScalerClass = StandardScaler if SKLEARN_AVAILABLE else SimpleScaler

        self.label_encoder = EncoderClass()
        self.scaler = ScalerClass()

        # Encoders for categorical features
        self.day_type_encoder = EncoderClass()
        self.weather_encoder = EncoderClass()
        self.activity_encoder = EncoderClass()
        self.pattern_encoder = EncoderClass()

        # Fit encoders with all possible values
        self._fit_encoders()

        if model_path and Path(model_path).exists():
            self.load(model_path)

    def _fit_encoders(self) -> None:
        """Pre-fit label encoders with all enum values."""
        self.day_type_encoder.fit([dt.value for dt in DayType])
        self.weather_encoder.fit([w.value for w in WeatherCondition])
        self.activity_encoder.fit([a.value for a in ActivityLevel])
        self.pattern_encoder.fit([p.value for p in PatternType])

    def _extract_features(
        self,
        context: DailyContext,
        prev_pattern: Optional[PatternType] = None,
        prev_adherence: float = 0.8,
        prev_energy: int = 3,
    ) -> np.ndarray:
        """Extract feature vector from context."""
        features = [
            context.date.weekday(),
            self.day_type_encoder.transform([context.day_type.value])[0],
            self.weather_encoder.transform([context.weather.value])[0],
            context.stress_level.value,
            self.activity_encoder.transform([context.activity_level.value])[0],
            int(context.has_morning_workout),
            int(context.has_evening_social),
            self.pattern_encoder.transform([
                (prev_pattern or PatternType.TRADITIONAL).value
            ])[0],
            prev_adherence,
            prev_energy / 5.0,  # Normalize to 0-1
        ]
        return np.array(features).reshape(1, -1)

    def _generate_reasoning(
        self,
        pattern: PatternType,
        context: DailyContext,
    ) -> List[str]:
        """Generate human-readable reasoning for recommendation."""
        reasons = []
        config = PATTERN_CONFIGS[pattern]

        # Context-based reasoning
        if context.has_morning_workout and pattern == PatternType.BIG_BREAKFAST:
            reasons.append("Big breakfast supports morning workout recovery")

        if context.has_evening_social and pattern in [PatternType.IF_NOON, PatternType.MORNING_FEAST]:
            reasons.append("Early eating window leaves evening free for social events")

        if context.stress_level.value >= 3 and pattern == PatternType.GRAZING_4_MEALS:
            reasons.append("Frequent small meals help manage stress-related hunger")

        if context.day_type == DayType.WEEKEND and pattern == PatternType.GRAZING_PLATTER:
            reasons.append("Platter grazing fits relaxed weekend schedule")

        if context.day_type == DayType.WORK_FROM_HOME and pattern == PatternType.GRAZING_PLATTER:
            reasons.append("Work from home allows flexible platter access")

        if context.activity_level in [ActivityLevel.ACTIVE, ActivityLevel.VERY_ACTIVE]:
            if pattern in [PatternType.TRADITIONAL, PatternType.BIG_BREAKFAST]:
                reasons.append("Structured meals support high activity levels")

        if context.weather == WeatherCondition.COLD:
            if pattern == PatternType.TRADITIONAL:
                reasons.append("Warm soup breakfast ideal for cold weather")

        # Pattern-specific baseline reasoning
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
            reasons = pattern_reasons.get(pattern, ["Based on historical success"])

        return reasons

    def fit(
        self,
        X: List[Dict[str, Any]],
        y: List[PatternType],
        **kwargs
    ) -> "PatternRecommender":
        """
        Train the model on historical data.

        Args:
            X: List of feature dictionaries with context information
            y: List of pattern types that were successful
            **kwargs: Additional arguments for the classifier
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for training")

        # Convert to feature matrix
        X_matrix = []
        for record in X:
            context = DailyContext(
                date=record.get("date", date.today()),
                day_type=DayType(record.get("day_type", "weekday")),
                weather=WeatherCondition(record.get("weather", "sunny")),
                stress_level=StressLevel(record.get("stress_level", 2)),
                activity_level=ActivityLevel(record.get("activity_level", "moderate")),
                has_morning_workout=record.get("has_morning_workout", False),
                has_evening_social=record.get("has_evening_social", False),
            )
            features = self._extract_features(
                context,
                prev_pattern=PatternType(record.get("prev_pattern", "traditional")),
                prev_adherence=record.get("prev_adherence", 0.8),
                prev_energy=record.get("prev_energy", 3),
            )
            X_matrix.append(features.flatten())

        X_array = np.array(X_matrix)
        y_encoded = self.pattern_encoder.transform([p.value for p in y])

        # Scale features
        X_scaled = self.scaler.fit_transform(X_array)

        # Train Gradient Boosting Classifier
        self.model = GradientBoostingClassifier(
            n_estimators=kwargs.get("n_estimators", 100),
            max_depth=kwargs.get("max_depth", 5),
            learning_rate=kwargs.get("learning_rate", 0.1),
            random_state=kwargs.get("random_state", 42),
        )
        self.model.fit(X_scaled, y_encoded)
        self.is_fitted = True

        return self

    def predict(
        self,
        context: DailyContext,
        prev_pattern: Optional[PatternType] = None,
        prev_adherence: float = 0.8,
        prev_energy: int = 3,
        top_k: int = 3,
    ) -> List[PatternRecommendation]:
        """
        Predict top-k pattern recommendations for given context.

        Args:
            context: Current day's context
            prev_pattern: Previous day's pattern
            prev_adherence: Previous day's adherence score (0-1)
            prev_energy: Previous day's energy rating (1-5)
            top_k: Number of recommendations to return

        Returns:
            List of PatternRecommendation sorted by probability
        """
        features = self._extract_features(
            context, prev_pattern, prev_adherence, prev_energy
        )

        if self.is_fitted and self.model is not None:
            features_scaled = self.scaler.transform(features)
            probabilities = self.model.predict_proba(features_scaled)[0]
            pattern_probs = list(zip(
                self.pattern_encoder.classes_,
                probabilities
            ))
        else:
            # Fallback to rule-based recommendations
            pattern_probs = self._rule_based_scores(context)

        # Sort by probability
        pattern_probs.sort(key=lambda x: x[1], reverse=True)

        recommendations = []
        for rank, (pattern_value, prob) in enumerate(pattern_probs[:top_k], 1):
            pattern = PatternType(pattern_value)
            recommendations.append(PatternRecommendation(
                pattern=pattern,
                probability=float(prob),
                reasoning=self._generate_reasoning(pattern, context),
                rank=rank,
            ))

        return recommendations

    def _rule_based_scores(
        self, context: DailyContext
    ) -> List[Tuple[str, float]]:
        """Generate rule-based pattern scores when model not trained."""
        scores = {p.value: 0.14 for p in PatternType}  # Base equal probability

        # Apply rules
        if context.has_morning_workout:
            scores[PatternType.BIG_BREAKFAST.value] += 0.2
            scores[PatternType.TRADITIONAL.value] += 0.1

        if context.has_evening_social:
            scores[PatternType.IF_NOON.value] += 0.15
            scores[PatternType.MORNING_FEAST.value] += 0.2
            scores[PatternType.REVERSED.value] -= 0.1

        if context.day_type in [DayType.WEEKEND, DayType.WORK_FROM_HOME]:
            scores[PatternType.GRAZING_PLATTER.value] += 0.2
            scores[PatternType.GRAZING_4_MEALS.value] += 0.1

        if context.stress_level.value >= 3:
            scores[PatternType.GRAZING_4_MEALS.value] += 0.15

        if context.activity_level in [ActivityLevel.VERY_ACTIVE, ActivityLevel.ACTIVE]:
            scores[PatternType.TRADITIONAL.value] += 0.1
            scores[PatternType.BIG_BREAKFAST.value] += 0.1

        # Normalize to sum to 1
        total = sum(scores.values())
        return [(k, v / total) for k, v in scores.items()]

    def evaluate(
        self,
        X: List[Dict[str, Any]],
        y: List[PatternType],
        cv: int = 5
    ) -> Dict[str, float]:
        """
        Evaluate model using cross-validation.

        Returns:
            Dictionary with accuracy, precision, recall metrics
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before evaluation")

        X_matrix = []
        for record in X:
            context = DailyContext(
                date=record.get("date", date.today()),
                day_type=DayType(record.get("day_type", "weekday")),
                weather=WeatherCondition(record.get("weather", "sunny")),
                stress_level=StressLevel(record.get("stress_level", 2)),
                activity_level=ActivityLevel(record.get("activity_level", "moderate")),
                has_morning_workout=record.get("has_morning_workout", False),
                has_evening_social=record.get("has_evening_social", False),
            )
            features = self._extract_features(context)
            X_matrix.append(features.flatten())

        X_array = np.array(X_matrix)
        X_scaled = self.scaler.transform(X_array)
        y_encoded = self.pattern_encoder.transform([p.value for p in y])

        scores = cross_val_score(self.model, X_scaled, y_encoded, cv=cv)

        return {
            "accuracy_mean": float(np.mean(scores)),
            "accuracy_std": float(np.std(scores)),
            "cv_folds": cv,
        }

    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance scores."""
        if not self.is_fitted or self.model is None:
            return {}

        importances = self.model.feature_importances_
        return dict(zip(self.FEATURE_NAMES, importances.tolist()))

    def save(self, path: Path) -> None:
        """Save model to disk."""
        model_data = {
            "model": self.model,
            "scaler": self.scaler,
            "is_fitted": self.is_fitted,
            "version": self.MODEL_VERSION,
        }
        with open(path, "wb") as f:
            pickle.dump(model_data, f)

    def load(self, path: Path) -> None:
        """Load model from disk."""
        with open(path, "rb") as f:
            model_data = pickle.load(f)

        self.model = model_data["model"]
        self.scaler = model_data["scaler"]
        self.is_fitted = model_data["is_fitted"]
