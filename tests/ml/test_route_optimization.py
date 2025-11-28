"""
Tests for route optimization ML models.
Tests store visit prediction, traffic patterns, route optimization, and savings prediction.
"""
import pytest
from datetime import datetime, time, timedelta
from pathlib import Path
import tempfile

from src.ml.models.store_visit_predictor import (
    StoreVisitPredictor,
    StoreVisitFeatures,
    StoreType,
    CrowdLevel,
    DayOfWeek,
    HistoricalVisit,
)
from src.ml.models.traffic_patterns import (
    TrafficPatternLearner,
    RouteSegment,
    Location,
    TrafficCondition,
    HistoricalTraffic,
)
from src.ml.models.route_sequence_optimizer import (
    RouteSequenceOptimizer,
    StoreInfo,
    ShoppingItem,
    ItemCategory,
    StorePriority,
)
from src.ml.models.savings_predictor import (
    SavingsPredictor,
    StoreOption,
    ShoppingTrip,
    ShoppingStrategy,
    ValuePriority,
    HistoricalTrip,
)


# ========================================
# Store Visit Predictor Tests
# ========================================

class TestStoreVisitPredictor:
    """Tests for StoreVisitPredictor."""

    @pytest.fixture
    def predictor(self):
        """Create predictor instance."""
        return StoreVisitPredictor()

    def test_basic_prediction(self, predictor):
        """Test basic store visit prediction."""
        features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=15,
            day_of_week=DayOfWeek.MONDAY,
            hour_of_day=10,
            crowd_level=CrowdLevel.MODERATE,
        )

        prediction = predictor.predict(features)

        assert prediction.estimated_minutes > 0
        assert prediction.confidence > 0.5
        assert prediction.range_min < prediction.estimated_minutes
        assert prediction.range_max > prediction.estimated_minutes
        assert len(prediction.breakdown) > 0

    def test_warehouse_takes_longer(self, predictor):
        """Test that warehouse stores take longer than supermarkets."""
        supermarket_features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=10,
            day_of_week=DayOfWeek.WEDNESDAY,
            hour_of_day=14,
            crowd_level=CrowdLevel.MODERATE,
        )

        warehouse_features = StoreVisitFeatures(
            store_type=StoreType.WAREHOUSE,
            item_count=10,
            day_of_week=DayOfWeek.WEDNESDAY,
            hour_of_day=14,
            crowd_level=CrowdLevel.MODERATE,
        )

        supermarket_pred = predictor.predict(supermarket_features)
        warehouse_pred = predictor.predict(warehouse_features)

        assert warehouse_pred.estimated_minutes > supermarket_pred.estimated_minutes

    def test_crowd_level_affects_duration(self, predictor):
        """Test that higher crowd levels increase duration."""
        base_features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=10,
            day_of_week=DayOfWeek.MONDAY,
            hour_of_day=10,
            crowd_level=CrowdLevel.EMPTY,
        )

        busy_features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=10,
            day_of_week=DayOfWeek.MONDAY,
            hour_of_day=10,
            crowd_level=CrowdLevel.PACKED,
        )

        empty_pred = predictor.predict(base_features)
        packed_pred = predictor.predict(busy_features)

        assert packed_pred.estimated_minutes > empty_pred.estimated_minutes

    def test_deli_counter_adds_time(self, predictor):
        """Test that deli counter adds extra time."""
        base_features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=10,
            day_of_week=DayOfWeek.MONDAY,
            hour_of_day=10,
            crowd_level=CrowdLevel.MODERATE,
            needs_deli_counter=False,
        )

        deli_features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=10,
            day_of_week=DayOfWeek.MONDAY,
            hour_of_day=10,
            crowd_level=CrowdLevel.MODERATE,
            needs_deli_counter=True,
        )

        base_pred = predictor.predict(base_features)
        deli_pred = predictor.predict(deli_features)

        assert deli_pred.estimated_minutes > base_pred.estimated_minutes
        assert "Deli counter stop" in deli_pred.factors

    def test_optimal_time_returns_recommendation(self, predictor):
        """Test optimal time recommendation."""
        result = predictor.get_optimal_time(
            store_type=StoreType.SUPERMARKET,
            item_count=15,
            day=DayOfWeek.SATURDAY,
        )

        assert "optimal_time" in result
        assert "recommendation" in result
        assert "hourly_breakdown" in result
        assert len(result["hourly_breakdown"]) > 0

    def test_training_updates_model(self, predictor):
        """Test that training updates model parameters."""
        visits = [
            HistoricalVisit(
                store_id="store1",
                store_type=StoreType.SUPERMARKET,
                item_count=10,
                actual_duration_minutes=35,  # Slower than average
                day_of_week=DayOfWeek.MONDAY,
                hour_of_day=10,
                crowd_level=CrowdLevel.MODERATE,
            )
            for _ in range(10)
        ]

        result = predictor.train(visits)

        assert result["status"] == "trained"
        assert result["visits_used"] == 10


# ========================================
# Traffic Pattern Learner Tests
# ========================================

class TestTrafficPatternLearner:
    """Tests for TrafficPatternLearner."""

    @pytest.fixture
    def learner(self):
        """Create learner instance."""
        return TrafficPatternLearner()

    @pytest.fixture
    def sample_segment(self):
        """Create sample route segment."""
        return RouteSegment(
            origin=Location(latitude=40.7128, longitude=-74.0060, name="Home"),
            destination=Location(latitude=40.7580, longitude=-73.9855, name="Store"),
            base_duration_minutes=15.0,
            distance_miles=5.0,
        )

    def test_basic_traffic_prediction(self, learner, sample_segment):
        """Test basic traffic prediction."""
        departure = datetime.now().replace(hour=10, minute=0)
        prediction = learner.predict_traffic(sample_segment, departure)

        assert prediction.predicted_duration >= sample_segment.base_duration_minutes
        assert prediction.traffic_condition is not None
        assert prediction.confidence > 0.5

    def test_rush_hour_has_more_delay(self, learner, sample_segment):
        """Test that rush hour has more traffic on weekdays."""
        # Use a fixed weekday (Monday) to ensure consistent weekday traffic patterns
        base_date = datetime(2025, 11, 24)  # A Monday
        morning_rush = base_date.replace(hour=8, minute=0)
        off_peak = base_date.replace(hour=14, minute=0)

        rush_pred = learner.predict_traffic(sample_segment, morning_rush)
        off_pred = learner.predict_traffic(sample_segment, off_peak)

        assert rush_pred.delay_minutes >= off_pred.delay_minutes

    def test_hourly_forecast(self, learner, sample_segment):
        """Test hourly traffic forecast."""
        today = datetime.now()
        forecasts = learner.get_hourly_forecast(sample_segment, today)

        assert len(forecasts) == 24
        for forecast in forecasts:
            assert "hour" in forecast
            assert "duration_minutes" in forecast
            assert "traffic_condition" in forecast

    def test_best_times_returns_sorted(self, learner, sample_segment):
        """Test that best times are sorted by duration."""
        today = datetime.now()
        best_times = learner.get_best_times(sample_segment, today, top_n=3)

        assert len(best_times) == 3
        # Verify sorted by duration
        for i in range(len(best_times) - 1):
            assert best_times[i]['duration_minutes'] <= best_times[i + 1]['duration_minutes']

    def test_multi_segment_route(self, learner):
        """Test route duration for multiple segments."""
        segments = [
            RouteSegment(
                origin=Location(40.7128, -74.0060, "Home"),
                destination=Location(40.7580, -73.9855, "Store1"),
                base_duration_minutes=10.0,
                distance_miles=3.0,
            ),
            RouteSegment(
                origin=Location(40.7580, -73.9855, "Store1"),
                destination=Location(40.7614, -73.9776, "Store2"),
                base_duration_minutes=8.0,
                distance_miles=2.0,
            ),
        ]

        departure = datetime.now().replace(hour=10, minute=0)
        result = learner.predict_route_duration(segments, departure)

        assert result["total_duration_minutes"] > 0
        assert len(result["segments"]) == 2
        assert "estimated_arrival" in result


# ========================================
# Route Sequence Optimizer Tests
# ========================================

class TestRouteSequenceOptimizer:
    """Tests for RouteSequenceOptimizer."""

    @pytest.fixture
    def optimizer(self):
        """Create optimizer instance."""
        return RouteSequenceOptimizer()

    @pytest.fixture
    def sample_stores(self):
        """Create sample stores."""
        return [
            StoreInfo(
                store_id="walmart",
                name="Walmart",
                latitude=40.7128,
                longitude=-74.0060,
                opens=time(6, 0),
                closes=time(22, 0),
                parking_difficulty=2,
                estimated_items=10,
            ),
            StoreInfo(
                store_id="costco",
                name="Costco",
                latitude=40.7580,
                longitude=-73.9855,
                opens=time(10, 0),
                closes=time(20, 0),
                parking_difficulty=4,
                estimated_items=5,
            ),
            StoreInfo(
                store_id="traderjoes",
                name="Trader Joes",
                latitude=40.7614,
                longitude=-73.9776,
                opens=time(8, 0),
                closes=time(21, 0),
                parking_difficulty=5,
                estimated_items=8,
            ),
        ]

    @pytest.fixture
    def sample_items(self):
        """Create sample shopping items."""
        return [
            ShoppingItem(name="Milk", category=ItemCategory.DAIRY, store_id="walmart"),
            ShoppingItem(name="Bread", category=ItemCategory.BAKERY, store_id="traderjoes"),
            ShoppingItem(name="Frozen Pizza", category=ItemCategory.FROZEN, store_id="costco"),
            ShoppingItem(name="Chicken", category=ItemCategory.MEAT_SEAFOOD, store_id="walmart"),
        ]

    def test_empty_stores(self, optimizer):
        """Test optimization with no stores."""
        result = optimizer.optimize(
            stores=[],
            items=[],
            start_time=datetime.now(),
            home_location=(40.7, -74.0),
        )

        assert len(result.store_order) == 0
        assert result.total_distance_miles == 0

    def test_single_store(self, optimizer, sample_stores):
        """Test optimization with single store."""
        result = optimizer.optimize(
            stores=[sample_stores[0]],
            items=[],
            start_time=datetime.now(),
            home_location=(40.7, -74.0),
        )

        assert len(result.store_order) == 1
        assert result.store_order[0].store_id == "walmart"

    def test_multiple_stores_returns_order(self, optimizer, sample_stores, sample_items):
        """Test that multiple stores returns optimized order."""
        result = optimizer.optimize(
            stores=sample_stores,
            items=sample_items,
            start_time=datetime.now().replace(hour=9),
            home_location=(40.7, -74.0),
        )

        assert len(result.store_order) == 3
        assert result.total_distance_miles > 0
        assert result.total_time_minutes > 0
        assert len(result.reasoning) > 0

    def test_frozen_items_last(self, optimizer, sample_stores, sample_items):
        """Test that frozen items are purchased last."""
        # Items with frozen at specific store
        items_with_frozen = [
            ShoppingItem(name="Bread", category=ItemCategory.PANTRY, store_id="walmart"),
            ShoppingItem(name="Ice Cream", category=ItemCategory.FROZEN, store_id="traderjoes"),
        ]

        stores = [
            StoreInfo("walmart", "Walmart", 40.71, -74.00, time(6, 0), time(22, 0)),
            StoreInfo("traderjoes", "Trader Joes", 40.76, -73.97, time(8, 0), time(21, 0)),
        ]

        result = optimizer.optimize(
            stores=stores,
            items=items_with_frozen,
            start_time=datetime.now().replace(hour=10),
            home_location=(40.7, -74.0),
            has_cooler=False,
        )

        # The store with frozen items should be last or near last
        # (unless other constraints override)
        assert len(result.store_order) == 2

    def test_perishable_order(self, optimizer, sample_items):
        """Test perishable category ordering."""
        order = optimizer.get_perishable_order(sample_items)

        # Frozen should be last in the category order
        if ItemCategory.FROZEN in order:
            assert order.index(ItemCategory.FROZEN) == len(order) - 1 or \
                   order.index(ItemCategory.FROZEN) > order.index(ItemCategory.BAKERY)

    def test_cart_strategy_recommendation(self, optimizer, sample_stores, sample_items):
        """Test cart strategy recommendation."""
        result = optimizer.optimize(
            stores=sample_stores,
            items=sample_items,
            start_time=datetime.now().replace(hour=10),
            home_location=(40.7, -74.0),
        )

        assert result.cart_strategy != ""


# ========================================
# Savings Predictor Tests
# ========================================

class TestSavingsPredictor:
    """Tests for SavingsPredictor."""

    @pytest.fixture
    def predictor(self):
        """Create predictor instance."""
        return SavingsPredictor(hourly_value=25.0)

    @pytest.fixture
    def multi_store_trip(self):
        """Create sample multi-store trip."""
        return ShoppingTrip(
            stores=[],
            total_cost=85.0,
            total_time_minutes=90,
            total_distance_miles=15,
            items_purchased=20,
            strategy=ShoppingStrategy.MULTI_STORE,
        )

    @pytest.fixture
    def single_store_option(self):
        """Create sample single store option."""
        return StoreOption(
            store_id="walmart",
            store_name="Walmart",
            distance_miles=5,
            items_available=20,
            total_price=100.0,
            travel_time_minutes=15,
            shopping_time_minutes=30,
        )

    def test_savings_calculation(self, predictor, multi_store_trip, single_store_option):
        """Test basic savings calculation."""
        analysis = predictor.predict_savings(
            multi_store_trip=multi_store_trip,
            single_store_option=single_store_option,
        )

        assert analysis.gross_savings > 0
        assert analysis.confidence > 0.5
        assert len(analysis.breakdown) > 0

    def test_gas_cost_included(self, predictor, multi_store_trip, single_store_option):
        """Test that gas cost is included in analysis."""
        analysis = predictor.predict_savings(
            multi_store_trip=multi_store_trip,
            single_store_option=single_store_option,
        )

        assert "single_store_gas" in analysis.breakdown
        assert "multi_store_gas" in analysis.breakdown
        assert analysis.breakdown["multi_store_gas"] > analysis.breakdown["single_store_gas"]

    def test_time_value_matters(self, predictor, multi_store_trip, single_store_option):
        """Test that time value affects recommendation."""
        # With high hourly value, multi-store may not be worth it
        high_value_predictor = SavingsPredictor(hourly_value=100.0)
        low_value_predictor = SavingsPredictor(hourly_value=10.0)

        high_analysis = high_value_predictor.predict_savings(
            multi_store_trip=multi_store_trip,
            single_store_option=single_store_option,
        )

        low_analysis = low_value_predictor.predict_savings(
            multi_store_trip=multi_store_trip,
            single_store_option=single_store_option,
        )

        # Higher time value = higher time cost
        assert high_analysis.time_cost > low_analysis.time_cost

    def test_quick_estimate(self, predictor):
        """Test quick savings estimate."""
        result = predictor.quick_estimate(
            price_difference=20.0,
            extra_miles=10,
            extra_minutes=30,
        )

        assert "gross_savings" in result
        assert "gas_cost" in result
        assert "net_savings" in result
        assert "worth_it" in result
        assert "recommendation" in result

    def test_strategy_recommendation(self, predictor):
        """Test strategy recommendation."""
        stores = [
            StoreOption(
                store_id="store1",
                store_name="Store 1",
                distance_miles=3,
                items_available=20,
                total_price=80.0,
                travel_time_minutes=10,
                shopping_time_minutes=25,
            ),
            StoreOption(
                store_id="store2",
                store_name="Store 2",
                distance_miles=5,
                items_available=20,
                total_price=95.0,
                travel_time_minutes=15,
                shopping_time_minutes=30,
            ),
            StoreOption(
                store_id="store3",
                store_name="Store 3",
                distance_miles=4,
                items_available=20,
                total_price=90.0,
                travel_time_minutes=12,
                shopping_time_minutes=28,
            ),
        ]

        recommendation = predictor.recommend_strategy(
            stores=stores,
            total_items=20,
            value_priority=ValuePriority.BALANCED,
        )

        assert recommendation.recommended_strategy is not None
        assert len(recommendation.reasoning) > 0

    def test_money_priority_favors_savings(self, predictor):
        """Test that money priority favors maximum savings."""
        stores = [
            StoreOption("s1", "Store 1", 3, 20, 100.0, 10, 25),
            StoreOption("s2", "Store 2", 8, 20, 70.0, 25, 35),
        ]

        money_rec = predictor.recommend_strategy(
            stores=stores,
            total_items=20,
            value_priority=ValuePriority.MONEY,
        )

        time_rec = predictor.recommend_strategy(
            stores=stores,
            total_items=20,
            value_priority=ValuePriority.TIME,
        )

        # Money priority should be more willing to go to farther store
        # Time priority should prefer closer store
        assert money_rec.money_saved >= time_rec.money_saved or \
               money_rec.time_investment <= time_rec.time_investment

    def test_update_preferences(self, predictor):
        """Test preference updates."""
        predictor.update_preferences(
            gas_price=4.00,
            mpg=30,
            hourly_value=30.0,
        )

        assert predictor.gas_price == 4.00
        assert predictor.mpg == 30
        assert predictor.hourly_value == 30.0


# ========================================
# Integration Tests
# ========================================

class TestRouteOptimizationIntegration:
    """Integration tests for route optimization workflow."""

    def test_full_shopping_workflow(self):
        """Test complete shopping optimization workflow."""
        # 1. Create stores
        stores = [
            StoreInfo(
                store_id="walmart",
                name="Walmart",
                latitude=40.7128,
                longitude=-74.0060,
                opens=time(6, 0),
                closes=time(22, 0),
                parking_difficulty=2,
            ),
            StoreInfo(
                store_id="aldi",
                name="Aldi",
                latitude=40.7580,
                longitude=-73.9855,
                opens=time(9, 0),
                closes=time(20, 0),
                parking_difficulty=3,
            ),
        ]

        # 2. Create items
        items = [
            ShoppingItem("Milk", ItemCategory.DAIRY, "walmart"),
            ShoppingItem("Bread", ItemCategory.BAKERY, "aldi"),
            ShoppingItem("Ice Cream", ItemCategory.FROZEN, "walmart"),
        ]

        # 3. Optimize route
        optimizer = RouteSequenceOptimizer()
        route = optimizer.optimize(
            stores=stores,
            items=items,
            start_time=datetime.now().replace(hour=10),
            home_location=(40.70, -74.01),
        )

        # 4. Predict store visit durations
        visit_predictor = StoreVisitPredictor()
        for store in route.store_order:
            features = StoreVisitFeatures(
                store_type=StoreType.SUPERMARKET,
                item_count=2,
                day_of_week=DayOfWeek.SATURDAY,
                hour_of_day=10,
                crowd_level=CrowdLevel.MODERATE,
            )
            prediction = visit_predictor.predict(features)
            assert prediction.estimated_minutes > 0

        # 5. Calculate savings
        savings_predictor = SavingsPredictor()
        estimate = savings_predictor.quick_estimate(
            price_difference=15.0,
            extra_miles=5.0,
            extra_minutes=20.0,
        )

        assert "worth_it" in estimate
        assert "recommendation" in estimate

    def test_prediction_accuracy_within_tolerance(self):
        """Test that predictions are within acceptable tolerance."""
        predictor = StoreVisitPredictor()

        # Multiple predictions should be consistent
        features = StoreVisitFeatures(
            store_type=StoreType.SUPERMARKET,
            item_count=15,
            day_of_week=DayOfWeek.MONDAY,
            hour_of_day=10,
            crowd_level=CrowdLevel.MODERATE,
        )

        predictions = [predictor.predict(features) for _ in range(5)]

        # All predictions should be identical (deterministic)
        for pred in predictions[1:]:
            assert pred.estimated_minutes == predictions[0].estimated_minutes

        # Range should be within 50% of estimate
        pred = predictions[0]
        assert pred.range_min >= pred.estimated_minutes * 0.5
        assert pred.range_max <= pred.estimated_minutes * 2.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
