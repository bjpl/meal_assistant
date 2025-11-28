/**
 * Template System - Main Export
 * Week 3-4: Template versioning, A/B testing, and sharing
 */

const templateService = require('./templateService');
const abTestService = require('./abTestService');
const marketplaceService = require('./marketplaceService');
const templateTypes = require('./templateTypes');

module.exports = {
  // Services
  templateService,
  abTestService,
  marketplaceService,

  // Types and utilities
  ...templateTypes,

  // Convenience methods
  createTemplate: templateService.createTemplate.bind(templateService),
  getTemplate: templateService.getTemplate.bind(templateService),
  updateFromCorrections: templateService.updateFromCorrections.bind(templateService),
  testTemplate: templateService.testTemplate.bind(templateService),
  shareTemplate: templateService.shareTemplate.bind(templateService),
  rollback: templateService.rollback.bind(templateService),

  // A/B Testing
  createABTest: abTestService.createTest.bind(abTestService),
  startABTest: abTestService.startTest.bind(abTestService),
  routeAd: abTestService.routeAd.bind(abTestService),
  recordABResult: abTestService.recordResult.bind(abTestService),
  concludeABTest: abTestService.concludeTest.bind(abTestService),

  // Marketplace
  publishTemplate: marketplaceService.publishTemplate.bind(marketplaceService),
  rateTemplate: marketplaceService.rateTemplate.bind(marketplaceService),
  searchTemplates: marketplaceService.searchTemplates.bind(marketplaceService),
  getFeaturedTemplates: marketplaceService.getFeaturedTemplates.bind(marketplaceService),

  // Clear all (for testing)
  clearAll: () => {
    templateService.clearAll();
    abTestService.clearAll();
    marketplaceService.clearAll();
  }
};
