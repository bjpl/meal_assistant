"""
Data models for the Meal Assistant ML system.
Defines domain entities for patterns, meals, tracking, and analytics.
"""
from dataclasses import dataclass, field
from datetime import datetime, date, time
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class PatternType(Enum):
    """The 7 flexible eating patterns."""
    TRADITIONAL = "traditional"      # Pattern A: 3 meals, standard timing
    REVERSED = "reversed"            # Pattern B: Light dinner, heavy lunch
    IF_NOON = "if_noon"              # Pattern C: 12PM-8PM eating window
    GRAZING_4_MEALS = "grazing_4"    # Pattern D: 4 mini-meals
    GRAZING_PLATTER = "grazing_platter"  # Pattern E: All-day platter
    BIG_BREAKFAST = "big_breakfast"  # Pattern F: 850 cal breakfast
    MORNING_FEAST = "morning_feast"  # Pattern G: 5AM-1PM eating window


class MealTiming(Enum):
    """Meal timing categories."""
    MORNING = "morning"
    LATE_MORNING = "late_morning"
    NOON = "noon"
    AFTERNOON = "afternoon"
    EVENING = "evening"


class WeatherCondition(Enum):
    """Weather conditions affecting meal preferences."""
    SUNNY = "sunny"
    CLOUDY = "cloudy"
    RAINY = "rainy"
    HOT = "hot"
    COLD = "cold"


class DayType(Enum):
    """Type of day affecting pattern choice."""
    WEEKDAY = "weekday"
    WEEKEND = "weekend"
    HOLIDAY = "holiday"
    WORK_FROM_HOME = "wfh"


class StressLevel(Enum):
    """Stress levels affecting eating patterns."""
    LOW = 1
    MODERATE = 2
    HIGH = 3
    VERY_HIGH = 4


class ActivityLevel(Enum):
    """Daily activity level."""
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"


@dataclass
class NutritionInfo:
    """Nutritional information for meals/components."""
    calories: float
    protein_g: float
    carbs_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: float = 0.0
    sodium_mg: float = 0.0


@dataclass
class MealComponent:
    """Individual food component."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    category: str = ""  # protein, carb, vegetable, fat, flavor
    nutrition: NutritionInfo = field(default_factory=lambda: NutritionInfo(0, 0))
    portion_size: str = ""
    prep_time_min: int = 0
    tags: List[str] = field(default_factory=list)


@dataclass
class Meal:
    """A complete meal."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    timing: MealTiming = MealTiming.NOON
    target_time: Optional[time] = None
    components: List[MealComponent] = field(default_factory=list)
    total_nutrition: NutritionInfo = field(default_factory=lambda: NutritionInfo(0, 0))

    def calculate_totals(self) -> NutritionInfo:
        """Calculate total nutrition from components."""
        return NutritionInfo(
            calories=sum(c.nutrition.calories for c in self.components),
            protein_g=sum(c.nutrition.protein_g for c in self.components),
            carbs_g=sum(c.nutrition.carbs_g for c in self.components),
            fat_g=sum(c.nutrition.fat_g for c in self.components),
            fiber_g=sum(c.nutrition.fiber_g for c in self.components),
            sodium_mg=sum(c.nutrition.sodium_mg for c in self.components),
        )


@dataclass
class PatternSchedule:
    """Defines meal timing for a pattern."""
    pattern: PatternType
    meals: List[Dict[str, Any]]  # List of {timing, target_calories, target_protein}
    eating_window_start: Optional[time] = None
    eating_window_end: Optional[time] = None
    total_target_calories: int = 1800
    total_target_protein: int = 135


@dataclass
class DailyContext:
    """Context for a specific day affecting pattern choice."""
    date: date
    day_type: DayType = DayType.WEEKDAY
    weather: WeatherCondition = WeatherCondition.SUNNY
    stress_level: StressLevel = StressLevel.MODERATE
    activity_level: ActivityLevel = ActivityLevel.MODERATE
    has_morning_workout: bool = False
    has_evening_social: bool = False
    wake_time: Optional[time] = None
    sleep_time: Optional[time] = None
    special_notes: str = ""


@dataclass
class PatternLog:
    """Log entry for a day's pattern adherence."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    date: date = field(default_factory=date.today)
    pattern_planned: PatternType = PatternType.TRADITIONAL
    pattern_actual: Optional[PatternType] = None
    context: Optional[DailyContext] = None

    # Meals consumed
    meals: List[Meal] = field(default_factory=list)

    # Adherence metrics
    adherence_score: float = 0.0  # 0-1
    calorie_variance: float = 0.0  # actual - target
    protein_variance: float = 0.0

    # Subjective ratings (1-5)
    energy_rating: Optional[int] = None
    satisfaction_rating: Optional[int] = None
    hunger_rating: Optional[int] = None  # 1=always hungry, 5=never hungry

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class WeightEntry:
    """Weight tracking entry."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    date: date = field(default_factory=date.today)
    weight_lbs: float = 0.0
    time_of_day: str = "morning"  # morning, evening
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class UserProfile:
    """User profile with baseline stats."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    age: int = 37
    height_inches: int = 70  # 5'10"
    starting_weight_lbs: float = 250.0
    target_weight_lbs: float = 200.0
    target_calories: int = 1900  # 1800-2000 range
    target_protein_g: int = 137  # 130-145 range
    activity_level: ActivityLevel = ActivityLevel.MODERATE
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class PatternAnalytics:
    """Analytics summary for a pattern."""
    pattern: PatternType
    total_days_used: int = 0
    successful_days: int = 0  # Adherence >= 0.8
    average_adherence: float = 0.0
    average_calorie_variance: float = 0.0
    average_protein_variance: float = 0.0
    average_energy_rating: float = 0.0
    average_satisfaction_rating: float = 0.0
    average_hunger_rating: float = 0.0
    weight_change_correlation: float = 0.0  # Correlation with weight loss
    best_contexts: List[str] = field(default_factory=list)  # Contexts where pattern excels


@dataclass
class Prediction:
    """ML model prediction result."""
    prediction: Any
    confidence: float
    model_version: str
    timestamp: datetime = field(default_factory=datetime.now)
    explanation: Optional[Dict[str, Any]] = None


# Pattern configurations matching the PRD
PATTERN_CONFIGS: Dict[PatternType, PatternSchedule] = {
    PatternType.TRADITIONAL: PatternSchedule(
        pattern=PatternType.TRADITIONAL,
        meals=[
            {"timing": MealTiming.MORNING, "target_calories": 400, "target_protein": 35},
            {"timing": MealTiming.NOON, "target_calories": 850, "target_protein": 60},
            {"timing": MealTiming.EVENING, "target_calories": 550, "target_protein": 40},
        ],
        total_target_calories=1800,
        total_target_protein=135,
    ),
    PatternType.REVERSED: PatternSchedule(
        pattern=PatternType.REVERSED,
        meals=[
            {"timing": MealTiming.MORNING, "target_calories": 400, "target_protein": 35},
            {"timing": MealTiming.NOON, "target_calories": 550, "target_protein": 55},
            {"timing": MealTiming.EVENING, "target_calories": 850, "target_protein": 50},
        ],
        total_target_calories=1800,
        total_target_protein=140,
    ),
    PatternType.IF_NOON: PatternSchedule(
        pattern=PatternType.IF_NOON,
        meals=[
            {"timing": MealTiming.NOON, "target_calories": 900, "target_protein": 72},
            {"timing": MealTiming.EVENING, "target_calories": 900, "target_protein": 73},
        ],
        eating_window_start=time(12, 0),
        eating_window_end=time(20, 0),
        total_target_calories=1800,
        total_target_protein=145,
    ),
    PatternType.GRAZING_4_MEALS: PatternSchedule(
        pattern=PatternType.GRAZING_4_MEALS,
        meals=[
            {"timing": MealTiming.MORNING, "target_calories": 450, "target_protein": 32},
            {"timing": MealTiming.LATE_MORNING, "target_calories": 450, "target_protein": 35},
            {"timing": MealTiming.AFTERNOON, "target_calories": 450, "target_protein": 38},
            {"timing": MealTiming.EVENING, "target_calories": 450, "target_protein": 25},
        ],
        total_target_calories=1800,
        total_target_protein=130,
    ),
    PatternType.GRAZING_PLATTER: PatternSchedule(
        pattern=PatternType.GRAZING_PLATTER,
        meals=[
            {"timing": MealTiming.MORNING, "target_calories": 1800, "target_protein": 135},
        ],
        eating_window_start=time(7, 0),
        eating_window_end=time(20, 0),
        total_target_calories=1800,
        total_target_protein=135,
    ),
    PatternType.BIG_BREAKFAST: PatternSchedule(
        pattern=PatternType.BIG_BREAKFAST,
        meals=[
            {"timing": MealTiming.MORNING, "target_calories": 850, "target_protein": 58},
            {"timing": MealTiming.NOON, "target_calories": 400, "target_protein": 40},
            {"timing": MealTiming.EVENING, "target_calories": 550, "target_protein": 40},
        ],
        total_target_calories=1800,
        total_target_protein=138,
    ),
    PatternType.MORNING_FEAST: PatternSchedule(
        pattern=PatternType.MORNING_FEAST,
        meals=[
            {"timing": MealTiming.MORNING, "target_calories": 600, "target_protein": 45},
            {"timing": MealTiming.LATE_MORNING, "target_calories": 700, "target_protein": 52},
            {"timing": MealTiming.NOON, "target_calories": 500, "target_protein": 45},
        ],
        eating_window_start=time(5, 0),
        eating_window_end=time(13, 0),
        total_target_calories=1800,
        total_target_protein=142,
    ),
}
