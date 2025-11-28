"""
Training Data Generator.
Generates synthetic training data for ML models.
"""
import random
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple
import numpy as np

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.data.models import (
    PatternType, PatternLog, WeightEntry, DailyContext,
    DayType, WeatherCondition, StressLevel, ActivityLevel,
    UserProfile, PATTERN_CONFIGS
)


class TrainingDataGenerator:
    """
    Generates realistic synthetic data for training ML models.

    Simulates:
    - Pattern selection with context correlations
    - Weight progression with pattern effectiveness
    - Adherence patterns with fatigue effects
    - Seasonal and contextual variations
    """

    def __init__(self, seed: int = 42):
        """
        Initialize generator with random seed for reproducibility.

        Args:
            seed: Random seed
        """
        random.seed(seed)
        np.random.seed(seed)

        # Pattern effectiveness coefficients (for weight loss simulation)
        self.pattern_effectiveness = {
            PatternType.TRADITIONAL: 0.85,
            PatternType.REVERSED: 0.82,
            PatternType.IF_NOON: 0.95,
            PatternType.GRAZING_4_MEALS: 0.78,
            PatternType.GRAZING_PLATTER: 0.70,
            PatternType.BIG_BREAKFAST: 0.88,
            PatternType.MORNING_FEAST: 0.92,
        }

        # Context-pattern affinity (likelihood of success)
        self.context_affinity = {
            (DayType.WEEKEND, PatternType.GRAZING_PLATTER): 0.95,
            (DayType.WEEKEND, PatternType.BIG_BREAKFAST): 0.90,
            (DayType.WORK_FROM_HOME, PatternType.GRAZING_PLATTER): 0.92,
            (DayType.WEEKDAY, PatternType.TRADITIONAL): 0.88,
            (DayType.WEEKDAY, PatternType.IF_NOON): 0.85,
        }

    def generate_user_profile(self) -> UserProfile:
        """Generate a user profile matching Brandon's specs."""
        return UserProfile(
            age=37,
            height_inches=70,
            starting_weight_lbs=250.0,
            target_weight_lbs=200.0,
            target_calories=1900,
            target_protein_g=137,
            activity_level=ActivityLevel.MODERATE,
        )

    def generate_daily_context(self, target_date: date) -> DailyContext:
        """
        Generate realistic daily context for a date.

        Args:
            target_date: Date to generate context for

        Returns:
            DailyContext with realistic values
        """
        # Determine day type
        weekday = target_date.weekday()
        if weekday >= 5:
            day_type = DayType.WEEKEND
        elif random.random() < 0.2:  # 20% WFH days
            day_type = DayType.WORK_FROM_HOME
        else:
            day_type = DayType.WEEKDAY

        # Weather based on simple seasonal model
        month = target_date.month
        if month in [12, 1, 2]:  # Winter
            weather = random.choice([WeatherCondition.COLD, WeatherCondition.RAINY, WeatherCondition.CLOUDY])
        elif month in [6, 7, 8]:  # Summer
            weather = random.choice([WeatherCondition.HOT, WeatherCondition.SUNNY, WeatherCondition.SUNNY])
        else:  # Spring/Fall
            weather = random.choice(list(WeatherCondition))

        # Stress varies by day of week
        if weekday in [0, 4]:  # Monday, Friday higher stress
            stress = random.choice([StressLevel.MODERATE, StressLevel.HIGH, StressLevel.HIGH])
        else:
            stress = random.choice([StressLevel.LOW, StressLevel.MODERATE, StressLevel.MODERATE])

        # Activity level
        if day_type == DayType.WEEKEND:
            activity = random.choice([ActivityLevel.MODERATE, ActivityLevel.ACTIVE, ActivityLevel.ACTIVE])
        else:
            activity = random.choice([ActivityLevel.SEDENTARY, ActivityLevel.LIGHT, ActivityLevel.MODERATE])

        return DailyContext(
            date=target_date,
            day_type=day_type,
            weather=weather,
            stress_level=stress,
            activity_level=activity,
            has_morning_workout=random.random() < 0.25,  # 25% workout days
            has_evening_social=random.random() < 0.15,  # 15% social evenings
        )

    def generate_pattern_selection(
        self,
        context: DailyContext,
        prev_pattern: PatternType,
        prev_adherence: float
    ) -> PatternType:
        """
        Generate realistic pattern selection based on context.

        Args:
            context: Today's context
            prev_pattern: Previous day's pattern
            prev_adherence: Previous day's adherence score

        Returns:
            Selected pattern for the day
        """
        # Base probabilities
        probs = {p: 1/7 for p in PatternType}

        # Context adjustments
        if context.has_morning_workout:
            probs[PatternType.BIG_BREAKFAST] += 0.3
            probs[PatternType.TRADITIONAL] += 0.1

        if context.has_evening_social:
            probs[PatternType.IF_NOON] += 0.2
            probs[PatternType.MORNING_FEAST] += 0.25
            probs[PatternType.REVERSED] -= 0.15

        if context.day_type in [DayType.WEEKEND, DayType.WORK_FROM_HOME]:
            probs[PatternType.GRAZING_PLATTER] += 0.25
            probs[PatternType.GRAZING_4_MEALS] += 0.1

        if context.stress_level.value >= 3:
            probs[PatternType.GRAZING_4_MEALS] += 0.2

        # Pattern fatigue - reduce probability of same pattern
        if prev_adherence < 0.7:  # Bad day yesterday
            probs[prev_pattern] -= 0.2

        # Normalize
        total = sum(max(0, p) for p in probs.values())
        probs = {k: max(0, v) / total for k, v in probs.items()}

        # Select
        return random.choices(
            list(probs.keys()),
            weights=list(probs.values()),
            k=1
        )[0]

    def generate_adherence_score(
        self,
        pattern: PatternType,
        context: DailyContext,
        days_on_same_pattern: int
    ) -> float:
        """
        Generate realistic adherence score.

        Args:
            pattern: Today's pattern
            context: Today's context
            days_on_same_pattern: Consecutive days on this pattern

        Returns:
            Adherence score 0-1
        """
        base_adherence = 0.85

        # Context affinity bonus
        affinity_key = (context.day_type, pattern)
        if affinity_key in self.context_affinity:
            base_adherence = self.context_affinity[affinity_key]

        # Stress penalty
        if context.stress_level.value >= 3:
            base_adherence -= 0.08

        # Pattern fatigue (diminishing returns after 4+ days)
        if days_on_same_pattern > 4:
            fatigue_penalty = min(0.15, (days_on_same_pattern - 4) * 0.03)
            base_adherence -= fatigue_penalty

        # Weekend effect (can be positive or negative)
        if context.day_type == DayType.WEEKEND:
            if pattern in [PatternType.GRAZING_PLATTER, PatternType.BIG_BREAKFAST]:
                base_adherence += 0.05
            else:
                base_adherence -= 0.05

        # Add noise
        noise = np.random.normal(0, 0.08)
        final_adherence = np.clip(base_adherence + noise, 0, 1)

        return round(float(final_adherence), 2)

    def generate_weight_progression(
        self,
        start_weight: float,
        days: int,
        adherence_scores: List[float],
        patterns: List[PatternType]
    ) -> List[WeightEntry]:
        """
        Generate realistic weight progression.

        Args:
            start_weight: Starting weight in lbs
            days: Number of days to generate
            adherence_scores: Daily adherence scores
            patterns: Daily patterns used

        Returns:
            List of WeightEntry objects
        """
        entries = []
        current_weight = start_weight

        for day_idx in range(days):
            target_date = date.today() - timedelta(days=days-day_idx)

            # Base daily change (targeting 1.25 lbs/week loss)
            base_change = -1.25 / 7  # ~-0.18 lbs/day

            # Adherence factor
            adherence = adherence_scores[day_idx] if day_idx < len(adherence_scores) else 0.8
            adherence_factor = adherence / 0.85  # Scale relative to expected

            # Pattern effectiveness
            pattern = patterns[day_idx] if day_idx < len(patterns) else PatternType.TRADITIONAL
            effectiveness = self.pattern_effectiveness.get(pattern, 0.85)

            # Calculate change
            daily_change = base_change * adherence_factor * effectiveness

            # Add realistic noise (water weight fluctuations)
            noise = np.random.normal(0, 0.3)
            current_weight += daily_change + noise

            entries.append(WeightEntry(
                date=target_date,
                weight_lbs=round(current_weight, 1),
                time_of_day="morning",
            ))

        return entries

    def generate_training_dataset(
        self,
        days: int = 90,
        start_weight: float = 250.0
    ) -> Tuple[List[PatternLog], List[WeightEntry]]:
        """
        Generate complete training dataset.

        Args:
            days: Number of days to generate
            start_weight: Starting weight

        Returns:
            Tuple of (pattern_logs, weight_entries)
        """
        pattern_logs = []
        contexts = []
        patterns = []
        adherences = []

        prev_pattern = PatternType.TRADITIONAL
        prev_adherence = 0.85
        days_on_same_pattern = 0

        for day_idx in range(days):
            target_date = date.today() - timedelta(days=days-day_idx)

            # Generate context
            context = self.generate_daily_context(target_date)
            contexts.append(context)

            # Select pattern
            pattern = self.generate_pattern_selection(context, prev_pattern, prev_adherence)
            patterns.append(pattern)

            # Track consecutive days
            if pattern == prev_pattern:
                days_on_same_pattern += 1
            else:
                days_on_same_pattern = 1

            # Generate adherence
            adherence = self.generate_adherence_score(pattern, context, days_on_same_pattern)
            adherences.append(adherence)

            # Generate ratings with correlation to adherence
            base_energy = 3 + (adherence - 0.8) * 5
            base_satisfaction = 3 + (adherence - 0.8) * 4
            base_hunger = 3 + (adherence - 0.8) * 3

            energy = int(np.clip(base_energy + np.random.normal(0, 0.5), 1, 5))
            satisfaction = int(np.clip(base_satisfaction + np.random.normal(0, 0.5), 1, 5))
            hunger = int(np.clip(base_hunger + np.random.normal(0, 0.5), 1, 5))

            # Calorie variance (correlated with adherence)
            calorie_variance = (1 - adherence) * 400 * np.random.choice([-1, 1])
            protein_variance = (1 - adherence) * 30 * np.random.choice([-1, 1])

            log = PatternLog(
                date=target_date,
                pattern_planned=pattern,
                pattern_actual=pattern,
                context=context,
                adherence_score=adherence,
                calorie_variance=round(calorie_variance, 0),
                protein_variance=round(protein_variance, 0),
                energy_rating=energy,
                satisfaction_rating=satisfaction,
                hunger_rating=hunger,
            )
            pattern_logs.append(log)

            prev_pattern = pattern
            prev_adherence = adherence

        # Generate weight entries
        weight_entries = self.generate_weight_progression(
            start_weight, days, adherences, patterns
        )

        return pattern_logs, weight_entries

    def generate_pattern_recommender_data(
        self,
        n_samples: int = 500
    ) -> Tuple[List[Dict[str, Any]], List[PatternType]]:
        """
        Generate training data for pattern recommender model.

        Returns:
            Tuple of (feature_dicts, labels)
        """
        X = []
        y = []

        for _ in range(n_samples):
            # Random date
            days_back = random.randint(1, 365)
            target_date = date.today() - timedelta(days=days_back)

            # Generate context
            context = self.generate_daily_context(target_date)

            # Previous day info
            prev_pattern = random.choice(list(PatternType))
            prev_adherence = random.uniform(0.5, 1.0)
            prev_energy = random.randint(1, 5)

            # Generate "successful" pattern for this context
            pattern = self.generate_pattern_selection(context, prev_pattern, prev_adherence)

            # Simulate success - if adherence would be high, this is a good choice
            simulated_adherence = self.generate_adherence_score(pattern, context, 1)

            if simulated_adherence >= 0.75:  # Only use successful examples
                X.append({
                    "date": target_date,
                    "day_type": context.day_type.value,
                    "weather": context.weather.value,
                    "stress_level": context.stress_level.value,
                    "activity_level": context.activity_level.value,
                    "has_morning_workout": context.has_morning_workout,
                    "has_evening_social": context.has_evening_social,
                    "prev_pattern": prev_pattern.value,
                    "prev_adherence": prev_adherence,
                    "prev_energy": prev_energy,
                })
                y.append(pattern)

        return X, y
