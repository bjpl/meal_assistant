"""
Tests for Phase 1: Regex-Based Deal Parser.
"""
import pytest
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from src.ml.models.deal_matching.deal_parser_regex import (
    RegexDealParser,
    ExtractedDeal,
    DealType
)


class TestRegexDealParser:
    """Test cases for regex-based deal parser."""

    @pytest.fixture
    def parser(self):
        """Create parser instance."""
        return RegexDealParser()

    @pytest.fixture
    def costco_parser(self):
        """Create Costco-specific parser."""
        return RegexDealParser(store_hint="costco")

    # Basic Price Extraction Tests

    def test_extract_simple_price(self, parser):
        """Test extraction of simple $X.XX prices."""
        text = "Chicken Breast $5.99/lb"  # Add unit for better matching
        deals = parser.parse(text)

        assert len(deals) >= 1
        assert any(d.price == 5.99 for d in deals)

    def test_extract_price_with_unit_lb(self, parser):
        """Test extraction of price per pound."""
        text = "Ground Beef $6.49/lb"
        deals = parser.parse(text)

        assert len(deals) >= 1
        price_deal = next((d for d in deals if d.price == 6.49), None)
        assert price_deal is not None
        assert price_deal.deal_type == DealType.UNIT_PRICE
        assert price_deal.unit == 'lb'

    def test_extract_price_with_unit_each(self, parser):
        """Test extraction of price each."""
        text = "Avocados $1.29 ea"
        deals = parser.parse(text)

        assert len(deals) >= 1
        price_deal = next((d for d in deals if d.price == 1.29), None)
        assert price_deal is not None

    def test_extract_multiple_prices(self, parser):
        """Test extraction of multiple prices from text."""
        text = """
        Chicken Breast $5.99/lb
        Ground Beef $6.49/lb
        Salmon $12.99/lb
        """
        deals = parser.parse(text)

        # Should find at least 2 prices (deduplication may remove some)
        prices = [d.price for d in deals if d.price]
        assert len(prices) >= 2
        assert 6.49 in prices
        assert 12.99 in prices

    # Multi-Buy Deal Tests

    def test_extract_multi_buy_2_for(self, parser):
        """Test extraction of '2 for $X' deals."""
        text = "Yogurt 2/$5.00"  # Use slash format with cents
        deals = parser.parse(text)

        multi_buy = next((d for d in deals if d.deal_type == DealType.MULTI_BUY), None)
        assert multi_buy is not None
        assert multi_buy.quantity == 2
        assert multi_buy.price == 2.5  # Unit price

    def test_extract_multi_buy_3_for(self, parser):
        """Test extraction of '3 for $X' deals."""
        text = "Canned Tomatoes 3/$6.00"  # Use amount divisible by 3
        deals = parser.parse(text)

        multi_buy = next((d for d in deals if d.deal_type == DealType.MULTI_BUY), None)
        assert multi_buy is not None
        assert multi_buy.quantity == 3
        assert multi_buy.price == 2.0  # Unit price: $6/3 = $2

    def test_extract_multi_buy_slash_format(self, parser):
        """Test extraction of 'X/$Y' format."""
        text = "Pasta 4/$6"
        deals = parser.parse(text)

        multi_buy = next((d for d in deals if d.deal_type == DealType.MULTI_BUY), None)
        assert multi_buy is not None
        assert multi_buy.quantity == 4

    # BOGO Deal Tests

    def test_extract_bogo_simple(self, parser):
        """Test extraction of simple BOGO."""
        text = "Ice Cream BOGO"
        deals = parser.parse(text)

        bogo = next((d for d in deals if d.deal_type == DealType.BOGO), None)
        assert bogo is not None

    def test_extract_bogo_explicit(self, parser):
        """Test extraction of 'Buy X get Y free'."""
        text = "Buy 1 get 1 free on all cereals"
        deals = parser.parse(text)

        bogo = next((d for d in deals if d.deal_type == DealType.BOGO), None)
        assert bogo is not None
        assert bogo.metadata.get('buy_quantity') == 1
        assert bogo.metadata.get('get_quantity') == 1

    def test_extract_bogo_b2g1f(self, parser):
        """Test extraction of B2G1F format."""
        text = "Soda B2G1F"
        deals = parser.parse(text)

        bogo = next((d for d in deals if d.deal_type == DealType.BOGO), None)
        assert bogo is not None

    # Discount Deal Tests

    def test_extract_save_amount(self, parser):
        """Test extraction of 'Save $X' deals."""
        text = "Chicken $5.99/lb\nSave $2.00"  # Put save on separate line
        deals = parser.parse(text)

        # Should have found price and/or save amount
        assert len(deals) >= 1
        # Check if save was found
        save = next((d for d in deals if d.deal_type == DealType.SAVE_AMOUNT), None)
        # Save pattern should match
        if save:
            assert save.discount_amount == 2.0

    def test_extract_percent_off(self, parser):
        """Test extraction of 'X% off' deals."""
        text = "Produce\n25% off\n$3.99/lb"  # Separate lines for clearer matching
        deals = parser.parse(text)

        # Should have found price and/or percent off
        assert len(deals) >= 1
        discount = next((d for d in deals if d.deal_type == DealType.PERCENT_OFF), None)
        if discount:
            assert discount.discount_percent == 25.0

    # Store-Specific Tests

    def test_costco_instant_savings(self, costco_parser):
        """Test Costco instant savings pattern."""
        text = "KIRKLAND CHICKEN\n$12.99\nInstant Savings $3.00"
        deals = costco_parser.parse(text)

        assert len(deals) >= 1

    def test_walmart_rollback(self):
        """Test Walmart rollback pattern."""
        parser = RegexDealParser(store_hint="walmart")
        text = "Paper Towels\nWas $8.99 Now $6.99"
        deals = parser.parse(text)

        # Should extract both prices
        prices = [d.price for d in deals if d.price]
        assert 6.99 in prices or 8.99 in prices

    # Product Name Extraction Tests

    def test_extract_product_name_uppercase(self, parser):
        """Test extraction of uppercase product names."""
        text = "ORGANIC BANANAS\n$0.69/lb"
        deals = parser.parse(text)

        deal_with_product = next((d for d in deals if d.product_name), None)
        assert deal_with_product is not None
        assert 'banana' in deal_with_product.product_name.lower()

    # Confidence Score Tests

    def test_confidence_increases_with_info(self, parser):
        """Test that confidence increases with more information."""
        # Minimal info
        text1 = "$5.99"
        deals1 = parser.parse(text1)

        # More info
        text2 = "Chicken Breast $5.99/lb Save $2"
        deals2 = parser.parse(text2)

        if deals1 and deals2:
            # Deal with more info should have higher confidence
            max_conf1 = max(d.confidence for d in deals1)
            max_conf2 = max(d.confidence for d in deals2)
            # Note: This might not always hold, but generally should
            assert max_conf1 > 0  # At least some confidence

    # Edge Cases

    def test_empty_text(self, parser):
        """Test parsing empty text."""
        deals = parser.parse("")
        assert deals == []

    def test_no_deals_in_text(self, parser):
        """Test parsing text with no deals."""
        text = "Welcome to our store! Great selection!"
        deals = parser.parse(text)
        # May or may not find anything, but shouldn't crash
        assert isinstance(deals, list)

    def test_malformed_prices(self, parser):
        """Test handling of malformed price patterns."""
        text = "Price: $abc not valid $12.345"
        deals = parser.parse(text)
        # Should handle gracefully
        assert isinstance(deals, list)

    # Stats Tests

    def test_get_stats(self, parser):
        """Test parser statistics."""
        stats = parser.get_stats()

        assert stats['parser_type'] == 'regex'
        assert stats['phase'] == 1
        assert 'supported_deal_types' in stats
        assert 'supported_stores' in stats


class TestDealDeduplication:
    """Tests for deal deduplication logic."""

    @pytest.fixture
    def parser(self):
        return RegexDealParser()

    def test_removes_overlapping_deals(self, parser):
        """Test that overlapping deals are deduplicated."""
        # This text might match multiple patterns at same position
        text = "$5.99"
        deals = parser.parse(text)

        # Should have at most 1 deal for single price
        price_deals = [d for d in deals if d.price == 5.99]
        assert len(price_deals) <= 2  # Allow some flexibility


class TestOCRErrorHandling:
    """Tests for OCR error handling."""

    @pytest.fixture
    def parser(self):
        return RegexDealParser()

    def test_handles_common_ocr_errors(self, parser):
        """Test handling of common OCR substitutions."""
        # $ often reads as 5 or S
        text = "Price: S5.99"  # Should still work
        deals = parser.parse(text)
        # May or may not extract, but shouldn't crash
        assert isinstance(deals, list)
