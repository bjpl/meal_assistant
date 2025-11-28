"""
Tests for Pattern Recommender ML model.
"""
import pytest
from datetime import date
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import (
    PatternType, DailyContext, DayType, WeatherCondition,
    StressLevel, ActivityLevel
)
from src.ml.models.pattern_recommender import PatternRecommender, PatternRecommendation


class TestPatternRecommender:
    """Tests for PatternRecommender model."""

    def setup_method(self):
        """Set up test fixtures."""
        self.recommender = PatternRecommender()

    def test_initialization(self):
        """Test model initialization."""
        assert self.recommender is not None
        assert self.recommender.MODEL_VERSION == "1.0.0"
        assert not self.recommender.is_fitted

    def test_predict_without_training(self):
        """Test prediction works without training (rule-based fallback)."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.MODERATE,
            activity_level=ActivityLevel.MODERATE,
        )

        recommendations = self.recommender.predict(context, top_k=3)

        assert len(recommendations) == 3
        assert all(isinstance(r, PatternRecommendation) for r in recommendations)
        assert recommendations[0].rank == 1
        assert 0 <= recommendations[0].probability <= 1
        assert len(recommendations[0].reasoning) > 0

    def test_predict_with_morning_workout(self):
        """Test that morning workout context affects recommendations."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.LOW,
            activity_level=ActivityLevel.ACTIVE,
            has_morning_workout=True,
        )

        recommendations = self.recommender.predict(context, top_k=5)

        # Big breakfast should be highly ranked for morning workout
        patterns = [r.pattern for r in recommendations]
        assert PatternType.BIG_BREAKFAST in patterns

    def test_predict_with_evening_social(self):
        """Test that evening social context affects recommendations."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.LOW,
            activity_level=ActivityLevel.LIGHT,
            has_evening_social=True,
        )

        recommendations = self.recommender.predict(context, top_k=5)

        # IF or morning feast should be recommended for evening social
        patterns = [r.pattern for r in recommendations]
        assert PatternType.IF_NOON in patterns or PatternType.MORNING_FEAST in patterns

    def test_predict_weekend(self):
        """Test weekend context recommendations."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKEND,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.LOW,
            activity_level=ActivityLevel.MODERATE,
        )

        recommendations = self.recommender.predict(context, top_k=5)

        # Grazing platter should be recommended for weekends
        patterns = [r.pattern for r in recommendations]
        assert PatternType.GRAZING_PLATTER in patterns

    def test_predict_high_stress(self):
        """Test high stress context recommendations."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.CLOUDY,
            stress_level=StressLevel.HIGH,
            activity_level=ActivityLevel.LIGHT,
        )

        recommendations = self.recommender.predict(context, top_k=5)

        # Grazing 4 meals should be recommended for high stress
        patterns = [r.pattern for r in recommendations]
        assert PatternType.GRAZING_4_MEALS in patterns

    def test_reasoning_generation(self):
        """Test that reasoning is generated for recommendations."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKEND,
            weather=WeatherCondition.COLD,
            stress_level=StressLevel.LOW,
            activity_level=ActivityLevel.MODERATE,
        )

        recommendations = self.recommender.predict(context, top_k=1)

        assert len(recommendations[0].reasoning) > 0
        assert all(isinstance(r, str) for r in recommendations[0].reasoning)

    def test_probability_sum(self):
        """Test that probabilities are reasonable."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.MODERATE,
            activity_level=ActivityLevel.MODERATE,
        )

        recommendations = self.recommender.predict(context, top_k=7)

        # All probabilities should sum to approximately 1
        total_prob = sum(r.probability for r in recommendations)
        assert 0.95 <= total_prob <= 1.05

    def test_top_k_parameter(self):
        """Test that top_k parameter limits results."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.MODERATE,
            activity_level=ActivityLevel.MODERATE,
        )

        for k in [1, 3, 5, 7]:
            recommendations = self.recommender.predict(context, top_k=k)
            assert len(recommendations) == k

    def test_feature_extraction(self):
        """Test feature extraction from context."""
        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.MODERATE,
            activity_level=ActivityLevel.MODERATE,
            has_morning_workout=True,
            has_evening_social=False,
        )

        features = self.recommender._extract_features(context)

        assert features.shape == (1, 10)  # 10 features
        assert features[0, 5] == 1  # has_morning_workout
        assert features[0, 6] == 0  # has_evening_social


class TestPatternRecommenderTraining:
    """Tests for Pattern Recommender training functionality."""

    @pytest.fixture
    def training_data(self):
        """Generate training data."""
        from src.ml.training.data_generator import TrainingDataGenerator

        generator = TrainingDataGenerator(seed=42)
        X, y = generator.generate_pattern_recommender_data(n_samples=100)
        return X, y

    def test_training(self, training_data):
        """Test model training."""
        X, y = training_data

        recommender = PatternRecommender()
        recommender.fit(X, y)

        assert recommender.is_fitted
        assert recommender.model is not None

    def test_feature_importance_after_training(self, training_data):
        """Test feature importance is available after training."""
        X, y = training_data

        recommender = PatternRecommender()
        recommender.fit(X, y)

        importance = recommender.get_feature_importance()

        assert len(importance) == len(PatternRecommender.FEATURE_NAMES)
        assert all(v >= 0 for v in importance.values())

    def test_prediction_after_training(self, training_data):
        """Test prediction quality after training."""
        X, y = training_data

        recommender = PatternRecommender()
        recommender.fit(X, y)

        context = DailyContext(
            date=date.today(),
            day_type=DayType.WEEKEND,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.LOW,
            activity_level=ActivityLevel.MODERATE,
        )

        recommendations = recommender.predict(context, top_k=3)

        assert len(recommendations) == 3
        # Trained model should have more confident predictions
        assert recommendations[0].probability > 0.1
