"""
Tests for Ingredient Substitution ML model.
"""
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.data.models import MealComponent, NutritionInfo
from src.ml.models.ingredient_substitution import (
    IngredientSubstitutionModel,
    SubstitutionSuggestion,
)


class TestIngredientSubstitutionModel:
    """Tests for IngredientSubstitutionModel."""

    def setup_method(self):
        """Set up test fixtures."""
        self.model = IngredientSubstitutionModel()

    def test_initialization(self):
        """Test model initialization with default ingredients."""
        assert self.model is not None
        assert len(self.model.ingredients) > 0
        assert self.model.is_fitted

    def test_categories(self):
        """Test that all categories are available."""
        categories = self.model.get_categories()

        assert "protein" in categories
        assert "carb" in categories
        assert "vegetable" in categories
        assert "fat" in categories

    def test_get_ingredients_by_category(self):
        """Test filtering ingredients by category."""
        proteins = self.model.get_ingredients_by_category("protein")

        assert len(proteins) > 0
        assert all(p.category == "protein" for p in proteins)

    def test_find_substitutes_protein(self):
        """Test finding protein substitutes."""
        chicken = MealComponent(
            name="Chicken Breast",
            category="protein",
            nutrition=NutritionInfo(calories=280, protein_g=52, carbs_g=0, fat_g=6),
            portion_size="6 oz",
        )

        suggestions = self.model.find_substitutes(chicken, top_k=5)

        assert len(suggestions) > 0
        assert all(isinstance(s, SubstitutionSuggestion) for s in suggestions)
        assert all(s.category_match for s in suggestions)

    def test_find_substitutes_same_category(self):
        """Test same_category_only parameter."""
        chicken = MealComponent(
            name="Chicken Breast",
            category="protein",
            nutrition=NutritionInfo(calories=280, protein_g=52),
        )

        # Same category only
        same_cat = self.model.find_substitutes(
            chicken, top_k=5, same_category_only=True
        )
        assert all(s.substitute.category == "protein" for s in same_cat)

        # Any category
        any_cat = self.model.find_substitutes(
            chicken, top_k=10, same_category_only=False
        )
        categories = set(s.substitute.category for s in any_cat)
        # Could have multiple categories
        assert len(categories) >= 1

    def test_find_substitutes_calorie_filter(self):
        """Test max calorie difference filter."""
        chicken = MealComponent(
            name="Chicken Breast",
            category="protein",
            nutrition=NutritionInfo(calories=280, protein_g=52),
        )

        suggestions = self.model.find_substitutes(
            chicken, top_k=10, max_calorie_diff=30
        )

        for s in suggestions:
            assert abs(s.calorie_difference) <= 30

    def test_similarity_scores(self):
        """Test that similarity scores are calculated."""
        chicken = MealComponent(
            name="Chicken Breast",
            category="protein",
            nutrition=NutritionInfo(calories=280, protein_g=52),
        )

        suggestions = self.model.find_substitutes(chicken, top_k=5)

        # Suggestions should be sorted by similarity
        for i in range(len(suggestions) - 1):
            assert suggestions[i].similarity_score >= suggestions[i + 1].similarity_score

    def test_notes_generation(self):
        """Test that helpful notes are generated."""
        chicken = MealComponent(
            name="Chicken Breast",
            category="protein",
            nutrition=NutritionInfo(calories=280, protein_g=52),
        )

        suggestions = self.model.find_substitutes(chicken, top_k=3)

        for s in suggestions:
            assert len(s.notes) > 0
            assert all(isinstance(note, str) for note in s.notes)

    def test_suggest_for_macros(self):
        """Test macro-based ingredient search."""
        # Looking for ~300 cal, 40g protein
        ingredients = self.model.suggest_for_macros(
            target_calories=300,
            target_protein=40,
            category="protein",
            top_k=5,
        )

        assert len(ingredients) > 0
        # First result should be closest to targets
        first = ingredients[0]
        assert abs(first.nutrition.calories - 300) < 100
        assert abs(first.nutrition.protein_g - 40) < 20

    def test_suggest_for_macros_any_category(self):
        """Test macro search without category filter."""
        ingredients = self.model.suggest_for_macros(
            target_calories=200,
            target_protein=5,
            category=None,  # Any category
            top_k=10,
        )

        assert len(ingredients) > 0
        categories = set(i.category for i in ingredients)
        assert len(categories) > 1  # Multiple categories

    def test_add_ingredient(self):
        """Test adding new ingredient."""
        initial_count = len(self.model.ingredients)

        new_ingredient = MealComponent(
            name="Tofu",
            category="protein",
            nutrition=NutritionInfo(calories=180, protein_g=20, carbs_g=4, fat_g=10),
            portion_size="1 cup",
            tags=["plant", "vegan"],
        )

        self.model.add_ingredient(new_ingredient)

        assert len(self.model.ingredients) == initial_count + 1
        assert "Tofu" in [i.name for i in self.model.ingredients]

    def test_excludes_self_from_substitutes(self):
        """Test that ingredient doesn't suggest itself."""
        chicken = next(
            i for i in self.model.ingredients if "Chicken" in i.name
        )

        suggestions = self.model.find_substitutes(chicken, top_k=10)

        for s in suggestions:
            assert s.substitute.name != chicken.name


class TestIngredientSubstitutionPersistence:
    """Tests for model persistence."""

    def test_save_and_load(self, tmp_path):
        """Test saving and loading model."""
        model = IngredientSubstitutionModel()

        # Add custom ingredient
        model.add_ingredient(MealComponent(
            name="Test Ingredient",
            category="protein",
            nutrition=NutritionInfo(calories=100, protein_g=10),
        ))

        # Save
        model_path = tmp_path / "test_model.pkl"
        model.save(model_path)

        # Load in new instance
        loaded_model = IngredientSubstitutionModel(model_path=model_path)

        assert len(loaded_model.ingredients) == len(model.ingredients)
        assert "Test Ingredient" in [i.name for i in loaded_model.ingredients]
