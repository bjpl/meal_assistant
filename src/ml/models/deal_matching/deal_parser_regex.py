"""
Phase 1: Regex-Based Deal Parser.
Extracts deals from OCR text using pattern matching.
Expected accuracy: 30-40%
"""
import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum


class DealType(Enum):
    """Types of deals that can be extracted."""
    PRICE = "price"                     # $X.XX
    UNIT_PRICE = "unit_price"           # $X.XX/lb or $X.XX/ea
    MULTI_BUY = "multi_buy"             # 2 for $X
    BOGO = "bogo"                       # Buy X get Y free
    SAVE_AMOUNT = "save_amount"         # Save $X
    PERCENT_OFF = "percent_off"         # XX% off
    MEMBER_PRICE = "member_price"       # Member price $X.XX
    UNKNOWN = "unknown"


@dataclass
class ExtractedDeal:
    """Represents an extracted deal from ad text."""
    raw_text: str
    deal_type: DealType
    product_name: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    quantity: Optional[int] = None
    discount_amount: Optional[float] = None
    discount_percent: Optional[float] = None
    original_price: Optional[float] = None
    confidence: float = 0.0
    position: Tuple[int, int] = (0, 0)  # Start, end position in text
    metadata: Dict[str, Any] = field(default_factory=dict)


class RegexDealParser:
    """
    Phase 1 deal parser using regex patterns.

    Handles common deal formats from grocery store ads:
    - Simple prices: $4.99, $12.99
    - Unit prices: $3.99/lb, $1.99/ea
    - Multi-buy: 2 for $5, 3 for $10
    - BOGO: Buy 1 get 1 free, B2G1F
    - Discounts: Save $2, 25% off

    Expected accuracy: 30-40% due to OCR errors and varied formats.
    """

    # Price patterns - more specific patterns first
    PRICE_PATTERNS = [
        # Price with trailing info: $X.XX ea, $X.XX/lb (more specific first)
        (r'\$(\d+(?:\.\d{2})?)\s*/\s*(?:lb|pound|lbs)', 'unit_price_lb'),
        (r'\$(\d+(?:\.\d{2})?)\s*/\s*(?:oz|ounce)', 'unit_price_oz'),
        (r'\$(\d+(?:\.\d{2})?)\s*/\s*(?:kg|kilogram)', 'unit_price_kg'),
        (r'\$(\d+(?:\.\d{2})?)\s*(?:ea|each)', 'unit_price_each'),
        # Standard price: $X.XX or $X (generic last)
        (r'\$(\d+(?:\.\d{2})?)', 'price'),
    ]

    # Multi-buy patterns
    MULTI_BUY_PATTERNS = [
        # "2 for $X" or "2/$X"
        (r'(\d+)\s*(?:for|/)\s*\$(\d+(?:\.\d{2})?)', 'multi_buy'),
        # "Buy 2 for $X"
        (r'buy\s+(\d+)\s+(?:for|@)\s*\$(\d+(?:\.\d{2})?)', 'multi_buy'),
    ]

    # BOGO patterns
    BOGO_PATTERNS = [
        # "Buy X get Y free"
        (r'buy\s+(\d+)\s+get\s+(\d+)\s+free', 'bogo'),
        # "BOGO" or "B1G1F"
        (r'b(?:uy\s*)?(\d)g(?:et\s*)?(\d)f(?:ree)?', 'bogo_short'),
        # "BOGO"
        (r'\bbogo\b', 'bogo_simple'),
    ]

    # Discount patterns
    DISCOUNT_PATTERNS = [
        # "Save $X"
        (r'save\s+\$(\d+(?:\.\d{2})?)', 'save_amount'),
        # "XX% off"
        (r'(\d+(?:\.\d{1,2})?)\s*%\s*off', 'percent_off'),
        # "$X off"
        (r'\$(\d+(?:\.\d{2})?)\s*off', 'dollar_off'),
    ]

    # Product name patterns (challenging due to OCR)
    PRODUCT_PATTERNS = [
        # All caps product names (common in ads)
        (r'([A-Z][A-Z\s]{3,30})', 'caps_product'),
        # Mixed case product names before price
        (r'([A-Za-z][A-Za-z\s\']{2,30})\s*\$', 'product_before_price'),
        # Product names after bullet or dash
        (r'[•\-]\s*([A-Za-z][A-Za-z\s\']{2,30})', 'bulleted_product'),
    ]

    # Store-specific patterns
    STORE_PATTERNS = {
        'costco': [
            (r'(?:manufacturer\'s?\s+)?instant\s+savings?\s+\$(\d+(?:\.\d{2})?)', 'instant_savings'),
            (r'after\s+(?:instant\s+)?savings?\s+\$(\d+(?:\.\d{2})?)', 'after_savings'),
        ],
        'whole_foods': [
            (r'prime\s+member\s+deal[:\s]+\$(\d+(?:\.\d{2})?)', 'prime_deal'),
            (r'sale[:\s]+\$(\d+(?:\.\d{2})?)', 'sale_price'),
        ],
        'safeway': [
            (r'club\s+price[:\s]+\$(\d+(?:\.\d{2})?)', 'club_price'),
            (r'just\s+for\s+u[:\s]+\$(\d+(?:\.\d{2})?)', 'j4u_price'),
        ],
        'walmart': [
            (r'rollback[:\s]+\$(\d+(?:\.\d{2})?)', 'rollback'),
            (r'was\s+\$(\d+(?:\.\d{2})?)\s*now\s+\$(\d+(?:\.\d{2})?)', 'was_now'),
        ],
    }

    def __init__(self, store_hint: Optional[str] = None):
        """
        Initialize regex parser.

        Args:
            store_hint: Optional store name to use store-specific patterns
        """
        self.store_hint = store_hint.lower() if store_hint else None
        self._compile_patterns()

    def _compile_patterns(self):
        """Compile all regex patterns for efficiency."""
        self.compiled_patterns = {}

        for name, patterns in [
            ('price', self.PRICE_PATTERNS),
            ('multi_buy', self.MULTI_BUY_PATTERNS),
            ('bogo', self.BOGO_PATTERNS),
            ('discount', self.DISCOUNT_PATTERNS),
            ('product', self.PRODUCT_PATTERNS),
        ]:
            self.compiled_patterns[name] = [
                (re.compile(pattern, re.IGNORECASE), label)
                for pattern, label in patterns
            ]

        # Add store-specific patterns
        self.compiled_store_patterns = {}
        for store, patterns in self.STORE_PATTERNS.items():
            self.compiled_store_patterns[store] = [
                (re.compile(pattern, re.IGNORECASE), label)
                for pattern, label in patterns
            ]

    def parse(self, text: str) -> List[ExtractedDeal]:
        """
        Parse OCR text and extract deals.

        Args:
            text: Raw OCR text from ad

        Returns:
            List of extracted deals
        """
        deals = []

        # Clean text
        cleaned_text = self._clean_text(text)

        # Extract by deal type
        deals.extend(self._extract_prices(cleaned_text))
        deals.extend(self._extract_multi_buy(cleaned_text))
        deals.extend(self._extract_bogo(cleaned_text))
        deals.extend(self._extract_discounts(cleaned_text))

        # Apply store-specific patterns
        if self.store_hint and self.store_hint in self.compiled_store_patterns:
            deals.extend(self._extract_store_specific(cleaned_text))

        # Try to associate products with deals
        deals = self._associate_products(cleaned_text, deals)

        # Remove duplicates and overlapping deals
        deals = self._deduplicate_deals(deals)

        # Calculate confidence scores
        deals = self._calculate_confidence(deals)

        return deals

    def _clean_text(self, text: str) -> str:
        """Clean and normalize OCR text."""
        # Common OCR error corrections
        # Note: Avoid replacing common characters like '5' that break valid prices
        corrections = {
            r'¢': ' cents',      # Normalize cents
            r'\s{2,}': ' ',      # Multiple spaces to single
            r'\n{3,}': '\n\n',   # Multiple newlines to double
        }

        cleaned = text
        for pattern, replacement in corrections.items():
            cleaned = re.sub(pattern, replacement, cleaned)

        return cleaned.strip()

    def _extract_prices(self, text: str) -> List[ExtractedDeal]:
        """Extract simple price deals."""
        deals = []

        for regex, label in self.compiled_patterns['price']:
            for match in regex.finditer(text):
                price = float(match.group(1))

                deal_type = DealType.PRICE
                unit = None

                if 'lb' in label:
                    deal_type = DealType.UNIT_PRICE
                    unit = 'lb'
                elif 'oz' in label:
                    deal_type = DealType.UNIT_PRICE
                    unit = 'oz'
                elif 'each' in label:
                    deal_type = DealType.UNIT_PRICE
                    unit = 'ea'
                elif 'kg' in label:
                    deal_type = DealType.UNIT_PRICE
                    unit = 'kg'

                deals.append(ExtractedDeal(
                    raw_text=match.group(0),
                    deal_type=deal_type,
                    price=price,
                    unit=unit,
                    position=(match.start(), match.end()),
                    metadata={'pattern': label}
                ))

        return deals

    def _extract_multi_buy(self, text: str) -> List[ExtractedDeal]:
        """Extract multi-buy deals like 2 for $5."""
        deals = []

        for regex, label in self.compiled_patterns['multi_buy']:
            for match in regex.finditer(text):
                quantity = int(match.group(1))
                total_price = float(match.group(2))

                deals.append(ExtractedDeal(
                    raw_text=match.group(0),
                    deal_type=DealType.MULTI_BUY,
                    price=total_price / quantity,  # Unit price
                    quantity=quantity,
                    position=(match.start(), match.end()),
                    metadata={
                        'pattern': label,
                        'total_price': total_price,
                    }
                ))

        return deals

    def _extract_bogo(self, text: str) -> List[ExtractedDeal]:
        """Extract BOGO deals."""
        deals = []

        for regex, label in self.compiled_patterns['bogo']:
            for match in regex.finditer(text):
                buy_qty = 1
                get_qty = 1

                if label == 'bogo':
                    buy_qty = int(match.group(1))
                    get_qty = int(match.group(2))
                elif label == 'bogo_short':
                    buy_qty = int(match.group(1))
                    get_qty = int(match.group(2))
                # bogo_simple defaults to 1/1

                deals.append(ExtractedDeal(
                    raw_text=match.group(0),
                    deal_type=DealType.BOGO,
                    quantity=buy_qty,
                    position=(match.start(), match.end()),
                    metadata={
                        'pattern': label,
                        'buy_quantity': buy_qty,
                        'get_quantity': get_qty,
                    }
                ))

        return deals

    def _extract_discounts(self, text: str) -> List[ExtractedDeal]:
        """Extract discount deals."""
        deals = []

        for regex, label in self.compiled_patterns['discount']:
            for match in regex.finditer(text):
                if label == 'save_amount' or label == 'dollar_off':
                    amount = float(match.group(1))
                    deals.append(ExtractedDeal(
                        raw_text=match.group(0),
                        deal_type=DealType.SAVE_AMOUNT,
                        discount_amount=amount,
                        position=(match.start(), match.end()),
                        metadata={'pattern': label}
                    ))
                elif label == 'percent_off':
                    percent = float(match.group(1))
                    deals.append(ExtractedDeal(
                        raw_text=match.group(0),
                        deal_type=DealType.PERCENT_OFF,
                        discount_percent=percent,
                        position=(match.start(), match.end()),
                        metadata={'pattern': label}
                    ))

        return deals

    def _extract_store_specific(self, text: str) -> List[ExtractedDeal]:
        """Extract store-specific deals."""
        deals = []

        if self.store_hint not in self.compiled_store_patterns:
            return deals

        for regex, label in self.compiled_store_patterns[self.store_hint]:
            for match in regex.finditer(text):
                if label == 'was_now':
                    was_price = float(match.group(1))
                    now_price = float(match.group(2))
                    deals.append(ExtractedDeal(
                        raw_text=match.group(0),
                        deal_type=DealType.PRICE,
                        price=now_price,
                        original_price=was_price,
                        discount_amount=was_price - now_price,
                        position=(match.start(), match.end()),
                        metadata={'pattern': label, 'store': self.store_hint}
                    ))
                else:
                    price = float(match.group(1))
                    deals.append(ExtractedDeal(
                        raw_text=match.group(0),
                        deal_type=DealType.MEMBER_PRICE if 'prime' in label or 'club' in label else DealType.PRICE,
                        price=price,
                        position=(match.start(), match.end()),
                        metadata={'pattern': label, 'store': self.store_hint}
                    ))

        return deals

    def _associate_products(self, text: str, deals: List[ExtractedDeal]) -> List[ExtractedDeal]:
        """Try to associate product names with deals."""
        # Extract potential product names
        product_candidates = []

        for regex, label in self.compiled_patterns['product']:
            for match in regex.finditer(text):
                product_candidates.append({
                    'name': match.group(1).strip(),
                    'position': (match.start(), match.end()),
                    'label': label,
                })

        # Associate products with nearby deals
        for deal in deals:
            deal_start, deal_end = deal.position

            # Find closest product within 100 characters
            closest_product = None
            min_distance = 100

            for product in product_candidates:
                prod_start, prod_end = product['position']

                # Check if product is before the deal
                if prod_end <= deal_start:
                    distance = deal_start - prod_end
                    if distance < min_distance:
                        min_distance = distance
                        closest_product = product

            if closest_product:
                deal.product_name = self._clean_product_name(closest_product['name'])

        return deals

    def _clean_product_name(self, name: str) -> str:
        """Clean extracted product name."""
        # Remove extra whitespace
        cleaned = ' '.join(name.split())

        # Remove common OCR artifacts
        cleaned = re.sub(r'[^\w\s\'-]', '', cleaned)

        # Title case
        cleaned = cleaned.title()

        return cleaned[:50]  # Limit length

    def _deduplicate_deals(self, deals: List[ExtractedDeal]) -> List[ExtractedDeal]:
        """Remove duplicate and overlapping deals."""
        if not deals:
            return deals

        # Sort by position
        sorted_deals = sorted(deals, key=lambda d: d.position[0])

        unique_deals = []
        for deal in sorted_deals:
            # Check for overlap with existing deals
            is_duplicate = False
            for existing in unique_deals:
                if self._positions_overlap(deal.position, existing.position):
                    # Keep the one with more information
                    if self._deal_info_score(deal) > self._deal_info_score(existing):
                        unique_deals.remove(existing)
                    else:
                        is_duplicate = True
                    break

            if not is_duplicate:
                unique_deals.append(deal)

        return unique_deals

    def _positions_overlap(self, pos1: Tuple[int, int], pos2: Tuple[int, int]) -> bool:
        """Check if two positions overlap."""
        return not (pos1[1] < pos2[0] or pos2[1] < pos1[0])

    def _deal_info_score(self, deal: ExtractedDeal) -> int:
        """Score deal by amount of information extracted."""
        score = 0
        if deal.product_name:
            score += 3
        if deal.price:
            score += 2
        if deal.unit:
            score += 1
        if deal.discount_amount or deal.discount_percent:
            score += 1
        if deal.original_price:
            score += 1
        return score

    def _calculate_confidence(self, deals: List[ExtractedDeal]) -> List[ExtractedDeal]:
        """Calculate confidence scores for deals."""
        for deal in deals:
            confidence = 0.3  # Base confidence for regex match

            # Increase confidence based on completeness
            if deal.product_name:
                confidence += 0.2
            if deal.price and deal.price > 0:
                confidence += 0.15
            if deal.deal_type != DealType.UNKNOWN:
                confidence += 0.1
            if deal.unit or deal.quantity:
                confidence += 0.1

            # Store-specific patterns are more reliable
            if 'store' in deal.metadata:
                confidence += 0.15

            deal.confidence = min(confidence, 1.0)

        return deals

    def get_stats(self) -> Dict[str, Any]:
        """Get parser statistics."""
        return {
            'parser_type': 'regex',
            'phase': 1,
            'expected_accuracy': '30-40%',
            'store_hint': self.store_hint,
            'supported_deal_types': [dt.value for dt in DealType],
            'supported_stores': list(self.STORE_PATTERNS.keys()),
        }
