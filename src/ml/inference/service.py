"""
ML Inference Service.
Provides unified interface for all ML model predictions.

FastAPI application for serving ML predictions via HTTP.
"""
from datetime import date
from pathlib import Path
from typing import Dict, Any, List, Optional
import time
import os

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Import health routes
from src.ml.inference.health import router as health_router
from src.ml.config.logging_config import logger, ml_logger

from src.data.models import (
    PatternType, DailyContext, DayType, WeatherCondition,
    StressLevel, ActivityLevel, PatternLog, WeightEntry,
    MealComponent, NutritionInfo
)
from src.ml.models.pattern_recommender import PatternRecommender, PatternRecommendation
from src.ml.models.weight_predictor import WeightPredictor, WeightForecast, WeightTrend
from src.ml.models.ingredient_substitution import IngredientSubstitutionModel, SubstitutionSuggestion
from src.ml.training.trainer import ModelTrainer


class MLInferenceService:
    """
    Unified service for all ML inference operations.

    Provides:
    - Pattern recommendations
    - Weight predictions
    - Ingredient substitutions
    - Model status and health checks
    """

    def __init__(self, models_dir: Optional[Path] = None):
        """
        Initialize inference service.

        Args:
            models_dir: Directory containing trained models
        """
        if models_dir is None:
            models_dir = Path(__file__).parent.parent.parent.parent / "models"

        self.models_dir = Path(models_dir)
        self.trainer = ModelTrainer(self.models_dir)

        # Try to load existing models
        self.loaded_models = self.trainer.load_models()

        # Initialize models that weren't loaded
        if not self.loaded_models.get("pattern_recommender"):
            self.trainer.pattern_recommender = PatternRecommender()

        if not self.loaded_models.get("weight_predictor"):
            self.trainer.weight_predictor = WeightPredictor()

        if not self.loaded_models.get("ingredient_substitution"):
            self.trainer.ingredient_model = IngredientSubstitutionModel()

    def recommend_pattern(
        self,
        day_type: str = "weekday",
        weather: str = "sunny",
        stress_level: int = 2,
        activity_level: str = "moderate",
        has_morning_workout: bool = False,
        has_evening_social: bool = False,
        prev_pattern: Optional[str] = None,
        prev_adherence: float = 0.8,
        prev_energy: int = 3,
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        Get pattern recommendations for given context.

        Args:
            day_type: Type of day (weekday, weekend, wfh, holiday)
            weather: Weather condition
            stress_level: Stress level 1-4
            activity_level: Activity level
            has_morning_workout: Whether there's a morning workout
            has_evening_social: Whether there's evening social plans
            prev_pattern: Previous day's pattern
            prev_adherence: Previous day's adherence score
            prev_energy: Previous day's energy rating
            top_k: Number of recommendations to return

        Returns:
            List of recommendation dicts
        """
        context = DailyContext(
            date=date.today(),
            day_type=DayType(day_type),
            weather=WeatherCondition(weather),
            stress_level=StressLevel(stress_level),
            activity_level=ActivityLevel(activity_level),
            has_morning_workout=has_morning_workout,
            has_evening_social=has_evening_social,
        )

        prev = PatternType(prev_pattern) if prev_pattern else None

        recommendations = self.trainer.pattern_recommender.predict(
            context=context,
            prev_pattern=prev,
            prev_adherence=prev_adherence,
            prev_energy=prev_energy,
            top_k=top_k,
        )

        return [
            {
                "pattern": r.pattern.value,
                "probability": round(r.probability, 3),
                "reasoning": r.reasoning,
                "rank": r.rank,
            }
            for r in recommendations
        ]

    def predict_weight(
        self,
        weight_entries: List[Dict[str, Any]],
        pattern_logs: Optional[List[Dict[str, Any]]] = None,
        days_ahead: int = 30,
        assumed_adherence: float = 0.85,
    ) -> Dict[str, Any]:
        """
        Predict weight for next N days.

        Args:
            weight_entries: List of weight entry dicts
            pattern_logs: List of pattern log dicts (optional)
            days_ahead: Days to forecast
            assumed_adherence: Assumed future adherence rate

        Returns:
            Dict with forecasts and trend analysis
        """
        # Convert to domain objects
        weights = [
            WeightEntry(
                date=date.fromisoformat(w["date"]) if isinstance(w["date"], str) else w["date"],
                weight_lbs=w["weight_lbs"],
                time_of_day=w.get("time_of_day", "morning"),
            )
            for w in weight_entries
        ]

        logs = []
        if pattern_logs:
            for log in pattern_logs:
                logs.append(PatternLog(
                    date=date.fromisoformat(log["date"]) if isinstance(log["date"], str) else log["date"],
                    pattern_planned=PatternType(log.get("pattern", "traditional")),
                    adherence_score=log.get("adherence_score", 0.8),
                    calorie_variance=log.get("calorie_variance", 0),
                ))

        # Get data quality status
        quality = self.trainer.weight_predictor.get_data_quality_status(weights)

        if not quality["can_predict"]:
            return {
                "status": "insufficient_data",
                "message": quality["message"],
                "points_needed": quality["points_needed"],
                "forecasts": [],
                "trend": None,
            }

        # Generate forecasts
        forecasts = self.trainer.weight_predictor.predict(
            weights=weights,
            pattern_logs=logs,
            days_ahead=days_ahead,
            assumed_adherence=assumed_adherence,
        )

        # Analyze trend
        trend = self.trainer.weight_predictor.analyze_trend(weights)

        return {
            "status": "success",
            "data_quality": quality["status"],
            "forecasts": [
                {
                    "date": f.date.isoformat(),
                    "predicted_weight": f.predicted_weight_lbs,
                    "confidence_lower": f.confidence_lower,
                    "confidence_upper": f.confidence_upper,
                    "confidence_level": round(f.confidence_level, 2),
                }
                for f in forecasts
            ],
            "trend": {
                "direction": trend.trend_direction,
                "weekly_rate_lbs": trend.weekly_rate_lbs,
                "days_to_goal": trend.days_to_goal,
                "on_track": trend.on_track,
            },
        }

    def suggest_substitutions(
        self,
        ingredient_name: str,
        ingredient_category: str = "protein",
        calories: float = 0,
        protein_g: float = 0,
        carbs_g: float = 0,
        fat_g: float = 0,
        top_k: int = 5,
        same_category_only: bool = True,
        max_calorie_diff: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get ingredient substitution suggestions.

        Args:
            ingredient_name: Name of ingredient to substitute
            ingredient_category: Category (protein, carb, vegetable, fat, fruit)
            calories: Calories per serving
            protein_g: Protein grams
            carbs_g: Carbs grams
            fat_g: Fat grams
            top_k: Number of suggestions
            same_category_only: Only suggest from same category
            max_calorie_diff: Maximum calorie difference allowed

        Returns:
            List of substitution suggestion dicts
        """
        ingredient = MealComponent(
            name=ingredient_name,
            category=ingredient_category,
            nutrition=NutritionInfo(
                calories=calories,
                protein_g=protein_g,
                carbs_g=carbs_g,
                fat_g=fat_g,
            ),
        )

        suggestions = self.trainer.ingredient_model.find_substitutes(
            ingredient=ingredient,
            top_k=top_k,
            same_category_only=same_category_only,
            max_calorie_diff=max_calorie_diff,
        )

        return [
            {
                "substitute_name": s.substitute.name,
                "category": s.substitute.category,
                "similarity_score": round(s.similarity_score, 3),
                "calories": s.substitute.nutrition.calories,
                "protein_g": s.substitute.nutrition.protein_g,
                "calorie_difference": s.calorie_difference,
                "protein_difference": s.protein_difference,
                "category_match": s.category_match,
                "notes": s.notes,
                "portion_size": s.substitute.portion_size,
            }
            for s in suggestions
        ]

    def get_ingredients_for_macros(
        self,
        target_calories: float,
        target_protein: float,
        category: Optional[str] = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Get ingredients matching target macros.

        Args:
            target_calories: Desired calories
            target_protein: Desired protein
            category: Optional category filter
            top_k: Number of results

        Returns:
            List of ingredient dicts
        """
        ingredients = self.trainer.ingredient_model.suggest_for_macros(
            target_calories=target_calories,
            target_protein=target_protein,
            category=category,
            top_k=top_k,
        )

        return [
            {
                "name": i.name,
                "category": i.category,
                "calories": i.nutrition.calories,
                "protein_g": i.nutrition.protein_g,
                "carbs_g": i.nutrition.carbs_g,
                "fat_g": i.nutrition.fat_g,
                "portion_size": i.portion_size,
                "tags": i.tags,
            }
            for i in ingredients
        ]

    def get_model_status(self) -> Dict[str, Any]:
        """
        Get status of all models.

        Returns:
            Dict with model status information
        """
        return {
            "models_loaded": self.loaded_models,
            "model_info": self.trainer.get_model_info(),
            "models_dir": str(self.models_dir),
        }

    def train_models(
        self,
        pattern_logs: Optional[List[Dict[str, Any]]] = None,
        weight_entries: Optional[List[Dict[str, Any]]] = None,
        target_weight: float = 200.0,
    ) -> Dict[str, Any]:
        """
        Train all models with provided data.

        Args:
            pattern_logs: Historical pattern logs
            weight_entries: Historical weight entries
            target_weight: Target weight

        Returns:
            Training results
        """
        # Convert input dicts to domain objects if provided
        logs = None
        if pattern_logs:
            logs = []
            for log in pattern_logs:
                context = None
                if "context" in log:
                    ctx = log["context"]
                    context = DailyContext(
                        date=date.fromisoformat(ctx["date"]) if isinstance(ctx.get("date"), str) else date.today(),
                        day_type=DayType(ctx.get("day_type", "weekday")),
                        weather=WeatherCondition(ctx.get("weather", "sunny")),
                        stress_level=StressLevel(ctx.get("stress_level", 2)),
                        activity_level=ActivityLevel(ctx.get("activity_level", "moderate")),
                        has_morning_workout=ctx.get("has_morning_workout", False),
                        has_evening_social=ctx.get("has_evening_social", False),
                    )

                logs.append(PatternLog(
                    date=date.fromisoformat(log["date"]) if isinstance(log["date"], str) else log["date"],
                    pattern_planned=PatternType(log.get("pattern_planned", "traditional")),
                    pattern_actual=PatternType(log.get("pattern_actual", log.get("pattern_planned", "traditional"))),
                    context=context,
                    adherence_score=log.get("adherence_score", 0.8),
                    calorie_variance=log.get("calorie_variance", 0),
                    protein_variance=log.get("protein_variance", 0),
                    energy_rating=log.get("energy_rating"),
                    satisfaction_rating=log.get("satisfaction_rating"),
                    hunger_rating=log.get("hunger_rating"),
                ))

        weights = None
        if weight_entries:
            weights = [
                WeightEntry(
                    date=date.fromisoformat(w["date"]) if isinstance(w["date"], str) else w["date"],
                    weight_lbs=w["weight_lbs"],
                    time_of_day=w.get("time_of_day", "morning"),
                )
                for w in weight_entries
            ]

        results = self.trainer.train_all(
            pattern_logs=logs,
            weight_entries=weights,
            target_weight=target_weight,
        )

        # Reload models
        self.loaded_models = self.trainer.load_models()

        return results


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Meal Assistant ML Service",
    description="Machine Learning inference service for meal planning and nutrition",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include health routes
app.include_router(health_router)

# Initialize ML service
ml_service: Optional[MLInferenceService] = None


@app.on_event("startup")
async def startup_event():
    """Initialize ML service on startup."""
    global ml_service
    start_time = time.time()

    try:
        models_dir = os.getenv("MODEL_PATH", "./models")
        ml_service = MLInferenceService(models_dir=Path(models_dir))
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_model_load("all_models", duration_ms, success=True)
        logger.info("ML Service initialized", models_dir=models_dir)
    except Exception as e:
        logger.error("Failed to initialize ML service", error=str(e))
        raise


# =============================================================================
# Request/Response Models
# =============================================================================

class PatternRequest(BaseModel):
    """Pattern recommendation request."""
    day_type: str = "weekday"
    weather: str = "sunny"
    stress_level: int = Field(default=2, ge=1, le=4)
    activity_level: str = "moderate"
    has_morning_workout: bool = False
    has_evening_social: bool = False
    prev_pattern: Optional[str] = None
    prev_adherence: float = Field(default=0.8, ge=0, le=1)
    prev_energy: int = Field(default=3, ge=1, le=5)
    top_k: int = Field(default=3, ge=1, le=10)


class WeightEntry(BaseModel):
    """Weight entry for prediction."""
    date: str
    weight_lbs: float
    time_of_day: str = "morning"


class WeightRequest(BaseModel):
    """Weight prediction request."""
    weight_entries: List[WeightEntry]
    pattern_logs: Optional[List[Dict[str, Any]]] = None
    days_ahead: int = Field(default=30, ge=1, le=90)
    assumed_adherence: float = Field(default=0.85, ge=0, le=1)


class SubstitutionRequest(BaseModel):
    """Ingredient substitution request."""
    ingredient_name: str
    ingredient_category: str = "protein"
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    top_k: int = Field(default=5, ge=1, le=20)
    same_category_only: bool = True
    max_calorie_diff: Optional[float] = None


class MacroRequest(BaseModel):
    """Macro-based ingredient search request."""
    target_calories: float
    target_protein: float
    category: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=20)


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Meal Assistant ML Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.post("/ml/patterns/recommend")
async def recommend_pattern(request: PatternRequest):
    """Get pattern recommendations for given context."""
    if ml_service is None:
        raise HTTPException(status_code=503, detail="ML service not initialized")

    start_time = time.time()
    try:
        result = ml_service.recommend_pattern(
            day_type=request.day_type,
            weather=request.weather,
            stress_level=request.stress_level,
            activity_level=request.activity_level,
            has_morning_workout=request.has_morning_workout,
            has_evening_social=request.has_evening_social,
            prev_pattern=request.prev_pattern,
            prev_adherence=request.prev_adherence,
            prev_energy=request.prev_energy,
            top_k=request.top_k,
        )
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_prediction("pattern_recommender", (1,), duration_ms, success=True)
        return {"recommendations": result}
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_prediction("pattern_recommender", (1,), duration_ms, success=False)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ml/weight/predict")
async def predict_weight(request: WeightRequest):
    """Predict weight for the next N days."""
    if ml_service is None:
        raise HTTPException(status_code=503, detail="ML service not initialized")

    start_time = time.time()
    try:
        weight_entries = [w.dict() for w in request.weight_entries]
        result = ml_service.predict_weight(
            weight_entries=weight_entries,
            pattern_logs=request.pattern_logs,
            days_ahead=request.days_ahead,
            assumed_adherence=request.assumed_adherence,
        )
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_prediction("weight_predictor", (len(weight_entries),), duration_ms, success=True)
        return result
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_prediction("weight_predictor", (0,), duration_ms, success=False)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ml/ingredients/substitute")
async def suggest_substitutions(request: SubstitutionRequest):
    """Get ingredient substitution suggestions."""
    if ml_service is None:
        raise HTTPException(status_code=503, detail="ML service not initialized")

    start_time = time.time()
    try:
        result = ml_service.suggest_substitutions(
            ingredient_name=request.ingredient_name,
            ingredient_category=request.ingredient_category,
            calories=request.calories,
            protein_g=request.protein_g,
            carbs_g=request.carbs_g,
            fat_g=request.fat_g,
            top_k=request.top_k,
            same_category_only=request.same_category_only,
            max_calorie_diff=request.max_calorie_diff,
        )
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_prediction("ingredient_substitution", (1,), duration_ms, success=True)
        return {"substitutions": result}
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        ml_logger.log_prediction("ingredient_substitution", (1,), duration_ms, success=False)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ml/ingredients/by-macros")
async def get_ingredients_for_macros(request: MacroRequest):
    """Get ingredients matching target macros."""
    if ml_service is None:
        raise HTTPException(status_code=503, detail="ML service not initialized")

    try:
        result = ml_service.get_ingredients_for_macros(
            target_calories=request.target_calories,
            target_protein=request.target_protein,
            category=request.category,
            top_k=request.top_k,
        )
        return {"ingredients": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ml/status")
async def get_model_status():
    """Get status of all ML models."""
    if ml_service is None:
        raise HTTPException(status_code=503, detail="ML service not initialized")

    return ml_service.get_model_status()
