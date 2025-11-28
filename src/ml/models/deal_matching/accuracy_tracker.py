"""
Accuracy Tracker for Deal Matching.
Tracks accuracy per store, per template, over time.
"""
import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

import numpy as np


@dataclass
class AccuracyMetrics:
    """Accuracy metrics for a specific period."""
    total_deals: int = 0
    correct_matches: int = 0
    incorrect_matches: int = 0
    corrections_received: int = 0

    @property
    def accuracy(self) -> float:
        if self.total_deals == 0:
            return 0.0
        return self.correct_matches / self.total_deals

    @property
    def correction_rate(self) -> float:
        if self.total_deals == 0:
            return 0.0
        return self.corrections_received / self.total_deals


@dataclass
class StoreAccuracy:
    """Accuracy metrics for a specific store."""
    store_name: str
    overall: AccuracyMetrics = field(default_factory=AccuracyMetrics)
    by_phase: Dict[int, AccuracyMetrics] = field(default_factory=dict)
    by_deal_type: Dict[str, AccuracyMetrics] = field(default_factory=dict)
    history: List[Dict[str, Any]] = field(default_factory=list)

    def add_result(
        self,
        is_correct: bool,
        phase: int,
        deal_type: str,
        timestamp: Optional[datetime] = None
    ):
        """Record a matching result."""
        timestamp = timestamp or datetime.now()

        # Update overall
        self.overall.total_deals += 1
        if is_correct:
            self.overall.correct_matches += 1
        else:
            self.overall.incorrect_matches += 1

        # Update by phase
        if phase not in self.by_phase:
            self.by_phase[phase] = AccuracyMetrics()
        self.by_phase[phase].total_deals += 1
        if is_correct:
            self.by_phase[phase].correct_matches += 1

        # Update by deal type
        if deal_type not in self.by_deal_type:
            self.by_deal_type[deal_type] = AccuracyMetrics()
        self.by_deal_type[deal_type].total_deals += 1
        if is_correct:
            self.by_deal_type[deal_type].correct_matches += 1

        # Add to history
        self.history.append({
            'timestamp': timestamp.isoformat(),
            'is_correct': is_correct,
            'phase': phase,
            'deal_type': deal_type,
        })

    def add_correction(self, phase: int, deal_type: str):
        """Record a user correction."""
        self.overall.corrections_received += 1

        if phase in self.by_phase:
            self.by_phase[phase].corrections_received += 1

        if deal_type in self.by_deal_type:
            self.by_deal_type[deal_type].corrections_received += 1


class AccuracyTracker:
    """
    Tracks deal matching accuracy across stores and time.

    Features:
    - Per-store accuracy tracking
    - Per-phase accuracy (regex, template, ML)
    - Trend analysis
    - Accuracy predictions
    """

    def __init__(self, storage_path: Optional[Path] = None):
        """
        Initialize accuracy tracker.

        Args:
            storage_path: Path to store accuracy data
        """
        self.storage_path = storage_path
        self.stores: Dict[str, StoreAccuracy] = {}
        self.global_metrics = AccuracyMetrics()
        self.phase_targets = {
            1: 0.35,  # 30-40% for regex
            2: 0.55,  # 50-60% for template
            3: 0.80,  # 70-85% for ML
        }

        if storage_path and storage_path.exists():
            self._load()

    def record_result(
        self,
        store: str,
        is_correct: bool,
        phase: int,
        deal_type: str = 'price',
        timestamp: Optional[datetime] = None
    ):
        """
        Record a matching result.

        Args:
            store: Store name
            is_correct: Whether the match was correct
            phase: Current phase (1, 2, or 3)
            deal_type: Type of deal
            timestamp: When the result occurred
        """
        store_lower = store.lower()

        if store_lower not in self.stores:
            self.stores[store_lower] = StoreAccuracy(store_name=store_lower)

        self.stores[store_lower].add_result(is_correct, phase, deal_type, timestamp)

        # Update global
        self.global_metrics.total_deals += 1
        if is_correct:
            self.global_metrics.correct_matches += 1
        else:
            self.global_metrics.incorrect_matches += 1

        self._save()

    def record_correction(
        self,
        store: str,
        phase: int,
        deal_type: str = 'price'
    ):
        """
        Record a user correction.

        Args:
            store: Store name
            phase: Current phase
            deal_type: Type of deal
        """
        store_lower = store.lower()

        if store_lower not in self.stores:
            self.stores[store_lower] = StoreAccuracy(store_name=store_lower)

        self.stores[store_lower].add_correction(phase, deal_type)
        self.global_metrics.corrections_received += 1

        self._save()

    def get_store_accuracy(self, store: str) -> Dict[str, Any]:
        """Get accuracy metrics for a store."""
        store_lower = store.lower()

        if store_lower not in self.stores:
            return {
                'store': store,
                'total_deals': 0,
                'accuracy': 0.0,
                'message': 'No data for this store'
            }

        store_data = self.stores[store_lower]

        return {
            'store': store,
            'total_deals': store_data.overall.total_deals,
            'accuracy': store_data.overall.accuracy,
            'correction_rate': store_data.overall.correction_rate,
            'by_phase': {
                phase: {
                    'accuracy': metrics.accuracy,
                    'total_deals': metrics.total_deals,
                }
                for phase, metrics in store_data.by_phase.items()
            },
            'by_deal_type': {
                dtype: {
                    'accuracy': metrics.accuracy,
                    'total_deals': metrics.total_deals,
                }
                for dtype, metrics in store_data.by_deal_type.items()
            }
        }

    def get_global_accuracy(self) -> Dict[str, Any]:
        """Get global accuracy metrics."""
        return {
            'total_deals': self.global_metrics.total_deals,
            'accuracy': self.global_metrics.accuracy,
            'correction_rate': self.global_metrics.correction_rate,
            'correct_matches': self.global_metrics.correct_matches,
            'incorrect_matches': self.global_metrics.incorrect_matches,
            'corrections_received': self.global_metrics.corrections_received,
        }

    def get_phase_accuracy(self, phase: int) -> Dict[str, Any]:
        """Get accuracy for a specific phase across all stores."""
        total = 0
        correct = 0

        for store_data in self.stores.values():
            if phase in store_data.by_phase:
                metrics = store_data.by_phase[phase]
                total += metrics.total_deals
                correct += metrics.correct_matches

        accuracy = correct / total if total > 0 else 0.0
        target = self.phase_targets.get(phase, 0.5)

        return {
            'phase': phase,
            'total_deals': total,
            'accuracy': accuracy,
            'target_accuracy': target,
            'meets_target': accuracy >= target,
            'gap': target - accuracy,
        }

    def get_trend(
        self,
        store: Optional[str] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get accuracy trend over time.

        Args:
            store: Optional store filter
            days: Number of days to analyze

        Returns:
            Trend data
        """
        cutoff = datetime.now() - timedelta(days=days)

        # Collect history
        history = []

        stores_to_check = [store.lower()] if store else list(self.stores.keys())

        for store_name in stores_to_check:
            if store_name not in self.stores:
                continue

            for entry in self.stores[store_name].history:
                try:
                    ts = datetime.fromisoformat(entry['timestamp'])
                    if ts >= cutoff:
                        history.append(entry)
                except (ValueError, KeyError):
                    continue

        if not history:
            return {
                'days': days,
                'data_points': 0,
                'trend': 'insufficient_data',
            }

        # Group by day
        daily_accuracy = defaultdict(lambda: {'correct': 0, 'total': 0})

        for entry in history:
            try:
                date = datetime.fromisoformat(entry['timestamp']).date().isoformat()
                daily_accuracy[date]['total'] += 1
                if entry.get('is_correct'):
                    daily_accuracy[date]['correct'] += 1
            except (ValueError, KeyError):
                continue

        # Calculate daily rates
        dates = sorted(daily_accuracy.keys())
        accuracies = []

        for date in dates:
            data = daily_accuracy[date]
            acc = data['correct'] / data['total'] if data['total'] > 0 else 0
            accuracies.append({
                'date': date,
                'accuracy': acc,
                'total': data['total'],
            })

        # Determine trend
        if len(accuracies) < 2:
            trend = 'insufficient_data'
        else:
            first_half = np.mean([a['accuracy'] for a in accuracies[:len(accuracies)//2]])
            second_half = np.mean([a['accuracy'] for a in accuracies[len(accuracies)//2:]])

            if second_half > first_half + 0.05:
                trend = 'improving'
            elif second_half < first_half - 0.05:
                trend = 'declining'
            else:
                trend = 'stable'

        return {
            'days': days,
            'data_points': len(history),
            'trend': trend,
            'daily_accuracy': accuracies,
            'overall_accuracy': sum(a['accuracy'] * a['total'] for a in accuracies) /
                               sum(a['total'] for a in accuracies) if accuracies else 0,
        }

    def predict_target_date(
        self,
        target_accuracy: float = 0.85,
        store: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Predict when target accuracy will be reached.

        Args:
            target_accuracy: Target accuracy (default 85%)
            store: Optional store filter

        Returns:
            Prediction data
        """
        trend_data = self.get_trend(store, days=14)

        if trend_data['trend'] == 'insufficient_data':
            return {
                'target_accuracy': target_accuracy,
                'prediction': 'insufficient_data',
                'message': 'Need more data for prediction'
            }

        current_accuracy = trend_data['overall_accuracy']

        if current_accuracy >= target_accuracy:
            return {
                'target_accuracy': target_accuracy,
                'current_accuracy': current_accuracy,
                'prediction': 'achieved',
                'message': 'Target accuracy already achieved!'
            }

        # Calculate improvement rate
        daily_acc = trend_data['daily_accuracy']
        if len(daily_acc) < 3:
            return {
                'target_accuracy': target_accuracy,
                'current_accuracy': current_accuracy,
                'prediction': 'insufficient_data',
                'message': 'Need more days of data for prediction'
            }

        # Linear regression on daily accuracy
        x = np.arange(len(daily_acc))
        y = np.array([a['accuracy'] for a in daily_acc])

        # Simple linear fit
        slope = np.polyfit(x, y, 1)[0]

        if slope <= 0:
            return {
                'target_accuracy': target_accuracy,
                'current_accuracy': current_accuracy,
                'prediction': 'not_improving',
                'daily_improvement': float(slope),
                'message': 'Accuracy is not improving. More corrections needed.'
            }

        # Estimate days to target
        gap = target_accuracy - current_accuracy
        days_to_target = int(gap / slope)

        if days_to_target > 365:
            return {
                'target_accuracy': target_accuracy,
                'current_accuracy': current_accuracy,
                'prediction': 'long_term',
                'estimated_days': days_to_target,
                'daily_improvement': float(slope),
                'message': f'At current rate, target will be reached in {days_to_target} days'
            }

        target_date = datetime.now() + timedelta(days=days_to_target)

        return {
            'target_accuracy': target_accuracy,
            'current_accuracy': current_accuracy,
            'prediction': 'estimated',
            'estimated_date': target_date.isoformat(),
            'estimated_days': days_to_target,
            'daily_improvement': float(slope),
            'message': f'Estimated to reach {target_accuracy:.0%} accuracy by {target_date.date()}'
        }

    def get_stores_needing_training(
        self,
        min_accuracy: float = 0.6,
        min_samples: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Identify stores that need more training.

        Args:
            min_accuracy: Minimum acceptable accuracy
            min_samples: Minimum samples to consider

        Returns:
            List of stores needing attention
        """
        stores_needing_help = []

        for store_name, store_data in self.stores.items():
            if store_data.overall.total_deals < min_samples:
                stores_needing_help.append({
                    'store': store_name,
                    'reason': 'insufficient_samples',
                    'total_deals': store_data.overall.total_deals,
                    'accuracy': store_data.overall.accuracy,
                    'recommendation': f'Process at least {min_samples - store_data.overall.total_deals} more ads'
                })
            elif store_data.overall.accuracy < min_accuracy:
                stores_needing_help.append({
                    'store': store_name,
                    'reason': 'low_accuracy',
                    'total_deals': store_data.overall.total_deals,
                    'accuracy': store_data.overall.accuracy,
                    'correction_rate': store_data.overall.correction_rate,
                    'recommendation': 'Review and correct more deals to improve templates'
                })

        # Sort by accuracy (lowest first)
        stores_needing_help.sort(key=lambda x: x.get('accuracy', 0))

        return stores_needing_help

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive accuracy report."""
        return {
            'generated_at': datetime.now().isoformat(),
            'global': self.get_global_accuracy(),
            'by_phase': {
                phase: self.get_phase_accuracy(phase)
                for phase in [1, 2, 3]
            },
            'by_store': {
                store: self.get_store_accuracy(store)
                for store in self.stores
            },
            'trend': self.get_trend(days=7),
            'prediction': self.predict_target_date(0.85),
            'stores_needing_training': self.get_stores_needing_training(),
        }

    def _save(self):
        """Save tracker data to disk."""
        if not self.storage_path:
            return

        data = {
            'global_metrics': {
                'total_deals': self.global_metrics.total_deals,
                'correct_matches': self.global_metrics.correct_matches,
                'incorrect_matches': self.global_metrics.incorrect_matches,
                'corrections_received': self.global_metrics.corrections_received,
            },
            'stores': {}
        }

        for store_name, store_data in self.stores.items():
            data['stores'][store_name] = {
                'store_name': store_data.store_name,
                'overall': {
                    'total_deals': store_data.overall.total_deals,
                    'correct_matches': store_data.overall.correct_matches,
                    'incorrect_matches': store_data.overall.incorrect_matches,
                    'corrections_received': store_data.overall.corrections_received,
                },
                'by_phase': {
                    str(phase): {
                        'total_deals': m.total_deals,
                        'correct_matches': m.correct_matches,
                        'corrections_received': m.corrections_received,
                    }
                    for phase, m in store_data.by_phase.items()
                },
                'by_deal_type': {
                    dtype: {
                        'total_deals': m.total_deals,
                        'correct_matches': m.correct_matches,
                    }
                    for dtype, m in store_data.by_deal_type.items()
                },
                'history': store_data.history[-1000:],  # Keep last 1000 entries
            }

        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=2)

    def _load(self):
        """Load tracker data from disk."""
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)

            # Load global metrics
            gm = data.get('global_metrics', {})
            self.global_metrics = AccuracyMetrics(
                total_deals=gm.get('total_deals', 0),
                correct_matches=gm.get('correct_matches', 0),
                incorrect_matches=gm.get('incorrect_matches', 0),
                corrections_received=gm.get('corrections_received', 0),
            )

            # Load stores
            for store_name, store_data in data.get('stores', {}).items():
                overall = store_data.get('overall', {})

                store_accuracy = StoreAccuracy(
                    store_name=store_name,
                    overall=AccuracyMetrics(
                        total_deals=overall.get('total_deals', 0),
                        correct_matches=overall.get('correct_matches', 0),
                        incorrect_matches=overall.get('incorrect_matches', 0),
                        corrections_received=overall.get('corrections_received', 0),
                    ),
                    history=store_data.get('history', [])
                )

                # Load by_phase
                for phase_str, metrics in store_data.get('by_phase', {}).items():
                    store_accuracy.by_phase[int(phase_str)] = AccuracyMetrics(
                        total_deals=metrics.get('total_deals', 0),
                        correct_matches=metrics.get('correct_matches', 0),
                        corrections_received=metrics.get('corrections_received', 0),
                    )

                # Load by_deal_type
                for dtype, metrics in store_data.get('by_deal_type', {}).items():
                    store_accuracy.by_deal_type[dtype] = AccuracyMetrics(
                        total_deals=metrics.get('total_deals', 0),
                        correct_matches=metrics.get('correct_matches', 0),
                    )

                self.stores[store_name] = store_accuracy

        except (json.JSONDecodeError, IOError) as e:
            print(f"Warning: Could not load accuracy data: {e}")
