"""
Store Sequence Optimizer.
Intelligent store visit ordering beyond simple TSP.
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple, Set
import numpy as np
from pathlib import Path
import json
from itertools import permutations


class ItemCategory(Enum):
    """Product categories affecting visit order."""
    FROZEN = "frozen"          # Must be last
    REFRIGERATED = "refrigerated"  # Near last
    FRESH_PRODUCE = "fresh_produce"
    MEAT_SEAFOOD = "meat_seafood"  # Keep cold
    BAKERY = "bakery"
    DAIRY = "dairy"            # Keep cold
    PANTRY = "pantry"          # Shelf stable
    HOUSEHOLD = "household"    # Non-food
    PHARMACY = "pharmacy"


class StorePriority(Enum):
    """Priority levels for store visits."""
    CRITICAL = 1   # Must visit (specific item only here)
    HIGH = 2       # Strong preference
    MEDIUM = 3     # Normal
    LOW = 4        # Optional (convenience)


@dataclass
class StoreInfo:
    """Information about a store."""
    store_id: str
    name: str
    latitude: float
    longitude: float
    opens: time
    closes: time
    parking_difficulty: int = 3  # 1=easy, 5=hard
    avg_checkout_time: int = 5   # minutes
    has_carts: bool = True
    accepts_bags: bool = True    # Can bring own bags
    items_to_buy: List[ItemCategory] = field(default_factory=list)
    priority: StorePriority = StorePriority.MEDIUM
    estimated_items: int = 0


@dataclass
class ShoppingItem:
    """An item to purchase."""
    name: str
    category: ItemCategory
    store_id: str  # Which store to buy from
    quantity: int = 1
    estimated_weight_lbs: float = 1.0
    perishable_minutes: int = 120  # How long before needs refrigeration


@dataclass
class OptimizedRoute:
    """Result of route optimization."""
    store_order: List[StoreInfo]
    total_distance_miles: float
    total_time_minutes: float
    reasoning: List[str]
    constraints_satisfied: List[str]
    warnings: List[str]
    estimated_arrival_times: Dict[str, str]
    cart_strategy: str


@dataclass
class RouteConstraint:
    """Constraint for route optimization."""
    name: str
    type: str  # 'perishable', 'hours', 'parking', 'sequence'
    affected_stores: List[str]
    priority: int = 1


class RouteSequenceOptimizer:
    """
    ML-enhanced route optimizer that considers:
    - Perishable items (frozen last)
    - Store hours
    - Parking difficulty
    - Cart transfer optimization
    - Distance optimization
    - Time constraints
    """

    # Category constraints (lower = earlier in trip)
    CATEGORY_ORDER_PRIORITY = {
        ItemCategory.HOUSEHOLD: 1,
        ItemCategory.PHARMACY: 2,
        ItemCategory.PANTRY: 3,
        ItemCategory.BAKERY: 4,
        ItemCategory.FRESH_PRODUCE: 5,
        ItemCategory.DAIRY: 6,
        ItemCategory.MEAT_SEAFOOD: 7,
        ItemCategory.REFRIGERATED: 8,
        ItemCategory.FROZEN: 9,
    }

    # Time sensitive categories (minutes before quality degrades)
    PERISHABLE_LIMITS = {
        ItemCategory.FROZEN: 30,
        ItemCategory.REFRIGERATED: 60,
        ItemCategory.MEAT_SEAFOOD: 60,
        ItemCategory.DAIRY: 90,
        ItemCategory.FRESH_PRODUCE: 180,
        ItemCategory.BAKERY: 240,
    }

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize optimizer."""
        self.model_path = model_path
        self.historical_routes: List[Dict] = []
        self.store_preferences: Dict[str, float] = {}  # Learned efficiency ratings
        self._load_model()

    def _load_model(self) -> None:
        """Load trained model."""
        if self.model_path and self.model_path.exists():
            try:
                with open(self.model_path, 'r') as f:
                    data = json.load(f)
                    self.store_preferences = data.get('store_preferences', {})
            except (json.JSONDecodeError, IOError):
                pass

    def save_model(self) -> None:
        """Save learned preferences."""
        if self.model_path:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.model_path, 'w') as f:
                json.dump({
                    'store_preferences': self.store_preferences,
                }, f, indent=2)

    def optimize(
        self,
        stores: List[StoreInfo],
        items: List[ShoppingItem],
        start_time: datetime,
        home_location: Tuple[float, float],
        max_trip_duration: int = 180,  # minutes
        has_cooler: bool = False,
    ) -> OptimizedRoute:
        """
        Optimize the shopping route.

        Args:
            stores: Stores to visit
            items: Items to purchase
            start_time: Trip start time
            home_location: (lat, lon) of home
            max_trip_duration: Maximum trip length in minutes
            has_cooler: Whether bringing a cooler for perishables

        Returns:
            Optimized route with reasoning
        """
        if not stores:
            return OptimizedRoute(
                store_order=[],
                total_distance_miles=0,
                total_time_minutes=0,
                reasoning=["No stores to visit"],
                constraints_satisfied=[],
                warnings=[],
                estimated_arrival_times={},
                cart_strategy="None needed",
            )

        # Group items by store
        store_items: Dict[str, List[ShoppingItem]] = {}
        for item in items:
            if item.store_id not in store_items:
                store_items[item.store_id] = []
            store_items[item.store_id].append(item)

        # Calculate constraints
        constraints = self._identify_constraints(stores, items, start_time)

        # Score all possible orderings
        if len(stores) <= 6:
            # Brute force for small number of stores
            best_order = self._brute_force_optimize(
                stores, store_items, constraints, start_time, home_location, has_cooler
            )
        else:
            # Heuristic for larger sets
            best_order = self._heuristic_optimize(
                stores, store_items, constraints, start_time, home_location, has_cooler
            )

        # Calculate route metrics
        total_distance = self._calculate_route_distance(best_order, home_location)
        total_time = self._calculate_route_time(best_order, store_items, start_time)

        # Generate arrival times
        arrival_times = self._calculate_arrival_times(best_order, start_time)

        # Generate reasoning
        reasoning = self._generate_reasoning(best_order, store_items, constraints, has_cooler)

        # Check constraints
        satisfied, warnings = self._check_constraints(
            best_order, constraints, start_time, max_trip_duration, total_time
        )

        # Determine cart strategy
        cart_strategy = self._determine_cart_strategy(best_order, store_items)

        return OptimizedRoute(
            store_order=best_order,
            total_distance_miles=round(total_distance, 1),
            total_time_minutes=round(total_time, 0),
            reasoning=reasoning,
            constraints_satisfied=satisfied,
            warnings=warnings,
            estimated_arrival_times=arrival_times,
            cart_strategy=cart_strategy,
        )

    def _identify_constraints(
        self,
        stores: List[StoreInfo],
        items: List[ShoppingItem],
        start_time: datetime
    ) -> List[RouteConstraint]:
        """Identify constraints for optimization."""
        constraints = []

        # Store hours constraints
        for store in stores:
            open_dt = datetime.combine(start_time.date(), store.opens)
            close_dt = datetime.combine(start_time.date(), store.closes)

            if start_time < open_dt:
                constraints.append(RouteConstraint(
                    name=f"{store.name} opens at {store.opens}",
                    type="hours",
                    affected_stores=[store.store_id],
                    priority=1,
                ))

        # Perishable constraints
        store_perishables: Dict[str, int] = {}
        for item in items:
            if item.category in self.PERISHABLE_LIMITS:
                limit = self.PERISHABLE_LIMITS[item.category]
                if item.store_id not in store_perishables:
                    store_perishables[item.store_id] = limit
                else:
                    store_perishables[item.store_id] = min(
                        store_perishables[item.store_id], limit
                    )

        for store_id, limit in store_perishables.items():
            constraints.append(RouteConstraint(
                name=f"Perishables from store ({limit} min limit)",
                type="perishable",
                affected_stores=[store_id],
                priority=2,
            ))

        return constraints

    def _brute_force_optimize(
        self,
        stores: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        constraints: List[RouteConstraint],
        start_time: datetime,
        home_location: Tuple[float, float],
        has_cooler: bool,
    ) -> List[StoreInfo]:
        """Try all permutations for small store counts."""
        best_score = float('inf')
        best_order = stores.copy()

        for perm in permutations(stores):
            order = list(perm)
            score = self._score_order(
                order, store_items, constraints, start_time, home_location, has_cooler
            )
            if score < best_score:
                best_score = score
                best_order = order

        return best_order

    def _heuristic_optimize(
        self,
        stores: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        constraints: List[RouteConstraint],
        start_time: datetime,
        home_location: Tuple[float, float],
        has_cooler: bool,
    ) -> List[StoreInfo]:
        """Use heuristic for larger store counts."""
        # Start with stores that have earliest closing times
        remaining = stores.copy()
        ordered = []

        while remaining:
            # Score each remaining store for next position
            best_store = None
            best_score = float('inf')

            for store in remaining:
                test_order = ordered + [store]
                score = self._score_partial_order(
                    test_order, store_items, constraints, start_time, home_location, has_cooler
                )
                if score < best_score:
                    best_score = score
                    best_store = store

            if best_store:
                ordered.append(best_store)
                remaining.remove(best_store)

        return ordered

    def _score_order(
        self,
        order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        constraints: List[RouteConstraint],
        start_time: datetime,
        home_location: Tuple[float, float],
        has_cooler: bool,
    ) -> float:
        """Score a complete ordering (lower is better)."""
        score = 0.0

        # Distance score
        distance = self._calculate_route_distance(order, home_location)
        score += distance * 5  # Weight distance

        # Perishable score
        perishable_penalty = self._calculate_perishable_penalty(
            order, store_items, start_time, has_cooler
        )
        score += perishable_penalty * 10  # Heavy penalty for perishables

        # Store hours violation
        hours_penalty = self._calculate_hours_penalty(order, start_time)
        score += hours_penalty * 20

        # Parking difficulty (prefer hard parking early)
        parking_score = self._calculate_parking_score(order)
        score += parking_score

        # Priority score (visit high priority early)
        priority_score = self._calculate_priority_score(order)
        score += priority_score

        return score

    def _score_partial_order(
        self,
        partial_order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        constraints: List[RouteConstraint],
        start_time: datetime,
        home_location: Tuple[float, float],
        has_cooler: bool,
    ) -> float:
        """Score a partial ordering for greedy heuristic."""
        # Similar to full scoring but with position-based adjustments
        return self._score_order(
            partial_order, store_items, constraints, start_time, home_location, has_cooler
        )

    def _calculate_route_distance(
        self,
        order: List[StoreInfo],
        home_location: Tuple[float, float]
    ) -> float:
        """Calculate total route distance."""
        if not order:
            return 0.0

        total = 0.0

        # Home to first store
        total += self._haversine_distance(
            home_location[0], home_location[1],
            order[0].latitude, order[0].longitude
        )

        # Between stores
        for i in range(len(order) - 1):
            total += self._haversine_distance(
                order[i].latitude, order[i].longitude,
                order[i+1].latitude, order[i+1].longitude
            )

        # Last store to home
        total += self._haversine_distance(
            order[-1].latitude, order[-1].longitude,
            home_location[0], home_location[1]
        )

        return total

    def _haversine_distance(
        self,
        lat1: float, lon1: float,
        lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two points in miles."""
        R = 3959  # Earth radius in miles

        lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])

        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        c = 2 * np.arcsin(np.sqrt(a))

        return R * c

    def _calculate_route_time(
        self,
        order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        start_time: datetime
    ) -> float:
        """Calculate total route time including shopping."""
        if not order:
            return 0.0

        total = 0.0

        # Travel time (assume 30 mph average)
        distance = self._calculate_route_distance(
            order,
            (order[0].latitude - 0.01, order[0].longitude)  # Approximate home
        )
        travel_time = (distance / 30) * 60  # Convert to minutes
        total += travel_time

        # Shopping time at each store
        for store in order:
            items = store_items.get(store.store_id, [])
            item_count = sum(item.quantity for item in items)

            # Base time + per-item time + checkout
            base_time = 10
            item_time = item_count * 1.5
            checkout_time = store.avg_checkout_time

            total += base_time + item_time + checkout_time

        return total

    def _calculate_perishable_penalty(
        self,
        order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        start_time: datetime,
        has_cooler: bool
    ) -> float:
        """Calculate penalty for perishable item handling."""
        penalty = 0.0

        # Calculate time from each store to end of trip
        trip_times = self._estimate_remaining_times(order, store_items, start_time)

        for i, store in enumerate(order):
            items = store_items.get(store.store_id, [])
            remaining_time = trip_times.get(store.store_id, 0)

            for item in items:
                if item.category in self.PERISHABLE_LIMITS:
                    limit = self.PERISHABLE_LIMITS[item.category]

                    # Cooler extends time
                    if has_cooler:
                        limit *= 2

                    if remaining_time > limit:
                        # Penalty proportional to time over limit
                        penalty += (remaining_time - limit) / 10

        return penalty

    def _estimate_remaining_times(
        self,
        order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        start_time: datetime
    ) -> Dict[str, float]:
        """Estimate time remaining after each store visit."""
        remaining = {}

        # Calculate cumulative time from end
        total_time = self._calculate_route_time(order, store_items, start_time)
        elapsed = 0

        for store in order:
            items = store_items.get(store.store_id, [])
            item_count = sum(item.quantity for item in items)

            store_time = 10 + (item_count * 1.5) + store.avg_checkout_time
            elapsed += store_time

            remaining[store.store_id] = total_time - elapsed

        return remaining

    def _calculate_hours_penalty(
        self,
        order: List[StoreInfo],
        start_time: datetime
    ) -> float:
        """Calculate penalty for store hours violations."""
        penalty = 0.0
        current_time = start_time

        for store in order:
            open_time = datetime.combine(start_time.date(), store.opens)
            close_time = datetime.combine(start_time.date(), store.closes)

            # Add travel time estimate
            current_time += timedelta(minutes=15)

            if current_time < open_time:
                wait_minutes = (open_time - current_time).seconds / 60
                penalty += wait_minutes
            elif current_time > close_time:
                penalty += 100  # Major penalty for missing closing time

            # Add shopping time estimate
            current_time += timedelta(minutes=20)

        return penalty

    def _calculate_parking_score(self, order: List[StoreInfo]) -> float:
        """Score based on parking difficulty ordering."""
        score = 0.0

        for i, store in enumerate(order):
            # Prefer hard parking early (when we have less stuff)
            position_factor = (len(order) - i) / len(order)
            score += store.parking_difficulty * (1 - position_factor) * 0.5

        return score

    def _calculate_priority_score(self, order: List[StoreInfo]) -> float:
        """Score based on priority ordering."""
        score = 0.0

        for i, store in enumerate(order):
            # High priority stores should be earlier
            position_penalty = i * store.priority.value
            score += position_penalty * 0.3

        return score

    def _calculate_arrival_times(
        self,
        order: List[StoreInfo],
        start_time: datetime
    ) -> Dict[str, str]:
        """Calculate estimated arrival times."""
        arrivals = {}
        current_time = start_time

        for i, store in enumerate(order):
            # Add travel time
            if i == 0:
                travel_time = 10  # First store
            else:
                # Estimate based on previous store
                travel_time = 8

            current_time += timedelta(minutes=travel_time)
            arrivals[store.store_id] = current_time.strftime("%H:%M")

            # Add shopping time for next iteration
            current_time += timedelta(minutes=20)

        return arrivals

    def _generate_reasoning(
        self,
        order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]],
        constraints: List[RouteConstraint],
        has_cooler: bool,
    ) -> List[str]:
        """Generate human-readable reasoning for the route."""
        reasoning = []

        if not order:
            return ["No stores to visit"]

        # Explain first store choice
        first = order[0]
        if first.priority == StorePriority.CRITICAL:
            reasoning.append(f"Starting at {first.name} - must-visit store")
        elif first.parking_difficulty >= 4:
            reasoning.append(f"Starting at {first.name} - difficult parking (easier with empty cart)")
        else:
            reasoning.append(f"Starting at {first.name} - efficient route start")

        # Explain perishable handling
        for store in order:
            items = store_items.get(store.store_id, [])
            frozen_items = [i for i in items if i.category == ItemCategory.FROZEN]
            if frozen_items:
                idx = order.index(store)
                if idx >= len(order) - 2:
                    reasoning.append(f"{store.name} near end of route - frozen items stay cold")
                elif has_cooler:
                    reasoning.append(f"Frozen items from {store.name} protected by cooler")

        # Explain any constraints
        perishable_constraints = [c for c in constraints if c.type == "perishable"]
        if perishable_constraints and not has_cooler:
            reasoning.append("Route optimized to minimize time for perishable items")

        return reasoning

    def _check_constraints(
        self,
        order: List[StoreInfo],
        constraints: List[RouteConstraint],
        start_time: datetime,
        max_duration: int,
        actual_duration: float,
    ) -> Tuple[List[str], List[str]]:
        """Check which constraints are satisfied."""
        satisfied = []
        warnings = []

        # Check duration
        if actual_duration <= max_duration:
            satisfied.append(f"Trip within {max_duration} minute limit")
        else:
            warnings.append(f"Trip may exceed {max_duration} minutes ({actual_duration:.0f} min estimated)")

        # Check store hours
        current = start_time
        for store in order:
            current += timedelta(minutes=20)  # Travel + shopping estimate
            close = datetime.combine(start_time.date(), store.closes)
            if current < close:
                satisfied.append(f"{store.name} visited before closing")
            else:
                warnings.append(f"{store.name} may be closed by arrival time")

        return satisfied, warnings

    def _determine_cart_strategy(
        self,
        order: List[StoreInfo],
        store_items: Dict[str, List[ShoppingItem]]
    ) -> str:
        """Determine optimal cart/bag strategy."""
        total_items = sum(
            sum(i.quantity for i in items)
            for items in store_items.values()
        )

        if total_items < 10:
            return "Hand basket sufficient"
        elif total_items < 25:
            return "Use store carts, bring reusable bags for car transfer"
        else:
            return "Use store carts at each stop, keep cooler in car for perishables"

    def get_perishable_order(self, items: List[ShoppingItem]) -> List[ItemCategory]:
        """Get recommended order for purchasing item categories."""
        categories = list(set(item.category for item in items))
        return sorted(categories, key=lambda c: self.CATEGORY_ORDER_PRIORITY.get(c, 5))

    def train(self, routes: List[Dict]) -> Dict[str, Any]:
        """Learn from historical routes."""
        self.historical_routes.extend(routes)

        # Learn store preferences from successful routes
        for route in routes:
            if route.get('success_rating', 3) >= 4:
                for store_id in route.get('stores_visited', []):
                    if store_id not in self.store_preferences:
                        self.store_preferences[store_id] = 1.0
                    self.store_preferences[store_id] *= 1.05  # Boost successful stores

        self.save_model()

        return {
            "routes_learned": len(routes),
            "store_preferences": len(self.store_preferences),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get optimizer statistics."""
        return {
            "historical_routes": len(self.historical_routes),
            "store_preferences": self.store_preferences,
        }
