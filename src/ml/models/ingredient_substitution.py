"""
Ingredient Substitution Model.
Suggests nutritionally-equivalent substitutes for missing ingredients.
"""
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.data.models import MealComponent, NutritionInfo


class SimpleScaler:
    """Simple standard scaler fallback when sklearn not available."""

    def __init__(self):
        self.mean_ = None
        self.std_ = None

    def fit_transform(self, X):
        X = np.array(X)
        self.mean_ = np.mean(X, axis=0)
        self.std_ = np.std(X, axis=0)
        self.std_[self.std_ == 0] = 1
        return (X - self.mean_) / self.std_

    def transform(self, X):
        X = np.array(X)
        if self.mean_ is None:
            return X
        return (X - self.mean_) / self.std_


def simple_cosine_similarity(X, Y):
    """Simple cosine similarity fallback when sklearn not available."""
    X = np.array(X)
    Y = np.array(Y)
    if X.ndim == 1:
        X = X.reshape(1, -1)
    if Y.ndim == 1:
        Y = Y.reshape(1, -1)

    # Normalize
    X_norm = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-10)
    Y_norm = Y / (np.linalg.norm(Y, axis=1, keepdims=True) + 1e-10)

    return np.dot(X_norm, Y_norm.T)


@dataclass
class SubstitutionSuggestion:
    """A suggested ingredient substitution."""
    original: MealComponent
    substitute: MealComponent
    similarity_score: float  # 0-1, how similar nutritionally
    calorie_difference: float  # Positive = substitute has more
    protein_difference: float  # Positive = substitute has more
    category_match: bool  # Same category (protein, carb, etc.)
    notes: List[str]


class IngredientSubstitutionModel:
    """
    Content-based filtering model for ingredient substitutions.

    Features used per ingredient:
    - Calories per serving
    - Protein per serving
    - Carbs per serving
    - Fat per serving
    - Fiber per serving
    - Category encoding

    Output:
    - Ranked list of substitutes maintaining similar macros
    """

    MODEL_VERSION = "1.0.0"

    def __init__(self, model_path: Optional[Path] = None):
        """Initialize substitution model."""
        self.ingredients: List[MealComponent] = []
        self.feature_matrix: Optional[np.ndarray] = None

        # Use sklearn if available, otherwise fallback
        ScalerClass = StandardScaler if SKLEARN_AVAILABLE else SimpleScaler
        self.scaler = ScalerClass()
        self.is_fitted = False
        self.category_map = {
            "protein": 0,
            "carb": 1,
            "vegetable": 2,
            "fat": 3,
            "flavor": 4,
            "fruit": 5,
        }

        if model_path and Path(model_path).exists():
            self.load(model_path)
        else:
            # Load default ingredient database
            self._load_default_ingredients()

    def _load_default_ingredients(self) -> None:
        """Load default ingredient database from meal system."""
        # Proteins from the PRD
        proteins = [
            MealComponent(
                name="Chicken Breast (6oz)", category="protein",
                nutrition=NutritionInfo(280, 52, 0, 6), portion_size="6 oz",
                tags=["lean", "batch-prep"]
            ),
            MealComponent(
                name="Cod/Tilapia (6oz)", category="protein",
                nutrition=NutritionInfo(260, 48, 0, 4), portion_size="6 oz",
                tags=["lean", "fish", "quick-cooking"]
            ),
            MealComponent(
                name="Egg Whites (4) + Whole Egg (1)", category="protein",
                nutrition=NutritionInfo(250, 30, 2, 10), portion_size="5 eggs",
                tags=["breakfast", "versatile"]
            ),
            MealComponent(
                name="Shrimp (6oz)", category="protein",
                nutrition=NutritionInfo(250, 48, 0, 2), portion_size="6 oz",
                tags=["lean", "seafood", "quick-cooking"]
            ),
            MealComponent(
                name="Salmon (6oz)", category="protein",
                nutrition=NutritionInfo(300, 42, 0, 14), portion_size="6 oz",
                tags=["omega-3", "fish"]
            ),
            MealComponent(
                name="Beef Sirloin (5oz)", category="protein",
                nutrition=NutritionInfo(290, 46, 0, 10), portion_size="5 oz",
                tags=["iron", "red-meat"]
            ),
            MealComponent(
                name="Pork Belly (4oz)", category="protein",
                nutrition=NutritionInfo(320, 20, 0, 28), portion_size="4 oz",
                tags=["high-fat", "special-occasion"]
            ),
            MealComponent(
                name="Black Beans (1 can)", category="protein",
                nutrition=NutritionInfo(385, 25, 65, 2, 25), portion_size="1 can",
                tags=["plant", "fiber", "mexican"]
            ),
            MealComponent(
                name="Greek Yogurt + Protein Powder", category="protein",
                nutrition=NutritionInfo(350, 45, 25, 5), portion_size="1.5 cups",
                tags=["quick", "dairy"]
            ),
            MealComponent(
                name="Eggs (3)", category="protein",
                nutrition=NutritionInfo(210, 18, 2, 15), portion_size="3 eggs",
                tags=["breakfast", "versatile"]
            ),
            MealComponent(
                name="Dal/Lentils (1 cup)", category="protein",
                nutrition=NutritionInfo(230, 16, 40, 1, 16), portion_size="1 cup cooked",
                tags=["plant", "indian", "fiber"]
            ),
        ]

        # Carbs
        carbs = [
            MealComponent(
                name="Basmati Rice", category="carb",
                nutrition=NutritionInfo(210, 4, 45, 0.5), portion_size="1 cup cooked",
                tags=["grain", "aromatic"]
            ),
            MealComponent(
                name="Sweet Brown Rice", category="carb",
                nutrition=NutritionInfo(220, 5, 46, 1.5), portion_size="1 cup cooked",
                tags=["grain", "nutty", "sticky"]
            ),
            MealComponent(
                name="Sushi Rice", category="carb",
                nutrition=NutritionInfo(240, 4, 53, 0.5), portion_size="1 cup cooked",
                tags=["grain", "sticky", "mild"]
            ),
            MealComponent(
                name="Arepas (2 small)", category="carb",
                nutrition=NutritionInfo(200, 4, 40, 2), portion_size="2 small",
                tags=["corn", "latin", "make-fresh"]
            ),
            MealComponent(
                name="Quinoa", category="carb",
                nutrition=NutritionInfo(222, 8, 39, 3.5), portion_size="1 cup cooked",
                tags=["grain", "complete-protein"]
            ),
        ]

        # Fruits
        fruits = [
            MealComponent(
                name="Orange", category="fruit",
                nutrition=NutritionInfo(65, 1, 16, 0, 3), portion_size="1 medium",
                tags=["citrus", "vitamin-c"]
            ),
            MealComponent(
                name="Banana", category="fruit",
                nutrition=NutritionInfo(105, 1, 27, 0, 3), portion_size="1 medium",
                tags=["potassium", "energy"]
            ),
            MealComponent(
                name="Pineapple (fresh)", category="fruit",
                nutrition=NutritionInfo(82, 1, 22, 0, 2), portion_size="1 cup",
                tags=["tropical", "bromelain"]
            ),
            MealComponent(
                name="Baked Apple", category="fruit",
                nutrition=NutritionInfo(95, 0, 25, 0, 4), portion_size="1 medium",
                tags=["dessert", "warm"]
            ),
            MealComponent(
                name="Grapes", category="fruit",
                nutrition=NutritionInfo(62, 1, 16, 0, 1), portion_size="1 cup",
                tags=["snack", "platter"]
            ),
            MealComponent(
                name="Melon Cubes", category="fruit",
                nutrition=NutritionInfo(54, 1, 13, 0, 1), portion_size="1 cup",
                tags=["light", "hydrating"]
            ),
        ]

        # Vegetables
        vegetables = [
            MealComponent(
                name="Leafy Greens", category="vegetable",
                nutrition=NutritionInfo(20, 2, 3, 0, 2), portion_size="2 cups",
                tags=["raw", "high-volume"]
            ),
            MealComponent(
                name="Cucumber Slices", category="vegetable",
                nutrition=NutritionInfo(16, 1, 4, 0, 1), portion_size="1 cup",
                tags=["raw", "hydrating"]
            ),
            MealComponent(
                name="Bell Pepper Strips", category="vegetable",
                nutrition=NutritionInfo(30, 1, 7, 0, 2), portion_size="1 cup",
                tags=["raw", "vitamin-c"]
            ),
            MealComponent(
                name="Cherry Tomatoes", category="vegetable",
                nutrition=NutritionInfo(27, 1, 6, 0, 2), portion_size="1 cup",
                tags=["raw", "lycopene"]
            ),
            MealComponent(
                name="Steamed Vegetables + Butter", category="vegetable",
                nutrition=NutritionInfo(250, 4, 15, 18), portion_size="2 cups",
                tags=["cooked", "comfort"]
            ),
            MealComponent(
                name="Roasted Vegetables + Oil", category="vegetable",
                nutrition=NutritionInfo(280, 4, 18, 20), portion_size="2 cups",
                tags=["cooked", "caramelized"]
            ),
            MealComponent(
                name="Stir-Fried Vegetables", category="vegetable",
                nutrition=NutritionInfo(220, 4, 12, 16), portion_size="2 cups",
                tags=["cooked", "asian"]
            ),
        ]

        # Fats
        fats = [
            MealComponent(
                name="Shredded Cheese", category="fat",
                nutrition=NutritionInfo(100, 7, 1, 8), portion_size="1/4 cup",
                tags=["dairy", "melting"]
            ),
            MealComponent(
                name="Feta Crumbles", category="fat",
                nutrition=NutritionInfo(100, 5, 1, 8), portion_size="1/4 cup",
                tags=["dairy", "tangy"]
            ),
            MealComponent(
                name="Fresh Mozzarella", category="fat",
                nutrition=NutritionInfo(100, 6, 1, 8), portion_size="1/4 cup",
                tags=["dairy", "mild"]
            ),
            MealComponent(
                name="Avocado", category="fat",
                nutrition=NutritionInfo(120, 1.5, 6, 11, 5), portion_size="1/2 medium",
                tags=["plant", "healthy-fat"]
            ),
            MealComponent(
                name="Nuts/Seeds", category="fat",
                nutrition=NutritionInfo(100, 4, 4, 9), portion_size="2 tbsp",
                tags=["plant", "crunchy"]
            ),
            MealComponent(
                name="Hummus", category="fat",
                nutrition=NutritionInfo(70, 2, 6, 4), portion_size="2 tbsp",
                tags=["plant", "dip"]
            ),
        ]

        self.ingredients = proteins + carbs + fruits + vegetables + fats
        self._fit_feature_matrix()

    def _ingredient_to_features(self, ingredient: MealComponent) -> np.ndarray:
        """Convert ingredient to feature vector."""
        category_encoding = [0] * len(self.category_map)
        cat_idx = self.category_map.get(ingredient.category, 0)
        category_encoding[cat_idx] = 1

        nutrition_features = [
            ingredient.nutrition.calories,
            ingredient.nutrition.protein_g,
            ingredient.nutrition.carbs_g,
            ingredient.nutrition.fat_g,
            ingredient.nutrition.fiber_g,
        ]

        return np.array(nutrition_features + category_encoding)

    def _fit_feature_matrix(self) -> None:
        """Build feature matrix from ingredients."""
        if not self.ingredients:
            return

        features = [self._ingredient_to_features(ing) for ing in self.ingredients]
        self.feature_matrix = np.array(features)

        # Scale only nutrition features (first 5), not category encoding
        self.feature_matrix[:, :5] = self.scaler.fit_transform(self.feature_matrix[:, :5])
        self.is_fitted = True

    def add_ingredient(self, ingredient: MealComponent) -> None:
        """Add new ingredient to database."""
        self.ingredients.append(ingredient)
        self._fit_feature_matrix()

    def find_substitutes(
        self,
        ingredient: MealComponent,
        top_k: int = 5,
        same_category_only: bool = True,
        max_calorie_diff: Optional[float] = None,
        max_protein_diff: Optional[float] = None,
    ) -> List[SubstitutionSuggestion]:
        """
        Find top-k substitutes for an ingredient.

        Args:
            ingredient: Ingredient to substitute
            top_k: Number of suggestions to return
            same_category_only: Only suggest from same category
            max_calorie_diff: Maximum calorie difference allowed
            max_protein_diff: Maximum protein difference allowed

        Returns:
            List of SubstitutionSuggestion sorted by similarity
        """
        if not self.is_fitted or self.feature_matrix is None:
            return []

        # Convert query to features
        query_features = self._ingredient_to_features(ingredient)
        query_features[:5] = self.scaler.transform(query_features[:5].reshape(1, -1))

        # Calculate similarities
        if SKLEARN_AVAILABLE:
            similarities = cosine_similarity(
                query_features.reshape(1, -1),
                self.feature_matrix
            )[0]
        else:
            # Use fallback cosine similarity
            similarities = simple_cosine_similarity(
                query_features.reshape(1, -1),
                self.feature_matrix
            )[0]

        # Filter and sort
        candidates = []
        for idx, sim in enumerate(similarities):
            candidate = self.ingredients[idx]

            # Skip self-match
            if candidate.name == ingredient.name:
                continue

            # Category filter
            if same_category_only and candidate.category != ingredient.category:
                continue

            cal_diff = candidate.nutrition.calories - ingredient.nutrition.calories
            protein_diff = candidate.nutrition.protein_g - ingredient.nutrition.protein_g

            # Calorie filter
            if max_calorie_diff and abs(cal_diff) > max_calorie_diff:
                continue

            # Protein filter
            if max_protein_diff and abs(protein_diff) > max_protein_diff:
                continue

            # Generate notes
            notes = self._generate_notes(ingredient, candidate, cal_diff, protein_diff)

            candidates.append(SubstitutionSuggestion(
                original=ingredient,
                substitute=candidate,
                similarity_score=float(sim),
                calorie_difference=cal_diff,
                protein_difference=protein_diff,
                category_match=(candidate.category == ingredient.category),
                notes=notes,
            ))

        # Sort by similarity
        candidates.sort(key=lambda x: x.similarity_score, reverse=True)

        return candidates[:top_k]

    def _generate_notes(
        self,
        original: MealComponent,
        substitute: MealComponent,
        cal_diff: float,
        protein_diff: float,
    ) -> List[str]:
        """Generate helpful notes for substitution."""
        notes = []

        if abs(cal_diff) < 20:
            notes.append("Nearly identical calories")
        elif cal_diff > 0:
            notes.append(f"+{cal_diff:.0f} calories vs original")
        else:
            notes.append(f"{cal_diff:.0f} calories vs original")

        if abs(protein_diff) < 5:
            notes.append("Similar protein content")
        elif protein_diff > 0:
            notes.append(f"+{protein_diff:.0f}g protein (good for protein goals)")
        else:
            notes.append(f"{protein_diff:.0f}g protein")

        # Tag-based notes
        orig_tags = set(original.tags)
        sub_tags = set(substitute.tags)

        if "quick-cooking" in sub_tags and "quick-cooking" not in orig_tags:
            notes.append("Faster to prepare")

        if "plant" in sub_tags and "plant" not in orig_tags:
            notes.append("Plant-based alternative")

        if "batch-prep" in sub_tags:
            notes.append("Good for batch cooking")

        return notes

    def suggest_for_macros(
        self,
        target_calories: float,
        target_protein: float,
        category: Optional[str] = None,
        top_k: int = 5,
    ) -> List[MealComponent]:
        """
        Suggest ingredients matching target macros.

        Args:
            target_calories: Desired calorie content
            target_protein: Desired protein content
            category: Optional category filter
            top_k: Number of suggestions

        Returns:
            List of MealComponents closest to targets
        """
        candidates = self.ingredients

        if category:
            candidates = [i for i in candidates if i.category == category]

        # Score by distance to targets
        scored = []
        for ing in candidates:
            cal_diff = abs(ing.nutrition.calories - target_calories)
            protein_diff = abs(ing.nutrition.protein_g - target_protein)

            # Weighted score (protein more important)
            score = cal_diff / 100 + protein_diff / 10
            scored.append((ing, score))

        scored.sort(key=lambda x: x[1])

        return [ing for ing, _ in scored[:top_k]]

    def get_categories(self) -> List[str]:
        """Get all available ingredient categories."""
        return list(self.category_map.keys())

    def get_ingredients_by_category(self, category: str) -> List[MealComponent]:
        """Get all ingredients in a category."""
        return [i for i in self.ingredients if i.category == category]

    def save(self, path: Path) -> None:
        """Save model to disk."""
        model_data = {
            "ingredients": self.ingredients,
            "scaler": self.scaler,
            "version": self.MODEL_VERSION,
        }
        with open(path, "wb") as f:
            pickle.dump(model_data, f)

    def load(self, path: Path) -> None:
        """Load model from disk."""
        with open(path, "rb") as f:
            model_data = pickle.load(f)

        self.ingredients = model_data["ingredients"]
        self.scaler = model_data["scaler"]
        self._fit_feature_matrix()
