"""
FastAPI Inference API.
REST endpoints for ML model predictions, deal matching, and route optimization.
"""
from datetime import date, datetime, time
from typing import List, Optional, Dict, Any
from pathlib import Path

try:
    from fastapi import FastAPI, HTTPException, Query
    from pydantic import BaseModel, Field
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.ml.inference.service import MLInferenceService
from src.ml.training.deal_matching.progressive_learning import ProgressiveLearner
from src.ml.training.deal_matching.deal_data_generator import DealDataGenerator
from src.ml.models.deal_matching.deal_parser_regex import ExtractedDeal, DealType
from src.ml.models.deal_matching.deal_matcher import ProductCatalog
from src.ml.models.store_visit_predictor import (
    StoreVisitPredictor, StoreVisitFeatures, StoreType, CrowdLevel,
    DayOfWeek as VisitDayOfWeek
)
from src.ml.models.traffic_patterns import (
    TrafficPatternLearner, RouteSegment, Location, TrafficCondition
)
from src.ml.models.route_sequence_optimizer import (
    RouteSequenceOptimizer, StoreInfo, ShoppingItem, ItemCategory, StorePriority
)
from src.ml.models.savings_predictor import (
    SavingsPredictor, StoreOption, ShoppingTrip, ShoppingStrategy, ValuePriority
)

# Initialize services
service = MLInferenceService()

# Initialize deal matching service
DEAL_DATA_DIR = Path(__file__).parent.parent.parent.parent / "models" / "deal_matching"
deal_learner = ProgressiveLearner(data_dir=DEAL_DATA_DIR)
deal_generator = DealDataGenerator()

# Initialize route optimization services
ROUTE_MODEL_DIR = Path(__file__).parent.parent.parent.parent / "models" / "route_optimization"
store_visit_predictor = StoreVisitPredictor(model_path=ROUTE_MODEL_DIR / "store_visit.json")
traffic_learner = TrafficPatternLearner(model_path=ROUTE_MODEL_DIR / "traffic_patterns.json")
route_optimizer = RouteSequenceOptimizer(model_path=ROUTE_MODEL_DIR / "route_optimizer.json")
savings_predictor = SavingsPredictor(model_path=ROUTE_MODEL_DIR / "savings_predictor.json")

# Create FastAPI app
if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="Meal Assistant ML API",
        description="ML-powered recommendations for the 7-pattern meal system",
        version="1.0.0",
    )

    # Request/Response Models
    class PatternRecommendRequest(BaseModel):
        """Request for pattern recommendation."""
        day_type: str = Field(default="weekday", description="Type of day: weekday, weekend, wfh, holiday")
        weather: str = Field(default="sunny", description="Weather condition")
        stress_level: int = Field(default=2, ge=1, le=4, description="Stress level 1-4")
        activity_level: str = Field(default="moderate", description="Activity level")
        has_morning_workout: bool = Field(default=False)
        has_evening_social: bool = Field(default=False)
        prev_pattern: Optional[str] = Field(default=None, description="Previous day's pattern")
        prev_adherence: float = Field(default=0.8, ge=0, le=1)
        prev_energy: int = Field(default=3, ge=1, le=5)
        top_k: int = Field(default=3, ge=1, le=7)

    class PatternRecommendation(BaseModel):
        """Pattern recommendation response."""
        pattern: str
        probability: float
        reasoning: List[str]
        rank: int

    class WeightEntry(BaseModel):
        """Weight entry for prediction."""
        date: str
        weight_lbs: float
        time_of_day: str = "morning"

    class PatternLogEntry(BaseModel):
        """Pattern log entry for prediction."""
        date: str
        pattern: str
        adherence_score: float = 0.8
        calorie_variance: float = 0

    class WeightPredictRequest(BaseModel):
        """Request for weight prediction."""
        weight_entries: List[WeightEntry]
        pattern_logs: Optional[List[PatternLogEntry]] = None
        days_ahead: int = Field(default=30, ge=1, le=90)
        assumed_adherence: float = Field(default=0.85, ge=0, le=1)

    class SubstitutionRequest(BaseModel):
        """Request for ingredient substitution."""
        ingredient_name: str
        ingredient_category: str = "protein"
        calories: float = 0
        protein_g: float = 0
        carbs_g: float = 0
        fat_g: float = 0
        top_k: int = Field(default=5, ge=1, le=20)
        same_category_only: bool = True
        max_calorie_diff: Optional[float] = None

    class MacroSearchRequest(BaseModel):
        """Request for macro-based ingredient search."""
        target_calories: float
        target_protein: float
        category: Optional[str] = None
        top_k: int = Field(default=5, ge=1, le=20)

    class TrainRequest(BaseModel):
        """Request to train models."""
        pattern_logs: Optional[List[dict]] = None
        weight_entries: Optional[List[dict]] = None
        target_weight: float = 200.0

    # API Endpoints

    # Deal Matching Request/Response Models
    class AdParseRequest(BaseModel):
        """Request to parse an ad for deals."""
        ad_text: str = Field(..., description="OCR text from grocery ad")
        store: Optional[str] = Field(None, description="Store name (helps with templates)")
        coordinates: Optional[List[Dict[str, Any]]] = Field(None, description="OCR coordinates")

    class DealResponse(BaseModel):
        """Extracted deal response."""
        raw_text: str
        deal_type: str
        product_name: Optional[str]
        price: Optional[float]
        unit: Optional[str]
        quantity: Optional[int]
        discount_amount: Optional[float]
        discount_percent: Optional[float]
        confidence: float

    class ProductMatchResponse(BaseModel):
        """Product match response."""
        product_id: str
        product_name: str
        category: str
        match_score: float
        match_features: Dict[str, float]

    class AdParseResponse(BaseModel):
        """Response from ad parsing."""
        deals: List[DealResponse]
        matches: List[ProductMatchResponse]
        phase_used: int
        confidence: float
        processing_time_ms: float

    class DealCorrectionRequest(BaseModel):
        """Request to submit a deal correction."""
        deal_id: str = Field(..., description="Unique deal identifier")
        store: str = Field(..., description="Store name")
        raw_text: str = Field(..., description="Original text around the deal")
        original_product_name: Optional[str] = Field(None)
        original_price: Optional[float] = Field(None)
        original_deal_type: str = Field(default="price")
        corrected_product_name: Optional[str] = Field(None)
        corrected_price: Optional[float] = Field(None)
        corrected_deal_type: str = Field(default="price")
        corrected_product_id: Optional[str] = Field(None)

    class AccuracyResponse(BaseModel):
        """Accuracy statistics response."""
        total_deals: int
        accuracy: float
        correction_rate: float
        current_phase: int
        phase_accuracies: Dict[str, Any]

    @app.get("/")
    async def root():
        """API root endpoint."""
        return {
            "name": "Meal Assistant ML API",
            "version": "1.0.0",
            "endpoints": [
                "/recommend/pattern",
                "/predict/weight",
                "/substitute/ingredient",
                "/search/ingredients",
                "/status",
                "/train",
                "/ml/ads/parse",
                "/ml/deals/match",
                "/ml/learn",
                "/ml/accuracy",
                "/ml/templates/optimize",
            ],
        }

    @app.post("/recommend/pattern", response_model=List[PatternRecommendation])
    async def recommend_pattern(request: PatternRecommendRequest):
        """
        Get pattern recommendations for the given context.

        Returns ranked list of patterns with probabilities and reasoning.
        """
        try:
            recommendations = service.recommend_pattern(
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
            return recommendations
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/predict/weight")
    async def predict_weight(request: WeightPredictRequest):
        """
        Predict weight for the next N days.

        Returns forecasts with confidence intervals and trend analysis.
        """
        try:
            weight_entries = [w.dict() for w in request.weight_entries]
            pattern_logs = [p.dict() for p in request.pattern_logs] if request.pattern_logs else None

            result = service.predict_weight(
                weight_entries=weight_entries,
                pattern_logs=pattern_logs,
                days_ahead=request.days_ahead,
                assumed_adherence=request.assumed_adherence,
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/substitute/ingredient")
    async def substitute_ingredient(request: SubstitutionRequest):
        """
        Get substitution suggestions for an ingredient.

        Returns ranked list of nutritionally similar substitutes.
        """
        try:
            suggestions = service.suggest_substitutions(
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
            return {"suggestions": suggestions}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/search/ingredients")
    async def search_ingredients(request: MacroSearchRequest):
        """
        Search for ingredients matching target macros.
        """
        try:
            ingredients = service.get_ingredients_for_macros(
                target_calories=request.target_calories,
                target_protein=request.target_protein,
                category=request.category,
                top_k=request.top_k,
            )
            return {"ingredients": ingredients}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/status")
    async def get_status():
        """
        Get status of all ML models.
        """
        return service.get_model_status()

    @app.post("/train")
    async def train_models(request: TrainRequest):
        """
        Train all ML models with provided data.

        If no data provided, generates synthetic training data.
        """
        try:
            results = service.train_models(
                pattern_logs=request.pattern_logs,
                weight_entries=request.weight_entries,
                target_weight=request.target_weight,
            )
            return results
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/patterns")
    async def list_patterns():
        """List all available eating patterns."""
        from src.data.models import PatternType, PATTERN_CONFIGS

        patterns = []
        for pattern in PatternType:
            config = PATTERN_CONFIGS[pattern]
            patterns.append({
                "id": pattern.value,
                "name": pattern.value.replace("_", " ").title(),
                "meals_per_day": len(config.meals),
                "total_calories": config.total_target_calories,
                "total_protein": config.total_target_protein,
                "eating_window": {
                    "start": config.eating_window_start.isoformat() if config.eating_window_start else None,
                    "end": config.eating_window_end.isoformat() if config.eating_window_end else None,
                } if config.eating_window_start else None,
            })

        return {"patterns": patterns}

    @app.get("/ingredients")
    async def list_ingredients(
        category: Optional[str] = Query(None, description="Filter by category")
    ):
        """List all ingredients in the database."""
        if category:
            ingredients = service.trainer.ingredient_model.get_ingredients_by_category(category)
        else:
            ingredients = service.trainer.ingredient_model.ingredients

        return {
            "count": len(ingredients),
            "categories": service.trainer.ingredient_model.get_categories(),
            "ingredients": [
                {
                    "name": i.name,
                    "category": i.category,
                    "calories": i.nutrition.calories,
                    "protein_g": i.nutrition.protein_g,
                    "portion_size": i.portion_size,
                    "tags": i.tags,
                }
                for i in ingredients
            ],
        }

    # ===============================
    # Deal Matching API Endpoints
    # ===============================

    @app.post("/ml/ads/parse", response_model=AdParseResponse)
    async def parse_ad(request: AdParseRequest):
        """
        Parse ad text and extract deals using progressive learning.

        Uses the current learning phase (regex -> template -> ML) to extract
        deals from OCR text. Returns deals with confidence scores.
        """
        try:
            result = deal_learner.process_ad(
                ad_text=request.ad_text,
                store=request.store,
                coordinates=request.coordinates
            )

            # Convert to response format
            deals = [
                DealResponse(
                    raw_text=d.raw_text[:100],
                    deal_type=d.deal_type.value,
                    product_name=d.product_name,
                    price=d.price,
                    unit=d.unit,
                    quantity=d.quantity,
                    discount_amount=d.discount_amount,
                    discount_percent=d.discount_percent,
                    confidence=d.confidence,
                )
                for d in result.deals
            ]

            matches = [
                ProductMatchResponse(
                    product_id=m.product_id,
                    product_name=m.product_name,
                    category=m.category,
                    match_score=m.match_score,
                    match_features=m.match_features,
                )
                for m in result.matches
            ]

            return AdParseResponse(
                deals=deals,
                matches=matches,
                phase_used=result.phase_used.value,
                confidence=result.confidence,
                processing_time_ms=result.processing_time_ms,
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/deals/match")
    async def match_deals(
        deals: List[DealResponse],
        top_k: int = Query(default=3, ge=1, le=10)
    ):
        """
        Match extracted deals to products in catalog.

        Takes deals extracted by parse_ad and returns product matches
        using the ML matching model.
        """
        try:
            # Convert to ExtractedDeal objects
            extracted_deals = [
                ExtractedDeal(
                    raw_text=d.raw_text,
                    deal_type=DealType(d.deal_type) if d.deal_type in [e.value for e in DealType] else DealType.PRICE,
                    product_name=d.product_name,
                    price=d.price,
                    unit=d.unit,
                    quantity=d.quantity,
                    discount_amount=d.discount_amount,
                    discount_percent=d.discount_percent,
                    confidence=d.confidence,
                )
                for d in deals
            ]

            # Get matches
            matches = deal_learner.ml_matcher.match(extracted_deals, top_k=top_k)

            return {
                "matches": [
                    {
                        "deal_raw_text": m.deal.raw_text[:50],
                        "product_id": m.product_id,
                        "product_name": m.product_name,
                        "category": m.category,
                        "match_score": m.match_score,
                        "match_features": m.match_features,
                    }
                    for m in matches
                ]
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/learn")
    async def learn_from_correction(request: DealCorrectionRequest):
        """
        Learn from user correction to improve matching accuracy.

        Takes the original deal and user's correction, updates:
        1. Template patterns for the store
        2. ML training data
        3. Accuracy metrics

        This is the key endpoint for progressive learning.
        """
        try:
            # Create original deal
            original_deal = ExtractedDeal(
                raw_text=request.raw_text,
                deal_type=DealType(request.original_deal_type) if request.original_deal_type in [e.value for e in DealType] else DealType.PRICE,
                product_name=request.original_product_name,
                price=request.original_price,
            )

            # Create corrected deal
            corrected_deal = ExtractedDeal(
                raw_text=request.raw_text,
                deal_type=DealType(request.corrected_deal_type) if request.corrected_deal_type in [e.value for e in DealType] else DealType.PRICE,
                product_name=request.corrected_product_name,
                price=request.corrected_price,
            )

            # Corrected product (if provided)
            corrected_product = None
            if request.corrected_product_id:
                corrected_product = {
                    'id': request.corrected_product_id,
                    'name': request.corrected_product_name or '',
                }

            # Learn from correction
            result = deal_learner.learn_from_correction(
                deal_id=request.deal_id,
                original_deal=original_deal,
                corrected_deal=corrected_deal,
                raw_text=request.raw_text,
                store=request.store,
                corrected_product=corrected_product,
            )

            return result

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/accuracy")
    async def get_accuracy(
        store: Optional[str] = Query(None, description="Filter by store")
    ):
        """
        Get current accuracy statistics.

        Returns accuracy by phase, store, and trend over time.
        """
        try:
            stats = deal_learner.get_stats()

            response = {
                "current_phase": stats['current_phase'],
                "phase_name": stats['phase_name'],
                "total_ads_processed": stats['total_ads_processed'],
                "total_corrections": stats['total_corrections'],
                "ml_model_trained": stats['ml_model_trained'],
                "accuracy": stats['accuracy'],
                "phase_advancement": stats['phase_advancement'],
            }

            if store:
                response["store_accuracy"] = deal_learner.accuracy_tracker.get_store_accuracy(store)
                response["store_trend"] = deal_learner.accuracy_tracker.get_trend(store=store, days=7)

            return response

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/templates/optimize")
    async def optimize_templates(
        store: str = Query(..., description="Store to optimize"),
        generate_synthetic: bool = Query(default=True, description="Generate synthetic data for testing")
    ):
        """
        A/B test templates and optimize for a store.

        Generates synthetic data and tests template accuracy.
        """
        try:
            if generate_synthetic:
                # Generate synthetic ad
                ad = deal_generator.generate_ad(
                    store=store,
                    num_deals=5,
                    ocr_quality=0.85
                )

                # Parse with current templates
                result = deal_learner.process_ad(
                    ad_text=ad.raw_text,
                    store=store
                )

                # Compare to ground truth
                correct = 0
                for ground_truth in ad.deals:
                    for extracted in result.deals:
                        if (ground_truth.price and extracted.price and
                            abs(ground_truth.price - extracted.price) < 0.02):
                            correct += 1
                            break

                accuracy = correct / len(ad.deals) if ad.deals else 0

                return {
                    "store": store,
                    "synthetic_deals": len(ad.deals),
                    "extracted_deals": len(result.deals),
                    "correct_matches": correct,
                    "accuracy": accuracy,
                    "phase_used": result.phase_used.value,
                    "template_stats": deal_learner.template_parser.get_stats().get('templates', {}).get(store.lower(), {}),
                }

            return {"message": "No synthetic data generated", "store": store}

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/stats")
    async def get_ml_stats():
        """
        Get comprehensive ML system statistics.

        Includes parser stats, training data, and predictions.
        """
        try:
            return deal_learner.get_stats()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/catalog/load")
    async def load_catalog(products: List[Dict[str, Any]]):
        """
        Load product catalog for matching.

        Products should have: id, name, category, typical_price
        """
        try:
            catalog = ProductCatalog(products=products)
            deal_learner.set_catalog(catalog)

            return {
                "loaded": len(products),
                "categories": list(set(p.get('category', '') for p in products)),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/catalog/generate")
    async def generate_catalog(num_products: int = Query(default=100, ge=10, le=1000)):
        """
        Generate synthetic product catalog for testing.
        """
        try:
            products = deal_generator.generate_product_catalog(num_products)
            catalog = ProductCatalog(products=products)
            deal_learner.set_catalog(catalog)

            return {
                "generated": len(products),
                "categories": list(set(p.get('category', '') for p in products)),
                "sample": products[:5],
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/prediction/target-date")
    async def predict_target_date(
        target_accuracy: float = Query(default=0.85, ge=0.5, le=1.0),
        store: Optional[str] = Query(None)
    ):
        """
        Predict when target accuracy will be reached.
        """
        try:
            return deal_learner.accuracy_tracker.predict_target_date(
                target_accuracy=target_accuracy,
                store=store
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/stores/needing-training")
    async def get_stores_needing_training():
        """
        Get list of stores that need more training.
        """
        try:
            return deal_learner.accuracy_tracker.get_stores_needing_training()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ===============================
    # Route Optimization API Models
    # ===============================

    class StoreVisitRequest(BaseModel):
        """Request for store visit duration prediction."""
        store_type: str = Field(..., description="Store type: supermarket, warehouse, discount, specialty, pharmacy, convenience")
        item_count: int = Field(..., ge=1, description="Number of items to purchase")
        day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Monday, 6=Sunday)")
        hour_of_day: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
        crowd_level: int = Field(default=3, ge=1, le=5, description="Crowd level (1=empty, 5=packed)")
        has_list: bool = Field(default=True, description="Whether user has shopping list")
        store_familiarity: float = Field(default=0.5, ge=0, le=1, description="How well user knows store")
        needs_deli_counter: bool = Field(default=False)
        needs_pharmacy: bool = Field(default=False)
        has_self_checkout: bool = Field(default=True)
        is_member: bool = Field(default=False, description="Warehouse membership")

    class RouteOptimizeRequest(BaseModel):
        """Request for route optimization."""
        stores: List[Dict[str, Any]] = Field(..., description="List of stores with lat/lon/items")
        items: List[Dict[str, Any]] = Field(..., description="Shopping items with category and store_id")
        start_time: str = Field(..., description="Trip start time (HH:MM)")
        home_lat: float = Field(..., description="Home latitude")
        home_lon: float = Field(..., description="Home longitude")
        max_trip_duration: int = Field(default=180, description="Max trip duration in minutes")
        has_cooler: bool = Field(default=False, description="Whether bringing cooler for perishables")

    class TrafficPredictRequest(BaseModel):
        """Request for traffic prediction."""
        origin_name: str = Field(..., description="Origin location name")
        origin_lat: float = Field(..., description="Origin latitude")
        origin_lon: float = Field(..., description="Origin longitude")
        dest_name: str = Field(..., description="Destination location name")
        dest_lat: float = Field(..., description="Destination latitude")
        dest_lon: float = Field(..., description="Destination longitude")
        base_duration_minutes: float = Field(..., description="Base duration without traffic")
        distance_miles: float = Field(..., description="Distance in miles")
        departure_time: str = Field(..., description="Departure time (HH:MM)")
        departure_date: Optional[str] = Field(None, description="Date (YYYY-MM-DD), defaults to today")

    class SavingsPredictRequest(BaseModel):
        """Request for savings prediction."""
        multi_store_cost: float = Field(..., description="Total cost at multiple stores")
        multi_store_time: float = Field(..., description="Total time for multi-store trip (minutes)")
        multi_store_distance: float = Field(..., description="Total distance for multi-store trip (miles)")
        multi_store_items: int = Field(..., description="Number of items purchased")
        single_store_price: float = Field(..., description="Price at single store")
        single_store_distance: float = Field(..., description="Distance to single store (miles)")
        single_store_travel_time: float = Field(..., description="Travel time to single store (minutes)")
        single_store_shopping_time: float = Field(..., description="Shopping time at single store (minutes)")
        value_priority: str = Field(default="balanced", description="Priority: time, money, balanced, quality")

    class WorthItRequest(BaseModel):
        """Request for worth-it recommendation."""
        stores: List[Dict[str, Any]] = Field(..., description="Store options with prices and times")
        total_items: int = Field(..., description="Total items to purchase")
        value_priority: str = Field(default="balanced", description="Priority: time, money, balanced, quality")
        max_stores: int = Field(default=3, description="Maximum stores to consider")

    class QuickSavingsRequest(BaseModel):
        """Quick savings estimate request."""
        price_difference: float = Field(..., description="How much cheaper multi-store is")
        extra_miles: float = Field(..., description="Additional miles to drive")
        extra_minutes: float = Field(..., description="Additional time required")

    # ===============================
    # Route Optimization API Endpoints
    # ===============================

    @app.post("/ml/route/optimize")
    async def optimize_route(request: RouteOptimizeRequest):
        """
        Optimize shopping route with intelligent constraints.

        Considers perishables (frozen last), store hours, parking difficulty,
        and cart transfer optimization.
        """
        try:
            # Parse start time
            hour, minute = map(int, request.start_time.split(':'))
            start_datetime = datetime.now().replace(hour=hour, minute=minute, second=0)

            # Convert stores to StoreInfo objects
            stores = []
            for s in request.stores:
                store_info = StoreInfo(
                    store_id=s.get('store_id', ''),
                    name=s.get('name', ''),
                    latitude=s.get('latitude', 0),
                    longitude=s.get('longitude', 0),
                    opens=time(s.get('opens_hour', 6), 0),
                    closes=time(s.get('closes_hour', 22), 0),
                    parking_difficulty=s.get('parking_difficulty', 3),
                    avg_checkout_time=s.get('avg_checkout_time', 5),
                    has_carts=s.get('has_carts', True),
                    items_to_buy=[ItemCategory(c) for c in s.get('item_categories', [])],
                    priority=StorePriority(s.get('priority', 3)),
                    estimated_items=s.get('estimated_items', 0),
                )
                stores.append(store_info)

            # Convert items to ShoppingItem objects
            items = []
            for i in request.items:
                item = ShoppingItem(
                    name=i.get('name', ''),
                    category=ItemCategory(i.get('category', 'pantry')),
                    store_id=i.get('store_id', ''),
                    quantity=i.get('quantity', 1),
                    estimated_weight_lbs=i.get('weight_lbs', 1.0),
                    perishable_minutes=i.get('perishable_minutes', 120),
                )
                items.append(item)

            # Optimize route
            result = route_optimizer.optimize(
                stores=stores,
                items=items,
                start_time=start_datetime,
                home_location=(request.home_lat, request.home_lon),
                max_trip_duration=request.max_trip_duration,
                has_cooler=request.has_cooler,
            )

            return {
                "store_order": [
                    {"store_id": s.store_id, "name": s.name}
                    for s in result.store_order
                ],
                "total_distance_miles": result.total_distance_miles,
                "total_time_minutes": result.total_time_minutes,
                "reasoning": result.reasoning,
                "constraints_satisfied": result.constraints_satisfied,
                "warnings": result.warnings,
                "estimated_arrival_times": result.estimated_arrival_times,
                "cart_strategy": result.cart_strategy,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/route/predict-duration")
    async def predict_visit_duration(request: StoreVisitRequest):
        """
        Predict store visit duration.

        Returns estimated time including shopping, checkout, and special stops.
        """
        try:
            features = StoreVisitFeatures(
                store_type=StoreType(request.store_type),
                item_count=request.item_count,
                day_of_week=VisitDayOfWeek(request.day_of_week),
                hour_of_day=request.hour_of_day,
                crowd_level=CrowdLevel(request.crowd_level),
                has_list=request.has_list,
                store_familiarity=request.store_familiarity,
                needs_deli_counter=request.needs_deli_counter,
                needs_pharmacy=request.needs_pharmacy,
                has_self_checkout=request.has_self_checkout,
                is_member=request.is_member,
            )

            prediction = store_visit_predictor.predict(features)

            return {
                "estimated_minutes": prediction.estimated_minutes,
                "confidence": prediction.confidence,
                "range_min": prediction.range_min,
                "range_max": prediction.range_max,
                "breakdown": prediction.breakdown,
                "factors": prediction.factors,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/route/best-time/{store_type}")
    async def get_best_visit_time(
        store_type: str,
        item_count: int = Query(default=10, ge=1),
        day_of_week: int = Query(default=0, ge=0, le=6)
    ):
        """
        Get optimal time to visit a store.

        Returns hourly breakdown with recommendations.
        """
        try:
            result = store_visit_predictor.get_optimal_time(
                store_type=StoreType(store_type),
                item_count=item_count,
                day=VisitDayOfWeek(day_of_week),
            )

            return result

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/route/traffic")
    async def predict_traffic(request: TrafficPredictRequest):
        """
        Predict traffic conditions for a route segment.
        """
        try:
            # Parse departure time
            hour, minute = map(int, request.departure_time.split(':'))
            if request.departure_date:
                dep_date = datetime.strptime(request.departure_date, "%Y-%m-%d")
            else:
                dep_date = datetime.now()
            departure = dep_date.replace(hour=hour, minute=minute, second=0)

            segment = RouteSegment(
                origin=Location(
                    latitude=request.origin_lat,
                    longitude=request.origin_lon,
                    name=request.origin_name,
                ),
                destination=Location(
                    latitude=request.dest_lat,
                    longitude=request.dest_lon,
                    name=request.dest_name,
                ),
                base_duration_minutes=request.base_duration_minutes,
                distance_miles=request.distance_miles,
            )

            prediction = traffic_learner.predict_traffic(segment, departure)

            return {
                "predicted_duration": prediction.predicted_duration,
                "delay_minutes": prediction.delay_minutes,
                "traffic_condition": prediction.traffic_condition.name,
                "confidence": prediction.confidence,
                "factors": prediction.factors,
                "best_departure_time": prediction.best_departure_time,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/savings/predict")
    async def predict_savings(request: SavingsPredictRequest):
        """
        Predict actual savings from multi-store vs single-store shopping.

        Considers gas cost, time value, and deal quality.
        """
        try:
            # Create multi-store trip
            multi_trip = ShoppingTrip(
                stores=[],  # Simplified for API
                total_cost=request.multi_store_cost,
                total_time_minutes=request.multi_store_time,
                total_distance_miles=request.multi_store_distance,
                items_purchased=request.multi_store_items,
                strategy=ShoppingStrategy.MULTI_STORE,
            )

            # Create single store option
            single_option = StoreOption(
                store_id="single",
                store_name="Single Store",
                distance_miles=request.single_store_distance,
                items_available=request.multi_store_items,
                total_price=request.single_store_price,
                travel_time_minutes=request.single_store_travel_time,
                shopping_time_minutes=request.single_store_shopping_time,
            )

            # Get priority
            priority_map = {
                "time": ValuePriority.TIME,
                "money": ValuePriority.MONEY,
                "balanced": ValuePriority.BALANCED,
                "quality": ValuePriority.QUALITY,
            }
            priority = priority_map.get(request.value_priority, ValuePriority.BALANCED)

            analysis = savings_predictor.predict_savings(
                multi_store_trip=multi_trip,
                single_store_option=single_option,
                value_priority=priority,
            )

            return {
                "gross_savings": analysis.gross_savings,
                "net_savings": analysis.net_savings,
                "time_cost": analysis.time_cost,
                "effective_savings": analysis.effective_savings,
                "hourly_savings_rate": analysis.hourly_savings_rate,
                "recommendation": analysis.recommendation,
                "worth_it": analysis.worth_it,
                "confidence": analysis.confidence,
                "breakdown": analysis.breakdown,
                "factors": analysis.factors,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/route/worth-it")
    async def recommend_worth_it(request: WorthItRequest):
        """
        Recommend whether multi-store shopping is worth it.

        Analyzes trade-off between time and savings.
        """
        try:
            # Convert stores to StoreOption objects
            stores = []
            for s in request.stores:
                option = StoreOption(
                    store_id=s.get('store_id', ''),
                    store_name=s.get('name', ''),
                    distance_miles=s.get('distance_miles', 0),
                    items_available=s.get('items_available', request.total_items),
                    total_price=s.get('total_price', 0),
                    travel_time_minutes=s.get('travel_time_minutes', 0),
                    shopping_time_minutes=s.get('shopping_time_minutes', 0),
                    deal_quality=s.get('deal_quality', 0.5),
                )
                stores.append(option)

            # Get priority
            priority_map = {
                "time": ValuePriority.TIME,
                "money": ValuePriority.MONEY,
                "balanced": ValuePriority.BALANCED,
                "quality": ValuePriority.QUALITY,
            }
            priority = priority_map.get(request.value_priority, ValuePriority.BALANCED)

            recommendation = savings_predictor.recommend_strategy(
                stores=stores,
                total_items=request.total_items,
                value_priority=priority,
                max_stores=request.max_stores,
            )

            return {
                "recommended_strategy": recommendation.recommended_strategy.value,
                "reasoning": recommendation.reasoning,
                "time_investment": recommendation.time_investment,
                "money_saved": recommendation.money_saved,
                "efficiency_score": recommendation.efficiency_score,
                "break_even_hourly": recommendation.break_even_hourly,
                "alternatives": recommendation.alternatives,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/savings/quick-estimate")
    async def quick_savings_estimate(request: QuickSavingsRequest):
        """
        Quick estimate of whether multi-store trip is worth it.
        """
        try:
            result = savings_predictor.quick_estimate(
                price_difference=request.price_difference,
                extra_miles=request.extra_miles,
                extra_minutes=request.extra_minutes,
            )
            return result

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/route/stats")
    async def get_route_optimization_stats():
        """
        Get route optimization model statistics.
        """
        try:
            return {
                "store_visit_predictor": store_visit_predictor.get_stats(),
                "traffic_learner": traffic_learner.get_stats(),
                "route_optimizer": route_optimizer.get_stats(),
                "savings_predictor": savings_predictor.get_stats(),
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/route/configure-savings")
    async def configure_savings_preferences(
        gas_price: Optional[float] = Query(None, description="Gas price per gallon"),
        mpg: Optional[float] = Query(None, description="Vehicle MPG"),
        hourly_value: Optional[float] = Query(None, description="Value of your time per hour"),
    ):
        """
        Configure savings predictor preferences.
        """
        try:
            savings_predictor.update_preferences(
                gas_price=gas_price,
                mpg=mpg,
                hourly_value=hourly_value,
            )
            return {
                "status": "updated",
                "current_settings": {
                    "gas_price": savings_predictor.gas_price,
                    "mpg": savings_predictor.mpg,
                    "hourly_value": savings_predictor.hourly_value,
                }
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # ===============================
    # Week 7-8 Pattern Analytics API
    # ===============================

    # Import Week 7-8 models
    from src.ml.models.pattern_recommender_v2 import (
        PatternRecommenderV2, ContextualFeatures, SleepQuality, PreviousDayOutcome
    )
    from src.ml.models.pattern_effectiveness import PatternEffectivenessAnalyzer
    from src.ml.models.deal_cycle_predictor import DealCyclePredictor, SaleRecord
    from src.ml.models.savings_validator import SavingsValidator, SavingsRecord

    # Initialize Week 7-8 services
    PATTERN_MODEL_DIR = Path(__file__).parent.parent.parent.parent / "models" / "patterns"
    pattern_recommender_v2 = PatternRecommenderV2(model_path=PATTERN_MODEL_DIR / "recommender_v2.pkl")
    pattern_effectiveness = PatternEffectivenessAnalyzer(model_path=PATTERN_MODEL_DIR / "effectiveness.json")
    deal_cycle_predictor = DealCyclePredictor(model_path=PATTERN_MODEL_DIR / "deal_cycles.json")
    savings_validator = SavingsValidator(model_path=PATTERN_MODEL_DIR / "savings_validator.json")

    # Request Models for Week 7-8
    class PatternRecommendV2Request(BaseModel):
        """Enhanced pattern recommendation request with 17 features."""
        day_type: str = Field(default="weekday", description="Day type: weekday, weekend, wfh, holiday")
        weather: str = Field(default="sunny", description="Weather condition")
        stress_level: int = Field(default=2, ge=1, le=4, description="Stress level 1-4")
        activity_level: str = Field(default="moderate", description="Activity level")
        has_morning_workout: bool = Field(default=False)
        has_evening_social: bool = Field(default=False)
        has_calendar_event: bool = Field(default=False)
        has_social_lunch: bool = Field(default=False)
        has_social_dinner: bool = Field(default=False)
        sleep_quality: int = Field(default=3, ge=1, le=5, description="Sleep quality 1-5")
        sleep_hours: float = Field(default=7.0, ge=0, le=12)
        prev_pattern: Optional[str] = Field(default=None)
        prev_adherence: float = Field(default=0.8, ge=0, le=1)
        prev_energy: int = Field(default=3, ge=1, le=5)
        prev_day_outcome: str = Field(default="success", description="success, partial, fail")
        pattern_fatigue_score: float = Field(default=0.0, ge=0, le=1)
        top_k: int = Field(default=3, ge=1, le=7)

    class FatigueCheckRequest(BaseModel):
        """Request to check pattern fatigue."""
        recent_patterns: List[Dict[str, Any]] = Field(..., description="Recent pattern logs")
        window_days: int = Field(default=7, ge=3, le=14)

    class DealCyclePredictRequest(BaseModel):
        """Request for deal cycle prediction."""
        item_id: str = Field(..., description="Item identifier")
        urgency: str = Field(default="normal", description="urgent, normal, flexible")

    class SavingsValidateRequest(BaseModel):
        """Request to validate savings prediction."""
        trip_id: str = Field(..., description="Trip identifier")
        trip_date: str = Field(..., description="Trip date (YYYY-MM-DD)")
        stores_visited: List[str] = Field(..., description="Stores visited")
        predicted_savings: float = Field(..., description="Predicted savings")
        actual_savings: float = Field(..., description="Actual savings")
        predicted_time: float = Field(default=60, description="Predicted time (minutes)")
        actual_time: float = Field(default=60, description="Actual time (minutes)")
        predicted_distance: float = Field(default=10, description="Predicted distance (miles)")
        actual_distance: float = Field(default=10, description="Actual distance (miles)")
        item_count: int = Field(default=10, description="Number of items")
        strategy: str = Field(default="multi_store", description="Shopping strategy")

    class SaleRecordRequest(BaseModel):
        """Request to add sale record."""
        item_id: str
        item_name: str
        store_id: str
        store_name: str
        sale_date: str
        original_price: float
        sale_price: float
        discount_percent: float
        deal_type: str = Field(default="regular")

    # Week 7-8 Endpoints

    @app.post("/ml/patterns/recommend-v2")
    async def recommend_pattern_v2(request: PatternRecommendV2Request):
        """
        Enhanced context-aware pattern recommendation with 17 features.

        Returns ranked patterns with confidence scores, reasoning, and suggested modifications.
        Target: 90%+ recommendation accuracy.
        """
        try:
            from src.data.models import DayType, WeatherCondition, StressLevel, ActivityLevel, PatternType

            context = ContextualFeatures(
                date=date.today(),
                day_type=DayType(request.day_type),
                weather=WeatherCondition(request.weather),
                stress_level=StressLevel(request.stress_level),
                activity_level=ActivityLevel(request.activity_level),
                has_morning_workout=request.has_morning_workout,
                has_evening_social=request.has_evening_social,
                has_calendar_event=request.has_calendar_event,
                has_social_lunch=request.has_social_lunch,
                has_social_dinner=request.has_social_dinner,
                sleep_quality=request.sleep_quality,
                sleep_hours=request.sleep_hours,
                prev_pattern=PatternType(request.prev_pattern) if request.prev_pattern else None,
                prev_adherence=request.prev_adherence,
                prev_energy=request.prev_energy,
                prev_day_outcome=request.prev_day_outcome,
                pattern_fatigue_score=request.pattern_fatigue_score,
            )

            recommendations = pattern_recommender_v2.predict(context, top_k=request.top_k)

            return {
                "recommendations": [
                    {
                        "pattern": rec.pattern.value,
                        "probability": rec.probability,
                        "confidence": rec.confidence,
                        "reasoning": rec.reasoning,
                        "rank": rec.rank,
                        "suggested_modifications": rec.suggested_modifications,
                    }
                    for rec in recommendations
                ],
                "model_version": pattern_recommender_v2.MODEL_VERSION,
                "feature_count": len(pattern_recommender_v2.FEATURE_NAMES),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/patterns/effectiveness/{pattern_id}")
    async def get_pattern_effectiveness(pattern_id: str):
        """
        Get comprehensive effectiveness analysis for a pattern.

        Returns adherence rate, weight loss rate, energy average, satisfaction,
        hunger levels, and context correlations.
        """
        try:
            profile = pattern_effectiveness.analyze_pattern(pattern_id)

            return {
                "pattern_id": profile.pattern_id,
                "pattern_name": profile.pattern_name,
                "metrics": {
                    "adherence_rate": profile.metrics.adherence_rate,
                    "weight_loss_rate": profile.metrics.weight_loss_rate,
                    "energy_average": profile.metrics.energy_average,
                    "satisfaction_average": profile.metrics.satisfaction_average,
                    "hunger_average": profile.metrics.hunger_average,
                    "success_score": profile.metrics.success_score,
                    "sustainability_score": profile.metrics.sustainability_score,
                    "days_analyzed": profile.metrics.days_analyzed,
                    "confidence": profile.metrics.confidence,
                },
                "best_contexts": {
                    "day_types": profile.best_day_types,
                    "weather": profile.best_weather,
                    "stress_levels": profile.best_stress_levels,
                    "schedule_types": profile.best_schedule_types,
                },
                "recommendation_score": profile.recommendation_score,
                "insights": profile.insights,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/patterns/fatigue-check")
    async def check_pattern_fatigue(request: FatigueCheckRequest):
        """
        Detect pattern fatigue and recommend variety.

        Analyzes recent pattern usage to detect burnout and suggests alternatives.
        """
        try:
            analysis = pattern_effectiveness.detect_fatigue(
                request.recent_patterns,
                window_days=request.window_days,
            )

            return {
                "pattern": analysis.pattern.value,
                "fatigue_level": analysis.fatigue_level,
                "fatigue_score": analysis.fatigue_score,
                "days_on_pattern": analysis.days_on_pattern,
                "trends": {
                    "adherence_trend": analysis.adherence_trend,
                    "satisfaction_trend": analysis.satisfaction_trend,
                },
                "recommended_action": analysis.recommended_action,
                "alternative_patterns": [p.value for p in analysis.alternative_patterns],
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/deals/cycle-predict")
    async def predict_deal_cycle(request: DealCyclePredictRequest):
        """
        Predict next sale date for an item based on historical cycles.

        Recommends 'wait' vs 'buy now' based on predicted deal timing.
        """
        try:
            result = deal_cycle_predictor.should_buy_now(
                request.item_id,
                urgency=request.urgency,
            )

            prediction = result.get("prediction")
            if prediction:
                return {
                    "recommendation": result["recommendation"],
                    "confidence": result["confidence"],
                    "reasoning": result["reasoning"],
                    "prediction": {
                        "item_id": prediction.item_id,
                        "item_name": prediction.item_name,
                        "predicted_date": prediction.predicted_date.isoformat(),
                        "days_until_sale": prediction.days_until_sale,
                        "expected_discount": prediction.expected_discount,
                        "prediction_range": {
                            "start": prediction.prediction_range[0].isoformat(),
                            "end": prediction.prediction_range[1].isoformat(),
                        },
                    },
                    "potential_savings": result.get("potential_savings"),
                }
            else:
                return {
                    "recommendation": result["recommendation"],
                    "confidence": result["confidence"],
                    "reasoning": result["reasoning"],
                }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/deals/add-sale")
    async def add_sale_record(request: SaleRecordRequest):
        """
        Add a historical sale record for cycle learning.
        """
        try:
            sale = SaleRecord(
                item_id=request.item_id,
                item_name=request.item_name,
                store_id=request.store_id,
                store_name=request.store_name,
                sale_date=date.fromisoformat(request.sale_date),
                original_price=request.original_price,
                sale_price=request.sale_price,
                discount_percent=request.discount_percent,
                deal_type=request.deal_type,
            )
            deal_cycle_predictor.add_sale(sale)

            return {
                "status": "recorded",
                "item_id": request.item_id,
                "sale_date": request.sale_date,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/deals/upcoming")
    async def get_upcoming_sales(
        days_ahead: int = Query(default=14, ge=1, le=60),
        min_confidence: float = Query(default=0.5, ge=0.1, le=1.0),
    ):
        """
        Get all predicted sales in the next N days.
        """
        try:
            predictions = deal_cycle_predictor.get_upcoming_sales(
                days_ahead=days_ahead,
                min_confidence=min_confidence,
            )

            return {
                "days_ahead": days_ahead,
                "predictions": [
                    {
                        "item_id": p.item_id,
                        "item_name": p.item_name,
                        "predicted_date": p.predicted_date.isoformat(),
                        "confidence": p.confidence,
                        "expected_discount": p.expected_discount,
                        "days_until_sale": p.days_until_sale,
                    }
                    for p in predictions
                ],
                "count": len(predictions),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/savings/validate")
    async def validate_savings(request: SavingsValidateRequest):
        """
        Validate predicted vs actual savings and learn correction factors.

        Improves future predictions through continuous learning.
        """
        try:
            record = SavingsRecord(
                trip_id=request.trip_id,
                trip_date=date.fromisoformat(request.trip_date),
                stores_visited=request.stores_visited,
                predicted_savings=request.predicted_savings,
                actual_savings=request.actual_savings,
                predicted_time=request.predicted_time,
                actual_time=request.actual_time,
                predicted_distance=request.predicted_distance,
                actual_distance=request.actual_distance,
                item_count=request.item_count,
                strategy=request.strategy,
            )

            result = savings_validator.record_trip(record)

            return {
                "validation": {
                    "accuracy": result.accuracy,
                    "deviation": result.deviation,
                    "deviation_percent": result.deviation_percent,
                    "is_accurate": result.is_accurate,
                    "factors": result.factors,
                },
                "overall_stats": savings_validator.get_stats(),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/savings/roi-analysis")
    async def get_roi_analysis(
        start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
        end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    ):
        """
        Get ROI analysis of multi-store shopping over a period.
        """
        try:
            start = date.fromisoformat(start_date) if start_date else None
            end = date.fromisoformat(end_date) if end_date else None

            analysis = savings_validator.analyze_roi(start, end)

            return {
                "period": {
                    "start": analysis.period_start.isoformat(),
                    "end": analysis.period_end.isoformat(),
                },
                "trips": {
                    "total": analysis.total_trips,
                    "multi_store": analysis.multi_store_trips,
                    "single_store": analysis.single_store_trips,
                },
                "savings": {
                    "predicted": analysis.total_predicted_savings,
                    "actual": analysis.total_actual_savings,
                },
                "costs": {
                    "extra_time_minutes": analysis.total_extra_time,
                    "extra_distance_miles": analysis.total_extra_distance,
                    "gas_cost": analysis.gas_cost,
                },
                "roi": {
                    "net_roi": analysis.net_roi,
                    "effective_hourly_rate": analysis.effective_hourly_rate,
                },
                "recommendation": analysis.recommendation,
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/ml/savings/adjust-prediction")
    async def adjust_savings_prediction(
        predicted_savings: float = Query(..., description="Raw prediction"),
        stores: str = Query(..., description="Comma-separated store IDs"),
        strategy: str = Query(default="multi_store"),
        trip_date: str = Query(..., description="Trip date (YYYY-MM-DD)"),
        item_count: int = Query(default=10, ge=1),
    ):
        """
        Adjust a savings prediction using learned correction factors.
        """
        try:
            store_list = [s.strip() for s in stores.split(",")]
            result = savings_validator.adjust_prediction(
                predicted_savings=predicted_savings,
                stores=store_list,
                strategy=strategy,
                trip_date=date.fromisoformat(trip_date),
                item_count=item_count,
            )

            return result

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/ml/patterns/stats")
    async def get_pattern_analytics_stats():
        """
        Get Week 7-8 pattern analytics statistics.
        """
        try:
            return {
                "pattern_recommender_v2": {
                    "version": pattern_recommender_v2.MODEL_VERSION,
                    "is_fitted": pattern_recommender_v2.is_fitted,
                    "feature_count": len(pattern_recommender_v2.FEATURE_NAMES),
                    "training_accuracy": pattern_recommender_v2.training_accuracy,
                },
                "pattern_effectiveness": pattern_effectiveness.get_stats(),
                "deal_cycle_predictor": deal_cycle_predictor.get_stats(),
                "savings_validator": savings_validator.get_stats(),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

else:
    # Minimal fallback if FastAPI not available
    app = None


def create_app() -> "FastAPI":
    """Factory function to create the FastAPI app."""
    if not FASTAPI_AVAILABLE:
        raise ImportError("FastAPI not installed. Run: pip install fastapi uvicorn")
    return app


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
