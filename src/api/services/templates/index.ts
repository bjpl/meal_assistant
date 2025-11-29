/**
 * Template System - Main Export
 * Week 3-4: Template versioning, A/B testing, and sharing
 */

import templateService from './templateService';
import abTestService from './abTestService';
import marketplaceService from './marketplaceService';
import * as templateTypes from './templateTypes';

// Convenience methods
export const createTemplate = templateService.createTemplate.bind(templateService);
export const getTemplate = templateService.getTemplate.bind(templateService);
export const updateFromCorrections = templateService.updateFromCorrections.bind(templateService);
export const testTemplate = templateService.testTemplate.bind(templateService);
export const shareTemplate = templateService.shareTemplate.bind(templateService);
export const rollback = templateService.rollback.bind(templateService);

// A/B Testing
export const createABTest = abTestService.createTest.bind(abTestService);
export const startABTest = abTestService.startTest.bind(abTestService);
export const routeAd = abTestService.routeAd.bind(abTestService);
export const recordABResult = abTestService.recordResult.bind(abTestService);
export const concludeABTest = abTestService.concludeTest.bind(abTestService);

// Marketplace
export const publishTemplate = marketplaceService.publishTemplate.bind(marketplaceService);
export const rateTemplate = marketplaceService.rateTemplate.bind(marketplaceService);
export const searchTemplates = marketplaceService.searchTemplates.bind(marketplaceService);
export const getFeaturedTemplates = marketplaceService.getFeaturedTemplates.bind(marketplaceService);

// Clear all (for testing)
export function clearAll(): void {
  templateService.clearAll();
  abTestService.clearAll();
  marketplaceService.clearAll();
}

// Export services and types
export {
  templateService,
  abTestService,
  marketplaceService,
  templateTypes
};

export default {
  templateService,
  abTestService,
  marketplaceService,
  ...templateTypes,
  createTemplate,
  getTemplate,
  updateFromCorrections,
  testTemplate,
  shareTemplate,
  rollback,
  createABTest,
  startABTest,
  routeAd,
  recordABResult,
  concludeABTest,
  publishTemplate,
  rateTemplate,
  searchTemplates,
  getFeaturedTemplates,
  clearAll
};
