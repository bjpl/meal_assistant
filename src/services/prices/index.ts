/**
 * Price Intelligence Module
 * Exports all price-related services for grocery deal tracking and recommendations
 *
 * Strategic Architecture:
 * - FlyerParserService: Transforms raw flyer data into structured deals
 * - DealMatcherService: Semantic search for matching deals to user needs
 * - PriceIntelligenceService: Orchestrates recommendations and tracking
 *
 * Integration Points:
 * - Uses RuVector for vector storage and semantic search
 * - Leverages SubstitutionService for alternative product deals
 * - Extends EmbeddingService patterns for deal embeddings
 */

// Types
export * from '../vector/types/deals.types';

// Services
export { FlyerParserService, flyerParserService } from './flyer-parser.service';
export type { FlyerParseOptions, FlyerParseResult } from './flyer-parser.service';
export { DealMatcherService, dealMatcherService } from './deal-matcher.service';
export type { DealMatchOptions } from './deal-matcher.service';
export { PriceIntelligenceService, priceIntelligenceService } from './price-intelligence.service';
export type { SmartShoppingRecommendation, MealPlanDealIntegration } from './price-intelligence.service';
