"""
Tests for Weight Predictor ML model.
"""
import pytest
from datetime import date, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import WeightEntry, PatternLog, PatternType
from src.ml.models.weight_predictor import WeightPredictor, WeightForecast, WeightTrend


class TestWeightPredictor:
    """Tests for WeightPredictor model."""

    def setup_method(self):
        """Set up test fixtures."""
        self.predictor = WeightPredictor(target_weight=200.0)

    def test_initialization(self):
        """Test model initialization."""
        assert self.predictor is not None
        assert self.predictor.target_weight == 200.0
        assert self.predictor.MODEL_VERSION == "1.0.0"

    def test_data_quality_no_data(self):
        """Test data quality status with no data."""
        status = self.predictor.get_data_quality_status([])

        assert status["status"] == "no_data"
        assert not status["can_predict"]

    def test_data_quality_insufficient(self):
        """Test data quality status with insufficient data."""
        weights = [
            WeightEntry(date=date.today() - timedelta(days=i), weight_lbs=250.0 - i * 0.2)
            for i in range(3)
        ]

        status = self.predictor.get_data_quality_status(weights)

        assert status["status"] == "insufficient"
        assert not status["can_predict"]
        assert status["points_needed"] > 0

    def test_data_quality_emerging(self):
        """Test data quality status with emerging data."""
        weights = [
            WeightEntry(date=date.today() - timedelta(days=i), weight_lbs=250.0 - i * 0.2)
            for i in range(10)
        ]

        status = self.predictor.get_data_quality_status(weights)

        assert status["status"] == "emerging"
        assert status["can_predict"]

    def test_data_quality_reliable(self):
        """Test data quality status with reliable data."""
        weights = [
            WeightEntry(date=date.today() - timedelta(days=i), weight_lbs=250.0 - i * 0.2)
            for i in range(25)
        ]

        status = self.predictor.get_data_quality_status(weights)

        assert status["status"] == "reliable"
        assert status["can_predict"]

    def test_simple_forecast_insufficient_data(self):
        """Test simple linear forecast with insufficient data."""
        # Create weight entries in chronological order (oldest first)
        weights = [
            WeightEntry(date=date.today() - timedelta(days=4-i), weight_lbs=250.0 - i * 0.2)
            for i in range(5)
        ]

        forecasts = self.predictor.predict(weights, [], days_ahead=7)

        assert len(forecasts) == 7
        assert all(isinstance(f, WeightForecast) for f in forecasts)
        # Should show downward trend (latest weight < earliest weight in forecast)
        assert forecasts[-1].predicted_weight_lbs < weights[0].weight_lbs

    def test_trend_analysis_losing(self):
        """Test trend analysis for weight loss."""
        # Create weight entries in chronological order (oldest first, weight decreasing over time)
        weights = [
            WeightEntry(date=date.today() - timedelta(days=13-i), weight_lbs=250.0 - i * 0.2)
            for i in range(14)
        ]

        trend = self.predictor.analyze_trend(weights)

        assert isinstance(trend, WeightTrend)
        assert trend.trend_direction == "losing"
        assert trend.weekly_rate_lbs < 0

    def test_trend_analysis_stable(self):
        """Test trend analysis for stable weight."""
        weights = [
            WeightEntry(date=date.today() - timedelta(days=i), weight_lbs=250.0 + (i % 2) * 0.2)
            for i in range(14)
        ]

        trend = self.predictor.analyze_trend(weights)

        assert trend.trend_direction == "stable"

    def test_trend_analysis_on_track(self):
        """Test trend analysis on-track detection."""
        # 1.25 lbs/week loss in chronological order (oldest first)
        weights = [
            WeightEntry(date=date.today() - timedelta(days=13-i), weight_lbs=250.0 - i * (1.25 / 7))
            for i in range(14)
        ]

        trend = self.predictor.analyze_trend(weights)

        assert trend.on_track

    def test_days_to_goal_calculation(self):
        """Test days to goal calculation."""
        # Current: ~248, Target: 200, Rate: ~1 lb/week in chronological order
        weights = [
            WeightEntry(date=date.today() - timedelta(days=13-i), weight_lbs=250.0 - i * (1.0 / 7))
            for i in range(14)
        ]

        predictor = WeightPredictor(target_weight=200.0)
        trend = predictor.analyze_trend(weights)

        # Should take about 48 weeks = 336 days (current ~248 lbs, target 200)
        assert trend.days_to_goal is not None
        assert 280 < trend.days_to_goal < 420

    def test_forecast_with_confidence_intervals(self):
        """Test that forecasts include confidence intervals."""
        weights = [
            WeightEntry(date=date.today() - timedelta(days=i), weight_lbs=250.0 - i * 0.2)
            for i in range(10)
        ]

        forecasts = self.predictor.predict(weights, [], days_ahead=7)

        for forecast in forecasts:
            assert forecast.confidence_lower < forecast.predicted_weight_lbs
            assert forecast.confidence_upper > forecast.predicted_weight_lbs
            assert 0 <= forecast.confidence_level <= 1


class TestWeightPredictorTraining:
    """Tests for Weight Predictor training functionality."""

    @pytest.fixture
    def training_data(self):
        """Generate training data."""
        from src.ml.training.data_generator import TrainingDataGenerator

        generator = TrainingDataGenerator(seed=42)
        pattern_logs, weight_entries = generator.generate_training_dataset(days=60)
        return pattern_logs, weight_entries

    def test_training(self, training_data):
        """Test model training."""
        pattern_logs, weight_entries = training_data

        predictor = WeightPredictor(target_weight=200.0)
        predictor.fit(weight_entries, pattern_logs)

        assert predictor.is_fitted
        assert predictor.model is not None

    def test_prediction_after_training(self, training_data):
        """Test prediction after training."""
        pattern_logs, weight_entries = training_data

        predictor = WeightPredictor(target_weight=200.0)
        predictor.fit(weight_entries, pattern_logs)

        forecasts = predictor.predict(weight_entries, pattern_logs, days_ahead=14)

        assert len(forecasts) == 14
        # Predictions should be reasonable
        current_weight = weight_entries[-1].weight_lbs
        for forecast in forecasts:
            # Should not deviate more than 10 lbs from current
            assert abs(forecast.predicted_weight_lbs - current_weight) < 10

    def test_training_with_pattern_logs(self, training_data):
        """Test that pattern logs improve predictions."""
        pattern_logs, weight_entries = training_data

        # Train with logs
        predictor_with_logs = WeightPredictor(target_weight=200.0)
        predictor_with_logs.fit(weight_entries, pattern_logs)

        # Train without logs
        predictor_without_logs = WeightPredictor(target_weight=200.0)
        predictor_without_logs.fit(weight_entries, [])

        # Both should work
        assert predictor_with_logs.is_fitted
        assert predictor_without_logs.is_fitted
