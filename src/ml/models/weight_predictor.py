"""
Weight Predictor ML Model.
Time-series forecasting for 30-day weight predictions using regression.
"""
import pickle
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from sklearn.linear_model import Ridge
    from sklearn.preprocessing import StandardScaler, PolynomialFeatures
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.data.models import WeightEntry, PatternLog, Prediction


class SimpleScaler:
    """Simple standard scaler fallback when sklearn not available."""

    def __init__(self):
        self.mean_ = None
        self.std_ = None

    def fit_transform(self, X):
        X = np.array(X)
        self.mean_ = np.mean(X, axis=0)
        self.std_ = np.std(X, axis=0)
        self.std_[self.std_ == 0] = 1
        return (X - self.mean_) / self.std_

    def transform(self, X):
        X = np.array(X)
        if self.mean_ is None:
            return X
        return (X - self.mean_) / self.std_


class SimplePolynomialFeatures:
    """Simple polynomial features fallback when sklearn not available."""

    def __init__(self, degree=2, include_bias=False):
        self.degree = degree
        self.include_bias = include_bias

    def fit_transform(self, X):
        return self._transform(X)

    def transform(self, X):
        return self._transform(X)

    def _transform(self, X):
        X = np.array(X)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        # Simple: just return original features plus squared terms
        X_poly = [X]
        if self.degree >= 2:
            X_poly.append(X ** 2)
        return np.hstack(X_poly)


@dataclass
class WeightForecast:
    """Weight forecast for a future date."""
    date: date
    predicted_weight_lbs: float
    confidence_lower: float  # Lower bound of confidence interval
    confidence_upper: float  # Upper bound of confidence interval
    confidence_level: float  # 0-1, how confident the prediction is


@dataclass
class WeightTrend:
    """Analysis of weight trend."""
    trend_direction: str  # "losing", "gaining", "stable"
    weekly_rate_lbs: float  # Average weekly change
    days_to_goal: Optional[int]  # Estimated days to reach target
    on_track: bool  # Whether on track for 1-1.5 lbs/week loss


class WeightPredictor:
    """
    Time-series model for weight prediction.

    Features used:
    - Days since start
    - 7-day rolling average weight
    - 7-day rolling average adherence
    - 7-day rolling average calorie variance
    - Pattern distribution (% of each pattern used)
    - Weekly trend (slope of last 7 days)

    Output:
    - 30-day weight forecast with confidence intervals
    """

    MODEL_VERSION = "1.0.0"
    MIN_DATA_POINTS = 7  # Minimum entries for prediction
    RELIABLE_DATA_POINTS = 20  # Points needed for reliable prediction

    def __init__(self, target_weight: float = 200.0, model_path: Optional[Path] = None):
        """
        Initialize weight predictor.

        Args:
            target_weight: Goal weight in lbs
            model_path: Optional path to load pre-trained model
        """
        self.target_weight = target_weight
        self.model: Optional[Any] = None

        # Use sklearn if available, otherwise fallback
        ScalerClass = StandardScaler if SKLEARN_AVAILABLE else SimpleScaler
        PolyClass = PolynomialFeatures if SKLEARN_AVAILABLE else SimplePolynomialFeatures

        self.scaler = ScalerClass()
        self.poly_features = PolyClass(degree=2, include_bias=False)
        self.is_fitted = False
        self.model_path = model_path
        self.residual_std = 0.5  # Default standard deviation for confidence intervals

        if model_path and Path(model_path).exists():
            self.load(model_path)

    def _calculate_rolling_features(
        self,
        weights: List[WeightEntry],
        pattern_logs: List[PatternLog],
        window: int = 7
    ) -> List[Dict[str, float]]:
        """Calculate rolling features for each weight entry."""
        features_list = []

        # Sort by date
        weights_sorted = sorted(weights, key=lambda w: w.date)
        logs_sorted = sorted(pattern_logs, key=lambda l: l.date)

        # Create lookup dict for pattern logs
        log_by_date = {l.date: l for l in logs_sorted}

        start_date = weights_sorted[0].date if weights_sorted else date.today()

        for i, entry in enumerate(weights_sorted):
            # Days since start
            days_since_start = (entry.date - start_date).days

            # Rolling average weight
            window_weights = [
                w.weight_lbs for w in weights_sorted[max(0, i-window+1):i+1]
            ]
            rolling_avg_weight = np.mean(window_weights) if window_weights else entry.weight_lbs

            # Rolling adherence and calorie variance from pattern logs
            window_start = entry.date - timedelta(days=window)
            recent_logs = [
                l for l in logs_sorted
                if window_start <= l.date <= entry.date
            ]

            rolling_adherence = np.mean([l.adherence_score for l in recent_logs]) if recent_logs else 0.8
            rolling_cal_variance = np.mean([l.calorie_variance for l in recent_logs]) if recent_logs else 0.0

            # Weekly trend (slope)
            if len(window_weights) >= 2:
                x = np.arange(len(window_weights))
                slope = np.polyfit(x, window_weights, 1)[0]
            else:
                slope = 0.0

            features_list.append({
                "days_since_start": days_since_start,
                "rolling_avg_weight": rolling_avg_weight,
                "rolling_adherence": rolling_adherence,
                "rolling_cal_variance": rolling_cal_variance,
                "weekly_slope": slope,
                "weight": entry.weight_lbs,
            })

        return features_list

    def _features_to_matrix(self, features: List[Dict[str, float]]) -> np.ndarray:
        """Convert feature dicts to numpy matrix."""
        X = []
        for f in features:
            X.append([
                f["days_since_start"],
                f["rolling_avg_weight"],
                f["rolling_adherence"],
                f["rolling_cal_variance"],
                f["weekly_slope"],
            ])
        return np.array(X)

    def fit(
        self,
        weights: List[WeightEntry],
        pattern_logs: List[PatternLog],
        **kwargs
    ) -> "WeightPredictor":
        """
        Train the weight prediction model.

        Args:
            weights: Historical weight entries
            pattern_logs: Historical pattern adherence logs
            **kwargs: Additional model parameters
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for training")

        if len(weights) < self.MIN_DATA_POINTS:
            raise ValueError(f"Need at least {self.MIN_DATA_POINTS} weight entries")

        # Calculate features
        features = self._calculate_rolling_features(weights, pattern_logs)

        X = self._features_to_matrix(features)
        y = np.array([f["weight"] for f in features])

        # Scale and add polynomial features
        X_scaled = self.scaler.fit_transform(X)
        X_poly = self.poly_features.fit_transform(X_scaled)

        # Train Ridge regression (handles multicollinearity)
        self.model = Ridge(
            alpha=kwargs.get("alpha", 1.0),
            random_state=kwargs.get("random_state", 42),
        )
        self.model.fit(X_poly, y)

        # Calculate residual standard deviation for confidence intervals
        y_pred = self.model.predict(X_poly)
        self.residual_std = float(np.std(y - y_pred))

        self.is_fitted = True
        return self

    def predict(
        self,
        weights: List[WeightEntry],
        pattern_logs: List[PatternLog],
        days_ahead: int = 30,
        assumed_adherence: float = 0.85,
    ) -> List[WeightForecast]:
        """
        Predict weight for next N days.

        Args:
            weights: Historical weight entries
            pattern_logs: Historical pattern logs
            days_ahead: Number of days to forecast
            assumed_adherence: Assumed future adherence rate

        Returns:
            List of WeightForecast for each future day
        """
        if len(weights) < self.MIN_DATA_POINTS:
            return self._simple_linear_forecast(weights, days_ahead)

        features = self._calculate_rolling_features(weights, pattern_logs)
        last_feature = features[-1]

        forecasts = []
        current_weight = last_feature["weight"]
        rolling_weights = [f["weight"] for f in features[-7:]]

        for day in range(1, days_ahead + 1):
            # Project features forward
            future_features = {
                "days_since_start": last_feature["days_since_start"] + day,
                "rolling_avg_weight": np.mean(rolling_weights[-7:]),
                "rolling_adherence": assumed_adherence,
                "rolling_cal_variance": 0.0,  # Assume on-target
                "weekly_slope": last_feature["weekly_slope"],
            }

            if self.is_fitted and self.model is not None:
                X = self._features_to_matrix([future_features])
                X_scaled = self.scaler.transform(X)
                X_poly = self.poly_features.transform(X_scaled)
                predicted_weight = float(self.model.predict(X_poly)[0])
            else:
                # Simple linear extrapolation
                predicted_weight = current_weight + (last_feature["weekly_slope"] * day / 7)

            # Confidence interval widens with prediction horizon
            horizon_factor = np.sqrt(day / 7)  # Uncertainty grows with sqrt of time
            confidence_width = 1.96 * self.residual_std * horizon_factor

            # Data quality affects confidence
            data_quality = min(1.0, len(weights) / self.RELIABLE_DATA_POINTS)
            confidence_level = 0.95 * data_quality

            forecast = WeightForecast(
                date=date.today() + timedelta(days=day),
                predicted_weight_lbs=round(predicted_weight, 1),
                confidence_lower=round(predicted_weight - confidence_width, 1),
                confidence_upper=round(predicted_weight + confidence_width, 1),
                confidence_level=confidence_level,
            )
            forecasts.append(forecast)

            # Update rolling for next iteration
            rolling_weights.append(predicted_weight)

        return forecasts

    def _simple_linear_forecast(
        self,
        weights: List[WeightEntry],
        days_ahead: int
    ) -> List[WeightForecast]:
        """Fallback linear forecast when insufficient data."""
        if not weights:
            return []

        weights_sorted = sorted(weights, key=lambda w: w.date)

        if len(weights_sorted) >= 2:
            # Calculate slope from available data
            days = [(w.date - weights_sorted[0].date).days for w in weights_sorted]
            values = [w.weight_lbs for w in weights_sorted]
            slope = np.polyfit(days, values, 1)[0]
        else:
            # Default to target weight loss rate (1.25 lbs/week)
            slope = -1.25 / 7

        current_weight = weights_sorted[-1].weight_lbs
        forecasts = []

        for day in range(1, days_ahead + 1):
            predicted = current_weight + slope * day

            forecasts.append(WeightForecast(
                date=date.today() + timedelta(days=day),
                predicted_weight_lbs=round(predicted, 1),
                confidence_lower=round(predicted - 3, 1),
                confidence_upper=round(predicted + 3, 1),
                confidence_level=0.5,  # Low confidence without enough data
            ))

        return forecasts

    def analyze_trend(
        self,
        weights: List[WeightEntry],
        target_weight: Optional[float] = None
    ) -> WeightTrend:
        """
        Analyze weight trend from historical data.

        Args:
            weights: Historical weight entries
            target_weight: Target weight (uses instance default if not provided)

        Returns:
            WeightTrend analysis
        """
        target = target_weight or self.target_weight

        if len(weights) < 2:
            return WeightTrend(
                trend_direction="stable",
                weekly_rate_lbs=0.0,
                days_to_goal=None,
                on_track=False,
            )

        weights_sorted = sorted(weights, key=lambda w: w.date)

        # Calculate weekly rate from last 2 weeks or all data
        recent_weights = weights_sorted[-14:] if len(weights_sorted) >= 14 else weights_sorted

        days_span = (recent_weights[-1].date - recent_weights[0].date).days
        if days_span == 0:
            days_span = 1

        weight_change = recent_weights[-1].weight_lbs - recent_weights[0].weight_lbs
        weekly_rate = (weight_change / days_span) * 7

        # Determine trend direction
        if weekly_rate < -0.5:
            direction = "losing"
        elif weekly_rate > 0.5:
            direction = "gaining"
        else:
            direction = "stable"

        # Calculate days to goal
        current_weight = weights_sorted[-1].weight_lbs
        weight_to_lose = current_weight - target

        if weekly_rate < 0 and weight_to_lose > 0:
            weeks_to_goal = weight_to_lose / abs(weekly_rate)
            days_to_goal = int(weeks_to_goal * 7)
        else:
            days_to_goal = None

        # Check if on track for 1-1.5 lbs/week loss
        on_track = -1.5 <= weekly_rate <= -1.0

        return WeightTrend(
            trend_direction=direction,
            weekly_rate_lbs=round(weekly_rate, 2),
            days_to_goal=days_to_goal,
            on_track=on_track,
        )

    def get_data_quality_status(self, weights: List[WeightEntry]) -> Dict[str, Any]:
        """
        Assess data quality for predictions.

        Returns:
            Dict with quality status and recommendations
        """
        n_points = len(weights)

        if n_points == 0:
            return {
                "status": "no_data",
                "message": "No weight entries found",
                "can_predict": False,
                "points_needed": self.MIN_DATA_POINTS,
                "confidence_status": "none",
            }

        if n_points < self.MIN_DATA_POINTS:
            return {
                "status": "insufficient",
                "message": f"Need {self.MIN_DATA_POINTS - n_points} more entries",
                "can_predict": False,
                "points_needed": self.MIN_DATA_POINTS - n_points,
                "confidence_status": "low",
            }

        if n_points < self.RELIABLE_DATA_POINTS:
            return {
                "status": "emerging",
                "message": f"Predictions improving, {self.RELIABLE_DATA_POINTS - n_points} more entries for high confidence",
                "can_predict": True,
                "points_needed": self.RELIABLE_DATA_POINTS - n_points,
                "confidence_status": "medium",
            }

        return {
            "status": "reliable",
            "message": "Sufficient data for accurate predictions",
            "can_predict": True,
            "points_needed": 0,
            "confidence_status": "high",
        }

    def save(self, path: Path) -> None:
        """Save model to disk."""
        model_data = {
            "model": self.model,
            "scaler": self.scaler,
            "poly_features": self.poly_features,
            "residual_std": self.residual_std,
            "is_fitted": self.is_fitted,
            "target_weight": self.target_weight,
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
        self.poly_features = model_data["poly_features"]
        self.residual_std = model_data["residual_std"]
        self.is_fitted = model_data["is_fitted"]
        self.target_weight = model_data.get("target_weight", 200.0)
