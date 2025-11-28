"""
Pattern Effectiveness Analyzer - ML-Enhanced Version.
Analyzes pattern success metrics, context correlations, and predicts effectiveness.
"""
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import json

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.data.models import (
    PatternType, PatternLog, WeightEntry, DailyContext,
    DayType, WeatherCondition, StressLevel, ActivityLevel
)


@dataclass
class EffectivenessMetrics:
    """Comprehensive effectiveness metrics for a pattern."""
    adherence_rate: float = 0.0       # % of days with full adherence
    weight_loss_rate: float = 0.0     # lbs/week when using pattern
    energy_average: float = 0.0       # 1-10 scale
    satisfaction_average: float = 0.0  # 1-5 stars
    hunger_average: float = 0.0       # 1-10 scale (10 = rarely hungry)

    # Derived metrics
    success_score: float = 0.0        # Combined effectiveness score
    sustainability_score: float = 0.0  # How sustainable long-term

    # Sample info
    days_analyzed: int = 0
    confidence: float = 0.0


@dataclass
class ContextCorrelation:
    """How a context factor correlates with pattern success."""
    factor_type: str           # day_type, weather, stress, etc.
    factor_value: str          # specific value
    correlation_strength: float  # -1 to 1
    sample_size: int
    avg_adherence: float
    avg_satisfaction: float


@dataclass
class EffectivenessProfile:
    """Complete effectiveness profile for a pattern."""
    pattern_id: str
    pattern_name: str
    metrics: EffectivenessMetrics
    best_day_types: List[str]
    best_weather: List[str]
    best_stress_levels: List[int]
    best_schedule_types: List[str]
    context_correlations: List[ContextCorrelation]
    recommendation_score: float  # 0-100
    insights: List[str]


@dataclass
class FatigueAnalysis:
    """Pattern fatigue detection result."""
    pattern: PatternType
    fatigue_level: str  # none, mild, moderate, severe
    fatigue_score: float  # 0-1
    days_on_pattern: int
    adherence_trend: float  # negative = declining
    satisfaction_trend: float
    recommended_action: str
    alternative_patterns: List[PatternType]


class PatternEffectivenessAnalyzer:
    """
    ML-enhanced pattern effectiveness analyzer.

    Capabilities:
    - Analyze pattern success metrics
    - Detect context correlations
    - Predict pattern effectiveness
    - Detect pattern fatigue
    - Recommend optimal patterns
    """

    ADHERENCE_THRESHOLD = 0.8
    MIN_SAMPLE_SIZE = 5
    FATIGUE_CONSECUTIVE_THRESHOLD = 4  # days
    FATIGUE_VARIETY_THRESHOLD = 2  # patterns in 7 days

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize analyzer."""
        self.model_path = model_path
        self.pattern_data: Dict[PatternType, Dict] = {
            p: self._empty_pattern_data() for p in PatternType
        }
        self.weight_by_date: Dict[date, float] = {}
        self.logs_processed = 0
        self.context_cache: Dict[str, List] = defaultdict(list)

        # Load model if exists
        if model_path and model_path.exists():
            self.load(model_path)

    def _empty_pattern_data(self) -> Dict:
        """Create empty pattern data structure."""
        return {
            "dates": [],
            "adherence_scores": [],
            "energy_ratings": [],
            "satisfaction_ratings": [],
            "hunger_ratings": [],
            "weight_changes": [],
            "contexts": [],
            "calorie_variances": [],
            "protein_variances": [],
        }

    def load_data(
        self,
        pattern_logs: List[PatternLog],
        weight_entries: List[WeightEntry],
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
            data = self.pattern_data[pattern]

            data["dates"].append(log.date)
            data["adherence_scores"].append(log.adherence_score)
            data["calorie_variances"].append(log.calorie_variance)
            data["protein_variances"].append(log.protein_variance)

            if log.energy_rating:
                data["energy_ratings"].append(log.energy_rating)
            if log.satisfaction_rating:
                data["satisfaction_ratings"].append(log.satisfaction_rating)
            if log.hunger_rating:
                data["hunger_ratings"].append(log.hunger_rating)
            if log.context:
                data["contexts"].append(log.context)
                # Cache for correlation analysis
                self._cache_context(pattern, log.context, log.adherence_score)

            # Calculate weight change
            if log.date in self.weight_by_date:
                prev_date = log.date - timedelta(days=1)
                if prev_date in self.weight_by_date:
                    change = self.weight_by_date[log.date] - self.weight_by_date[prev_date]
                    data["weight_changes"].append(change)

        self.logs_processed = len(pattern_logs)

    def _cache_context(
        self,
        pattern: PatternType,
        context: DailyContext,
        adherence: float,
    ) -> None:
        """Cache context for correlation analysis."""
        self.context_cache[f"{pattern.value}:day_type:{context.day_type.value}"].append(adherence)
        self.context_cache[f"{pattern.value}:weather:{context.weather.value}"].append(adherence)
        self.context_cache[f"{pattern.value}:stress:{context.stress_level.value}"].append(adherence)
        self.context_cache[f"{pattern.value}:activity:{context.activity_level.value}"].append(adherence)

        if context.has_morning_workout:
            self.context_cache[f"{pattern.value}:workout:morning"].append(adherence)
        if context.has_evening_social:
            self.context_cache[f"{pattern.value}:social:evening"].append(adherence)

    def analyze_pattern(
        self,
        pattern_id: str,
        user_data: Optional[Dict] = None,
    ) -> EffectivenessProfile:
        """
        Comprehensive pattern effectiveness analysis.

        Args:
            pattern_id: Pattern type value (e.g., "traditional")
            user_data: Optional additional user context

        Returns:
            Complete EffectivenessProfile
        """
        pattern = PatternType(pattern_id)
        data = self.pattern_data[pattern]

        # Calculate base metrics
        metrics = self._calculate_metrics(pattern)

        # Find best contexts
        correlations = self._analyze_correlations(pattern)

        best_day_types = self._find_best_values(correlations, "day_type")
        best_weather = self._find_best_values(correlations, "weather")
        best_stress = self._find_best_values(correlations, "stress", as_int=True)
        best_schedule = self._find_best_schedule_types(pattern, correlations)

        # Generate insights
        insights = self._generate_insights(pattern, metrics, correlations)

        # Calculate recommendation score
        rec_score = self._calculate_recommendation_score(metrics, len(data["dates"]))

        return EffectivenessProfile(
            pattern_id=pattern_id,
            pattern_name=pattern_id.replace("_", " ").title(),
            metrics=metrics,
            best_day_types=best_day_types,
            best_weather=best_weather,
            best_stress_levels=best_stress,
            best_schedule_types=best_schedule,
            context_correlations=correlations,
            recommendation_score=rec_score,
            insights=insights,
        )

    def _calculate_metrics(self, pattern: PatternType) -> EffectivenessMetrics:
        """Calculate effectiveness metrics for a pattern."""
        data = self.pattern_data[pattern]
        days = len(data["dates"])

        if days == 0:
            return EffectivenessMetrics()

        # Adherence rate (successful days / total days)
        adherence_rate = sum(
            1 for a in data["adherence_scores"]
            if a >= self.ADHERENCE_THRESHOLD
        ) / days

        # Weight loss rate (average daily change * 7 for weekly)
        weight_loss_rate = 0.0
        if data["weight_changes"]:
            weight_loss_rate = np.mean(data["weight_changes"]) * 7

        # Ratings (convert to 10-point scale where needed)
        energy_avg = np.mean(data["energy_ratings"]) * 2 if data["energy_ratings"] else 5.0
        satisfaction_avg = np.mean(data["satisfaction_ratings"]) if data["satisfaction_ratings"] else 2.5
        hunger_avg = np.mean(data["hunger_ratings"]) * 2 if data["hunger_ratings"] else 5.0

        # Success score (weighted combination)
        success_score = (
            adherence_rate * 0.3 +
            (1 if weight_loss_rate < 0 else 0) * 0.25 +  # Losing weight is good
            (energy_avg / 10) * 0.2 +
            (satisfaction_avg / 5) * 0.15 +
            (hunger_avg / 10) * 0.1
        )

        # Sustainability (based on variance and trend)
        adherence_std = np.std(data["adherence_scores"]) if len(data["adherence_scores"]) > 1 else 0.5
        sustainability = max(0, 1 - adherence_std)

        # Confidence based on sample size
        confidence = min(1.0, days / 30)  # Max confidence at 30 days

        return EffectivenessMetrics(
            adherence_rate=round(adherence_rate, 3),
            weight_loss_rate=round(weight_loss_rate, 2),
            energy_average=round(energy_avg, 1),
            satisfaction_average=round(satisfaction_avg, 2),
            hunger_average=round(hunger_avg, 1),
            success_score=round(success_score, 3),
            sustainability_score=round(sustainability, 3),
            days_analyzed=days,
            confidence=round(confidence, 3),
        )

    def _analyze_correlations(self, pattern: PatternType) -> List[ContextCorrelation]:
        """Analyze context correlations for a pattern."""
        correlations = []

        prefix = f"{pattern.value}:"

        for key, adherences in self.context_cache.items():
            if not key.startswith(prefix):
                continue

            if len(adherences) < self.MIN_SAMPLE_SIZE:
                continue

            # Parse key
            parts = key[len(prefix):].split(":")
            factor_type = parts[0]
            factor_value = parts[1]

            avg_adherence = np.mean(adherences)

            # Calculate correlation strength relative to overall pattern adherence
            overall_adherence = np.mean(self.pattern_data[pattern]["adherence_scores"])
            correlation = (avg_adherence - overall_adherence) / max(0.01, overall_adherence)

            correlations.append(ContextCorrelation(
                factor_type=factor_type,
                factor_value=factor_value,
                correlation_strength=round(min(1, max(-1, correlation)), 3),
                sample_size=len(adherences),
                avg_adherence=round(avg_adherence, 3),
                avg_satisfaction=0.0,  # Could add if tracked
            ))

        # Sort by correlation strength
        correlations.sort(key=lambda c: c.correlation_strength, reverse=True)
        return correlations

    def _find_best_values(
        self,
        correlations: List[ContextCorrelation],
        factor_type: str,
        as_int: bool = False,
    ) -> List:
        """Find best values for a factor type."""
        relevant = [
            c for c in correlations
            if c.factor_type == factor_type and c.correlation_strength > 0
        ]

        values = [c.factor_value for c in relevant[:3]]

        if as_int:
            return [int(v) for v in values]
        return values

    def _find_best_schedule_types(
        self,
        pattern: PatternType,
        correlations: List[ContextCorrelation],
    ) -> List[str]:
        """Determine best schedule types for a pattern."""
        schedule_types = []

        day_type_corr = {
            c.factor_value: c.correlation_strength
            for c in correlations
            if c.factor_type == "day_type"
        }

        if day_type_corr.get("weekday", 0) > 0:
            schedule_types.append("structured_workdays")
        if day_type_corr.get("weekend", 0) > 0:
            schedule_types.append("flexible_weekends")
        if day_type_corr.get("wfh", 0) > 0:
            schedule_types.append("work_from_home")

        # Activity correlations
        activity_corr = {
            c.factor_value: c.correlation_strength
            for c in correlations
            if c.factor_type == "activity"
        }

        if activity_corr.get("very_active", 0) > 0:
            schedule_types.append("high_activity_days")
        if activity_corr.get("sedentary", 0) > 0:
            schedule_types.append("low_activity_days")

        return schedule_types[:4]

    def _generate_insights(
        self,
        pattern: PatternType,
        metrics: EffectivenessMetrics,
        correlations: List[ContextCorrelation],
    ) -> List[str]:
        """Generate human-readable insights."""
        insights = []

        # Adherence insights
        if metrics.adherence_rate >= 0.85:
            insights.append(f"Excellent adherence rate of {metrics.adherence_rate:.0%}")
        elif metrics.adherence_rate >= 0.7:
            insights.append(f"Good adherence at {metrics.adherence_rate:.0%}, room for improvement")
        else:
            insights.append(f"Adherence of {metrics.adherence_rate:.0%} suggests this pattern may not be ideal fit")

        # Weight loss insights
        if metrics.weight_loss_rate < -0.5:
            insights.append(f"Strong weight loss: {-metrics.weight_loss_rate:.1f} lbs/week average")
        elif metrics.weight_loss_rate < 0:
            insights.append(f"Consistent weight loss trend: {-metrics.weight_loss_rate:.1f} lbs/week")
        elif metrics.weight_loss_rate > 0.5:
            insights.append("Weight gain trend detected - consider adjusting portions")

        # Energy insights
        if metrics.energy_average >= 8:
            insights.append("High energy levels reported with this pattern")
        elif metrics.energy_average <= 5:
            insights.append("Low energy levels - consider timing or composition changes")

        # Context insights
        positive_corr = [c for c in correlations if c.correlation_strength > 0.1]
        if positive_corr:
            best = positive_corr[0]
            insights.append(f"Best results when {best.factor_type} is {best.factor_value}")

        negative_corr = [c for c in correlations if c.correlation_strength < -0.1]
        if negative_corr:
            worst = negative_corr[0]
            insights.append(f"Struggles when {worst.factor_type} is {worst.factor_value}")

        # Sustainability insight
        if metrics.sustainability_score >= 0.8:
            insights.append("Highly sustainable - consistent adherence over time")
        elif metrics.sustainability_score <= 0.5:
            insights.append("Variable adherence - consider alternating with other patterns")

        return insights[:6]

    def _calculate_recommendation_score(
        self,
        metrics: EffectivenessMetrics,
        sample_size: int,
    ) -> float:
        """Calculate overall recommendation score (0-100)."""
        if sample_size == 0:
            return 0.0

        # Weighted score calculation
        score = (
            metrics.adherence_rate * 30 +
            metrics.success_score * 30 +
            metrics.sustainability_score * 20 +
            (metrics.satisfaction_average / 5) * 10 +
            (metrics.energy_average / 10) * 10
        )

        # Confidence adjustment
        confidence_factor = min(1.0, sample_size / 20)
        score *= confidence_factor

        return round(min(100, score), 1)

    def recommend_pattern(
        self,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        ML-based pattern recommendation.

        Args:
            context: Current context (day_type, weather, stress, etc.)

        Returns:
            Recommendation with reasoning and confidence
        """
        recommendations = []

        for pattern in PatternType:
            profile = self.analyze_pattern(pattern.value)

            # Calculate context match score
            context_score = self._calculate_context_match(pattern, context, profile)

            # Combined score
            combined_score = (
                profile.recommendation_score * 0.6 +
                context_score * 40
            )

            recommendations.append({
                "pattern": pattern.value,
                "score": combined_score,
                "base_score": profile.recommendation_score,
                "context_match": context_score,
                "confidence": profile.metrics.confidence,
            })

        # Sort by score
        recommendations.sort(key=lambda r: r["score"], reverse=True)

        top = recommendations[0]
        profile = self.analyze_pattern(top["pattern"])

        return {
            "recommended_pattern": top["pattern"],
            "score": round(top["score"], 1),
            "confidence": top["confidence"],
            "reasoning": profile.insights[:3],
            "context_factors": {
                "day_type_match": context.get("day_type") in profile.best_day_types,
                "weather_match": context.get("weather") in profile.best_weather,
                "stress_match": context.get("stress_level") in profile.best_stress_levels,
            },
            "alternatives": [
                {"pattern": r["pattern"], "score": round(r["score"], 1)}
                for r in recommendations[1:4]
            ],
        }

    def _calculate_context_match(
        self,
        pattern: PatternType,
        context: Dict[str, Any],
        profile: EffectivenessProfile,
    ) -> float:
        """Calculate how well context matches pattern's best conditions."""
        matches = 0
        total = 0

        if "day_type" in context:
            total += 1
            if context["day_type"] in profile.best_day_types:
                matches += 1

        if "weather" in context:
            total += 1
            if context["weather"] in profile.best_weather:
                matches += 1

        if "stress_level" in context:
            total += 1
            if context["stress_level"] in profile.best_stress_levels:
                matches += 1

        return matches / max(1, total)

    def detect_fatigue(
        self,
        recent_patterns: List[Dict[str, Any]],
        window_days: int = 7,
    ) -> FatigueAnalysis:
        """
        Detect pattern fatigue from recent usage.

        Args:
            recent_patterns: List of {date, pattern, adherence, satisfaction}
            window_days: Days to analyze

        Returns:
            FatigueAnalysis with recommendations
        """
        if not recent_patterns:
            return FatigueAnalysis(
                pattern=PatternType.TRADITIONAL,
                fatigue_level="unknown",
                fatigue_score=0.0,
                days_on_pattern=0,
                adherence_trend=0.0,
                satisfaction_trend=0.0,
                recommended_action="Insufficient data",
                alternative_patterns=[],
            )

        # Sort by date
        recent = sorted(recent_patterns, key=lambda p: p.get("date", date.today()))
        recent = recent[-window_days:]

        # Current pattern
        current_pattern = PatternType(recent[-1].get("pattern", "traditional"))

        # Count consecutive days
        consecutive = 0
        for p in reversed(recent):
            if p.get("pattern") == current_pattern.value:
                consecutive += 1
            else:
                break

        # Calculate variety
        unique_patterns = len(set(p.get("pattern") for p in recent))

        # Calculate trends
        adherences = [p.get("adherence", 0.8) for p in recent]
        adherence_trend = self._calculate_trend(adherences)

        satisfactions = [p.get("satisfaction", 3) for p in recent if p.get("satisfaction")]
        satisfaction_trend = self._calculate_trend(satisfactions) if satisfactions else 0.0

        # Calculate fatigue score
        fatigue_score = self._calculate_fatigue_score(
            consecutive, unique_patterns, adherence_trend, satisfaction_trend
        )

        # Determine fatigue level
        if fatigue_score < 0.2:
            fatigue_level = "none"
            action = "Continue with current pattern"
        elif fatigue_score < 0.4:
            fatigue_level = "mild"
            action = "Consider small variations within the pattern"
        elif fatigue_score < 0.7:
            fatigue_level = "moderate"
            action = "Rotate to a different pattern for 2-3 days"
        else:
            fatigue_level = "severe"
            action = "Strongly recommend changing patterns immediately"

        # Find alternative patterns
        alternatives = self._find_alternative_patterns(current_pattern, recent)

        return FatigueAnalysis(
            pattern=current_pattern,
            fatigue_level=fatigue_level,
            fatigue_score=round(fatigue_score, 3),
            days_on_pattern=consecutive,
            adherence_trend=round(adherence_trend, 3),
            satisfaction_trend=round(satisfaction_trend, 3),
            recommended_action=action,
            alternative_patterns=alternatives,
        )

    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend (slope) of values."""
        if len(values) < 2:
            return 0.0

        x = np.arange(len(values))
        slope = np.polyfit(x, values, 1)[0]
        return slope

    def _calculate_fatigue_score(
        self,
        consecutive: int,
        variety: int,
        adherence_trend: float,
        satisfaction_trend: float,
    ) -> float:
        """Calculate overall fatigue score."""
        # Consecutive factor (max at 5+ days)
        consecutive_factor = min(1.0, consecutive / 5)

        # Variety factor (7 patterns is max variety)
        variety_factor = 1 - min(1.0, variety / 4)

        # Trend factors (negative trends increase fatigue)
        adherence_factor = max(0, -adherence_trend * 5)
        satisfaction_factor = max(0, -satisfaction_trend * 3)

        # Weighted combination
        fatigue = (
            consecutive_factor * 0.35 +
            variety_factor * 0.25 +
            adherence_factor * 0.25 +
            satisfaction_factor * 0.15
        )

        return min(1.0, fatigue)

    def _find_alternative_patterns(
        self,
        current: PatternType,
        recent: List[Dict],
    ) -> List[PatternType]:
        """Find good alternative patterns."""
        # Get recently used patterns
        recent_patterns = set(p.get("pattern") for p in recent)

        # Find patterns not used recently
        alternatives = [
            p for p in PatternType
            if p.value not in recent_patterns and p != current
        ]

        # If all patterns used recently, find least used
        if not alternatives:
            pattern_counts = defaultdict(int)
            for p in recent:
                pattern_counts[p.get("pattern")] += 1

            alternatives = sorted(
                PatternType,
                key=lambda p: pattern_counts.get(p.value, 0)
            )[:3]

        return alternatives[:3]

    def save(self, path: Path) -> None:
        """Save analyzer state."""
        data = {
            "logs_processed": self.logs_processed,
            "context_cache": {k: list(v) for k, v in self.context_cache.items()},
            # Convert pattern_data for JSON serialization
            "pattern_data": {
                p.value: {
                    "adherence_scores": list(d["adherence_scores"]),
                    "energy_ratings": list(d["energy_ratings"]),
                    "satisfaction_ratings": list(d["satisfaction_ratings"]),
                    "hunger_ratings": list(d["hunger_ratings"]),
                    "weight_changes": list(d["weight_changes"]),
                }
                for p, d in self.pattern_data.items()
            },
        }

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def load(self, path: Path) -> None:
        """Load analyzer state."""
        with open(path, "r") as f:
            data = json.load(f)

        self.logs_processed = data.get("logs_processed", 0)
        self.context_cache = defaultdict(list, data.get("context_cache", {}))

        for pattern_value, pdata in data.get("pattern_data", {}).items():
            pattern = PatternType(pattern_value)
            self.pattern_data[pattern]["adherence_scores"] = pdata.get("adherence_scores", [])
            self.pattern_data[pattern]["energy_ratings"] = pdata.get("energy_ratings", [])
            self.pattern_data[pattern]["satisfaction_ratings"] = pdata.get("satisfaction_ratings", [])
            self.pattern_data[pattern]["hunger_ratings"] = pdata.get("hunger_ratings", [])
            self.pattern_data[pattern]["weight_changes"] = pdata.get("weight_changes", [])

    def get_stats(self) -> Dict[str, Any]:
        """Get analyzer statistics."""
        return {
            "logs_processed": self.logs_processed,
            "patterns_with_data": sum(
                1 for p, d in self.pattern_data.items()
                if len(d["adherence_scores"]) > 0
            ),
            "total_context_entries": sum(
                len(v) for v in self.context_cache.values()
            ),
            "pattern_usage": {
                p.value: len(d["adherence_scores"])
                for p, d in self.pattern_data.items()
            },
        }
