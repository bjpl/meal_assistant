"""
Traffic Pattern Learning Model.
Learns optimal visit times and predicts traffic delays for routes.
"""
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
import numpy as np
from pathlib import Path
import json


class TrafficCondition(Enum):
    """Traffic condition levels."""
    FREE_FLOW = 1      # No delays
    LIGHT = 2          # Minor delays
    MODERATE = 3       # Normal traffic
    HEAVY = 4          # Significant delays
    CONGESTED = 5      # Severe delays


class RouteType(Enum):
    """Type of route."""
    RESIDENTIAL = "residential"
    ARTERIAL = "arterial"
    HIGHWAY = "highway"
    MIXED = "mixed"


@dataclass
class Location:
    """Geographic location."""
    latitude: float
    longitude: float
    name: str = ""
    address: str = ""


@dataclass
class RouteSegment:
    """A segment of a route between two locations."""
    origin: Location
    destination: Location
    base_duration_minutes: float  # Duration with no traffic
    distance_miles: float
    route_type: RouteType = RouteType.MIXED


@dataclass
class TrafficPrediction:
    """Traffic delay prediction."""
    segment: RouteSegment
    predicted_duration: float  # Actual expected duration
    delay_minutes: float
    traffic_condition: TrafficCondition
    confidence: float
    factors: List[str]
    best_departure_time: Optional[str] = None


@dataclass
class HistoricalTraffic:
    """Historical traffic data for learning."""
    segment_id: str
    day_of_week: int  # 0-6
    hour: int  # 0-23
    actual_duration: float
    base_duration: float
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class DepartureRecommendation:
    """Recommendation for optimal departure time."""
    recommended_time: str
    estimated_arrival: str
    total_duration: float
    traffic_condition: TrafficCondition
    savings_vs_worst: float  # Minutes saved vs worst time
    reasoning: List[str]


class TrafficPatternLearner:
    """
    ML model to learn traffic patterns and predict delays.

    Features:
    - Time-of-day patterns
    - Day-of-week patterns
    - Historical learning
    - Route-specific adjustments
    """

    # Base traffic multipliers by hour (weekday)
    WEEKDAY_TRAFFIC = {
        0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.1,
        6: 1.3, 7: 1.6, 8: 1.8, 9: 1.5, 10: 1.2, 11: 1.3,
        12: 1.4, 13: 1.3, 14: 1.2, 15: 1.3, 16: 1.5, 17: 1.8,
        18: 1.7, 19: 1.4, 20: 1.2, 21: 1.1, 22: 1.0, 23: 1.0,
    }

    # Weekend traffic multipliers
    WEEKEND_TRAFFIC = {
        0: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0,
        6: 1.0, 7: 1.0, 8: 1.1, 9: 1.2, 10: 1.3, 11: 1.4,
        12: 1.5, 13: 1.5, 14: 1.4, 15: 1.4, 16: 1.3, 17: 1.3,
        18: 1.2, 19: 1.2, 20: 1.1, 21: 1.0, 22: 1.0, 23: 1.0,
    }

    # Route type multipliers
    ROUTE_TYPE_FACTORS = {
        RouteType.RESIDENTIAL: 0.8,   # Less affected by traffic
        RouteType.ARTERIAL: 1.0,
        RouteType.HIGHWAY: 1.2,       # More affected by traffic
        RouteType.MIXED: 1.0,
    }

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize traffic pattern learner."""
        self.model_path = model_path
        self.historical_data: List[HistoricalTraffic] = []
        self.segment_adjustments: Dict[str, Dict[int, float]] = {}  # segment_id -> {hour: multiplier}
        self._load_model()

    def _load_model(self) -> None:
        """Load trained model if available."""
        if self.model_path and self.model_path.exists():
            try:
                with open(self.model_path, 'r') as f:
                    data = json.load(f)
                    self.segment_adjustments = data.get('segment_adjustments', {})
            except (json.JSONDecodeError, IOError):
                pass

    def save_model(self) -> None:
        """Save learned patterns."""
        if self.model_path:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.model_path, 'w') as f:
                json.dump({
                    'segment_adjustments': self.segment_adjustments,
                }, f, indent=2)

    def predict_traffic(
        self,
        segment: RouteSegment,
        departure_time: datetime
    ) -> TrafficPrediction:
        """
        Predict traffic conditions for a route segment.

        Args:
            segment: Route segment to predict
            departure_time: When leaving

        Returns:
            Traffic prediction with delay estimate
        """
        hour = departure_time.hour
        day_of_week = departure_time.weekday()
        is_weekend = day_of_week >= 5

        factors = []

        # Get base traffic multiplier
        if is_weekend:
            base_multiplier = self.WEEKEND_TRAFFIC[hour]
        else:
            base_multiplier = self.WEEKDAY_TRAFFIC[hour]

        # Apply route type factor
        route_factor = self.ROUTE_TYPE_FACTORS[segment.route_type]

        # Check for learned segment-specific patterns
        segment_id = self._get_segment_id(segment)
        segment_adj = 1.0
        if segment_id in self.segment_adjustments:
            hour_adjustments = self.segment_adjustments[segment_id]
            if str(hour) in hour_adjustments:
                segment_adj = hour_adjustments[str(hour)]
                factors.append("Learned route pattern")

        # Calculate total multiplier
        total_multiplier = base_multiplier * route_factor * segment_adj

        # Determine traffic condition
        if total_multiplier < 1.1:
            condition = TrafficCondition.FREE_FLOW
        elif total_multiplier < 1.3:
            condition = TrafficCondition.LIGHT
        elif total_multiplier < 1.5:
            condition = TrafficCondition.MODERATE
        elif total_multiplier < 1.7:
            condition = TrafficCondition.HEAVY
        else:
            condition = TrafficCondition.CONGESTED
            factors.append("Rush hour traffic")

        # Calculate predicted duration
        predicted_duration = segment.base_duration_minutes * total_multiplier
        delay = predicted_duration - segment.base_duration_minutes

        # Add contextual factors
        if not is_weekend and hour in [7, 8, 17, 18]:
            factors.append("Peak commute hours")
        if is_weekend and hour in [11, 12, 13, 14]:
            factors.append("Weekend shopping traffic")
        if segment.route_type == RouteType.HIGHWAY:
            factors.append("Highway route (more variable)")

        # Find best departure time
        best_time = self._find_best_departure(segment, departure_time)

        # Calculate confidence
        confidence = self._calculate_confidence(segment_id, hour)

        return TrafficPrediction(
            segment=segment,
            predicted_duration=round(predicted_duration, 1),
            delay_minutes=round(delay, 1),
            traffic_condition=condition,
            confidence=confidence,
            factors=factors,
            best_departure_time=best_time,
        )

    def _get_segment_id(self, segment: RouteSegment) -> str:
        """Generate unique ID for a route segment."""
        return f"{segment.origin.name}->{segment.destination.name}"

    def _find_best_departure(
        self,
        segment: RouteSegment,
        target_time: datetime,
        window_hours: int = 2
    ) -> str:
        """Find best departure time within a window."""
        best_hour = target_time.hour
        best_multiplier = float('inf')

        is_weekend = target_time.weekday() >= 5
        traffic_pattern = self.WEEKEND_TRAFFIC if is_weekend else self.WEEKDAY_TRAFFIC

        start_hour = max(0, target_time.hour - window_hours)
        end_hour = min(23, target_time.hour + window_hours)

        for hour in range(start_hour, end_hour + 1):
            multiplier = traffic_pattern[hour]
            if multiplier < best_multiplier:
                best_multiplier = multiplier
                best_hour = hour

        return f"{best_hour:02d}:00"

    def _calculate_confidence(self, segment_id: str, hour: int) -> float:
        """Calculate prediction confidence."""
        base_confidence = 0.7

        # Higher confidence with segment-specific data
        if segment_id in self.segment_adjustments:
            if str(hour) in self.segment_adjustments[segment_id]:
                base_confidence += 0.15

        # Count relevant historical data
        relevant_data = [
            d for d in self.historical_data
            if d.segment_id == segment_id and d.hour == hour
        ]
        data_bonus = min(0.1, len(relevant_data) * 0.02)

        return min(0.95, base_confidence + data_bonus)

    def get_optimal_departure(
        self,
        segments: List[RouteSegment],
        arrival_target: datetime,
        flexibility_minutes: int = 60
    ) -> DepartureRecommendation:
        """
        Calculate optimal departure time for a multi-segment route.

        Args:
            segments: Route segments in order
            arrival_target: When you want to arrive
            flexibility_minutes: How flexible is the arrival time

        Returns:
            Departure recommendation
        """
        # Test different departure times
        candidates = []

        for offset in range(-flexibility_minutes, flexibility_minutes + 1, 15):
            test_time = arrival_target - timedelta(minutes=offset)

            # Calculate total trip duration at this time
            current_time = test_time
            total_duration = 0

            for segment in segments:
                prediction = self.predict_traffic(segment, current_time)
                total_duration += prediction.predicted_duration
                current_time = current_time + timedelta(minutes=prediction.predicted_duration)

            candidates.append({
                'departure': test_time,
                'duration': total_duration,
                'arrival': current_time,
            })

        # Find best option
        best = min(candidates, key=lambda x: x['duration'])
        worst = max(candidates, key=lambda x: x['duration'])

        # Get traffic condition for the best departure
        test_prediction = self.predict_traffic(segments[0], best['departure'])

        reasoning = []
        if best['duration'] < worst['duration'] - 10:
            reasoning.append(f"Saves {worst['duration'] - best['duration']:.0f} minutes vs worst time")

        hour = best['departure'].hour
        if 6 <= hour <= 9 or 16 <= hour <= 19:
            reasoning.append("Avoids peak rush hour")
        else:
            reasoning.append("Off-peak departure time")

        return DepartureRecommendation(
            recommended_time=best['departure'].strftime("%H:%M"),
            estimated_arrival=best['arrival'].strftime("%H:%M"),
            total_duration=round(best['duration'], 1),
            traffic_condition=test_prediction.traffic_condition,
            savings_vs_worst=round(worst['duration'] - best['duration'], 1),
            reasoning=reasoning,
        )

    def train(self, data: List[HistoricalTraffic]) -> Dict[str, Any]:
        """
        Train model on historical traffic data.

        Args:
            data: Historical traffic observations

        Returns:
            Training metrics
        """
        self.historical_data.extend(data)

        if len(data) < 5:
            return {"status": "insufficient_data", "observations": len(data)}

        # Group by segment and hour
        segment_hour_data: Dict[str, Dict[int, List[float]]] = {}

        for obs in data:
            if obs.segment_id not in segment_hour_data:
                segment_hour_data[obs.segment_id] = {}

            if obs.hour not in segment_hour_data[obs.segment_id]:
                segment_hour_data[obs.segment_id][obs.hour] = []

            # Calculate actual multiplier
            if obs.base_duration > 0:
                multiplier = obs.actual_duration / obs.base_duration
                segment_hour_data[obs.segment_id][obs.hour].append(multiplier)

        # Calculate adjustments
        for segment_id, hour_data in segment_hour_data.items():
            self.segment_adjustments[segment_id] = {}
            for hour, multipliers in hour_data.items():
                if multipliers:
                    # Use median for robustness
                    learned_multiplier = float(np.median(multipliers))

                    # Compare to expected
                    is_weekend = False  # Assume weekday for now
                    expected = self.WEEKDAY_TRAFFIC[hour]

                    # Store relative adjustment
                    self.segment_adjustments[segment_id][str(hour)] = learned_multiplier / expected

        self.save_model()

        return {
            "status": "trained",
            "observations_used": len(data),
            "segments_learned": len(self.segment_adjustments),
            "segment_adjustments": {
                k: len(v) for k, v in self.segment_adjustments.items()
            },
        }

    def log_trip(
        self,
        segment: RouteSegment,
        actual_duration: float,
        departure_time: datetime
    ) -> None:
        """Log a completed trip for learning."""
        obs = HistoricalTraffic(
            segment_id=self._get_segment_id(segment),
            day_of_week=departure_time.weekday(),
            hour=departure_time.hour,
            actual_duration=actual_duration,
            base_duration=segment.base_duration_minutes,
            timestamp=departure_time,
        )
        self.historical_data.append(obs)

        # Periodic retraining
        if len(self.historical_data) % 10 == 0:
            self.train(self.historical_data[-30:])

    def get_hourly_forecast(
        self,
        segment: RouteSegment,
        date: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get traffic forecast for all hours of a day.

        Args:
            segment: Route segment
            date: Date to forecast

        Returns:
            Hourly traffic predictions
        """
        forecasts = []

        for hour in range(24):
            departure = date.replace(hour=hour, minute=0, second=0)
            prediction = self.predict_traffic(segment, departure)

            forecasts.append({
                "hour": hour,
                "time_display": f"{hour:02d}:00",
                "duration_minutes": prediction.predicted_duration,
                "delay_minutes": prediction.delay_minutes,
                "traffic_condition": prediction.traffic_condition.name,
                "traffic_level": prediction.traffic_condition.value,
            })

        return forecasts

    def get_best_times(
        self,
        segment: RouteSegment,
        date: datetime,
        top_n: int = 3
    ) -> List[Dict[str, Any]]:
        """Get the best times to travel on a given day."""
        forecasts = self.get_hourly_forecast(segment, date)

        # Sort by duration
        sorted_forecasts = sorted(forecasts, key=lambda x: x['duration_minutes'])

        return sorted_forecasts[:top_n]

    def predict_route_duration(
        self,
        segments: List[RouteSegment],
        departure_time: datetime
    ) -> Dict[str, Any]:
        """
        Predict total duration for a multi-segment route.

        Args:
            segments: Route segments in order
            departure_time: Start time

        Returns:
            Route duration prediction
        """
        total_duration = 0
        total_delay = 0
        segment_details = []
        current_time = departure_time

        for segment in segments:
            prediction = self.predict_traffic(segment, current_time)

            segment_details.append({
                "from": segment.origin.name,
                "to": segment.destination.name,
                "base_minutes": segment.base_duration_minutes,
                "predicted_minutes": prediction.predicted_duration,
                "delay_minutes": prediction.delay_minutes,
                "traffic": prediction.traffic_condition.name,
                "departure": current_time.strftime("%H:%M"),
            })

            total_duration += prediction.predicted_duration
            total_delay += prediction.delay_minutes
            current_time = current_time + timedelta(minutes=prediction.predicted_duration)

        return {
            "total_duration_minutes": round(total_duration, 1),
            "total_delay_minutes": round(total_delay, 1),
            "departure_time": departure_time.strftime("%H:%M"),
            "estimated_arrival": current_time.strftime("%H:%M"),
            "segments": segment_details,
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics."""
        return {
            "total_observations": len(self.historical_data),
            "segments_learned": len(self.segment_adjustments),
            "segment_details": {
                k: {"hours_learned": len(v)}
                for k, v in self.segment_adjustments.items()
            },
        }
