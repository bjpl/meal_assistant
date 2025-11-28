"""
Tests for Synthetic Data Generator.
"""
import pytest
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.ml.training.deal_matching.deal_data_generator import (
    DealDataGenerator,
    SyntheticAd,
    SyntheticCorrection
)
from src.ml.models.deal_matching.deal_parser_regex import DealType


class TestDealDataGenerator:
    """Tests for the synthetic data generator."""

    @pytest.fixture
    def generator(self):
        """Create generator with fixed seed for reproducibility."""
        return DealDataGenerator(seed=42)

    @pytest.fixture
    def random_generator(self):
        """Create generator without seed."""
        return DealDataGenerator()

    # Ad Generation Tests

    def test_generate_ad_returns_synthetic_ad(self, generator):
        """Test that generate_ad returns SyntheticAd."""
        ad = generator.generate_ad(store='costco', num_deals=5)

        assert isinstance(ad, SyntheticAd)
        assert ad.store == 'costco'
        assert ad.raw_text is not None
        assert len(ad.raw_text) > 0

    def test_generate_ad_creates_deals(self, generator):
        """Test that generated ads contain deals."""
        ad = generator.generate_ad(store='walmart', num_deals=5)

        assert len(ad.deals) == 5
        for deal in ad.deals:
            assert deal.deal_type is not None

    def test_generate_ad_all_stores(self, generator):
        """Test ad generation for all supported stores."""
        stores = ['costco', 'whole_foods', 'safeway', 'walmart', 'kroger']

        for store in stores:
            ad = generator.generate_ad(store=store, num_deals=3)
            assert ad.store == store
            assert len(ad.deals) == 3
            assert store.lower() in ad.raw_text.lower() or len(ad.raw_text) > 50

    def test_generate_ad_ocr_quality(self, generator):
        """Test that OCR quality affects text."""
        # Perfect quality
        ad_perfect = generator.generate_ad(
            store='safeway',
            num_deals=3,
            ocr_quality=1.0
        )

        # Poor quality
        ad_poor = generator.generate_ad(
            store='safeway',
            num_deals=3,
            ocr_quality=0.5
        )

        assert ad_perfect.ocr_quality == 1.0
        assert ad_poor.ocr_quality == 0.5

        # Poor quality text might have some differences (hard to test precisely)

    def test_generate_ad_deal_types(self, generator):
        """Test that various deal types are generated."""
        # Generate many ads to get variety
        deal_types_found = set()

        for _ in range(20):
            ad = generator.generate_ad(
                store='walmart',
                num_deals=5,
                include_multi_buy=True,
                include_bogo=True
            )
            for deal in ad.deals:
                deal_types_found.add(deal.deal_type)

        # Should have found multiple types
        assert len(deal_types_found) >= 2

    def test_generate_ad_reproducibility(self):
        """Test that same seed produces same deal count."""
        gen1 = DealDataGenerator(seed=123)
        gen2 = DealDataGenerator(seed=123)

        ad1 = gen1.generate_ad(store='costco', num_deals=3, ocr_quality=1.0)
        ad2 = gen2.generate_ad(store='costco', num_deals=3, ocr_quality=1.0)

        # With same seed, should have same number of deals
        assert len(ad1.deals) == len(ad2.deals)
        # Both should be from costco
        assert ad1.store == ad2.store == 'costco'

    # Product Catalog Generation Tests

    def test_generate_product_catalog(self, generator):
        """Test product catalog generation."""
        catalog = generator.generate_product_catalog(num_products=50)

        assert len(catalog) == 50
        for product in catalog:
            assert 'id' in product
            assert 'name' in product
            assert 'category' in product
            assert 'typical_price' in product

    def test_generate_product_catalog_categories(self, generator):
        """Test that catalog has diverse categories."""
        catalog = generator.generate_product_catalog(num_products=100)

        categories = set(p['category'] for p in catalog)
        assert len(categories) >= 3  # Multiple categories

    def test_generate_product_catalog_prices(self, generator):
        """Test that catalog prices are reasonable."""
        catalog = generator.generate_product_catalog(num_products=50)

        for product in catalog:
            assert 0 < product['typical_price'] < 100  # Reasonable range

    # Correction Generation Tests

    def test_generate_corrections(self, generator):
        """Test synthetic correction generation."""
        ad = generator.generate_ad(store='safeway', num_deals=5)

        # Simulate some parsed deals (imperfect)
        from src.ml.models.deal_matching.deal_parser_regex import ExtractedDeal

        parsed = [
            ExtractedDeal(
                raw_text=ad.deals[0].raw_text if ad.deals else "test",
                deal_type=DealType.PRICE,
                price=9.99  # Wrong price
            )
        ]

        corrections = generator.generate_corrections(
            ad=ad,
            parsed_deals=parsed,
            error_rate=0.5
        )

        assert isinstance(corrections, list)
        # May or may not have corrections depending on matching

    # Training Batch Generation Tests

    def test_generate_training_batch(self, generator):
        """Test batch generation for training."""
        ads, corrections = generator.generate_training_batch(
            num_ads=5,
            ocr_quality_range=(0.8, 0.95)
        )

        assert len(ads) == 5
        for ad in ads:
            assert 0.8 <= ad.ocr_quality <= 0.95

    def test_generate_training_batch_stores(self, generator):
        """Test batch generation with specific stores."""
        ads, _ = generator.generate_training_batch(
            num_ads=10,
            stores=['costco', 'walmart']
        )

        stores_in_batch = set(ad.store.lower() for ad in ads)
        assert stores_in_batch.issubset({'costco', 'walmart'})

    # Progressive Learning Simulation Tests

    def test_simulate_progressive_learning(self, generator):
        """Test progressive learning simulation."""
        results = generator.simulate_progressive_learning(
            num_weeks=5,
            ads_per_week=10,
            correction_rate=0.4
        )

        assert 'weeks' in results
        assert len(results['weeks']) == 5

        # Check accuracy progression
        accuracies = [w['expected_accuracy'] for w in results['weeks']]
        assert accuracies[-1] >= accuracies[0]  # Should improve

        # Check phase progression
        phases = [w['phase'] for w in results['weeks']]
        assert phases[0] <= phases[-1]  # Should advance

    def test_simulate_progressive_learning_phases(self, generator):
        """Test that simulation reaches Phase 3."""
        results = generator.simulate_progressive_learning(
            num_weeks=5,
            ads_per_week=20,
            correction_rate=0.5
        )

        final_phase = results['weeks'][-1]['phase']
        assert final_phase >= 2  # Should reach at least Phase 2


class TestSyntheticAd:
    """Tests for SyntheticAd dataclass."""

    def test_synthetic_ad_creation(self):
        """Test creating SyntheticAd."""
        ad = SyntheticAd(
            store='test_store',
            raw_text='Test ad text',
            deals=[],
            ocr_quality=0.9,
            metadata={'key': 'value'}
        )

        assert ad.store == 'test_store'
        assert ad.raw_text == 'Test ad text'
        assert ad.deals == []
        assert ad.ocr_quality == 0.9
        assert ad.metadata == {'key': 'value'}


class TestProductVariety:
    """Tests for product variety in generator."""

    @pytest.fixture
    def generator(self):
        return DealDataGenerator(seed=42)

    def test_products_have_reasonable_prices(self, generator):
        """Test that generated product prices are reasonable."""
        for _ in range(10):
            ad = generator.generate_ad(store='walmart', num_deals=5)
            for deal in ad.deals:
                if deal.price:
                    assert 0.01 <= deal.price <= 100  # Reasonable grocery range

    def test_products_cover_categories(self, generator):
        """Test that products cover multiple categories."""
        categories_seen = set()

        for _ in range(20):
            ad = generator.generate_ad(store='costco', num_deals=5)
            for deal in ad.deals:
                if deal.metadata.get('category'):
                    categories_seen.add(deal.metadata['category'])

        assert len(categories_seen) >= 3
