"""
Insights Generator.
Generates actionable insights from analytics data.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import numpy as np

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import PatternType, PatternLog, WeightEntry
from src.analytics.pattern_effectiveness import PatternEffectivenessAnalyzer


@dataclass
class Insight:
    """A generated insight."""
    category: str  # "pattern", "weight", "nutrition", "behavior"
    title: str
    description: str
    impact: str  # "high", "medium", "low"
    actionable: bool
    action: Optional[str] = None
    confidence: float = 0.8
    data_points: int = 0


class InsightsGenerator:
    """
    Generates actionable insights from meal tracking data.

    Insight Categories:
    - Pattern optimization recommendations
    - Weight trend analysis
    - Nutritional balance insights
    - Behavioral pattern detection
    - Seasonal/contextual correlations
    """

    def __init__(self):
        """Initialize insights generator."""
        self.analyzer = PatternEffectivenessAnalyzer()
        self.pattern_logs: List[PatternLog] = []
        self.weight_entries: List[WeightEntry] = []

    def load_data(
        self,
        pattern_logs: List[PatternLog],
        weight_entries: List[WeightEntry]
    ) -> None:
        """Load data for analysis."""
        self.pattern_logs = pattern_logs
        self.weight_entries = weight_entries
        self.analyzer.load_data(pattern_logs, weight_entries)

    def generate_all_insights(self, max_insights: int = 10) -> List[Insight]:
        """
        Generate all applicable insights.

        Args:
            max_insights: Maximum number of insights to return

        Returns:
            List of Insight objects sorted by impact
        """
        insights = []

        # Generate different insight types
        insights.extend(self._generate_pattern_insights())
        insights.extend(self._generate_weight_insights())
        insights.extend(self._generate_adherence_insights())
        insights.extend(self._generate_context_insights())

        # Sort by impact and actionability
        impact_order = {"high": 0, "medium": 1, "low": 2}
        insights.sort(key=lambda i: (impact_order.get(i.impact, 2), not i.actionable))

        return insights[:max_insights]

    def _generate_pattern_insights(self) -> List[Insight]:
        """Generate insights about pattern usage."""
        insights = []

        if len(self.pattern_logs) < 7:
            return insights

        rankings = self.analyzer.get_all_pattern_rankings()

        # Best pattern for weight loss
        if rankings["by_weight_loss"]:
            best_pattern, score = rankings["by_weight_loss"][0]
            if score > 0.1:  # Significant weight loss
                insights.append(Insight(
                    category="pattern",
                    title=f"Best Pattern for Weight Loss: {best_pattern.value.replace('_', ' ').title()}",
                    description=f"This pattern correlates with the highest weight loss rate among all patterns you've used.",
                    impact="high",
                    actionable=True,
                    action=f"Consider using {best_pattern.value} pattern more frequently during weight loss phases.",
                    confidence=min(0.9, len(self.pattern_logs) / 30),
                    data_points=len(self.pattern_logs),
                ))

        # Best pattern for energy
        if rankings["by_energy"]:
            best_pattern, score = rankings["by_energy"][0]
            if score >= 4.0:  # High energy rating
                insights.append(Insight(
                    category="pattern",
                    title=f"Highest Energy Pattern: {best_pattern.value.replace('_', ' ').title()}",
                    description=f"Average energy rating of {score:.1f}/5 when using this pattern.",
                    impact="medium",
                    actionable=True,
                    action=f"Use {best_pattern.value} pattern on days requiring high energy.",
                    confidence=min(0.85, len(self.pattern_logs) / 20),
                    data_points=len(self.pattern_logs),
                ))

        # Pattern variety check
        patterns_used = set(
            log.pattern_actual or log.pattern_planned
            for log in self.pattern_logs[-14:]
        )
        if len(patterns_used) == 1:
            insights.append(Insight(
                category="pattern",
                title="Low Pattern Variety",
                description="You've used only one pattern in the last 2 weeks.",
                impact="medium",
                actionable=True,
                action="Try rotating patterns to prevent fatigue and maintain flexibility.",
                confidence=1.0,
                data_points=14,
            ))

        # Pattern fatigue detection
        for pattern in PatternType:
            fatigue = self.analyzer.get_pattern_fatigue_risk(pattern)
            if fatigue["risk_level"] == "high":
                insights.append(Insight(
                    category="pattern",
                    title=f"Pattern Fatigue Detected: {pattern.value.replace('_', ' ').title()}",
                    description=fatigue["message"],
                    impact="high",
                    actionable=True,
                    action=fatigue["recommendation"],
                    confidence=0.85,
                    data_points=fatigue.get("days_on_pattern", 0),
                ))

        return insights

    def _generate_weight_insights(self) -> List[Insight]:
        """Generate insights about weight trends."""
        insights = []

        if len(self.weight_entries) < 7:
            return insights

        sorted_weights = sorted(self.weight_entries, key=lambda w: w.date)

        # Calculate weekly rate
        recent = sorted_weights[-7:]
        if len(recent) >= 2:
            days = (recent[-1].date - recent[0].date).days or 1
            weekly_change = ((recent[-1].weight_lbs - recent[0].weight_lbs) / days) * 7

            if weekly_change < -2.0:
                insights.append(Insight(
                    category="weight",
                    title="Rapid Weight Loss Detected",
                    description=f"Losing {abs(weekly_change):.1f} lbs/week, which exceeds recommended rate.",
                    impact="high",
                    actionable=True,
                    action="Consider adding 100-200 calories daily to slow down loss and preserve muscle.",
                    confidence=0.9,
                    data_points=len(recent),
                ))
            elif -1.5 <= weekly_change <= -1.0:
                insights.append(Insight(
                    category="weight",
                    title="On Track for Weight Goals",
                    description=f"Losing {abs(weekly_change):.1f} lbs/week, within the optimal 1-1.5 lbs range.",
                    impact="low",
                    actionable=False,
                    confidence=0.9,
                    data_points=len(recent),
                ))
            elif weekly_change > 0.5:
                insights.append(Insight(
                    category="weight",
                    title="Weight Trending Up",
                    description=f"Gaining approximately {weekly_change:.1f} lbs/week.",
                    impact="high",
                    actionable=True,
                    action="Review calorie intake and consider increasing IF pattern usage.",
                    confidence=0.85,
                    data_points=len(recent),
                ))

        # Plateau detection
        if len(sorted_weights) >= 14:
            last_14_days = sorted_weights[-14:]
            weights = [w.weight_lbs for w in last_14_days]
            std_dev = np.std(weights)

            if std_dev < 0.5:  # Very stable weight
                insights.append(Insight(
                    category="weight",
                    title="Potential Weight Plateau",
                    description="Weight has remained within 0.5 lbs for 2 weeks.",
                    impact="medium",
                    actionable=True,
                    action="Consider a pattern change or slight calorie adjustment to break plateau.",
                    confidence=0.8,
                    data_points=14,
                ))

        return insights

    def _generate_adherence_insights(self) -> List[Insight]:
        """Generate insights about adherence patterns."""
        insights = []

        if len(self.pattern_logs) < 7:
            return insights

        # Overall adherence trend
        adherences = [log.adherence_score for log in self.pattern_logs if log.adherence_score]
        if len(adherences) >= 14:
            first_half = np.mean(adherences[:len(adherences)//2])
            second_half = np.mean(adherences[len(adherences)//2:])

            if second_half - first_half > 0.1:
                insights.append(Insight(
                    category="behavior",
                    title="Improving Adherence",
                    description=f"Adherence improved from {first_half:.0%} to {second_half:.0%}.",
                    impact="low",
                    actionable=False,
                    confidence=0.85,
                    data_points=len(adherences),
                ))
            elif first_half - second_half > 0.1:
                insights.append(Insight(
                    category="behavior",
                    title="Declining Adherence",
                    description=f"Adherence dropped from {first_half:.0%} to {second_half:.0%}.",
                    impact="high",
                    actionable=True,
                    action="Identify barriers to adherence. Consider simpler patterns like Grazing.",
                    confidence=0.85,
                    data_points=len(adherences),
                ))

        # Calorie variance patterns
        variances = [log.calorie_variance for log in self.pattern_logs if log.calorie_variance != 0]
        if variances:
            avg_variance = np.mean(variances)
            if avg_variance > 200:
                insights.append(Insight(
                    category="nutrition",
                    title="Consistently Over Calorie Target",
                    description=f"Averaging {avg_variance:.0f} calories above target daily.",
                    impact="high",
                    actionable=True,
                    action="Review portion sizes or choose lower-calorie components.",
                    confidence=0.8,
                    data_points=len(variances),
                ))
            elif avg_variance < -200:
                insights.append(Insight(
                    category="nutrition",
                    title="Consistently Under Calorie Target",
                    description=f"Averaging {abs(avg_variance):.0f} calories below target daily.",
                    impact="medium",
                    actionable=True,
                    action="Ensure adequate nutrition. Consider adding healthy snacks.",
                    confidence=0.8,
                    data_points=len(variances),
                ))

        return insights

    def _generate_context_insights(self) -> List[Insight]:
        """Generate insights about context correlations."""
        insights = []

        if len(self.pattern_logs) < 14:
            return insights

        # Analyze day-of-week patterns
        weekday_adherences = []
        weekend_adherences = []

        for log in self.pattern_logs:
            if log.adherence_score:
                if log.date.weekday() < 5:
                    weekday_adherences.append(log.adherence_score)
                else:
                    weekend_adherences.append(log.adherence_score)

        if weekday_adherences and weekend_adherences:
            weekday_avg = np.mean(weekday_adherences)
            weekend_avg = np.mean(weekend_adherences)

            if weekday_avg - weekend_avg > 0.15:
                insights.append(Insight(
                    category="behavior",
                    title="Weekend Adherence Challenge",
                    description=f"Weekday adherence ({weekday_avg:.0%}) is significantly higher than weekend ({weekend_avg:.0%}).",
                    impact="medium",
                    actionable=True,
                    action="Consider Grazing Platter pattern on weekends for more flexibility.",
                    confidence=0.8,
                    data_points=len(weekday_adherences) + len(weekend_adherences),
                ))
            elif weekend_avg - weekday_avg > 0.15:
                insights.append(Insight(
                    category="behavior",
                    title="Weekday Adherence Challenge",
                    description=f"Weekend adherence ({weekend_avg:.0%}) is higher than weekday ({weekday_avg:.0%}).",
                    impact="medium",
                    actionable=True,
                    action="Consider meal prep on Sundays or use simpler patterns on workdays.",
                    confidence=0.8,
                    data_points=len(weekday_adherences) + len(weekend_adherences),
                ))

        # Stress correlation
        high_stress_logs = [
            log for log in self.pattern_logs
            if log.context and log.context.stress_level.value >= 3 and log.adherence_score
        ]
        low_stress_logs = [
            log for log in self.pattern_logs
            if log.context and log.context.stress_level.value <= 2 and log.adherence_score
        ]

        if len(high_stress_logs) >= 5 and len(low_stress_logs) >= 5:
            high_stress_adherence = np.mean([l.adherence_score for l in high_stress_logs])
            low_stress_adherence = np.mean([l.adherence_score for l in low_stress_logs])

            if low_stress_adherence - high_stress_adherence > 0.15:
                insights.append(Insight(
                    category="behavior",
                    title="Stress Impacts Adherence",
                    description=f"Adherence drops significantly ({high_stress_adherence:.0%} vs {low_stress_adherence:.0%}) on high-stress days.",
                    impact="medium",
                    actionable=True,
                    action="On stressful days, use forgiving patterns like Grazing 4-Meals.",
                    confidence=0.75,
                    data_points=len(high_stress_logs) + len(low_stress_logs),
                ))

        return insights

    def get_best_pattern_for_context(
        self,
        day_type: str,
        has_workout: bool = False,
        has_social: bool = False,
        stress_level: int = 2
    ) -> Dict[str, Any]:
        """
        Get best pattern recommendation for a specific context.

        Returns:
            Dict with recommended pattern and reasoning
        """
        summary = self.analyzer.generate_summary_report()

        if not summary["pattern_analytics"]:
            # No data - return rule-based recommendation
            return self._rule_based_recommendation(day_type, has_workout, has_social, stress_level)

        # Find pattern with best adherence for this context type
        best_match = None
        best_score = 0

        for pattern_name, analytics in summary["pattern_analytics"].items():
            contexts = analytics.get("best_contexts", [])
            score = analytics.get("average_adherence", 0)

            # Boost score if context matches
            context_key = f"day_type:{day_type}"
            if context_key in contexts:
                score += 0.2

            if has_workout and "morning_workout:yes" in contexts:
                score += 0.15

            if has_social and "evening_social:yes" in contexts:
                score += 0.15

            if score > best_score:
                best_score = score
                best_match = pattern_name

        if best_match:
            return {
                "recommended_pattern": best_match,
                "confidence": min(0.9, best_score),
                "reasoning": f"Based on historical performance in similar contexts",
                "data_backed": True,
            }

        return self._rule_based_recommendation(day_type, has_workout, has_social, stress_level)

    def _rule_based_recommendation(
        self,
        day_type: str,
        has_workout: bool,
        has_social: bool,
        stress_level: int
    ) -> Dict[str, Any]:
        """Fallback rule-based recommendation."""
        if has_workout:
            pattern = "big_breakfast"
            reasoning = "Front-loaded calories support workout recovery"
        elif has_social:
            pattern = "if_noon"
            reasoning = "Eating window ends early, leaving evening free"
        elif stress_level >= 3:
            pattern = "grazing_4"
            reasoning = "Frequent small meals help manage stress eating"
        elif day_type in ["weekend", "wfh"]:
            pattern = "grazing_platter"
            reasoning = "Flexible format for relaxed schedule"
        else:
            pattern = "traditional"
            reasoning = "Reliable 3-meal structure for standard days"

        return {
            "recommended_pattern": pattern,
            "confidence": 0.6,
            "reasoning": reasoning,
            "data_backed": False,
        }
