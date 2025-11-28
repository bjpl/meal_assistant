"""
Pattern Effectiveness Analyzer.
Analyzes success rates, weight loss correlation, and optimal contexts for each pattern.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import (
    PatternType, PatternLog, WeightEntry, DailyContext,
    DayType, WeatherCondition, StressLevel, PatternAnalytics
)


@dataclass
class PatternMetrics:
    """Detailed metrics for a single pattern."""
    pattern: PatternType
    total_days: int = 0
    successful_days: int = 0  # adherence >= 0.8
    adherence_scores: List[float] = field(default_factory=list)
    calorie_variances: List[float] = field(default_factory=list)
    protein_variances: List[float] = field(default_factory=list)
    energy_ratings: List[int] = field(default_factory=list)
    satisfaction_ratings: List[int] = field(default_factory=list)
    hunger_ratings: List[int] = field(default_factory=list)
    weight_changes: List[float] = field(default_factory=list)  # Daily weight change when using pattern
    contexts: List[DailyContext] = field(default_factory=list)


@dataclass
class ContextPerformance:
    """Performance metrics for a specific context."""
    context_type: str
    context_value: str
    pattern: PatternType
    days_used: int
    avg_adherence: float
    avg_energy: float
    avg_satisfaction: float
    weight_trend: float  # Average daily weight change


class PatternEffectivenessAnalyzer:
    """
    Analyzes pattern effectiveness across multiple dimensions:
    - Success rate by pattern
    - Weight loss correlation
    - Energy and satisfaction trends
    - Context-based performance
    """

    ADHERENCE_THRESHOLD = 0.8  # 80% adherence = successful day

    def __init__(self):
        """Initialize analyzer."""
        self.pattern_metrics: Dict[PatternType, PatternMetrics] = {
            p: PatternMetrics(pattern=p) for p in PatternType
        }
        self.weight_by_date: Dict[date, float] = {}
        self.logs_processed = 0

    def load_data(
        self,
        pattern_logs: List[PatternLog],
        weight_entries: List[WeightEntry]
    ) -> None:
        """
        Load historical data for analysis.

        Args:
            pattern_logs: List of daily pattern logs
            weight_entries: List of weight tracking entries
        """
        # Build weight lookup
        self.weight_by_date = {w.date: w.weight_lbs for w in weight_entries}

        # Process pattern logs
        for log in pattern_logs:
            pattern = log.pattern_actual or log.pattern_planned
            metrics = self.pattern_metrics[pattern]

            metrics.total_days += 1
            metrics.adherence_scores.append(log.adherence_score)

            if log.adherence_score >= self.ADHERENCE_THRESHOLD:
                metrics.successful_days += 1

            metrics.calorie_variances.append(log.calorie_variance)
            metrics.protein_variances.append(log.protein_variance)

            if log.energy_rating:
                metrics.energy_ratings.append(log.energy_rating)
            if log.satisfaction_rating:
                metrics.satisfaction_ratings.append(log.satisfaction_rating)
            if log.hunger_rating:
                metrics.hunger_ratings.append(log.hunger_rating)
            if log.context:
                metrics.contexts.append(log.context)

            # Calculate weight change for this day
            if log.date in self.weight_by_date:
                prev_date = log.date - timedelta(days=1)
                if prev_date in self.weight_by_date:
                    change = self.weight_by_date[log.date] - self.weight_by_date[prev_date]
                    metrics.weight_changes.append(change)

        self.logs_processed = len(pattern_logs)

    def get_pattern_analytics(self, pattern: PatternType) -> PatternAnalytics:
        """
        Get comprehensive analytics for a specific pattern.

        Args:
            pattern: Pattern to analyze

        Returns:
            PatternAnalytics with all metrics
        """
        metrics = self.pattern_metrics[pattern]

        if metrics.total_days == 0:
            return PatternAnalytics(
                pattern=pattern,
                total_days_used=0,
                successful_days=0,
                average_adherence=0.0,
                average_calorie_variance=0.0,
                average_protein_variance=0.0,
                average_energy_rating=0.0,
                average_satisfaction_rating=0.0,
                average_hunger_rating=0.0,
                weight_change_correlation=0.0,
                best_contexts=[],
            )

        # Calculate averages
        avg_adherence = np.mean(metrics.adherence_scores) if metrics.adherence_scores else 0.0
        avg_cal_var = np.mean(metrics.calorie_variances) if metrics.calorie_variances else 0.0
        avg_prot_var = np.mean(metrics.protein_variances) if metrics.protein_variances else 0.0
        avg_energy = np.mean(metrics.energy_ratings) if metrics.energy_ratings else 0.0
        avg_satisfaction = np.mean(metrics.satisfaction_ratings) if metrics.satisfaction_ratings else 0.0
        avg_hunger = np.mean(metrics.hunger_ratings) if metrics.hunger_ratings else 0.0

        # Calculate weight change correlation
        weight_correlation = 0.0
        if len(metrics.weight_changes) >= 5 and len(metrics.adherence_scores) >= 5:
            # Correlation between adherence and weight loss
            min_len = min(len(metrics.weight_changes), len(metrics.adherence_scores))
            if np.std(metrics.weight_changes[:min_len]) > 0 and np.std(metrics.adherence_scores[:min_len]) > 0:
                weight_correlation = float(np.corrcoef(
                    metrics.adherence_scores[:min_len],
                    metrics.weight_changes[:min_len]
                )[0, 1])

        # Find best contexts
        best_contexts = self._find_best_contexts(metrics)

        return PatternAnalytics(
            pattern=pattern,
            total_days_used=metrics.total_days,
            successful_days=metrics.successful_days,
            average_adherence=round(avg_adherence, 3),
            average_calorie_variance=round(avg_cal_var, 1),
            average_protein_variance=round(avg_prot_var, 1),
            average_energy_rating=round(avg_energy, 2),
            average_satisfaction_rating=round(avg_satisfaction, 2),
            average_hunger_rating=round(avg_hunger, 2),
            weight_change_correlation=round(weight_correlation, 3),
            best_contexts=best_contexts,
        )

    def _find_best_contexts(self, metrics: PatternMetrics) -> List[str]:
        """Find contexts where this pattern performs best."""
        if not metrics.contexts or metrics.total_days < 5:
            return []

        context_performance: Dict[str, List[float]] = defaultdict(list)

        # Aggregate adherence by context attributes
        for i, ctx in enumerate(metrics.contexts):
            if i < len(metrics.adherence_scores):
                adherence = metrics.adherence_scores[i]
                context_performance[f"day_type:{ctx.day_type.value}"].append(adherence)
                context_performance[f"weather:{ctx.weather.value}"].append(adherence)
                context_performance[f"stress:{ctx.stress_level.value}"].append(adherence)
                if ctx.has_morning_workout:
                    context_performance["morning_workout:yes"].append(adherence)
                if ctx.has_evening_social:
                    context_performance["evening_social:yes"].append(adherence)

        # Find top performing contexts
        scored_contexts = []
        for ctx_key, adherences in context_performance.items():
            if len(adherences) >= 3:  # Minimum sample size
                avg = np.mean(adherences)
                if avg >= 0.85:  # Above average threshold
                    scored_contexts.append((ctx_key, avg, len(adherences)))

        # Sort by average adherence, then by sample size
        scored_contexts.sort(key=lambda x: (x[1], x[2]), reverse=True)

        return [ctx for ctx, _, _ in scored_contexts[:5]]

    def get_all_pattern_rankings(self) -> Dict[str, List[Tuple[PatternType, float]]]:
        """
        Get pattern rankings across different dimensions.

        Returns:
            Dictionary with ranking lists for each dimension
        """
        rankings = {
            "by_adherence": [],
            "by_weight_loss": [],
            "by_energy": [],
            "by_satisfaction": [],
            "by_success_rate": [],
        }

        for pattern in PatternType:
            metrics = self.pattern_metrics[pattern]
            if metrics.total_days == 0:
                continue

            # Adherence ranking
            avg_adherence = np.mean(metrics.adherence_scores) if metrics.adherence_scores else 0
            rankings["by_adherence"].append((pattern, avg_adherence))

            # Weight loss (negative is good)
            avg_weight_change = np.mean(metrics.weight_changes) if metrics.weight_changes else 0
            rankings["by_weight_loss"].append((pattern, -avg_weight_change))  # Invert for ranking

            # Energy ranking
            avg_energy = np.mean(metrics.energy_ratings) if metrics.energy_ratings else 0
            rankings["by_energy"].append((pattern, avg_energy))

            # Satisfaction ranking
            avg_satisfaction = np.mean(metrics.satisfaction_ratings) if metrics.satisfaction_ratings else 0
            rankings["by_satisfaction"].append((pattern, avg_satisfaction))

            # Success rate
            success_rate = metrics.successful_days / metrics.total_days if metrics.total_days > 0 else 0
            rankings["by_success_rate"].append((pattern, success_rate))

        # Sort each ranking
        for key in rankings:
            rankings[key].sort(key=lambda x: x[1], reverse=True)

        return rankings

    def analyze_context_correlations(self) -> Dict[str, Dict[str, float]]:
        """
        Analyze how different contexts affect pattern success.

        Returns:
            Nested dict of context_type -> pattern -> correlation
        """
        correlations = {
            "day_type": {},
            "weather": {},
            "stress_level": {},
            "activity_level": {},
        }

        # Aggregate data by context and pattern
        for pattern, metrics in self.pattern_metrics.items():
            if metrics.total_days < 5:
                continue

            # Day type analysis
            for day_type in DayType:
                relevant_adherences = [
                    metrics.adherence_scores[i]
                    for i, ctx in enumerate(metrics.contexts)
                    if ctx.day_type == day_type and i < len(metrics.adherence_scores)
                ]
                if len(relevant_adherences) >= 3:
                    key = f"{pattern.value}_{day_type.value}"
                    correlations["day_type"][key] = round(np.mean(relevant_adherences), 3)

            # Weather analysis
            for weather in WeatherCondition:
                relevant_adherences = [
                    metrics.adherence_scores[i]
                    for i, ctx in enumerate(metrics.contexts)
                    if ctx.weather == weather and i < len(metrics.adherence_scores)
                ]
                if len(relevant_adherences) >= 3:
                    key = f"{pattern.value}_{weather.value}"
                    correlations["weather"][key] = round(np.mean(relevant_adherences), 3)

        return correlations

    def get_pattern_fatigue_risk(self, pattern: PatternType, recent_days: int = 7) -> Dict[str, Any]:
        """
        Detect if a pattern is showing fatigue signs.

        Args:
            pattern: Pattern to analyze
            recent_days: Number of recent days to check

        Returns:
            Dict with fatigue risk assessment
        """
        metrics = self.pattern_metrics[pattern]

        if len(metrics.adherence_scores) < recent_days * 2:
            return {
                "risk_level": "unknown",
                "message": "Insufficient data to assess fatigue",
                "recommendation": "Continue using pattern and track adherence",
            }

        # Compare recent adherence to historical average
        recent_adherence = np.mean(metrics.adherence_scores[-recent_days:])
        historical_adherence = np.mean(metrics.adherence_scores[:-recent_days])

        decline = historical_adherence - recent_adherence
        decline_pct = (decline / historical_adherence) * 100 if historical_adherence > 0 else 0

        # Check satisfaction trend
        satisfaction_decline = 0
        if len(metrics.satisfaction_ratings) >= recent_days * 2:
            recent_satisfaction = np.mean(metrics.satisfaction_ratings[-recent_days:])
            historical_satisfaction = np.mean(metrics.satisfaction_ratings[:-recent_days])
            satisfaction_decline = historical_satisfaction - recent_satisfaction

        # Assess risk
        if decline_pct > 15 or satisfaction_decline > 1:
            risk_level = "high"
            message = f"Pattern fatigue detected: {decline_pct:.1f}% adherence decline"
            recommendation = "Consider rotating to a different pattern for variety"
        elif decline_pct > 8 or satisfaction_decline > 0.5:
            risk_level = "medium"
            message = "Early signs of pattern fatigue"
            recommendation = "Monitor closely and consider small variations"
        else:
            risk_level = "low"
            message = "Pattern performance remains consistent"
            recommendation = "Continue with current pattern"

        return {
            "risk_level": risk_level,
            "message": message,
            "recommendation": recommendation,
            "adherence_change_pct": round(decline_pct, 1),
            "satisfaction_change": round(satisfaction_decline, 2),
            "days_on_pattern": len(metrics.adherence_scores),
        }

    def generate_summary_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive summary report of all patterns.

        Returns:
            Dict with complete analytics summary
        """
        total_days = sum(m.total_days for m in self.pattern_metrics.values())
        total_successful = sum(m.successful_days for m in self.pattern_metrics.values())

        # Pattern usage distribution
        usage_distribution = {
            p.value: m.total_days
            for p, m in self.pattern_metrics.items()
        }

        # Get rankings
        rankings = self.get_all_pattern_rankings()

        # Best patterns
        best_for_adherence = rankings["by_adherence"][0] if rankings["by_adherence"] else None
        best_for_weight = rankings["by_weight_loss"][0] if rankings["by_weight_loss"] else None
        best_for_energy = rankings["by_energy"][0] if rankings["by_energy"] else None

        return {
            "summary": {
                "total_days_tracked": total_days,
                "successful_days": total_successful,
                "overall_success_rate": round(total_successful / total_days, 3) if total_days > 0 else 0,
                "patterns_used": len([m for m in self.pattern_metrics.values() if m.total_days > 0]),
            },
            "usage_distribution": usage_distribution,
            "best_patterns": {
                "for_adherence": best_for_adherence[0].value if best_for_adherence else None,
                "for_weight_loss": best_for_weight[0].value if best_for_weight else None,
                "for_energy": best_for_energy[0].value if best_for_energy else None,
            },
            "rankings": {
                k: [(p.value, round(v, 3)) for p, v in v_list]
                for k, v_list in rankings.items()
            },
            "pattern_analytics": {
                p.value: self.get_pattern_analytics(p).__dict__
                for p in PatternType
                if self.pattern_metrics[p].total_days > 0
            },
        }
