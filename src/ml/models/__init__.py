"""
ML Models package for Meal Assistant.
Contains pattern recommender, weight predictor, ingredient substitution,
route optimization models, and Week 7-8 pattern analytics enhancements.
"""
from .pattern_recommender import PatternRecommender
from .pattern_recommender_v2 import (
    PatternRecommenderV2,
    PatternRecommendationV2,
    ContextualFeatures,
    SleepQuality,
    PreviousDayOutcome,
)
from .pattern_effectiveness import (
    PatternEffectivenessAnalyzer,
    EffectivenessProfile,
    EffectivenessMetrics,
    ContextCorrelation,
    FatigueAnalysis,
)
from .deal_cycle_predictor import (
    DealCyclePredictor,
    SaleRecord,
    SalePrediction,
    CyclePattern,
    ItemCycleProfile,
)
from .savings_validator import (
    SavingsValidator,
    SavingsRecord,
    ValidationResult,
    CorrectionFactor,
    ROIAnalysis,
)
from .weight_predictor import WeightPredictor
from .ingredient_substitution import IngredientSubstitutionModel
from .store_visit_predictor import (
    StoreVisitPredictor,
    StoreVisitFeatures,
    VisitDurationPrediction,
    StoreType,
    CrowdLevel,
    DayOfWeek,
)
from .traffic_patterns import (
    TrafficPatternLearner,
    TrafficPrediction,
    RouteSegment,
    Location,
    TrafficCondition,
    DepartureRecommendation,
)
from .route_sequence_optimizer import (
    RouteSequenceOptimizer,
    StoreInfo,
    ShoppingItem,
    OptimizedRoute,
    ItemCategory,
    StorePriority,
)
from .savings_predictor import (
    SavingsPredictor,
    SavingsAnalysis,
    WorthItRecommendation,
    StoreOption,
    ShoppingTrip,
    ShoppingStrategy,
    ValuePriority,
)

__all__ = [
    # Core ML models
    "PatternRecommender",
    "WeightPredictor",
    "IngredientSubstitutionModel",
    # Week 7-8 Pattern Analytics Enhancement
    "PatternRecommenderV2",
    "PatternRecommendationV2",
    "ContextualFeatures",
    "SleepQuality",
    "PreviousDayOutcome",
    "PatternEffectivenessAnalyzer",
    "EffectivenessProfile",
    "EffectivenessMetrics",
    "ContextCorrelation",
    "FatigueAnalysis",
    "DealCyclePredictor",
    "SaleRecord",
    "SalePrediction",
    "CyclePattern",
    "ItemCycleProfile",
    "SavingsValidator",
    "SavingsRecord",
    "ValidationResult",
    "CorrectionFactor",
    "ROIAnalysis",
    # Route optimization models
    "StoreVisitPredictor",
    "StoreVisitFeatures",
    "VisitDurationPrediction",
    "StoreType",
    "CrowdLevel",
    "DayOfWeek",
    "TrafficPatternLearner",
    "TrafficPrediction",
    "RouteSegment",
    "Location",
    "TrafficCondition",
    "DepartureRecommendation",
    "RouteSequenceOptimizer",
    "StoreInfo",
    "ShoppingItem",
    "OptimizedRoute",
    "ItemCategory",
    "StorePriority",
    "SavingsPredictor",
    "SavingsAnalysis",
    "WorthItRecommendation",
    "StoreOption",
    "ShoppingTrip",
    "ShoppingStrategy",
    "ValuePriority",
]
