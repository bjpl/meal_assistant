"""
Savings Predictor.
Predicts actual savings value from multi-store shopping trips.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
import numpy as np
from pathlib import Path
import json


class ShoppingStrategy(Enum):
    """Shopping strategy options."""
    SINGLE_STORE = "single_store"
    TWO_STORES = "two_stores"
    MULTI_STORE = "multi_store"  # 3+ stores


class ValuePriority(Enum):
    """What the user values most."""
    TIME = "time"           # Value time above all
    MONEY = "money"         # Maximize savings
    BALANCED = "balanced"   # Balance time and money
    QUALITY = "quality"     # Prefer quality stores


@dataclass
class StoreOption:
    """A store option for comparison."""
    store_id: str
    store_name: str
    distance_miles: float
    items_available: int
    total_price: float
    travel_time_minutes: float
    shopping_time_minutes: float
    deal_quality: float = 0.5  # 0-1 rating of deals


@dataclass
class ShoppingTrip:
    """A potential shopping trip."""
    stores: List[StoreOption]
    total_cost: float
    total_time_minutes: float
    total_distance_miles: float
    items_purchased: int
    strategy: ShoppingStrategy


@dataclass
class SavingsAnalysis:
    """Analysis of savings vs time trade-off."""
    gross_savings: float        # Raw price difference
    net_savings: float          # After gas cost
    time_cost: float            # Value of extra time spent
    effective_savings: float    # Net savings minus time cost
    hourly_savings_rate: float  # Savings per hour of extra time
    recommendation: str
    worth_it: bool
    confidence: float
    breakdown: Dict[str, float]
    factors: List[str]


@dataclass
class WorthItRecommendation:
    """Recommendation for whether multi-store shopping is worth it."""
    recommended_strategy: ShoppingStrategy
    reasoning: List[str]
    time_investment: float      # Extra time in minutes
    money_saved: float          # Net savings
    efficiency_score: float     # Savings per hour
    break_even_hourly: float    # What hourly rate makes this worth it
    alternatives: List[Dict[str, Any]]


@dataclass
class HistoricalTrip:
    """Historical shopping trip data."""
    trip_id: str
    strategy: ShoppingStrategy
    stores_visited: List[str]
    planned_savings: float
    actual_savings: float
    total_time: float
    satisfaction: int  # 1-5
    timestamp: datetime = field(default_factory=datetime.now)


class SavingsPredictor:
    """
    ML model to predict savings value and recommend shopping strategy.

    Considers:
    - Gas costs
    - Time value
    - Deal quality
    - Historical accuracy
    - User preferences
    """

    # Cost assumptions
    DEFAULT_GAS_PRICE = 3.50       # $ per gallon
    DEFAULT_MPG = 25               # Miles per gallon
    DEFAULT_HOURLY_VALUE = 25.0    # $ value of user's time

    # Thresholds
    MIN_WORTHWHILE_SAVINGS = 5.0   # Minimum savings to consider
    MIN_HOURLY_RATE = 15.0         # Minimum $ saved per hour

    def __init__(
        self,
        model_path: Optional[Path] = None,
        gas_price: float = DEFAULT_GAS_PRICE,
        mpg: float = DEFAULT_MPG,
        hourly_value: float = DEFAULT_HOURLY_VALUE
    ):
        """Initialize savings predictor."""
        self.model_path = model_path
        self.gas_price = gas_price
        self.mpg = mpg
        self.hourly_value = hourly_value
        self.historical_trips: List[HistoricalTrip] = []
        self.savings_accuracy: float = 0.85  # Historical accuracy of predictions
        self.user_preferences: Dict[str, Any] = {}
        self._load_model()

    def _load_model(self) -> None:
        """Load trained model."""
        if self.model_path and self.model_path.exists():
            try:
                with open(self.model_path, 'r') as f:
                    data = json.load(f)
                    self.savings_accuracy = data.get('savings_accuracy', 0.85)
                    self.user_preferences = data.get('user_preferences', {})
            except (json.JSONDecodeError, IOError):
                pass

    def save_model(self) -> None:
        """Save model state."""
        if self.model_path:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.model_path, 'w') as f:
                json.dump({
                    'savings_accuracy': self.savings_accuracy,
                    'user_preferences': self.user_preferences,
                }, f, indent=2)

    def predict_savings(
        self,
        multi_store_trip: ShoppingTrip,
        single_store_option: StoreOption,
        value_priority: ValuePriority = ValuePriority.BALANCED
    ) -> SavingsAnalysis:
        """
        Predict actual savings from multi-store vs single-store shopping.

        Args:
            multi_store_trip: Planned multi-store trip
            single_store_option: Single store alternative
            value_priority: What user values most

        Returns:
            Detailed savings analysis
        """
        breakdown = {}
        factors = []

        # Calculate single store costs
        single_total = single_store_option.total_price
        single_gas = self._calculate_gas_cost(single_store_option.distance_miles * 2)
        single_time = (
            single_store_option.travel_time_minutes +
            single_store_option.shopping_time_minutes
        )
        single_all_in = single_total + single_gas

        breakdown['single_store_price'] = single_total
        breakdown['single_store_gas'] = round(single_gas, 2)
        breakdown['single_store_time'] = single_time

        # Calculate multi-store costs
        multi_total = multi_store_trip.total_cost
        multi_gas = self._calculate_gas_cost(multi_store_trip.total_distance_miles)
        multi_time = multi_store_trip.total_time_minutes
        multi_all_in = multi_total + multi_gas

        breakdown['multi_store_price'] = multi_total
        breakdown['multi_store_gas'] = round(multi_gas, 2)
        breakdown['multi_store_time'] = multi_time

        # Calculate savings
        gross_savings = single_total - multi_total
        net_savings = single_all_in - multi_all_in

        # Calculate time cost
        extra_time = multi_time - single_time
        time_cost = (extra_time / 60) * self.hourly_value

        # Effective savings
        effective_savings = net_savings - time_cost

        breakdown['gross_savings'] = round(gross_savings, 2)
        breakdown['gas_cost_difference'] = round(single_gas - multi_gas, 2)
        breakdown['net_savings'] = round(net_savings, 2)
        breakdown['extra_time_minutes'] = round(extra_time, 1)
        breakdown['time_cost'] = round(time_cost, 2)
        breakdown['effective_savings'] = round(effective_savings, 2)

        # Calculate hourly rate
        if extra_time > 0:
            hourly_rate = (net_savings / extra_time) * 60
        else:
            hourly_rate = float('inf') if net_savings > 0 else 0

        breakdown['hourly_savings_rate'] = round(hourly_rate, 2)

        # Generate factors
        if gross_savings > 20:
            factors.append(f"Strong price savings: ${gross_savings:.2f}")
        elif gross_savings > 10:
            factors.append(f"Moderate price savings: ${gross_savings:.2f}")
        else:
            factors.append(f"Limited price savings: ${gross_savings:.2f}")

        if multi_gas > single_gas:
            factors.append(f"Extra gas cost: ${multi_gas - single_gas:.2f}")

        if extra_time > 30:
            factors.append(f"Significant time investment: {extra_time:.0f} minutes")
        elif extra_time > 0:
            factors.append(f"Additional time: {extra_time:.0f} minutes")

        # Determine if worth it based on priority
        worth_it = self._determine_worth_it(
            net_savings, extra_time, hourly_rate, value_priority
        )

        # Generate recommendation
        recommendation = self._generate_recommendation(
            net_savings, extra_time, hourly_rate, worth_it, value_priority
        )

        # Apply historical accuracy adjustment
        adjusted_savings = net_savings * self.savings_accuracy
        confidence = self._calculate_confidence(multi_store_trip, single_store_option)

        return SavingsAnalysis(
            gross_savings=round(gross_savings, 2),
            net_savings=round(net_savings, 2),
            time_cost=round(time_cost, 2),
            effective_savings=round(effective_savings, 2),
            hourly_savings_rate=round(hourly_rate, 2),
            recommendation=recommendation,
            worth_it=worth_it,
            confidence=confidence,
            breakdown=breakdown,
            factors=factors,
        )

    def _calculate_gas_cost(self, miles: float) -> float:
        """Calculate gas cost for a given distance."""
        gallons = miles / self.mpg
        return gallons * self.gas_price

    def _determine_worth_it(
        self,
        net_savings: float,
        extra_time: float,
        hourly_rate: float,
        priority: ValuePriority
    ) -> bool:
        """Determine if the multi-store trip is worth it."""
        if priority == ValuePriority.TIME:
            # Only worth it if massive savings with minimal time
            return net_savings > 30 and extra_time < 20

        elif priority == ValuePriority.MONEY:
            # Worth it if any positive savings
            return net_savings > self.MIN_WORTHWHILE_SAVINGS

        elif priority == ValuePriority.QUALITY:
            # Usually prefer single store
            return net_savings > 50

        else:  # BALANCED
            # Check both thresholds
            min_savings = net_savings > self.MIN_WORTHWHILE_SAVINGS
            good_rate = hourly_rate > self.MIN_HOURLY_RATE
            return min_savings and good_rate

    def _generate_recommendation(
        self,
        net_savings: float,
        extra_time: float,
        hourly_rate: float,
        worth_it: bool,
        priority: ValuePriority
    ) -> str:
        """Generate human-readable recommendation."""
        if not worth_it:
            if net_savings < 0:
                return "Single store is cheaper - skip multi-store trip"
            elif extra_time > 60:
                return f"Time investment too high - {extra_time:.0f} min for ${net_savings:.2f}"
            elif hourly_rate < self.MIN_HOURLY_RATE:
                return f"Low efficiency - ${hourly_rate:.2f}/hr saved, not worth the extra time"
            else:
                return "Marginal savings - single store recommended"

        # Worth it cases
        if hourly_rate > 50:
            return f"Excellent value! Save ${net_savings:.2f} in {extra_time:.0f} extra minutes"
        elif hourly_rate > 30:
            return f"Good value - ${hourly_rate:.2f}/hr effective savings rate"
        else:
            return f"Worth considering - saves ${net_savings:.2f} with {extra_time:.0f} min investment"

    def _calculate_confidence(
        self,
        multi_trip: ShoppingTrip,
        single_option: StoreOption
    ) -> float:
        """Calculate prediction confidence."""
        base_confidence = 0.7

        # Higher confidence with historical data
        data_bonus = min(0.15, len(self.historical_trips) * 0.01)

        # Higher confidence for known stores
        known_stores = sum(
            1 for s in multi_trip.stores
            if s.store_id in self.user_preferences.get('visited_stores', [])
        )
        store_bonus = min(0.1, known_stores * 0.03)

        return min(0.95, base_confidence + data_bonus + store_bonus)

    def recommend_strategy(
        self,
        stores: List[StoreOption],
        total_items: int,
        value_priority: ValuePriority = ValuePriority.BALANCED,
        max_stores: int = 3
    ) -> WorthItRecommendation:
        """
        Recommend optimal shopping strategy.

        Args:
            stores: Available store options sorted by total price
            total_items: Total items to purchase
            value_priority: User's value priority
            max_stores: Maximum stores to consider

        Returns:
            Strategy recommendation
        """
        if not stores:
            return WorthItRecommendation(
                recommended_strategy=ShoppingStrategy.SINGLE_STORE,
                reasoning=["No stores provided"],
                time_investment=0,
                money_saved=0,
                efficiency_score=0,
                break_even_hourly=0,
                alternatives=[],
            )

        # Sort by price
        sorted_stores = sorted(stores, key=lambda s: s.total_price)

        # Single store baseline (cheapest overall)
        single_store = sorted_stores[0]
        single_time = single_store.travel_time_minutes + single_store.shopping_time_minutes
        single_cost = single_store.total_price + self._calculate_gas_cost(
            single_store.distance_miles * 2
        )

        # Calculate multi-store options
        alternatives = []

        # Two-store option
        if len(sorted_stores) >= 2:
            two_store = self._evaluate_two_store(sorted_stores[:3], single_cost, single_time)
            if two_store:
                alternatives.append(two_store)

        # Three-store option
        if len(sorted_stores) >= 3 and max_stores >= 3:
            three_store = self._evaluate_three_store(sorted_stores[:4], single_cost, single_time)
            if three_store:
                alternatives.append(three_store)

        # Find best option
        best = self._select_best_option(
            single_store, alternatives, value_priority
        )

        reasoning = self._generate_strategy_reasoning(
            best['strategy'], best, single_store, value_priority
        )

        # Calculate break-even hourly rate
        if best['extra_time'] > 0:
            break_even = (best['savings'] / best['extra_time']) * 60
        else:
            break_even = 0

        return WorthItRecommendation(
            recommended_strategy=best['strategy'],
            reasoning=reasoning,
            time_investment=best['extra_time'],
            money_saved=best['savings'],
            efficiency_score=best['efficiency'],
            break_even_hourly=round(break_even, 2),
            alternatives=[a for a in alternatives if a['strategy'] != best['strategy']],
        )

    def _evaluate_two_store(
        self,
        stores: List[StoreOption],
        single_cost: float,
        single_time: float
    ) -> Optional[Dict[str, Any]]:
        """Evaluate two-store shopping option."""
        if len(stores) < 2:
            return None

        # Assume splitting items between best deal stores
        store1, store2 = stores[0], stores[1]

        # Estimate combined cost (weighted average, assuming deals)
        combined_cost = (store1.total_price * 0.6) + (store2.total_price * 0.4)

        # Calculate time and gas
        combined_time = (
            store1.travel_time_minutes + store1.shopping_time_minutes +
            store2.travel_time_minutes * 0.5 + store2.shopping_time_minutes
        )
        combined_distance = store1.distance_miles * 2 + store2.distance_miles
        combined_gas = self._calculate_gas_cost(combined_distance)

        total_two_store = combined_cost + combined_gas
        savings = single_cost - total_two_store
        extra_time = combined_time - single_time

        efficiency = (savings / extra_time * 60) if extra_time > 0 else 0

        return {
            'strategy': ShoppingStrategy.TWO_STORES,
            'stores': [store1.store_name, store2.store_name],
            'total_cost': round(total_two_store, 2),
            'savings': round(savings, 2),
            'time': round(combined_time, 0),
            'extra_time': round(extra_time, 0),
            'efficiency': round(efficiency, 2),
        }

    def _evaluate_three_store(
        self,
        stores: List[StoreOption],
        single_cost: float,
        single_time: float
    ) -> Optional[Dict[str, Any]]:
        """Evaluate three-store shopping option."""
        if len(stores) < 3:
            return None

        store1, store2, store3 = stores[0], stores[1], stores[2]

        # Estimate combined cost
        combined_cost = (
            store1.total_price * 0.45 +
            store2.total_price * 0.35 +
            store3.total_price * 0.20
        )

        # Calculate time and gas
        combined_time = (
            store1.travel_time_minutes + store1.shopping_time_minutes +
            store2.travel_time_minutes * 0.4 + store2.shopping_time_minutes +
            store3.travel_time_minutes * 0.4 + store3.shopping_time_minutes
        )
        combined_distance = (
            store1.distance_miles * 2 +
            store2.distance_miles +
            store3.distance_miles
        )
        combined_gas = self._calculate_gas_cost(combined_distance)

        total_three_store = combined_cost + combined_gas
        savings = single_cost - total_three_store
        extra_time = combined_time - single_time

        efficiency = (savings / extra_time * 60) if extra_time > 0 else 0

        return {
            'strategy': ShoppingStrategy.MULTI_STORE,
            'stores': [store1.store_name, store2.store_name, store3.store_name],
            'total_cost': round(total_three_store, 2),
            'savings': round(savings, 2),
            'time': round(combined_time, 0),
            'extra_time': round(extra_time, 0),
            'efficiency': round(efficiency, 2),
        }

    def _select_best_option(
        self,
        single_store: StoreOption,
        alternatives: List[Dict[str, Any]],
        priority: ValuePriority
    ) -> Dict[str, Any]:
        """Select best option based on priority."""
        single_option = {
            'strategy': ShoppingStrategy.SINGLE_STORE,
            'stores': [single_store.store_name],
            'total_cost': single_store.total_price,
            'savings': 0,
            'time': single_store.travel_time_minutes + single_store.shopping_time_minutes,
            'extra_time': 0,
            'efficiency': 0,
        }

        if not alternatives:
            return single_option

        # Filter worthwhile alternatives
        worthwhile = [
            a for a in alternatives
            if a['savings'] > self.MIN_WORTHWHILE_SAVINGS
        ]

        if not worthwhile:
            return single_option

        # Select based on priority
        if priority == ValuePriority.TIME:
            # Prefer least time increase with good savings
            worthwhile.sort(key=lambda x: (x['extra_time'], -x['savings']))
            best_alt = worthwhile[0]
            if best_alt['extra_time'] < 30 and best_alt['savings'] > 10:
                return best_alt
            return single_option

        elif priority == ValuePriority.MONEY:
            # Prefer maximum savings
            worthwhile.sort(key=lambda x: -x['savings'])
            return worthwhile[0]

        elif priority == ValuePriority.QUALITY:
            # Prefer single store unless massive savings
            worthwhile.sort(key=lambda x: -x['savings'])
            if worthwhile[0]['savings'] > 40:
                return worthwhile[0]
            return single_option

        else:  # BALANCED
            # Use efficiency (savings per hour)
            worthwhile.sort(key=lambda x: -x['efficiency'])
            best_alt = worthwhile[0]
            if best_alt['efficiency'] > self.MIN_HOURLY_RATE:
                return best_alt
            return single_option

    def _generate_strategy_reasoning(
        self,
        strategy: ShoppingStrategy,
        best: Dict[str, Any],
        single: StoreOption,
        priority: ValuePriority
    ) -> List[str]:
        """Generate reasoning for the recommendation."""
        reasoning = []

        if strategy == ShoppingStrategy.SINGLE_STORE:
            reasoning.append(f"Single store at {single.store_name} is most efficient")
            if best.get('savings', 0) == 0:
                reasoning.append("Multi-store options don't offer meaningful savings")
            else:
                reasoning.append(f"Time investment outweighs ${best.get('savings', 0):.2f} savings")

        elif strategy == ShoppingStrategy.TWO_STORES:
            reasoning.append(f"Two-store trip saves ${best['savings']:.2f}")
            reasoning.append(f"Extra {best['extra_time']:.0f} minutes yields ${best['efficiency']:.2f}/hr rate")
            if best['efficiency'] > 30:
                reasoning.append("Excellent efficiency - worth the extra time")

        else:  # MULTI_STORE
            reasoning.append(f"Three-store trip maximizes savings: ${best['savings']:.2f}")
            reasoning.append(f"Requires {best['extra_time']:.0f} extra minutes")
            if best['efficiency'] > self.MIN_HOURLY_RATE:
                reasoning.append(f"Still efficient at ${best['efficiency']:.2f}/hr")

        # Add priority context
        if priority == ValuePriority.TIME:
            reasoning.append("Optimized for time (your preference)")
        elif priority == ValuePriority.MONEY:
            reasoning.append("Optimized for maximum savings (your preference)")

        return reasoning

    def train(self, trips: List[HistoricalTrip]) -> Dict[str, Any]:
        """Train model on historical trip data."""
        self.historical_trips.extend(trips)

        if len(trips) < 3:
            return {"status": "insufficient_data", "trips": len(trips)}

        # Calculate actual vs predicted accuracy
        accurate_predictions = 0
        for trip in trips:
            if trip.planned_savings > 0:
                accuracy = trip.actual_savings / trip.planned_savings
                if 0.7 < accuracy < 1.3:  # Within 30%
                    accurate_predictions += 1

        if trips:
            self.savings_accuracy = accurate_predictions / len(trips)

        # Learn store preferences from satisfaction
        for trip in trips:
            if trip.satisfaction >= 4:
                for store_id in trip.stores_visited:
                    if 'visited_stores' not in self.user_preferences:
                        self.user_preferences['visited_stores'] = []
                    if store_id not in self.user_preferences['visited_stores']:
                        self.user_preferences['visited_stores'].append(store_id)

        self.save_model()

        return {
            "status": "trained",
            "trips_analyzed": len(trips),
            "savings_accuracy": self.savings_accuracy,
        }

    def log_trip(self, trip: HistoricalTrip) -> None:
        """Log a completed trip for learning."""
        self.historical_trips.append(trip)

        if len(self.historical_trips) % 5 == 0:
            self.train(self.historical_trips[-10:])

    def update_preferences(
        self,
        gas_price: Optional[float] = None,
        mpg: Optional[float] = None,
        hourly_value: Optional[float] = None
    ) -> None:
        """Update user preferences."""
        if gas_price:
            self.gas_price = gas_price
        if mpg:
            self.mpg = mpg
        if hourly_value:
            self.hourly_value = hourly_value

    def quick_estimate(
        self,
        price_difference: float,
        extra_miles: float,
        extra_minutes: float
    ) -> Dict[str, Any]:
        """
        Quick estimate of whether multi-store is worth it.

        Args:
            price_difference: How much cheaper multi-store is
            extra_miles: Additional miles to drive
            extra_minutes: Additional time required

        Returns:
            Quick analysis
        """
        gas_cost = self._calculate_gas_cost(extra_miles)
        net_savings = price_difference - gas_cost
        time_cost = (extra_minutes / 60) * self.hourly_value
        effective = net_savings - time_cost

        hourly_rate = (net_savings / extra_minutes * 60) if extra_minutes > 0 else 0

        return {
            "gross_savings": round(price_difference, 2),
            "gas_cost": round(gas_cost, 2),
            "net_savings": round(net_savings, 2),
            "time_cost": round(time_cost, 2),
            "effective_savings": round(effective, 2),
            "hourly_rate": round(hourly_rate, 2),
            "worth_it": effective > 0 and hourly_rate > self.MIN_HOURLY_RATE,
            "recommendation": (
                "Worth it" if effective > 0 and hourly_rate > self.MIN_HOURLY_RATE
                else "Stick with single store"
            ),
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get predictor statistics."""
        return {
            "historical_trips": len(self.historical_trips),
            "savings_accuracy": self.savings_accuracy,
            "gas_price": self.gas_price,
            "mpg": self.mpg,
            "hourly_value": self.hourly_value,
            "user_preferences": self.user_preferences,
        }
