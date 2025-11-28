"""
Progressive Learning Pipeline for Deal Matching.
Implements the 30% -> 85% accuracy progression through phased learning.
"""
import json
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from pathlib import Path
from enum import Enum

from ...models.deal_matching.deal_parser_regex import (
    RegexDealParser,
    ExtractedDeal,
    DealType
)
from ...models.deal_matching.deal_parser_template import (
    TemplateDealParser,
    StoreTemplate
)
from ...models.deal_matching.deal_matcher import (
    DealMatcher,
    ProductMatch,
    ProductCatalog
)
from ...models.deal_matching.accuracy_tracker import AccuracyTracker


class LearningPhase(Enum):
    """Progressive learning phases."""
    PHASE_1_REGEX = 1      # 30-40% accuracy
    PHASE_2_TEMPLATE = 2   # 50-60% accuracy
    PHASE_3_ML = 3         # 70-85% accuracy


@dataclass
class PhaseTransitionConfig:
    """Configuration for phase transitions."""
    # Phase 1 -> 2 requirements
    min_ads_for_phase_2: int = 5
    min_corrections_for_phase_2: int = 20

    # Phase 2 -> 3 requirements
    min_ads_for_phase_3: int = 15
    min_corrections_for_phase_3: int = 50
    min_accuracy_for_phase_3: float = 0.55

    # Retraining threshold
    ml_retrain_threshold: int = 10  # Retrain after N corrections


@dataclass
class ProcessingResult:
    """Result from processing an ad."""
    deals: List[ExtractedDeal]
    matches: List[ProductMatch]
    phase_used: LearningPhase
    confidence: float
    store: Optional[str] = None
    processing_time_ms: float = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CorrectionRecord:
    """Record of a user correction."""
    correction_id: str
    timestamp: datetime
    store: str
    original_deal: ExtractedDeal
    corrected_deal: ExtractedDeal
    original_match: Optional[ProductMatch] = None
    corrected_match: Optional[ProductMatch] = None
    phase_at_correction: int = 1
    raw_text: str = ""


class ProgressiveLearner:
    """
    Progressive learning system for deal matching.

    Implements three phases:
    1. Regex-based parsing (30-40% accuracy)
    2. Template-based parsing with learned patterns (50-60% accuracy)
    3. ML-based matching (70-85% accuracy)

    Learning progression:
    - Phase 1 -> 2: After 5 ads OR 20 corrections
    - Phase 2 -> 3: After 15 ads OR 50 corrections AND accuracy >= 55%
    - Continuous improvement through corrections
    """

    def __init__(
        self,
        data_dir: Optional[Path] = None,
        config: Optional[PhaseTransitionConfig] = None,
        catalog: Optional[ProductCatalog] = None
    ):
        """
        Initialize progressive learner.

        Args:
            data_dir: Directory for storing learning data
            config: Phase transition configuration
            catalog: Product catalog for matching
        """
        self.data_dir = data_dir or Path("./models/deal_matching")
        self.config = config or PhaseTransitionConfig()
        self.catalog = catalog or ProductCatalog()

        # Ensure directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Initialize components
        self.regex_parser = RegexDealParser()
        self.template_parser = TemplateDealParser(
            templates_path=self.data_dir / "templates.json"
        )
        self.ml_matcher = DealMatcher(
            model_path=self.data_dir / "deal_matcher.pkl",
            catalog=self.catalog
        )
        self.accuracy_tracker = AccuracyTracker(
            storage_path=self.data_dir / "accuracy_tracker.json"
        )

        # State
        self.current_phase = LearningPhase.PHASE_1_REGEX
        self.corrections: List[CorrectionRecord] = []
        self.ads_processed: Dict[str, int] = {}  # store -> count
        self.total_corrections = 0
        self.training_data: List[Dict[str, Any]] = []  # For ML training
        self.pending_corrections_for_retrain = 0

        # Load state
        self._load_state()

    def process_ad(
        self,
        ad_text: str,
        store: Optional[str] = None,
        coordinates: Optional[List[Dict[str, Any]]] = None
    ) -> ProcessingResult:
        """
        Process an ad and extract deals.

        Uses progressive approach based on current phase.

        Args:
            ad_text: OCR text from ad
            store: Store name (helps with templates)
            coordinates: Optional OCR coordinates

        Returns:
            ProcessingResult with extracted deals and matches
        """
        start_time = datetime.now()

        # Track ad
        store_lower = (store or 'unknown').lower()
        self.ads_processed[store_lower] = self.ads_processed.get(store_lower, 0) + 1

        # Phase 1: Always try regex first
        regex_results = self.regex_parser.parse(ad_text)

        # Default result
        deals = regex_results
        phase_used = LearningPhase.PHASE_1_REGEX

        # Phase 2: Apply template if available
        if self.current_phase.value >= LearningPhase.PHASE_2_TEMPLATE.value:
            template_results = self.template_parser.parse(
                ad_text,
                store=store,
                coordinates=coordinates
            )

            if template_results:
                # Merge results, preferring template
                deals = self._merge_results(template_results, regex_results)
                phase_used = LearningPhase.PHASE_2_TEMPLATE

        # Phase 3: Apply ML matching if trained
        matches = []
        if self.current_phase.value >= LearningPhase.PHASE_3_ML.value:
            if self.ml_matcher.model is not None and self.catalog.products:
                matches = self.ml_matcher.match(deals, top_k=3)
                phase_used = LearningPhase.PHASE_3_ML

        # Calculate overall confidence
        confidence = self._calculate_confidence(deals, matches, phase_used)

        # Processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        # Check for phase advancement
        self._check_phase_advancement()

        return ProcessingResult(
            deals=deals,
            matches=matches,
            phase_used=phase_used,
            confidence=confidence,
            store=store,
            processing_time_ms=processing_time,
            metadata={
                'regex_count': len(regex_results),
                'total_deals': len(deals),
                'matches_found': len(matches),
                'ads_processed_for_store': self.ads_processed.get(store_lower, 0),
            }
        )

    def learn_from_correction(
        self,
        deal_id: str,
        original_deal: ExtractedDeal,
        corrected_deal: ExtractedDeal,
        raw_text: str,
        store: str,
        original_match: Optional[ProductMatch] = None,
        corrected_product: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Learn from a user correction.

        Updates:
        1. Template patterns (Phase 2)
        2. ML training data (Phase 3)
        3. Accuracy metrics

        Args:
            deal_id: Unique identifier for the deal
            original_deal: What the system extracted
            corrected_deal: User's correction
            raw_text: Original text around the deal
            store: Store name
            original_match: Original product match (if any)
            corrected_product: Correct product (if any)

        Returns:
            Learning result with updated state
        """
        # Record correction
        correction = CorrectionRecord(
            correction_id=deal_id,
            timestamp=datetime.now(),
            store=store,
            original_deal=original_deal,
            corrected_deal=corrected_deal,
            original_match=original_match,
            corrected_match=ProductMatch(
                deal=corrected_deal,
                product_id=corrected_product.get('id', '') if corrected_product else '',
                product_name=corrected_product.get('name', '') if corrected_product else '',
                category=corrected_product.get('category', '') if corrected_product else '',
                match_score=1.0,  # User-verified
                is_verified=True
            ) if corrected_product else None,
            phase_at_correction=self.current_phase.value,
            raw_text=raw_text
        )
        self.corrections.append(correction)
        self.total_corrections += 1
        self.pending_corrections_for_retrain += 1

        result = {
            'correction_id': deal_id,
            'total_corrections': self.total_corrections,
            'current_phase': self.current_phase.value,
            'actions_taken': []
        }

        # Update template (Phase 2 learning)
        self.template_parser.learn_from_correction(
            store=store,
            original_deal=original_deal,
            corrected_deal=corrected_deal,
            raw_text=raw_text
        )
        result['actions_taken'].append('template_updated')

        # Add to ML training data
        if original_match and corrected_product:
            # Create negative example (original was wrong)
            self.training_data.append({
                'deal': original_deal,
                'product': {
                    'id': original_match.product_id,
                    'name': original_match.product_name,
                    'category': original_match.category,
                },
                'is_match': False
            })

            # Create positive example (corrected is right)
            self.training_data.append({
                'deal': corrected_deal,
                'product': corrected_product,
                'is_match': True
            })
            result['actions_taken'].append('training_data_added')

        # Record in accuracy tracker
        self.accuracy_tracker.record_correction(
            store=store,
            phase=self.current_phase.value,
            deal_type=original_deal.deal_type.value
        )

        # Check if we should retrain ML model
        if (self.current_phase == LearningPhase.PHASE_3_ML and
            self.pending_corrections_for_retrain >= self.config.ml_retrain_threshold):
            retrain_result = self._retrain_ml_model()
            result['ml_retrain'] = retrain_result
            result['actions_taken'].append('ml_model_retrained')

        # Check for phase advancement
        advanced = self._check_phase_advancement()
        if advanced:
            result['phase_advanced'] = True
            result['new_phase'] = self.current_phase.value

        # Save state
        self._save_state()

        return result

    def record_result(
        self,
        store: str,
        deal: ExtractedDeal,
        is_correct: bool,
        match: Optional[ProductMatch] = None
    ):
        """
        Record whether a deal extraction was correct.

        Used for accuracy tracking without full correction.
        """
        self.accuracy_tracker.record_result(
            store=store,
            is_correct=is_correct,
            phase=self.current_phase.value,
            deal_type=deal.deal_type.value
        )

    def _merge_results(
        self,
        template_deals: List[ExtractedDeal],
        regex_deals: List[ExtractedDeal]
    ) -> List[ExtractedDeal]:
        """Merge template and regex results."""
        merged = list(template_deals)

        # Add regex deals that weren't found by template
        for regex_deal in regex_deals:
            is_duplicate = False
            for template_deal in template_deals:
                if self._deals_similar(regex_deal, template_deal):
                    is_duplicate = True
                    break

            if not is_duplicate:
                merged.append(regex_deal)

        return merged

    def _deals_similar(
        self,
        deal1: ExtractedDeal,
        deal2: ExtractedDeal
    ) -> bool:
        """Check if two deals are similar."""
        # Same price
        if deal1.price and deal2.price:
            if abs(deal1.price - deal2.price) < 0.01:
                return True

        # Same raw text substring
        if deal1.raw_text and deal2.raw_text:
            if deal1.raw_text in deal2.raw_text or deal2.raw_text in deal1.raw_text:
                return True

        return False

    def _calculate_confidence(
        self,
        deals: List[ExtractedDeal],
        matches: List[ProductMatch],
        phase: LearningPhase
    ) -> float:
        """Calculate overall confidence for the extraction."""
        if not deals:
            return 0.0

        # Base confidence from deals
        deal_confidence = sum(d.confidence for d in deals) / len(deals)

        # Boost from matches
        match_confidence = 0.0
        if matches:
            match_confidence = sum(m.match_score for m in matches) / len(matches)

        # Phase-based weighting
        phase_weight = {
            LearningPhase.PHASE_1_REGEX: 0.35,
            LearningPhase.PHASE_2_TEMPLATE: 0.55,
            LearningPhase.PHASE_3_ML: 0.75,
        }[phase]

        # Combined confidence
        if matches:
            confidence = 0.4 * deal_confidence + 0.4 * match_confidence + 0.2 * phase_weight
        else:
            confidence = 0.6 * deal_confidence + 0.4 * phase_weight

        return min(confidence, 1.0)

    def _check_phase_advancement(self) -> bool:
        """Check if we should advance to next phase."""
        total_ads = sum(self.ads_processed.values())
        advanced = False

        if self.current_phase == LearningPhase.PHASE_1_REGEX:
            # Check Phase 1 -> 2 transition
            if (total_ads >= self.config.min_ads_for_phase_2 or
                self.total_corrections >= self.config.min_corrections_for_phase_2):
                self.current_phase = LearningPhase.PHASE_2_TEMPLATE
                advanced = True

        elif self.current_phase == LearningPhase.PHASE_2_TEMPLATE:
            # Check Phase 2 -> 3 transition
            current_accuracy = self.accuracy_tracker.get_phase_accuracy(2).get('accuracy', 0)

            if ((total_ads >= self.config.min_ads_for_phase_3 or
                 self.total_corrections >= self.config.min_corrections_for_phase_3) and
                current_accuracy >= self.config.min_accuracy_for_phase_3):

                # Train initial ML model
                if self.training_data:
                    self._retrain_ml_model()

                self.current_phase = LearningPhase.PHASE_3_ML
                advanced = True

        return advanced

    def _retrain_ml_model(self) -> Dict[str, Any]:
        """Retrain the ML model with accumulated training data."""
        if len(self.training_data) < 10:
            return {'status': 'skipped', 'reason': 'insufficient_data'}

        try:
            result = self.ml_matcher.train(self.training_data)
            self.pending_corrections_for_retrain = 0
            return {'status': 'success', 'metrics': result}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    def should_advance_phase(self) -> Dict[str, Any]:
        """Check current phase advancement status."""
        total_ads = sum(self.ads_processed.values())

        if self.current_phase == LearningPhase.PHASE_1_REGEX:
            return {
                'current_phase': 1,
                'next_phase': 2,
                'ads_needed': max(0, self.config.min_ads_for_phase_2 - total_ads),
                'corrections_needed': max(0, self.config.min_corrections_for_phase_2 - self.total_corrections),
                'ready': (total_ads >= self.config.min_ads_for_phase_2 or
                         self.total_corrections >= self.config.min_corrections_for_phase_2)
            }

        elif self.current_phase == LearningPhase.PHASE_2_TEMPLATE:
            current_accuracy = self.accuracy_tracker.get_phase_accuracy(2).get('accuracy', 0)
            return {
                'current_phase': 2,
                'next_phase': 3,
                'ads_needed': max(0, self.config.min_ads_for_phase_3 - total_ads),
                'corrections_needed': max(0, self.config.min_corrections_for_phase_3 - self.total_corrections),
                'current_accuracy': current_accuracy,
                'accuracy_needed': self.config.min_accuracy_for_phase_3,
                'ready': ((total_ads >= self.config.min_ads_for_phase_3 or
                          self.total_corrections >= self.config.min_corrections_for_phase_3) and
                         current_accuracy >= self.config.min_accuracy_for_phase_3)
            }

        return {
            'current_phase': 3,
            'next_phase': None,
            'message': 'Already at maximum phase'
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get comprehensive learner statistics."""
        return {
            'current_phase': self.current_phase.value,
            'phase_name': self.current_phase.name,
            'total_ads_processed': sum(self.ads_processed.values()),
            'ads_by_store': self.ads_processed,
            'total_corrections': self.total_corrections,
            'pending_corrections_for_retrain': self.pending_corrections_for_retrain,
            'training_data_size': len(self.training_data),
            'ml_model_trained': self.ml_matcher.model is not None,
            'catalog_size': len(self.catalog.products),
            'phase_advancement': self.should_advance_phase(),
            'accuracy': {
                'global': self.accuracy_tracker.get_global_accuracy(),
                'by_phase': {
                    phase: self.accuracy_tracker.get_phase_accuracy(phase)
                    for phase in [1, 2, 3]
                }
            },
            'parsers': {
                'regex': self.regex_parser.get_stats(),
                'template': self.template_parser.get_stats(),
                'ml': self.ml_matcher.get_stats(),
            }
        }

    def set_catalog(self, catalog: ProductCatalog):
        """Set product catalog."""
        self.catalog = catalog
        self.ml_matcher.set_catalog(catalog)

    def force_phase(self, phase: int):
        """Force a specific phase (for testing)."""
        if phase in [1, 2, 3]:
            self.current_phase = LearningPhase(phase)
            self._save_state()

    def _save_state(self):
        """Save learner state to disk."""
        state = {
            'current_phase': self.current_phase.value,
            'ads_processed': self.ads_processed,
            'total_corrections': self.total_corrections,
            'pending_corrections_for_retrain': self.pending_corrections_for_retrain,
            'training_data_count': len(self.training_data),
        }

        state_path = self.data_dir / "learner_state.json"
        with open(state_path, 'w') as f:
            json.dump(state, f, indent=2)

        # Save training data separately
        if self.training_data:
            training_path = self.data_dir / "training_data.json"
            # Convert deals to serializable format
            serializable_data = []
            for item in self.training_data:
                serializable_data.append({
                    'deal': {
                        'raw_text': item['deal'].raw_text,
                        'deal_type': item['deal'].deal_type.value,
                        'product_name': item['deal'].product_name,
                        'price': item['deal'].price,
                        'confidence': item['deal'].confidence,
                    },
                    'product': item['product'],
                    'is_match': item['is_match']
                })
            with open(training_path, 'w') as f:
                json.dump(serializable_data, f, indent=2)

    def _load_state(self):
        """Load learner state from disk."""
        state_path = self.data_dir / "learner_state.json"

        if state_path.exists():
            try:
                with open(state_path, 'r') as f:
                    state = json.load(f)

                self.current_phase = LearningPhase(state.get('current_phase', 1))
                self.ads_processed = state.get('ads_processed', {})
                self.total_corrections = state.get('total_corrections', 0)
                self.pending_corrections_for_retrain = state.get('pending_corrections_for_retrain', 0)

            except (json.JSONDecodeError, IOError):
                pass

        # Load training data
        training_path = self.data_dir / "training_data.json"
        if training_path.exists():
            try:
                with open(training_path, 'r') as f:
                    serialized = json.load(f)

                self.training_data = []
                for item in serialized:
                    deal_data = item['deal']
                    self.training_data.append({
                        'deal': ExtractedDeal(
                            raw_text=deal_data['raw_text'],
                            deal_type=DealType(deal_data['deal_type']),
                            product_name=deal_data.get('product_name'),
                            price=deal_data.get('price'),
                            confidence=deal_data.get('confidence', 0.5)
                        ),
                        'product': item['product'],
                        'is_match': item['is_match']
                    })

            except (json.JSONDecodeError, IOError):
                pass
