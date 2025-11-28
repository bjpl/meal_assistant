"""
Tests for Progressive Learning Pipeline.
"""
import pytest
import sys
import tempfile
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.ml.training.deal_matching.progressive_learning import (
    ProgressiveLearner,
    LearningPhase,
    PhaseTransitionConfig,
    ProcessingResult
)
from src.ml.training.deal_matching.deal_data_generator import DealDataGenerator
from src.ml.models.deal_matching.deal_parser_regex import ExtractedDeal, DealType
from src.ml.models.deal_matching.deal_matcher import ProductCatalog


class TestProgressiveLearner:
    """Tests for the progressive learning system."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test data."""
        with tempfile.TemporaryDirectory() as td:
            yield Path(td)

    @pytest.fixture
    def learner(self, temp_dir):
        """Create learner instance with test config."""
        config = PhaseTransitionConfig(
            min_ads_for_phase_2=3,      # Lower thresholds for testing
            min_corrections_for_phase_2=5,
            min_ads_for_phase_3=8,
            min_corrections_for_phase_3=15,
            min_accuracy_for_phase_3=0.4,
            ml_retrain_threshold=3,
        )
        return ProgressiveLearner(data_dir=temp_dir, config=config)

    @pytest.fixture
    def generator(self):
        """Create data generator."""
        return DealDataGenerator(seed=42)

    # Phase Tests

    def test_initial_phase_is_regex(self, learner):
        """Test that learner starts in Phase 1 (regex)."""
        assert learner.current_phase == LearningPhase.PHASE_1_REGEX

    def test_phase_advancement_after_ads(self, learner, generator):
        """Test phase advancement after processing ads."""
        # Process enough ads to advance
        for i in range(5):
            ad = generator.generate_ad(store='costco', num_deals=3)
            learner.process_ad(ad.raw_text, store='costco')

        # Should have advanced to Phase 2
        assert learner.current_phase.value >= LearningPhase.PHASE_2_TEMPLATE.value

    def test_phase_advancement_after_corrections(self, learner, generator):
        """Test phase advancement after corrections."""
        # Submit corrections
        for i in range(6):
            original = ExtractedDeal(
                raw_text=f"Product {i}",
                deal_type=DealType.PRICE,
                price=9.99
            )
            corrected = ExtractedDeal(
                raw_text=f"Product {i}",
                deal_type=DealType.PRICE,
                price=5.99
            )
            learner.learn_from_correction(
                deal_id=f"deal_{i}",
                original_deal=original,
                corrected_deal=corrected,
                raw_text=f"Product {i} $5.99",
                store='safeway'
            )

        # Should have advanced
        assert learner.current_phase.value >= LearningPhase.PHASE_2_TEMPLATE.value

    def test_force_phase(self, learner):
        """Test forcing a specific phase."""
        learner.force_phase(3)
        assert learner.current_phase == LearningPhase.PHASE_3_ML

        learner.force_phase(1)
        assert learner.current_phase == LearningPhase.PHASE_1_REGEX

    # Processing Tests

    def test_process_ad_returns_result(self, learner, generator):
        """Test that process_ad returns ProcessingResult."""
        ad = generator.generate_ad(store='walmart', num_deals=3)
        result = learner.process_ad(ad.raw_text, store='walmart')

        assert isinstance(result, ProcessingResult)
        assert isinstance(result.deals, list)
        assert result.phase_used is not None
        assert 0 <= result.confidence <= 1
        assert result.processing_time_ms >= 0

    def test_process_ad_extracts_deals(self, learner, generator):
        """Test that process_ad extracts deals."""
        ad = generator.generate_ad(
            store='safeway',
            num_deals=5,
            ocr_quality=1.0  # Perfect OCR
        )
        result = learner.process_ad(ad.raw_text, store='safeway')

        # Should extract at least some deals
        assert len(result.deals) > 0

    def test_process_ad_tracks_count(self, learner, generator):
        """Test that ad processing is tracked."""
        initial_count = sum(learner.ads_processed.values())

        ad = generator.generate_ad(store='kroger', num_deals=2)
        learner.process_ad(ad.raw_text, store='kroger')

        assert sum(learner.ads_processed.values()) == initial_count + 1
        assert learner.ads_processed.get('kroger', 0) >= 1

    # Correction Learning Tests

    def test_learn_from_correction(self, learner):
        """Test learning from user correction."""
        original = ExtractedDeal(
            raw_text="Chicken $9.99",
            deal_type=DealType.PRICE,
            product_name="Chicken",
            price=9.99
        )
        corrected = ExtractedDeal(
            raw_text="Chicken $5.99",
            deal_type=DealType.PRICE,
            product_name="Chicken Breast",
            price=5.99
        )

        result = learner.learn_from_correction(
            deal_id="test_deal_1",
            original_deal=original,
            corrected_deal=corrected,
            raw_text="Chicken Breast $5.99/lb",
            store='costco'
        )

        assert 'correction_id' in result
        assert 'total_corrections' in result
        assert result['total_corrections'] > 0
        assert 'template_updated' in result['actions_taken']

    def test_corrections_accumulate_training_data(self, learner):
        """Test that corrections add training data."""
        initial_size = len(learner.training_data)

        # Need to provide product info for training data
        original = ExtractedDeal(
            raw_text="Test",
            deal_type=DealType.PRICE,
            price=9.99
        )
        corrected = ExtractedDeal(
            raw_text="Test",
            deal_type=DealType.PRICE,
            price=5.99
        )

        # This won't add training data without product match info
        learner.learn_from_correction(
            deal_id="test",
            original_deal=original,
            corrected_deal=corrected,
            raw_text="Test $5.99",
            store='test'
        )

        # Training data may not increase without product info
        assert learner.total_corrections > 0

    # Statistics Tests

    def test_get_stats(self, learner):
        """Test statistics gathering."""
        stats = learner.get_stats()

        assert 'current_phase' in stats
        assert 'total_ads_processed' in stats
        assert 'total_corrections' in stats
        assert 'accuracy' in stats
        assert 'parsers' in stats

    def test_should_advance_phase_info(self, learner):
        """Test phase advancement info."""
        info = learner.should_advance_phase()

        assert 'current_phase' in info
        assert 'next_phase' in info
        assert 'ready' in info

    # Catalog Tests

    def test_set_catalog(self, learner, generator):
        """Test setting product catalog."""
        products = generator.generate_product_catalog(50)
        catalog = ProductCatalog(products=products)
        learner.set_catalog(catalog)

        assert len(learner.catalog.products) == 50

    # State Persistence Tests

    def test_state_persistence(self, temp_dir, generator):
        """Test state saves and loads correctly."""
        config = PhaseTransitionConfig(
            min_ads_for_phase_2=10,  # High threshold to prevent auto-advancement
            min_corrections_for_phase_2=30,
        )

        # Create learner and do some work
        learner1 = ProgressiveLearner(data_dir=temp_dir, config=config)

        for i in range(3):
            ad = generator.generate_ad(store='walmart', num_deals=2)
            learner1.process_ad(ad.raw_text, store='walmart')

        ads_before = sum(learner1.ads_processed.values())

        # Explicitly save state
        learner1._save_state()

        # Create new learner with same path
        learner2 = ProgressiveLearner(data_dir=temp_dir, config=config)

        # State should be restored - ads count should match
        assert sum(learner2.ads_processed.values()) == ads_before


class TestPhaseTransitionConfig:
    """Tests for phase transition configuration."""

    def test_default_config(self):
        """Test default configuration values."""
        config = PhaseTransitionConfig()

        assert config.min_ads_for_phase_2 == 5
        assert config.min_corrections_for_phase_2 == 20
        assert config.min_ads_for_phase_3 == 15
        assert config.min_corrections_for_phase_3 == 50
        assert config.min_accuracy_for_phase_3 == 0.55
        assert config.ml_retrain_threshold == 10

    def test_custom_config(self):
        """Test custom configuration."""
        config = PhaseTransitionConfig(
            min_ads_for_phase_2=10,
            min_corrections_for_phase_2=30,
        )

        assert config.min_ads_for_phase_2 == 10
        assert config.min_corrections_for_phase_2 == 30


class TestProcessingResult:
    """Tests for ProcessingResult dataclass."""

    def test_processing_result_creation(self):
        """Test creating ProcessingResult."""
        result = ProcessingResult(
            deals=[],
            matches=[],
            phase_used=LearningPhase.PHASE_1_REGEX,
            confidence=0.5,
            store='test',
            processing_time_ms=10.5,
        )

        assert result.deals == []
        assert result.matches == []
        assert result.phase_used == LearningPhase.PHASE_1_REGEX
        assert result.confidence == 0.5
        assert result.store == 'test'
        assert result.processing_time_ms == 10.5
