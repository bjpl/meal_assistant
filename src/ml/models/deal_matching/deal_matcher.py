"""
Phase 3: ML Model Deal Matcher.
Uses RandomForest classifier for product matching.
Expected accuracy: 70-85%
"""
import re
import pickle
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path

import numpy as np
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from .deal_parser_regex import ExtractedDeal, DealType


@dataclass
class ProductMatch:
    """Represents a match between a deal and a product."""
    deal: ExtractedDeal
    product_id: str
    product_name: str
    category: str
    match_score: float
    match_features: Dict[str, float] = field(default_factory=dict)
    is_verified: bool = False


@dataclass
class ProductCatalog:
    """Product catalog for matching."""
    products: List[Dict[str, Any]] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)

    def get_by_category(self, category: str) -> List[Dict[str, Any]]:
        return [p for p in self.products if p.get('category') == category]

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Simple text search."""
        query_lower = query.lower()
        results = []
        for product in self.products:
            name = product.get('name', '').lower()
            if query_lower in name or any(word in name for word in query_lower.split()):
                results.append(product)
        return results[:limit]


class DealMatcher:
    """
    Phase 3 ML-based deal matcher.

    Uses RandomForest classifier with features:
    - String similarity (Levenshtein, Jaro-Winkler)
    - N-gram matching
    - Category matching
    - Price reasonableness
    - Historical purchase patterns

    Expected accuracy: 70-85%
    """

    def __init__(
        self,
        model_path: Optional[Path] = None,
        catalog: Optional[ProductCatalog] = None
    ):
        """
        Initialize deal matcher.

        Args:
            model_path: Path to saved model
            catalog: Product catalog for matching
        """
        self.model_path = model_path
        self.catalog = catalog or ProductCatalog()
        self.model: Optional[Any] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.feature_names = [
            'levenshtein_sim',
            'jaro_winkler_sim',
            'ngram_overlap_2',
            'ngram_overlap_3',
            'word_overlap',
            'category_match',
            'price_reasonableness',
            'historical_purchase',
            'brand_match',
            'unit_match',
        ]

        if model_path and model_path.exists():
            self.load_model()

    def match(
        self,
        deals: List[ExtractedDeal],
        top_k: int = 3
    ) -> List[ProductMatch]:
        """
        Match deals to products.

        Args:
            deals: List of extracted deals
            top_k: Number of top matches per deal

        Returns:
            List of product matches
        """
        all_matches = []

        for deal in deals:
            matches = self._match_single_deal(deal, top_k)
            all_matches.extend(matches)

        return all_matches

    def _match_single_deal(
        self,
        deal: ExtractedDeal,
        top_k: int
    ) -> List[ProductMatch]:
        """Match a single deal to products."""
        if not deal.product_name:
            return []

        # Get candidate products
        candidates = self._get_candidates(deal)

        if not candidates:
            return []

        # Calculate features for each candidate
        candidate_features = []
        for product in candidates:
            features = self._calculate_features(deal, product)
            candidate_features.append((product, features))

        # Use ML model if trained, otherwise use heuristic scoring
        if self.model and SKLEARN_AVAILABLE:
            matches = self._ml_match(deal, candidate_features, top_k)
        else:
            matches = self._heuristic_match(deal, candidate_features, top_k)

        return matches

    def _get_candidates(self, deal: ExtractedDeal, limit: int = 50) -> List[Dict[str, Any]]:
        """Get candidate products for matching."""
        candidates = []

        if deal.product_name:
            # Search by name
            search_results = self.catalog.search(deal.product_name, limit)
            candidates.extend(search_results)

        # Add category-based candidates if we have few results
        if len(candidates) < 10 and deal.metadata.get('category'):
            category = deal.metadata['category']
            category_products = self.catalog.get_by_category(category)
            for p in category_products:
                if p not in candidates:
                    candidates.append(p)

        return candidates[:limit]

    def _calculate_features(
        self,
        deal: ExtractedDeal,
        product: Dict[str, Any]
    ) -> np.ndarray:
        """Calculate feature vector for deal-product pair."""
        features = np.zeros(len(self.feature_names))

        deal_name = (deal.product_name or '').lower()
        product_name = product.get('name', '').lower()

        # String similarity features
        features[0] = self._levenshtein_similarity(deal_name, product_name)
        features[1] = self._jaro_winkler_similarity(deal_name, product_name)

        # N-gram features
        features[2] = self._ngram_overlap(deal_name, product_name, 2)
        features[3] = self._ngram_overlap(deal_name, product_name, 3)

        # Word overlap
        features[4] = self._word_overlap(deal_name, product_name)

        # Category match
        deal_category = deal.metadata.get('category', '').lower()
        product_category = product.get('category', '').lower()
        features[5] = 1.0 if deal_category and deal_category == product_category else 0.0

        # Price reasonableness
        if deal.price and 'typical_price' in product:
            typical = product['typical_price']
            if typical > 0:
                ratio = deal.price / typical
                # Score is high if price is close to typical (within 50%)
                features[6] = max(0, 1 - abs(ratio - 1))

        # Historical purchase (placeholder - would come from user data)
        features[7] = product.get('purchase_frequency', 0)

        # Brand match
        deal_brand = self._extract_brand(deal.product_name)
        product_brand = product.get('brand', '').lower()
        features[8] = 1.0 if deal_brand and deal_brand in product_brand else 0.0

        # Unit match
        if deal.unit and 'unit' in product:
            features[9] = 1.0 if deal.unit == product['unit'] else 0.0

        return features

    def _levenshtein_similarity(self, s1: str, s2: str) -> float:
        """Calculate Levenshtein similarity (1 - normalized distance)."""
        if not s1 or not s2:
            return 0.0

        len1, len2 = len(s1), len(s2)
        if len1 == 0 or len2 == 0:
            return 0.0

        # Dynamic programming Levenshtein
        matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]

        for i in range(len1 + 1):
            matrix[i][0] = i
        for j in range(len2 + 1):
            matrix[0][j] = j

        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if s1[i-1] == s2[j-1] else 1
                matrix[i][j] = min(
                    matrix[i-1][j] + 1,
                    matrix[i][j-1] + 1,
                    matrix[i-1][j-1] + cost
                )

        distance = matrix[len1][len2]
        max_len = max(len1, len2)

        return 1 - (distance / max_len)

    def _jaro_winkler_similarity(self, s1: str, s2: str) -> float:
        """Calculate Jaro-Winkler similarity."""
        if not s1 or not s2:
            return 0.0

        if s1 == s2:
            return 1.0

        len1, len2 = len(s1), len(s2)
        match_distance = max(len1, len2) // 2 - 1

        s1_matches = [False] * len1
        s2_matches = [False] * len2

        matches = 0
        transpositions = 0

        # Find matches
        for i in range(len1):
            start = max(0, i - match_distance)
            end = min(i + match_distance + 1, len2)

            for j in range(start, end):
                if s2_matches[j] or s1[i] != s2[j]:
                    continue
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break

        if matches == 0:
            return 0.0

        # Count transpositions
        k = 0
        for i in range(len1):
            if not s1_matches[i]:
                continue
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1

        jaro = (matches / len1 + matches / len2 +
                (matches - transpositions / 2) / matches) / 3

        # Winkler modification
        prefix = 0
        for i in range(min(len1, len2, 4)):
            if s1[i] == s2[i]:
                prefix += 1
            else:
                break

        return jaro + prefix * 0.1 * (1 - jaro)

    def _ngram_overlap(self, s1: str, s2: str, n: int) -> float:
        """Calculate n-gram overlap coefficient."""
        if not s1 or not s2:
            return 0.0

        ngrams1 = set(s1[i:i+n] for i in range(len(s1) - n + 1))
        ngrams2 = set(s2[i:i+n] for i in range(len(s2) - n + 1))

        if not ngrams1 or not ngrams2:
            return 0.0

        intersection = len(ngrams1 & ngrams2)
        smaller = min(len(ngrams1), len(ngrams2))

        return intersection / smaller if smaller > 0 else 0.0

    def _word_overlap(self, s1: str, s2: str) -> float:
        """Calculate word overlap."""
        words1 = set(re.findall(r'\w+', s1.lower()))
        words2 = set(re.findall(r'\w+', s2.lower()))

        if not words1 or not words2:
            return 0.0

        intersection = len(words1 & words2)
        union = len(words1 | words2)

        return intersection / union if union > 0 else 0.0

    def _extract_brand(self, name: Optional[str]) -> Optional[str]:
        """Extract brand from product name."""
        if not name:
            return None

        # Common brand patterns
        # First capitalized word is often the brand
        words = name.split()
        if words and words[0][0].isupper():
            return words[0].lower()

        return None

    def _ml_match(
        self,
        deal: ExtractedDeal,
        candidate_features: List[Tuple[Dict, np.ndarray]],
        top_k: int
    ) -> List[ProductMatch]:
        """Match using ML model."""
        matches = []

        # Stack features for batch prediction
        X = np.array([f for _, f in candidate_features])

        # Get probabilities
        probas = self.model.predict_proba(X)

        # Get positive class probability
        positive_idx = list(self.model.classes_).index(1) if 1 in self.model.classes_ else 0
        scores = probas[:, positive_idx]

        # Get top k
        top_indices = np.argsort(scores)[-top_k:][::-1]

        for idx in top_indices:
            product, features = candidate_features[idx]
            matches.append(ProductMatch(
                deal=deal,
                product_id=product.get('id', ''),
                product_name=product.get('name', ''),
                category=product.get('category', ''),
                match_score=float(scores[idx]),
                match_features={
                    name: float(features[i])
                    for i, name in enumerate(self.feature_names)
                }
            ))

        return matches

    def _heuristic_match(
        self,
        deal: ExtractedDeal,
        candidate_features: List[Tuple[Dict, np.ndarray]],
        top_k: int
    ) -> List[ProductMatch]:
        """Match using heuristic scoring."""
        # Weighted sum of features
        weights = np.array([
            0.15,  # levenshtein
            0.2,   # jaro_winkler
            0.1,   # ngram_2
            0.1,   # ngram_3
            0.15,  # word_overlap
            0.1,   # category
            0.05,  # price
            0.05,  # historical
            0.05,  # brand
            0.05,  # unit
        ])

        scored = []
        for product, features in candidate_features:
            score = np.dot(features, weights)
            scored.append((product, features, score))

        # Sort by score
        scored.sort(key=lambda x: x[2], reverse=True)

        matches = []
        for product, features, score in scored[:top_k]:
            matches.append(ProductMatch(
                deal=deal,
                product_id=product.get('id', ''),
                product_name=product.get('name', ''),
                category=product.get('category', ''),
                match_score=float(score),
                match_features={
                    name: float(features[i])
                    for i, name in enumerate(self.feature_names)
                }
            ))

        return matches

    def train(
        self,
        training_data: List[Dict[str, Any]],
        validation_split: float = 0.2
    ) -> Dict[str, float]:
        """
        Train the matching model.

        Args:
            training_data: List of labeled deal-product pairs
                Each entry: {
                    'deal': ExtractedDeal,
                    'product': Dict,
                    'is_match': bool
                }
            validation_split: Fraction for validation

        Returns:
            Training metrics
        """
        if not SKLEARN_AVAILABLE:
            return {'error': 'sklearn not available'}

        if len(training_data) < 10:
            return {'error': 'insufficient training data'}

        # Prepare features and labels
        X = []
        y = []

        for entry in training_data:
            deal = entry['deal']
            product = entry['product']
            is_match = entry['is_match']

            features = self._calculate_features(deal, product)
            X.append(features)
            y.append(1 if is_match else 0)

        X = np.array(X)
        y = np.array(y)

        # Split data
        n_val = int(len(X) * validation_split)
        indices = np.random.permutation(len(X))

        X_train = X[indices[n_val:]]
        y_train = y[indices[n_val:]]
        X_val = X[indices[:n_val]]
        y_val = y[indices[:n_val]]

        # Train model
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            class_weight='balanced',
            random_state=42
        )

        self.model.fit(X_train, y_train)

        # Evaluate
        train_acc = self.model.score(X_train, y_train)
        val_acc = self.model.score(X_val, y_val)

        # Feature importance
        importance = dict(zip(self.feature_names, self.model.feature_importances_))

        # Save model
        if self.model_path:
            self.save_model()

        return {
            'train_accuracy': train_acc,
            'validation_accuracy': val_acc,
            'samples_trained': len(X_train),
            'samples_validated': len(X_val),
            'feature_importance': importance,
        }

    def learn_from_correction(
        self,
        deal: ExtractedDeal,
        incorrect_product: Dict[str, Any],
        correct_product: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Learn from user correction.

        Creates training examples from the correction:
        - Negative example: deal + incorrect_product
        - Positive example: deal + correct_product
        """
        return {
            'negative': {
                'deal': deal,
                'product': incorrect_product,
                'is_match': False
            },
            'positive': {
                'deal': deal,
                'product': correct_product,
                'is_match': True
            }
        }

    def save_model(self):
        """Save model to disk."""
        if not self.model_path or not self.model:
            return

        self.model_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.model_path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'feature_names': self.feature_names,
            }, f)

    def load_model(self):
        """Load model from disk."""
        if not self.model_path or not self.model_path.exists():
            return

        with open(self.model_path, 'rb') as f:
            data = pickle.load(f)
            self.model = data.get('model')
            self.feature_names = data.get('feature_names', self.feature_names)

    def set_catalog(self, catalog: ProductCatalog):
        """Set product catalog."""
        self.catalog = catalog

    def get_stats(self) -> Dict[str, Any]:
        """Get matcher statistics."""
        return {
            'matcher_type': 'ml',
            'phase': 3,
            'expected_accuracy': '70-85%',
            'model_loaded': self.model is not None,
            'catalog_size': len(self.catalog.products),
            'feature_names': self.feature_names,
        }
