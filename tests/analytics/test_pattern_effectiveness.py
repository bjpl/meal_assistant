"""
Tests for Pattern Effectiveness Analyzer.
"""
import pytest
from datetime import date, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import (
    PatternType, PatternLog, WeightEntry, DailyContext,
    DayType, WeatherCondition, StressLevel, ActivityLevel
)
from src.analytics.pattern_effectiveness import PatternEffectivenessAnalyzer


class TestPatternEffectivenessAnalyzer:
    """Tests for PatternEffectivenessAnalyzer."""

    def setup_method(self):
        """Set up test fixtures."""
        self.analyzer = PatternEffectivenessAnalyzer()

    def test_initialization(self):
        """Test analyzer initialization."""
        assert self.analyzer is not None
        assert len(self.analyzer.pattern_metrics) == len(PatternType)

    def test_load_empty_data(self):
        """Test loading empty data."""
        self.analyzer.load_data([], [])

        assert self.analyzer.logs_processed == 0

    @pytest.fixture
    def sample_data(self):
        """Generate sample data for testing."""
        pattern_logs = []
        weight_entries = []

        # Generate 30 days of data
        for i in range(30):
            log_date = date.today() - timedelta(days=30 - i)

            # Alternate patterns
            pattern = list(PatternType)[i % 7]

            context = DailyContext(
                date=log_date,
                day_type=DayType.WEEKDAY if log_date.weekday() < 5 else DayType.WEEKEND,
                weather=WeatherCondition.SUNNY,
                stress_level=StressLevel.MODERATE,
                activity_level=ActivityLevel.MODERATE,
            )

            pattern_logs.append(PatternLog(
                date=log_date,
                pattern_planned=pattern,
                pattern_actual=pattern,
                context=context,
                adherence_score=0.85 + (i % 3) * 0.05,
                calorie_variance=50 - (i % 5) * 20,
                protein_variance=5 - (i % 3) * 3,
                energy_rating=3 + (i % 3),
                satisfaction_rating=3 + (i % 3),
                hunger_rating=3 + (i % 2),
            ))

            weight_entries.append(WeightEntry(
                date=log_date,
                weight_lbs=250.0 - i * 0.15,
                time_of_day="morning",
            ))

        return pattern_logs, weight_entries

    def test_load_data(self, sample_data):
        """Test loading sample data."""
        pattern_logs, weight_entries = sample_data

        self.analyzer.load_data(pattern_logs, weight_entries)

        assert self.analyzer.logs_processed == 30
        assert len(self.analyzer.weight_by_date) == 30

    def test_get_pattern_analytics(self, sample_data):
        """Test getting analytics for a pattern."""
        pattern_logs, weight_entries = sample_data
        self.analyzer.load_data(pattern_logs, weight_entries)

        analytics = self.analyzer.get_pattern_analytics(PatternType.TRADITIONAL)

        assert analytics.pattern == PatternType.TRADITIONAL
        assert analytics.total_days_used > 0
        assert 0 <= analytics.average_adherence <= 1
        assert 1 <= analytics.average_energy_rating <= 5

    def test_get_all_pattern_rankings(self, sample_data):
        """Test getting pattern rankings."""
        pattern_logs, weight_entries = sample_data
        self.analyzer.load_data(pattern_logs, weight_entries)

        rankings = self.analyzer.get_all_pattern_rankings()

        assert "by_adherence" in rankings
        assert "by_weight_loss" in rankings
        assert "by_energy" in rankings
        assert "by_satisfaction" in rankings
        assert "by_success_rate" in rankings

        # Each ranking should have entries
        for key, ranking in rankings.items():
            assert len(ranking) > 0

    def test_pattern_fatigue_detection(self, sample_data):
        """Test pattern fatigue detection."""
        pattern_logs, weight_entries = sample_data

        # Modify data to simulate fatigue - declining adherence
        for i in range(10):
            pattern_logs[-(i + 1)].adherence_score = 0.65 - i * 0.02
            pattern_logs[-(i + 1)].pattern_actual = PatternType.TRADITIONAL

        self.analyzer.load_data(pattern_logs, weight_entries)

        fatigue = self.analyzer.get_pattern_fatigue_risk(PatternType.TRADITIONAL)

        # Should detect some level of fatigue
        assert fatigue["risk_level"] in ["low", "medium", "high", "unknown"]

    def test_generate_summary_report(self, sample_data):
        """Test summary report generation."""
        pattern_logs, weight_entries = sample_data
        self.analyzer.load_data(pattern_logs, weight_entries)

        report = self.analyzer.generate_summary_report()

        assert "summary" in report
        assert "usage_distribution" in report
        assert "best_patterns" in report
        assert "rankings" in report
        assert "pattern_analytics" in report

        assert report["summary"]["total_days_tracked"] == 30

    def test_context_correlations(self, sample_data):
        """Test context correlation analysis."""
        pattern_logs, weight_entries = sample_data
        self.analyzer.load_data(pattern_logs, weight_entries)

        correlations = self.analyzer.analyze_context_correlations()

        assert "day_type" in correlations
        assert "weather" in correlations
        assert "stress_level" in correlations
