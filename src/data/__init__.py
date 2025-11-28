"""
Data package for Meal Assistant.
Contains domain models and data utilities.
"""
from .models import (
    PatternType,
    MealTiming,
    WeatherCondition,
    DayType,
    StressLevel,
    ActivityLevel,
    NutritionInfo,
    MealComponent,
    Meal,
    PatternSchedule,
    DailyContext,
    PatternLog,
    WeightEntry,
    UserProfile,
    PatternAnalytics,
    Prediction,
    PATTERN_CONFIGS,
)

__all__ = [
    "PatternType",
    "MealTiming",
    "WeatherCondition",
    "DayType",
    "StressLevel",
    "ActivityLevel",
    "NutritionInfo",
    "MealComponent",
    "Meal",
    "PatternSchedule",
    "DailyContext",
    "PatternLog",
    "WeightEntry",
    "UserProfile",
    "PatternAnalytics",
    "Prediction",
    "PATTERN_CONFIGS",
]
