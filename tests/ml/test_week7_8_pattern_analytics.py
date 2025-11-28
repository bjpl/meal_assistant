"""
Tests for Week 7-8 Pattern Analytics ML Models.

Tests:
- PatternRecommenderV2 (17-feature context-aware model)
- PatternEffectivenessAnalyzer
- DealCyclePredictor
- SavingsValidator
"""
import pytest
from datetime import date, timedelta
from pathlib import Path
import tempfile
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import (
    PatternType, DayType, WeatherCondition, StressLevel, ActivityLevel
)


class TestPatternRecommenderV2:
    """Tests for enhanced 17-feature pattern recommender."""

    def test_contextual_features_creation(self):
        """Test creating contextual features."""
        from src.ml.models.pattern_recommender_v2 import (
            ContextualFeatures, SleepQuality, PreviousDayOutcome
        )

        context = ContextualFeatures(
            date=date.today(),
            day_type=DayType.WEEKDAY,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.MODERATE,
            activity_level=ActivityLevel.MODERATE,
            has_morning_workout=True,
            has_evening_social=False,
            has_calendar_event=True,
            has_social_lunch=False,
            has_social_dinner=True,
            sleep_quality=4,
            sleep_hours=7.5,
            prev_pattern=PatternType.TRADITIONAL,
            prev_adherence=0.85,
            prev_energy=4,
            prev_day_outcome=PreviousDayOutcome.SUCCESS,
            pattern_fatigue_score=0.2,
        )

        assert context.date == date.today()
        assert context.has_morning_workout is True
        assert context.sleep_quality == 4
        assert context.pattern_fatigue_score == 0.2

    def test_recommender_initialization(self):
        """Test recommender initializes correctly."""
        from src.ml.models.pattern_recommender_v2 import PatternRecommenderV2

        recommender = PatternRecommenderV2()

        assert recommender.MODEL_VERSION == "2.0.0"
        assert len(recommender.FEATURE_NAMES) == 17
        assert not recommender.is_fitted

    def test_feature_extraction(self):
        """Test feature vector extraction."""
        from src.ml.models.pattern_recommender_v2 import (
            PatternRecommenderV2, ContextualFeatures
        )

        recommender = PatternRecommenderV2()
        context = ContextualFeatures(
            date=date.today(),
            day_type=DayType.WEEKEND,
            weather=WeatherCondition.RAINY,
            stress_level=StressLevel.HIGH,
        )

        features = recommender._extract_features(context)

        assert features.shape == (1, 17)
        assert features[0, 0] == date.today().weekday()  # day_of_week

    def test_rule_based_prediction(self):
        """Test prediction without trained model (rule-based fallback)."""
        from src.ml.models.pattern_recommender_v2 import (
            PatternRecommenderV2, ContextualFeatures
        )

        recommender = PatternRecommenderV2()
        context = ContextualFeatures(
            date=date.today(),
            day_type=DayType.WEEKEND,
            weather=WeatherCondition.SUNNY,
            stress_level=StressLevel.LOW,
            has_morning_workout=False,
            has_evening_social=False,
        )

        recommendations = recommender.predict(context, top_k=3)

        assert len(recommendations) == 3
        assert all(r.pattern in PatternType for r in recommendations)
        assert all(0 <= r.probability <= 1 for r in recommendations)
        assert recommendations[0].rank == 1

    def test_morning_workout_boosts_big_breakfast(self):
        """Test that morning workout context boosts big breakfast pattern."""
        from src.ml.models.pattern_recommender_v2 import (
            PatternRecommenderV2, ContextualFeatures
        )

        recommender = PatternRecommenderV2()

        # Without workout
        context_no_workout = ContextualFeatures(
            date=date.today(),
            has_morning_workout=False,
        )

        # With workout
        context_workout = ContextualFeatures(
            date=date.today(),
            has_morning_workout=True,
        )

        recs_no_workout = recommender.predict(context_no_workout, top_k=7)
        recs_workout = recommender.predict(context_workout, top_k=7)

        # Find big breakfast probability
        bb_no_workout = next(
            (r.probability for r in recs_no_workout if r.pattern == PatternType.BIG_BREAKFAST),
            0
        )
        bb_workout = next(
            (r.probability for r in recs_workout if r.pattern == PatternType.BIG_BREAKFAST),
            0
        )

        assert bb_workout > bb_no_workout

    def test_weekend_boosts_grazing_platter(self):
        """Test that weekend boosts grazing platter pattern."""
        from src.ml.models.pattern_recommender_v2 import (
            PatternRecommenderV2, ContextualFeatures
        )

        recommender = PatternRecommenderV2()

        context_weekday = ContextualFeatures(
            date=date.today(),
            day_type=DayType.WEEKDAY,
        )

        context_weekend = ContextualFeatures(
            date=date.today(),
            day_type=DayType.WEEKEND,
        )

        recs_weekday = recommender.predict(context_weekday, top_k=7)
        recs_weekend = recommender.predict(context_weekend, top_k=7)

        gp_weekday = next(
            (r.probability for r in recs_weekday if r.pattern == PatternType.GRAZING_PLATTER),
            0
        )
        gp_weekend = next(
            (r.probability for r in recs_weekend if r.pattern == PatternType.GRAZING_PLATTER),
            0
        )

        assert gp_weekend > gp_weekday

    def test_reasoning_generation(self):
        """Test that reasoning is generated for recommendations."""
        from src.ml.models.pattern_recommender_v2 import (
            PatternRecommenderV2, ContextualFeatures
        )

        recommender = PatternRecommenderV2()
        context = ContextualFeatures(
            date=date.today(),
            has_morning_workout=True,
            stress_level=StressLevel.HIGH,
        )

        recommendations = recommender.predict(context, top_k=3)

        for rec in recommendations:
            assert len(rec.reasoning) > 0
            assert all(isinstance(r, str) for r in rec.reasoning)

    def test_pattern_fatigue_reduces_current_pattern_score(self):
        """Test that fatigue reduces score for current pattern."""
        from src.ml.models.pattern_recommender_v2 import (
            PatternRecommenderV2, ContextualFeatures
        )

        recommender = PatternRecommenderV2()

        # Low fatigue
        context_low_fatigue = ContextualFeatures(
            date=date.today(),
            prev_pattern=PatternType.TRADITIONAL,
            pattern_fatigue_score=0.1,
        )

        # High fatigue
        context_high_fatigue = ContextualFeatures(
            date=date.today(),
            prev_pattern=PatternType.TRADITIONAL,
            pattern_fatigue_score=0.8,
        )

        recs_low = recommender.predict(context_low_fatigue, top_k=7)
        recs_high = recommender.predict(context_high_fatigue, top_k=7)

        trad_low = next(
            (r.probability for r in recs_low if r.pattern == PatternType.TRADITIONAL),
            0
        )
        trad_high = next(
            (r.probability for r in recs_high if r.pattern == PatternType.TRADITIONAL),
            0
        )

        assert trad_high < trad_low


class TestPatternEffectivenessAnalyzer:
    """Tests for pattern effectiveness analyzer."""

    def test_analyzer_initialization(self):
        """Test analyzer initializes correctly."""
        from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer

        analyzer = PatternEffectivenessAnalyzer()

        assert analyzer.logs_processed == 0
        assert len(analyzer.pattern_data) == len(PatternType)

    def test_analyze_pattern_empty(self):
        """Test analyzing pattern with no data."""
        from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer

        analyzer = PatternEffectivenessAnalyzer()
        profile = analyzer.analyze_pattern("traditional")

        assert profile.metrics.days_analyzed == 0
        assert profile.metrics.adherence_rate == 0.0
        assert profile.recommendation_score == 0.0

    def test_detect_fatigue_insufficient_data(self):
        """Test fatigue detection with insufficient data."""
        from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer

        analyzer = PatternEffectivenessAnalyzer()
        analysis = analyzer.detect_fatigue([])

        assert analysis.fatigue_level == "unknown"
        assert analysis.days_on_pattern == 0

    def test_detect_fatigue_consecutive_days(self):
        """Test fatigue detection with consecutive pattern usage."""
        from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer

        analyzer = PatternEffectivenessAnalyzer()

        # Create 7 days of same pattern
        recent_patterns = [
            {
                "date": (date.today() - timedelta(days=i)).isoformat(),
                "pattern": "traditional",
                "adherence": 0.9 - (i * 0.05),  # Declining adherence
                "satisfaction": 4,
            }
            for i in range(7)
        ]

        analysis = analyzer.detect_fatigue(recent_patterns)

        assert analysis.days_on_pattern >= 5
        assert analysis.fatigue_score > 0.3

    def test_recommend_pattern(self):
        """Test pattern recommendation based on context."""
        from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer

        analyzer = PatternEffectivenessAnalyzer()

        context = {
            "day_type": "weekend",
            "weather": "sunny",
            "stress_level": 2,
        }

        recommendation = analyzer.recommend_pattern(context)

        assert "recommended_pattern" in recommendation
        assert "score" in recommendation
        assert "confidence" in recommendation

    def test_get_stats(self):
        """Test getting analyzer statistics."""
        from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer

        analyzer = PatternEffectivenessAnalyzer()
        stats = analyzer.get_stats()

        assert "logs_processed" in stats
        assert "patterns_with_data" in stats
        assert "total_context_entries" in stats


class TestDealCyclePredictor:
    """Tests for deal cycle predictor."""

    def test_predictor_initialization(self):
        """Test predictor initializes correctly."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor

        predictor = DealCyclePredictor()

        assert predictor.MODEL_VERSION == "1.0.0"
        assert len(predictor.sales_history) == 0

    def test_add_sale_record(self):
        """Test adding sale records."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor, SaleRecord

        predictor = DealCyclePredictor()

        sale = SaleRecord(
            item_id="item_001",
            item_name="Chicken Breast",
            store_id="store_001",
            store_name="Costco",
            sale_date=date.today(),
            original_price=12.99,
            sale_price=8.99,
            discount_percent=30.8,
        )

        predictor.add_sale(sale)

        assert len(predictor.sales_history["item_001"]) == 1

    def test_should_buy_now_no_data(self):
        """Test buy recommendation with no data."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor

        predictor = DealCyclePredictor()
        result = predictor.should_buy_now("unknown_item")

        assert result["recommendation"] == "buy_now"
        assert result["confidence"] == 0.3

    def test_weekly_cycle_detection(self):
        """Test detection of weekly sale cycles."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor, SaleRecord

        predictor = DealCyclePredictor()

        # Add sales every 7 days
        for i in range(5):
            sale = SaleRecord(
                item_id="weekly_item",
                item_name="Weekly Deal Item",
                store_id="store_001",
                store_name="Test Store",
                sale_date=date.today() - timedelta(days=i * 7),
                original_price=10.00,
                sale_price=7.00,
                discount_percent=30.0,
            )
            predictor.add_sale(sale)

        profile = predictor.analyze_item("weekly_item")

        assert profile is not None
        assert profile.cycle_pattern.cycle_type == "weekly"
        assert profile.cycle_pattern.cycle_days == 7

    def test_get_upcoming_sales(self):
        """Test getting upcoming predicted sales."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor, SaleRecord

        predictor = DealCyclePredictor()

        # Add sales with weekly pattern
        for i in range(4):
            sale = SaleRecord(
                item_id="regular_item",
                item_name="Regular Item",
                store_id="store_001",
                store_name="Test Store",
                sale_date=date.today() - timedelta(days=i * 7 + 3),
                original_price=10.00,
                sale_price=7.00,
                discount_percent=30.0,
            )
            predictor.add_sale(sale)

        predictor.analyze_item("regular_item")
        upcoming = predictor.get_upcoming_sales(days_ahead=14, min_confidence=0.3)

        # Should have at least one prediction
        assert isinstance(upcoming, list)

    def test_get_stats(self):
        """Test getting predictor statistics."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor

        predictor = DealCyclePredictor()
        stats = predictor.get_stats()

        assert "items_tracked" in stats
        assert "total_sales" in stats
        assert "profiles_created" in stats
        assert "cycle_types" in stats


class TestSavingsValidator:
    """Tests for savings validator."""

    def test_validator_initialization(self):
        """Test validator initializes correctly."""
        from src.ml.models.savings_validator import SavingsValidator

        validator = SavingsValidator()

        assert validator.MODEL_VERSION == "1.0.0"
        assert validator.total_predictions == 0
        assert validator.accurate_predictions == 0

    def test_validate_prediction(self):
        """Test validating a single prediction."""
        from src.ml.models.savings_validator import SavingsValidator

        validator = SavingsValidator()

        result = validator.validate(
            predicted_savings=10.00,
            actual_savings=9.50,
            stores=["store_001", "store_002"],
            trip_date=date.today(),
        )

        assert 0.9 <= result.accuracy <= 1.0
        assert result.deviation == -0.50
        assert result.is_accurate is True  # Within 15%

    def test_record_trip(self):
        """Test recording a complete trip."""
        from src.ml.models.savings_validator import SavingsValidator, SavingsRecord

        validator = SavingsValidator()

        record = SavingsRecord(
            trip_id="trip_001",
            trip_date=date.today(),
            stores_visited=["store_001", "store_002"],
            predicted_savings=15.00,
            actual_savings=14.00,
            predicted_time=60,
            actual_time=65,
            predicted_distance=10,
            actual_distance=11,
            item_count=20,
            strategy="two_store",
        )

        result = validator.record_trip(record)

        assert validator.total_predictions == 1
        assert result.is_accurate is True

    def test_correction_factor_learning(self):
        """Test that correction factors are learned."""
        from src.ml.models.savings_validator import SavingsValidator, SavingsRecord

        validator = SavingsValidator()

        # Record multiple trips
        for i in range(5):
            record = SavingsRecord(
                trip_id=f"trip_{i}",
                trip_date=date.today() - timedelta(days=i),
                stores_visited=["costco"],
                predicted_savings=10.00,
                actual_savings=8.00,  # Consistently 80% of prediction
                predicted_time=60,
                actual_time=60,
                predicted_distance=10,
                actual_distance=10,
                item_count=15,
                strategy="single_store",
            )
            validator.record_trip(record)

        # Check correction factor was learned
        assert "store:costco" in validator.correction_factors
        assert validator.correction_factors["store:costco"].correction_multiplier < 1.0

    def test_adjust_prediction(self):
        """Test adjusting prediction with learned factors."""
        from src.ml.models.savings_validator import SavingsValidator, SavingsRecord

        validator = SavingsValidator()

        # Train with some data
        for i in range(5):
            record = SavingsRecord(
                trip_id=f"trip_{i}",
                trip_date=date.today() - timedelta(days=i),
                stores_visited=["target"],
                predicted_savings=20.00,
                actual_savings=18.00,
                predicted_time=45,
                actual_time=50,
                predicted_distance=8,
                actual_distance=8,
                item_count=12,
                strategy="single_store",
            )
            validator.record_trip(record)

        result = validator.adjust_prediction(
            predicted_savings=25.00,
            stores=["target"],
            strategy="single_store",
            trip_date=date.today(),
            item_count=15,
        )

        assert "adjusted_prediction" in result
        assert "correction_factor" in result
        assert "confidence" in result

    def test_roi_analysis(self):
        """Test ROI analysis."""
        from src.ml.models.savings_validator import SavingsValidator, SavingsRecord

        validator = SavingsValidator()

        # Add multi-store trips
        for i in range(3):
            record = SavingsRecord(
                trip_id=f"multi_{i}",
                trip_date=date.today() - timedelta(days=i),
                stores_visited=["store_1", "store_2"],
                predicted_savings=15.00,
                actual_savings=14.00,
                predicted_time=90,
                actual_time=95,
                predicted_distance=20,
                actual_distance=22,
                item_count=25,
                strategy="two_store",
            )
            validator.record_trip(record)

        analysis = validator.analyze_roi()

        assert analysis.total_trips == 3
        assert analysis.multi_store_trips == 3
        assert analysis.total_actual_savings == 42.00

    def test_get_stats(self):
        """Test getting validator statistics."""
        from src.ml.models.savings_validator import SavingsValidator

        validator = SavingsValidator()
        stats = validator.get_stats()

        assert "total_predictions" in stats
        assert "accurate_predictions" in stats
        assert "accuracy_rate" in stats
        assert "correction_factors_learned" in stats


class TestSaveLoad:
    """Tests for model persistence."""

    def test_savings_validator_save_load(self):
        """Test saving and loading savings validator."""
        from src.ml.models.savings_validator import SavingsValidator, SavingsRecord

        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "validator.json"

            # Create and populate validator
            validator = SavingsValidator(model_path=model_path)
            record = SavingsRecord(
                trip_id="test_trip",
                trip_date=date.today(),
                stores_visited=["store_1"],
                predicted_savings=10.00,
                actual_savings=9.00,
                predicted_time=30,
                actual_time=35,
                predicted_distance=5,
                actual_distance=5,
                item_count=10,
                strategy="single_store",
            )
            validator.record_trip(record)
            validator.save(model_path)

            # Load in new validator
            validator2 = SavingsValidator(model_path=model_path)

            assert validator2.total_predictions == 1
            assert len(validator2.savings_records) == 1

    def test_deal_cycle_predictor_save_load(self):
        """Test saving and loading deal cycle predictor."""
        from src.ml.models.deal_cycle_predictor import DealCyclePredictor, SaleRecord

        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "cycles.json"

            predictor = DealCyclePredictor(model_path=model_path)
            sale = SaleRecord(
                item_id="item_001",
                item_name="Test Item",
                store_id="store_001",
                store_name="Test Store",
                sale_date=date.today(),
                original_price=10.00,
                sale_price=7.00,
                discount_percent=30.0,
            )
            predictor.add_sale(sale)
            predictor.save(model_path)

            predictor2 = DealCyclePredictor(model_path=model_path)

            assert len(predictor2.sales_history["item_001"]) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
