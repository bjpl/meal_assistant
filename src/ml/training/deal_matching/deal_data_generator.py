"""
Synthetic Data Generator for Deal Matching.
Generates synthetic ad data for 5 common stores with OCR simulation.
"""
import random
import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

from ...models.deal_matching.deal_parser_regex import ExtractedDeal, DealType


@dataclass
class SyntheticAd:
    """Represents a synthetic grocery ad."""
    store: str
    raw_text: str
    deals: List[ExtractedDeal]
    ocr_quality: float = 1.0  # 1.0 = perfect, lower = more errors
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SyntheticCorrection:
    """Represents a synthetic user correction."""
    deal_id: str
    store: str
    original_deal: ExtractedDeal
    corrected_deal: ExtractedDeal
    raw_text: str
    timestamp: datetime = field(default_factory=datetime.now)


class DealDataGenerator:
    """
    Generates synthetic grocery ad data for testing and training.

    Features:
    - Store-specific ad formats
    - OCR error simulation
    - User correction simulation
    - Product catalog generation
    """

    # Common grocery products by category
    PRODUCTS = {
        'produce': [
            ('Organic Bananas', 0.69, 'lb'),
            ('Avocados', 1.29, 'ea'),
            ('Baby Spinach', 4.99, '5oz'),
            ('Roma Tomatoes', 1.49, 'lb'),
            ('Red Bell Peppers', 1.99, 'ea'),
            ('Honeycrisp Apples', 2.99, 'lb'),
            ('Russet Potatoes', 3.99, '5lb'),
            ('Broccoli Crowns', 2.49, 'lb'),
        ],
        'meat': [
            ('Chicken Breast', 5.99, 'lb'),
            ('Ground Beef 80/20', 6.49, 'lb'),
            ('Salmon Fillets', 12.99, 'lb'),
            ('Pork Chops', 4.99, 'lb'),
            ('Turkey Breast', 8.99, 'lb'),
            ('Ribeye Steak', 14.99, 'lb'),
            ('Bacon', 6.99, '16oz'),
        ],
        'dairy': [
            ('Whole Milk', 3.99, 'gal'),
            ('Greek Yogurt', 5.49, '32oz'),
            ('Cheddar Cheese', 4.99, '8oz'),
            ('Large Eggs', 3.49, 'doz'),
            ('Butter', 4.99, 'lb'),
            ('Cottage Cheese', 3.99, '16oz'),
        ],
        'pantry': [
            ('Olive Oil', 8.99, '16oz'),
            ('Peanut Butter', 4.49, '16oz'),
            ('Whole Wheat Bread', 3.99, 'loaf'),
            ('Brown Rice', 4.99, '2lb'),
            ('Pasta', 1.99, '16oz'),
            ('Canned Tomatoes', 1.49, '14oz'),
        ],
        'frozen': [
            ('Frozen Berries', 5.99, '16oz'),
            ('Ice Cream', 4.99, 'qt'),
            ('Frozen Pizza', 6.99, 'ea'),
            ('Frozen Vegetables', 2.99, '16oz'),
        ]
    }

    # Store-specific ad templates
    STORE_TEMPLATES = {
        'costco': {
            'header': "COSTCO WAREHOUSE\nMEMBER SAVINGS",
            'deal_format': "{product}\n${price:.2f}\nInstant Savings ${savings:.2f}",
            'multi_buy_format': "{product}\n{qty} for ${total:.2f}",
            'layout': 'grid',
            'price_style': 'after_savings',
        },
        'whole_foods': {
            'header': "WHOLE FOODS MARKET\nPrime Member Deals",
            'deal_format': "{product}\nSale ${price:.2f}\nReg ${original:.2f}",
            'multi_buy_format': "{product}\nBuy {qty}, Get {free} FREE",
            'layout': 'mixed',
            'price_style': 'prime_discount',
        },
        'safeway': {
            'header': "SAFEWAY\nClub Card Specials",
            'deal_format': "{product}\nClub Price ${price:.2f}",
            'multi_buy_format': "{product}\n{qty} for ${total:.2f} with Card",
            'layout': 'grid',
            'price_style': 'club_price',
        },
        'walmart': {
            'header': "WALMART\nRollback Prices",
            'deal_format': "{product}\nWas ${original:.2f} Now ${price:.2f}",
            'multi_buy_format': "{product}\n{qty} for ${total:.2f}",
            'layout': 'list',
            'price_style': 'rollback',
        },
        'kroger': {
            'header': "KROGER\nDigital Coupons",
            'deal_format': "{product}\n${price:.2f} with Digital Coupon",
            'multi_buy_format': "Buy {qty} {product} Get {free} Free",
            'layout': 'grid',
            'price_style': 'digital_coupon',
        },
    }

    # OCR error patterns
    OCR_ERRORS = {
        '$': ['5', 'S', '§'],
        '0': ['O', 'o', 'Q'],
        '1': ['l', 'I', '|'],
        '5': ['S', 's', '$'],
        '8': ['B', '&'],
        '9': ['g', 'q'],
        '.': [',', '·'],
        '/': ['l', '1', '|'],
    }

    def __init__(self, seed: Optional[int] = None):
        """Initialize generator with optional seed for reproducibility."""
        self.seed = seed
        if seed:
            random.seed(seed)

    def generate_ad(
        self,
        store: str,
        num_deals: int = 5,
        ocr_quality: float = 0.9,
        include_multi_buy: bool = True,
        include_bogo: bool = True
    ) -> SyntheticAd:
        """
        Generate a synthetic grocery ad.

        Args:
            store: Store name (costco, whole_foods, safeway, walmart, kroger)
            num_deals: Number of deals to generate
            ocr_quality: OCR quality (0.0-1.0, 1.0 = perfect)
            include_multi_buy: Include multi-buy deals
            include_bogo: Include BOGO deals

        Returns:
            SyntheticAd with deals and ground truth
        """
        store_lower = store.lower()
        template = self.STORE_TEMPLATES.get(store_lower, self.STORE_TEMPLATES['walmart'])

        # Generate deals
        deals = []
        deal_texts = [template['header'] + "\n" + "=" * 30 + "\n"]

        for i in range(num_deals):
            # Choose deal type
            deal_type_rand = random.random()
            if deal_type_rand < 0.5:
                deal, text = self._generate_price_deal(store_lower, template)
            elif deal_type_rand < 0.75 and include_multi_buy:
                deal, text = self._generate_multi_buy_deal(store_lower, template)
            elif include_bogo:
                deal, text = self._generate_bogo_deal(store_lower, template)
            else:
                deal, text = self._generate_price_deal(store_lower, template)

            deals.append(deal)
            deal_texts.append(text + "\n" + "-" * 20 + "\n")

        # Combine text
        raw_text = "\n".join(deal_texts)

        # Apply OCR errors
        if ocr_quality < 1.0:
            raw_text = self._apply_ocr_errors(raw_text, ocr_quality)

        return SyntheticAd(
            store=store,
            raw_text=raw_text,
            deals=deals,
            ocr_quality=ocr_quality,
            metadata={
                'generated_at': datetime.now().isoformat(),
                'num_deals': num_deals,
            }
        )

    def _generate_price_deal(
        self,
        store: str,
        template: Dict[str, str]
    ) -> Tuple[ExtractedDeal, str]:
        """Generate a simple price deal."""
        # Pick random product
        category = random.choice(list(self.PRODUCTS.keys()))
        product_info = random.choice(self.PRODUCTS[category])
        name, base_price, unit = product_info

        # Apply discount
        discount_pct = random.uniform(0.1, 0.4)
        sale_price = round(base_price * (1 - discount_pct), 2)
        savings = round(base_price - sale_price, 2)

        # Format text
        text = template['deal_format'].format(
            product=name.upper(),
            price=sale_price,
            original=base_price,
            savings=savings
        )

        # Create deal
        deal = ExtractedDeal(
            raw_text=text,
            deal_type=DealType.PRICE,
            product_name=name,
            price=sale_price,
            unit=unit,
            original_price=base_price,
            discount_amount=savings,
            discount_percent=discount_pct * 100,
            confidence=1.0,  # Ground truth
            metadata={
                'category': category,
                'store': store,
                'is_synthetic': True,
            }
        )

        return deal, text

    def _generate_multi_buy_deal(
        self,
        store: str,
        template: Dict[str, str]
    ) -> Tuple[ExtractedDeal, str]:
        """Generate a multi-buy deal."""
        category = random.choice(list(self.PRODUCTS.keys()))
        product_info = random.choice(self.PRODUCTS[category])
        name, base_price, unit = product_info

        # Generate multi-buy
        qty = random.choice([2, 3, 4])
        total_price = round(base_price * qty * random.uniform(0.7, 0.9), 2)

        text = template['multi_buy_format'].format(
            product=name.upper(),
            qty=qty,
            total=total_price,
            free=1  # For BOGO-style multi-buy
        )

        deal = ExtractedDeal(
            raw_text=text,
            deal_type=DealType.MULTI_BUY,
            product_name=name,
            price=round(total_price / qty, 2),
            quantity=qty,
            confidence=1.0,
            metadata={
                'category': category,
                'store': store,
                'total_price': total_price,
                'is_synthetic': True,
            }
        )

        return deal, text

    def _generate_bogo_deal(
        self,
        store: str,
        template: Dict[str, str]
    ) -> Tuple[ExtractedDeal, str]:
        """Generate a BOGO deal."""
        category = random.choice(list(self.PRODUCTS.keys()))
        product_info = random.choice(self.PRODUCTS[category])
        name, base_price, unit = product_info

        buy_qty = random.choice([1, 2])
        get_qty = 1

        bogo_formats = [
            f"Buy {buy_qty} Get {get_qty} FREE",
            f"BOGO" if buy_qty == 1 else f"B{buy_qty}G{get_qty}F",
            f"Buy {buy_qty}, Get {get_qty} 50% Off"
        ]

        text = f"{name.upper()}\n{random.choice(bogo_formats)}\n${base_price:.2f} ea"

        deal = ExtractedDeal(
            raw_text=text,
            deal_type=DealType.BOGO,
            product_name=name,
            price=base_price,
            quantity=buy_qty,
            confidence=1.0,
            metadata={
                'category': category,
                'store': store,
                'buy_qty': buy_qty,
                'get_qty': get_qty,
                'is_synthetic': True,
            }
        )

        return deal, text

    def _apply_ocr_errors(self, text: str, quality: float) -> str:
        """Apply simulated OCR errors to text."""
        error_rate = 1 - quality
        result = list(text)

        for i, char in enumerate(result):
            if char in self.OCR_ERRORS and random.random() < error_rate:
                result[i] = random.choice(self.OCR_ERRORS[char])

        # Additional random errors
        # Random character insertions
        if random.random() < error_rate * 0.3:
            pos = random.randint(0, len(result) - 1)
            result.insert(pos, random.choice([' ', '.', ',']))

        # Random character deletions
        if random.random() < error_rate * 0.2 and len(result) > 10:
            pos = random.randint(0, len(result) - 1)
            result.pop(pos)

        return ''.join(result)

    def generate_corrections(
        self,
        ad: SyntheticAd,
        parsed_deals: List[ExtractedDeal],
        error_rate: float = 0.3
    ) -> List[SyntheticCorrection]:
        """
        Generate synthetic user corrections based on parsing results.

        Args:
            ad: Original synthetic ad (with ground truth)
            parsed_deals: What the parser extracted
            error_rate: Rate of corrections to generate

        Returns:
            List of synthetic corrections
        """
        corrections = []

        # Match parsed deals to ground truth
        for ground_truth in ad.deals:
            matched = False
            for parsed in parsed_deals:
                if self._deals_match(ground_truth, parsed):
                    matched = True
                    # Parser got it right - no correction needed
                    break

            if not matched and random.random() < error_rate:
                # Generate correction
                # Find closest parsed deal or create one
                closest_parsed = self._find_closest_deal(ground_truth, parsed_deals)

                corrections.append(SyntheticCorrection(
                    deal_id=f"corr_{len(corrections)}_{datetime.now().timestamp()}",
                    store=ad.store,
                    original_deal=closest_parsed or ExtractedDeal(
                        raw_text=ground_truth.raw_text[:50],
                        deal_type=DealType.UNKNOWN
                    ),
                    corrected_deal=ground_truth,
                    raw_text=ground_truth.raw_text,
                ))

        return corrections

    def _deals_match(
        self,
        deal1: ExtractedDeal,
        deal2: ExtractedDeal,
        price_tolerance: float = 0.02
    ) -> bool:
        """Check if two deals match."""
        # Price match
        if deal1.price and deal2.price:
            if abs(deal1.price - deal2.price) > price_tolerance:
                return False

        # Product name similarity
        if deal1.product_name and deal2.product_name:
            name1 = deal1.product_name.lower()
            name2 = deal2.product_name.lower()

            # Simple word overlap
            words1 = set(name1.split())
            words2 = set(name2.split())
            overlap = len(words1 & words2)

            if overlap < min(len(words1), len(words2)) * 0.5:
                return False

        return True

    def _find_closest_deal(
        self,
        target: ExtractedDeal,
        candidates: List[ExtractedDeal]
    ) -> Optional[ExtractedDeal]:
        """Find the closest matching deal from candidates."""
        if not candidates:
            return None

        best_match = None
        best_score = -1

        for candidate in candidates:
            score = 0

            # Price similarity
            if target.price and candidate.price:
                price_diff = abs(target.price - candidate.price)
                score += max(0, 1 - price_diff / target.price) * 0.5

            # Type match
            if target.deal_type == candidate.deal_type:
                score += 0.3

            # Name similarity
            if target.product_name and candidate.product_name:
                name1 = set(target.product_name.lower().split())
                name2 = set(candidate.product_name.lower().split())
                if name1 and name2:
                    overlap = len(name1 & name2) / len(name1 | name2)
                    score += overlap * 0.2

            if score > best_score:
                best_score = score
                best_match = candidate

        return best_match

    def generate_product_catalog(self, num_products: int = 100) -> List[Dict[str, Any]]:
        """Generate a product catalog for testing."""
        catalog = []

        for category, products in self.PRODUCTS.items():
            for name, price, unit in products:
                catalog.append({
                    'id': f"prod_{len(catalog)}",
                    'name': name,
                    'category': category,
                    'typical_price': price,
                    'unit': unit,
                    'brand': name.split()[0] if len(name.split()) > 1 else '',
                    'purchase_frequency': random.random(),
                })

        # Add variations
        while len(catalog) < num_products:
            base_product = random.choice(catalog[:len(self.PRODUCTS) * 2])
            variation = {
                'id': f"prod_{len(catalog)}",
                'name': f"{random.choice(['Organic', 'Fresh', 'Premium', 'Value'])} {base_product['name']}",
                'category': base_product['category'],
                'typical_price': base_product['typical_price'] * random.uniform(0.8, 1.3),
                'unit': base_product['unit'],
                'brand': random.choice(['Store Brand', 'Generic', 'Premium']),
                'purchase_frequency': random.random(),
            }
            catalog.append(variation)

        return catalog

    def generate_training_batch(
        self,
        num_ads: int = 10,
        ocr_quality_range: Tuple[float, float] = (0.7, 0.95),
        stores: Optional[List[str]] = None
    ) -> Tuple[List[SyntheticAd], List[SyntheticCorrection]]:
        """
        Generate a batch of ads and corrections for training.

        Args:
            num_ads: Number of ads to generate
            ocr_quality_range: Range of OCR quality
            stores: List of stores to include

        Returns:
            Tuple of (ads, corrections)
        """
        stores = stores or list(self.STORE_TEMPLATES.keys())
        ads = []
        all_corrections = []

        for _ in range(num_ads):
            store = random.choice(stores)
            ocr_quality = random.uniform(*ocr_quality_range)
            num_deals = random.randint(3, 8)

            ad = self.generate_ad(
                store=store,
                num_deals=num_deals,
                ocr_quality=ocr_quality
            )
            ads.append(ad)

        return ads, all_corrections

    def simulate_progressive_learning(
        self,
        num_weeks: int = 5,
        ads_per_week: int = 10,
        correction_rate: float = 0.4
    ) -> Dict[str, Any]:
        """
        Simulate progressive learning over time.

        Args:
            num_weeks: Number of weeks to simulate
            ads_per_week: Ads processed per week
            correction_rate: Rate of user corrections

        Returns:
            Simulation results with expected accuracy progression
        """
        results = {
            'weeks': [],
            'total_ads': 0,
            'total_corrections': 0,
        }

        base_accuracy = 0.30  # Starting accuracy
        learning_rate = 0.15  # Accuracy improvement per week

        for week in range(num_weeks):
            week_data = {
                'week': week + 1,
                'ads_processed': ads_per_week,
                'corrections': int(ads_per_week * correction_rate * (1 - week * 0.1)),
            }

            # Calculate expected accuracy
            corrections_so_far = results['total_corrections'] + week_data['corrections']
            ads_so_far = results['total_ads'] + ads_per_week

            # Accuracy improves with corrections and ads
            accuracy = min(
                0.85,
                base_accuracy + (learning_rate * (corrections_so_far / 20))
            )

            # Determine phase
            if ads_so_far < 5 or corrections_so_far < 20:
                phase = 1
            elif ads_so_far < 15 or corrections_so_far < 50 or accuracy < 0.55:
                phase = 2
            else:
                phase = 3

            week_data['expected_accuracy'] = accuracy
            week_data['phase'] = phase

            results['weeks'].append(week_data)
            results['total_ads'] += ads_per_week
            results['total_corrections'] += week_data['corrections']

        return results
