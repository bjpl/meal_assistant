"""
Phase 2: Template-Based Deal Parser.
Uses learned store-specific layouts to improve extraction accuracy.
Expected accuracy: 50-60%
"""
import re
import json
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path

from .deal_parser_regex import ExtractedDeal, DealType, RegexDealParser


@dataclass
class LayoutRegion:
    """Defines a region in the ad layout."""
    name: str
    x_start: float = 0.0  # Percentage of page width
    x_end: float = 1.0
    y_start: float = 0.0  # Percentage of page height
    y_end: float = 1.0
    contains: str = "deals"  # deals, header, footer, image


@dataclass
class StoreTemplate:
    """Template for a specific store's ad format."""
    store_name: str
    layout_type: str = "grid"  # grid, list, mixed
    regions: List[LayoutRegion] = field(default_factory=list)

    # Learned patterns from corrections
    price_pattern: Optional[str] = None
    product_pattern: Optional[str] = None
    deal_separator: str = "\n"

    # Layout-specific settings
    columns: int = 1
    has_header: bool = True
    has_member_prices: bool = False

    # Confidence from training
    sample_count: int = 0
    accuracy: float = 0.0
    last_updated: Optional[str] = None

    # Custom patterns learned from corrections
    custom_patterns: List[Dict[str, str]] = field(default_factory=list)


class TemplateDealParser:
    """
    Phase 2 deal parser using learned templates.

    Improves on regex parser by:
    1. Learning store-specific layouts
    2. Using coordinate-based extraction
    3. Building custom patterns from corrections

    Expected accuracy: 50-60%
    """

    # Default templates for common stores
    DEFAULT_TEMPLATES = {
        'costco': StoreTemplate(
            store_name='costco',
            layout_type='grid',
            columns=2,
            has_header=True,
            has_member_prices=True,
            regions=[
                LayoutRegion('header', 0, 1, 0, 0.1, 'header'),
                LayoutRegion('main_deals', 0, 1, 0.1, 0.85, 'deals'),
                LayoutRegion('footer', 0, 1, 0.85, 1.0, 'footer'),
            ],
            price_pattern=r'\$(\d+\.\d{2})\s+(?:after|instant)',
            product_pattern=r'^([A-Z][A-Z\s]{5,40})$',
        ),
        'whole_foods': StoreTemplate(
            store_name='whole_foods',
            layout_type='mixed',
            columns=3,
            has_header=True,
            has_member_prices=True,
            regions=[
                LayoutRegion('header', 0, 1, 0, 0.15, 'header'),
                LayoutRegion('prime_deals', 0, 0.5, 0.15, 0.5, 'deals'),
                LayoutRegion('regular_deals', 0.5, 1, 0.15, 0.85, 'deals'),
                LayoutRegion('footer', 0, 1, 0.85, 1.0, 'footer'),
            ],
            price_pattern=r'(?:sale|prime)\s*\$(\d+\.\d{2})',
        ),
        'safeway': StoreTemplate(
            store_name='safeway',
            layout_type='grid',
            columns=3,
            has_header=True,
            has_member_prices=True,
            regions=[
                LayoutRegion('header', 0, 1, 0, 0.12, 'header'),
                LayoutRegion('main_grid', 0, 1, 0.12, 0.88, 'deals'),
                LayoutRegion('footer', 0, 1, 0.88, 1.0, 'footer'),
            ],
            price_pattern=r'club\s+price\s+\$(\d+\.\d{2})',
        ),
        'walmart': StoreTemplate(
            store_name='walmart',
            layout_type='list',
            columns=1,
            has_header=True,
            has_member_prices=False,
            regions=[
                LayoutRegion('header', 0, 1, 0, 0.1, 'header'),
                LayoutRegion('deals', 0, 1, 0.1, 0.9, 'deals'),
                LayoutRegion('footer', 0, 1, 0.9, 1.0, 'footer'),
            ],
            price_pattern=r'(?:rollback|was\s+\$\d+\.\d{2}\s+now)\s*\$(\d+\.\d{2})',
        ),
        'kroger': StoreTemplate(
            store_name='kroger',
            layout_type='grid',
            columns=4,
            has_header=True,
            has_member_prices=True,
            regions=[
                LayoutRegion('header', 0, 1, 0, 0.1, 'header'),
                LayoutRegion('digital_coupons', 0, 0.3, 0.1, 0.5, 'deals'),
                LayoutRegion('main_deals', 0.3, 1, 0.1, 0.9, 'deals'),
                LayoutRegion('footer', 0, 1, 0.9, 1.0, 'footer'),
            ],
        ),
    }

    def __init__(self, templates_path: Optional[Path] = None):
        """
        Initialize template parser.

        Args:
            templates_path: Path to saved templates JSON
        """
        self.templates: Dict[str, StoreTemplate] = {}
        self.templates_path = templates_path
        self.regex_parser = RegexDealParser()

        # Load default templates
        for store, template in self.DEFAULT_TEMPLATES.items():
            self.templates[store] = template

        # Load custom templates if available
        if templates_path and templates_path.exists():
            self._load_templates()

    def _load_templates(self):
        """Load templates from file."""
        try:
            with open(self.templates_path, 'r') as f:
                data = json.load(f)
                for store, template_data in data.items():
                    regions = [
                        LayoutRegion(**r) for r in template_data.pop('regions', [])
                    ]
                    self.templates[store] = StoreTemplate(
                        **template_data,
                        regions=regions
                    )
        except Exception as e:
            print(f"Warning: Could not load templates: {e}")

    def save_templates(self):
        """Save templates to file."""
        if not self.templates_path:
            return

        data = {}
        for store, template in self.templates.items():
            data[store] = {
                'store_name': template.store_name,
                'layout_type': template.layout_type,
                'columns': template.columns,
                'has_header': template.has_header,
                'has_member_prices': template.has_member_prices,
                'price_pattern': template.price_pattern,
                'product_pattern': template.product_pattern,
                'deal_separator': template.deal_separator,
                'sample_count': template.sample_count,
                'accuracy': template.accuracy,
                'last_updated': template.last_updated,
                'custom_patterns': template.custom_patterns,
                'regions': [
                    {
                        'name': r.name,
                        'x_start': r.x_start,
                        'x_end': r.x_end,
                        'y_start': r.y_start,
                        'y_end': r.y_end,
                        'contains': r.contains,
                    }
                    for r in template.regions
                ]
            }

        self.templates_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.templates_path, 'w') as f:
            json.dump(data, f, indent=2)

    def parse(
        self,
        text: str,
        store: Optional[str] = None,
        coordinates: Optional[List[Dict[str, Any]]] = None
    ) -> List[ExtractedDeal]:
        """
        Parse ad text using template-based extraction.

        Args:
            text: OCR text from ad
            store: Store name to use template
            coordinates: Optional OCR coordinates for each text block

        Returns:
            List of extracted deals
        """
        deals = []
        template = self._get_template(store)

        if template:
            # Use template-based extraction
            if coordinates:
                deals = self._extract_with_coordinates(text, template, coordinates)
            else:
                deals = self._extract_with_template(text, template)

            # Apply custom patterns learned from corrections
            custom_deals = self._apply_custom_patterns(text, template)
            deals.extend(custom_deals)

        # Fall back to regex parser for unmatched text
        regex_deals = self.regex_parser.parse(text)

        # Merge results, preferring template-based extraction
        merged_deals = self._merge_deals(deals, regex_deals)

        # Calculate confidence
        merged_deals = self._calculate_confidence(merged_deals, template)

        return merged_deals

    def _get_template(self, store: Optional[str]) -> Optional[StoreTemplate]:
        """Get template for store."""
        if not store:
            return None

        store_lower = store.lower()

        # Exact match
        if store_lower in self.templates:
            return self.templates[store_lower]

        # Fuzzy match
        for key in self.templates:
            if key in store_lower or store_lower in key:
                return self.templates[key]

        return None

    def _extract_with_template(
        self,
        text: str,
        template: StoreTemplate
    ) -> List[ExtractedDeal]:
        """Extract deals using template patterns."""
        deals = []

        # Split text by layout type
        if template.layout_type == 'grid':
            blocks = self._split_grid(text, template.columns)
        elif template.layout_type == 'list':
            blocks = text.split(template.deal_separator)
        else:
            blocks = self._split_mixed(text)

        # Extract from each block
        for i, block in enumerate(blocks):
            block_deals = self._extract_from_block(block, template, i)
            deals.extend(block_deals)

        return deals

    def _extract_with_coordinates(
        self,
        text: str,
        template: StoreTemplate,
        coordinates: List[Dict[str, Any]]
    ) -> List[ExtractedDeal]:
        """Extract deals using OCR coordinates."""
        deals = []

        # Group text blocks by region
        region_texts = {r.name: [] for r in template.regions}

        for coord in coordinates:
            x = coord.get('x', 0)
            y = coord.get('y', 0)
            block_text = coord.get('text', '')

            # Find which region this belongs to
            for region in template.regions:
                if (region.x_start <= x <= region.x_end and
                    region.y_start <= y <= region.y_end):
                    if region.contains == 'deals':
                        region_texts[region.name].append({
                            'text': block_text,
                            'x': x,
                            'y': y,
                        })
                    break

        # Process each region
        for region_name, blocks in region_texts.items():
            if not blocks:
                continue

            # Sort by position (top-left to bottom-right)
            blocks.sort(key=lambda b: (b['y'], b['x']))

            # Group adjacent blocks
            current_deal_text = []
            last_y = -1

            for block in blocks:
                if last_y >= 0 and abs(block['y'] - last_y) > 0.05:
                    # New row, process accumulated text
                    if current_deal_text:
                        combined = ' '.join(current_deal_text)
                        block_deals = self._extract_from_block(combined, template, 0)
                        deals.extend(block_deals)
                    current_deal_text = []

                current_deal_text.append(block['text'])
                last_y = block['y']

            # Process remaining text
            if current_deal_text:
                combined = ' '.join(current_deal_text)
                block_deals = self._extract_from_block(combined, template, 0)
                deals.extend(block_deals)

        return deals

    def _extract_from_block(
        self,
        block: str,
        template: StoreTemplate,
        block_index: int
    ) -> List[ExtractedDeal]:
        """Extract deals from a single block of text."""
        deals = []

        if not block.strip():
            return deals

        # Try template-specific patterns first
        product_name = None
        price = None

        # Extract product name
        if template.product_pattern:
            match = re.search(template.product_pattern, block, re.MULTILINE)
            if match:
                product_name = match.group(1).strip()

        # Extract price
        if template.price_pattern:
            match = re.search(template.price_pattern, block, re.IGNORECASE)
            if match:
                price = float(match.group(1))

        # Fall back to generic price pattern
        if price is None:
            price_match = re.search(r'\$(\d+\.\d{2})', block)
            if price_match:
                price = float(price_match.group(1))

        # Fall back to generic product extraction
        if product_name is None:
            # Look for capitalized words at start of block
            lines = block.strip().split('\n')
            for line in lines[:3]:
                if re.match(r'^[A-Z][A-Za-z\s\']{2,30}$', line.strip()):
                    product_name = line.strip()
                    break

        if price is not None:
            deals.append(ExtractedDeal(
                raw_text=block[:100],  # Limit length
                deal_type=DealType.PRICE,
                product_name=product_name,
                price=price,
                metadata={
                    'source': 'template',
                    'store': template.store_name,
                    'block_index': block_index,
                }
            ))

        return deals

    def _apply_custom_patterns(
        self,
        text: str,
        template: StoreTemplate
    ) -> List[ExtractedDeal]:
        """Apply custom patterns learned from corrections."""
        deals = []

        for pattern_info in template.custom_patterns:
            pattern = pattern_info.get('pattern')
            deal_type = pattern_info.get('deal_type', 'price')

            if not pattern:
                continue

            try:
                regex = re.compile(pattern, re.IGNORECASE)
                for match in regex.finditer(text):
                    groups = match.groups()

                    deal = ExtractedDeal(
                        raw_text=match.group(0),
                        deal_type=DealType(deal_type) if deal_type in [e.value for e in DealType] else DealType.PRICE,
                        metadata={
                            'source': 'custom_pattern',
                            'pattern_id': pattern_info.get('id'),
                        }
                    )

                    # Try to extract price from groups
                    for group in groups:
                        try:
                            price = float(group)
                            if 0.01 <= price <= 1000:
                                deal.price = price
                                break
                        except (ValueError, TypeError):
                            pass

                    if deal.price:
                        deals.append(deal)

            except re.error:
                continue

        return deals

    def _split_grid(self, text: str, columns: int) -> List[str]:
        """Split text assuming grid layout."""
        lines = text.split('\n')
        blocks = []
        current_block = []

        for line in lines:
            if not line.strip():
                if current_block:
                    blocks.append('\n'.join(current_block))
                    current_block = []
            else:
                current_block.append(line)

        if current_block:
            blocks.append('\n'.join(current_block))

        return blocks

    def _split_mixed(self, text: str) -> List[str]:
        """Split text with mixed layout."""
        # Use double newlines as separators
        blocks = re.split(r'\n{2,}', text)
        return [b.strip() for b in blocks if b.strip()]

    def _merge_deals(
        self,
        template_deals: List[ExtractedDeal],
        regex_deals: List[ExtractedDeal]
    ) -> List[ExtractedDeal]:
        """Merge template and regex deals, avoiding duplicates."""
        merged = list(template_deals)

        for regex_deal in regex_deals:
            is_duplicate = False

            for template_deal in template_deals:
                # Check if same price and similar product
                if (template_deal.price == regex_deal.price and
                    self._similar_products(template_deal.product_name, regex_deal.product_name)):
                    is_duplicate = True
                    break

            if not is_duplicate:
                merged.append(regex_deal)

        return merged

    def _similar_products(self, name1: Optional[str], name2: Optional[str]) -> bool:
        """Check if two product names are similar."""
        if not name1 or not name2:
            return False

        # Normalize
        n1 = name1.lower().strip()
        n2 = name2.lower().strip()

        # Exact match
        if n1 == n2:
            return True

        # One contains the other
        if n1 in n2 or n2 in n1:
            return True

        # Word overlap
        words1 = set(n1.split())
        words2 = set(n2.split())
        overlap = len(words1 & words2)

        return overlap >= min(len(words1), len(words2)) * 0.5

    def _calculate_confidence(
        self,
        deals: List[ExtractedDeal],
        template: Optional[StoreTemplate]
    ) -> List[ExtractedDeal]:
        """Calculate confidence scores."""
        for deal in deals:
            base_confidence = 0.4  # Higher base for template

            # Source bonus
            if deal.metadata.get('source') == 'template':
                base_confidence += 0.15
            elif deal.metadata.get('source') == 'custom_pattern':
                base_confidence += 0.2

            # Completeness bonus
            if deal.product_name:
                base_confidence += 0.15
            if deal.price and 0.01 <= deal.price <= 500:
                base_confidence += 0.1

            # Template accuracy bonus
            if template and template.accuracy > 0:
                base_confidence += template.accuracy * 0.1

            deal.confidence = min(base_confidence, 1.0)

        return deals

    def learn_from_correction(
        self,
        store: str,
        original_deal: ExtractedDeal,
        corrected_deal: ExtractedDeal,
        raw_text: str
    ):
        """
        Learn from user correction to improve template.

        Args:
            store: Store name
            original_deal: What the parser extracted
            corrected_deal: What the user corrected it to
            raw_text: Original text around the deal
        """
        store_lower = store.lower()

        # Create template if doesn't exist
        if store_lower not in self.templates:
            self.templates[store_lower] = StoreTemplate(store_name=store_lower)

        template = self.templates[store_lower]
        template.sample_count += 1

        # Try to learn a new pattern
        if corrected_deal.price and original_deal.price != corrected_deal.price:
            # Price was wrong - try to find correct pattern
            price_str = f"{corrected_deal.price:.2f}"

            # Find where the correct price appears in text
            escaped_price = re.escape(price_str)
            patterns_to_try = [
                rf'\$({escaped_price})',
                rf'({escaped_price})\s*(?:dollars?|usd)',
                rf'price[:\s]+\$?({escaped_price})',
            ]

            for pattern in patterns_to_try:
                if re.search(pattern, raw_text, re.IGNORECASE):
                    # This pattern works
                    template.custom_patterns.append({
                        'id': f"price_{template.sample_count}",
                        'pattern': pattern,
                        'deal_type': 'price',
                        'learned_from': corrected_deal.raw_text[:50],
                    })
                    break

        # Update timestamp
        from datetime import datetime
        template.last_updated = datetime.now().isoformat()

        # Save templates
        self.save_templates()

    def update_template_accuracy(self, store: str, accuracy: float):
        """Update template accuracy metric."""
        store_lower = store.lower()
        if store_lower in self.templates:
            self.templates[store_lower].accuracy = accuracy
            self.save_templates()

    def get_stats(self) -> Dict[str, Any]:
        """Get parser statistics."""
        return {
            'parser_type': 'template',
            'phase': 2,
            'expected_accuracy': '50-60%',
            'templates_loaded': len(self.templates),
            'templates': {
                store: {
                    'layout_type': t.layout_type,
                    'sample_count': t.sample_count,
                    'accuracy': t.accuracy,
                    'custom_patterns': len(t.custom_patterns),
                }
                for store, t in self.templates.items()
            }
        }
