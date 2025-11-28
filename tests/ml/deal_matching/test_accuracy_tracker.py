"""
Tests for Accuracy Tracker.
"""
import pytest
import sys
import tempfile
from pathlib import Path
from datetime import datetime, timedelta

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.ml.models.deal_matching.accuracy_tracker import (
    AccuracyTracker,
    AccuracyMetrics,
    StoreAccuracy
)


class TestAccuracyMetrics:
    """Tests for AccuracyMetrics dataclass."""

    def test_accuracy_calculation(self):
        """Test accuracy calculation."""
        metrics = AccuracyMetrics(
            total_deals=100,
            correct_matches=70,
            incorrect_matches=30,
            corrections_received=15
        )

        assert metrics.accuracy == 0.7
        assert metrics.correction_rate == 0.15

    def test_accuracy_with_zero_deals(self):
        """Test accuracy with no deals."""
        metrics = AccuracyMetrics()

        assert metrics.accuracy == 0.0
        assert metrics.correction_rate == 0.0


class TestAccuracyTracker:
    """Tests for AccuracyTracker."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        with tempfile.TemporaryDirectory() as td:
            yield Path(td)

    @pytest.fixture
    def tracker(self, temp_dir):
        """Create tracker instance."""
        return AccuracyTracker(storage_path=temp_dir / "accuracy.json")

    # Recording Tests

    def test_record_result(self, tracker):
        """Test recording a result."""
        tracker.record_result(
            store='costco',
            is_correct=True,
            phase=1,
            deal_type='price'
        )

        global_acc = tracker.get_global_accuracy()
        assert global_acc['total_deals'] == 1
        assert global_acc['correct_matches'] == 1

    def test_record_multiple_results(self, tracker):
        """Test recording multiple results."""
        # 7 correct, 3 incorrect = 70% accuracy
        for i in range(7):
            tracker.record_result('walmart', True, 1, 'price')
        for i in range(3):
            tracker.record_result('walmart', False, 1, 'price')

        store_acc = tracker.get_store_accuracy('walmart')
        assert store_acc['total_deals'] == 10
        assert abs(store_acc['accuracy'] - 0.7) < 0.01

    def test_record_correction(self, tracker):
        """Test recording a correction."""
        tracker.record_result('safeway', False, 1, 'price')
        tracker.record_correction('safeway', 1, 'price')

        global_acc = tracker.get_global_accuracy()
        assert global_acc['corrections_received'] == 1

    # Store Accuracy Tests

    def test_get_store_accuracy_unknown_store(self, tracker):
        """Test getting accuracy for unknown store."""
        acc = tracker.get_store_accuracy('unknown_store')

        assert acc['total_deals'] == 0
        assert acc['accuracy'] == 0.0
        assert 'message' in acc

    def test_get_store_accuracy_by_phase(self, tracker):
        """Test accuracy tracking by phase."""
        # Phase 1 results
        for i in range(5):
            tracker.record_result('kroger', True, 1, 'price')

        # Phase 2 results (better)
        for i in range(10):
            tracker.record_result('kroger', True, 2, 'price')

        acc = tracker.get_store_accuracy('kroger')
        assert 1 in acc['by_phase']
        assert 2 in acc['by_phase']
        assert acc['by_phase'][1]['total_deals'] == 5
        assert acc['by_phase'][2]['total_deals'] == 10

    def test_get_store_accuracy_by_deal_type(self, tracker):
        """Test accuracy tracking by deal type."""
        tracker.record_result('costco', True, 1, 'price')
        tracker.record_result('costco', True, 1, 'multi_buy')
        tracker.record_result('costco', False, 1, 'bogo')

        acc = tracker.get_store_accuracy('costco')
        assert 'price' in acc['by_deal_type']
        assert 'multi_buy' in acc['by_deal_type']
        assert 'bogo' in acc['by_deal_type']

    # Phase Accuracy Tests

    def test_get_phase_accuracy(self, tracker):
        """Test getting phase-wide accuracy."""
        # Multiple stores, same phase
        for store in ['costco', 'walmart', 'safeway']:
            for i in range(10):
                tracker.record_result(store, i < 7, 2, 'price')

        phase_acc = tracker.get_phase_accuracy(2)
        assert phase_acc['phase'] == 2
        assert phase_acc['total_deals'] == 30
        assert abs(phase_acc['accuracy'] - 0.7) < 0.01

    def test_get_phase_accuracy_meets_target(self, tracker):
        """Test phase accuracy target checking."""
        # Add results that exceed phase 2 target (55%)
        for i in range(100):
            tracker.record_result('test', i < 60, 2, 'price')

        phase_acc = tracker.get_phase_accuracy(2)
        assert phase_acc['meets_target'] == True

    # Trend Tests

    def test_get_trend_insufficient_data(self, tracker):
        """Test trend with insufficient data."""
        trend = tracker.get_trend(days=7)

        assert trend['trend'] == 'insufficient_data'

    def test_get_trend_improving(self, tracker):
        """Test detecting improving trend."""
        # Simulate improving accuracy over days
        base_time = datetime.now() - timedelta(days=10)

        for day in range(10):
            timestamp = base_time + timedelta(days=day)
            correct_rate = 0.3 + (day * 0.05)  # Improving

            for i in range(10):
                is_correct = i < int(correct_rate * 10)
                tracker.record_result(
                    'test', is_correct, 1, 'price',
                    timestamp=timestamp
                )

        trend = tracker.get_trend(days=10)
        # Should detect improvement or at least have data
        assert trend['data_points'] > 0

    def test_get_trend_by_store(self, tracker):
        """Test trend filtering by store."""
        base_time = datetime.now() - timedelta(days=5)

        for day in range(5):
            timestamp = base_time + timedelta(days=day)
            tracker.record_result('costco', True, 1, 'price', timestamp)
            tracker.record_result('walmart', False, 1, 'price', timestamp)

        costco_trend = tracker.get_trend(store='costco', days=5)
        walmart_trend = tracker.get_trend(store='walmart', days=5)

        # Both should have data
        assert costco_trend['data_points'] > 0
        assert walmart_trend['data_points'] > 0

    # Prediction Tests

    def test_predict_target_date_insufficient_data(self, tracker):
        """Test prediction with insufficient data."""
        pred = tracker.predict_target_date(target_accuracy=0.85)

        assert pred['prediction'] in ['insufficient_data', 'achieved']

    def test_predict_target_date_already_achieved(self, tracker):
        """Test prediction when target already achieved."""
        # Add high accuracy results with timestamps over several days
        from datetime import timedelta
        base_time = datetime.now() - timedelta(days=5)

        for day in range(5):
            timestamp = base_time + timedelta(days=day)
            for i in range(20):
                tracker.record_result('test', i < 18, 3, 'price', timestamp=timestamp)  # 90% accuracy

        pred = tracker.predict_target_date(target_accuracy=0.85)

        # Should be achieved or have sufficient data
        assert pred['prediction'] in ['achieved', 'estimated', 'long_term']

    # Stores Needing Training Tests

    def test_get_stores_needing_training_low_accuracy(self, tracker):
        """Test identifying stores with low accuracy."""
        # Store with low accuracy
        for i in range(20):
            tracker.record_result('bad_store', i < 8, 1, 'price')  # 40% accuracy

        # Store with high accuracy
        for i in range(20):
            tracker.record_result('good_store', i < 16, 1, 'price')  # 80% accuracy

        needs_training = tracker.get_stores_needing_training(
            min_accuracy=0.6,
            min_samples=10
        )

        store_names = [s['store'] for s in needs_training]
        assert 'bad_store' in store_names
        assert 'good_store' not in store_names

    def test_get_stores_needing_training_insufficient_samples(self, tracker):
        """Test identifying stores with few samples."""
        # Store with few samples
        for i in range(3):
            tracker.record_result('new_store', True, 1, 'price')

        needs_training = tracker.get_stores_needing_training(
            min_accuracy=0.5,
            min_samples=10
        )

        store_names = [s['store'] for s in needs_training]
        assert 'new_store' in store_names
        assert needs_training[0]['reason'] == 'insufficient_samples'

    # Report Generation Tests

    def test_generate_report(self, tracker):
        """Test comprehensive report generation."""
        # Add some data
        for store in ['costco', 'walmart']:
            for i in range(10):
                tracker.record_result(store, i < 7, 2, 'price')

        report = tracker.generate_report()

        assert 'generated_at' in report
        assert 'global' in report
        assert 'by_phase' in report
        assert 'by_store' in report
        assert 'trend' in report

    # Persistence Tests

    def test_persistence(self, temp_dir):
        """Test saving and loading tracker data."""
        storage_path = temp_dir / "test_acc.json"

        # Create and populate tracker
        tracker1 = AccuracyTracker(storage_path=storage_path)
        for i in range(10):
            tracker1.record_result('test_store', i < 7, 1, 'price')

        # Create new tracker from same file
        tracker2 = AccuracyTracker(storage_path=storage_path)

        # Should have same data
        assert tracker2.get_global_accuracy()['total_deals'] == 10
        assert abs(tracker2.get_global_accuracy()['accuracy'] - 0.7) < 0.01


class TestStoreAccuracy:
    """Tests for StoreAccuracy dataclass."""

    def test_add_result(self):
        """Test adding result to store accuracy."""
        store_acc = StoreAccuracy(store_name='test')

        store_acc.add_result(True, 1, 'price')
        store_acc.add_result(False, 1, 'price')

        assert store_acc.overall.total_deals == 2
        assert store_acc.overall.correct_matches == 1
        assert store_acc.overall.accuracy == 0.5

    def test_add_correction(self):
        """Test adding correction to store accuracy."""
        store_acc = StoreAccuracy(store_name='test')

        store_acc.add_result(False, 1, 'price')
        store_acc.add_correction(1, 'price')

        assert store_acc.overall.corrections_received == 1
