/**
 * Community Template Marketplace Service
 * Handles public template sharing, ratings, and discovery
 */

const { v4: uuidv4 } = require('uuid');
const { createTemplateReview, TemplateStatus } = require('./templateTypes');
const templateService = require('./templateService');

// In-memory storage
const reviewStore = new Map();
const storeVerifications = new Map(); // storeId -> verification data
const officialTemplates = new Set();
const featuredTemplates = new Set();

/**
 * MarketplaceService class for community template features
 */
class MarketplaceService {
  /**
   * Publish a template to the marketplace
   * @param {string} templateId - Template to publish
   * @param {string} userId - User publishing
   * @param {Object} publishData - Publication metadata
   * @returns {Promise<Object>} Published template
   */
  async publishTemplate(templateId, userId, publishData = {}) {
    const template = await templateService.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.user_id !== userId) {
      throw new Error('Unauthorized: not template owner');
    }

    // Verify template quality
    const qualityCheck = await this.verifyTemplateQuality(template);
    if (!qualityCheck.passed) {
      throw new Error(`Template quality check failed: ${qualityCheck.reason}`);
    }

    // Update template for publication
    template.is_public = true;
    template.status = TemplateStatus.ACTIVE;
    template.published_at = new Date().toISOString();
    template.marketplace_data = {
      title: publishData.title || template.name,
      description: publishData.description || template.description,
      category: publishData.category || 'general',
      tags: publishData.tags || template.tags,
      screenshots: publishData.screenshots || [],
      documentation_url: publishData.documentation_url || null
    };

    // Save through template service
    await templateService.shareTemplate(templateId, true);

    return template;
  }

  /**
   * Verify template quality before publication
   */
  async verifyTemplateQuality(template) {
    const issues = [];

    // Check minimum test count
    if (template.test_count < 5) {
      issues.push('Template must be tested at least 5 times');
    }

    // Check minimum accuracy
    if (template.accuracy_score !== null && template.accuracy_score < 0.7) {
      issues.push('Template accuracy must be at least 70%');
    }

    // Check has extraction rules
    if (!template.extraction_rules ||
        !template.extraction_rules.price_patterns ||
        template.extraction_rules.price_patterns.length === 0) {
      issues.push('Template must have extraction rules defined');
    }

    // Check has description
    if (!template.description || template.description.length < 10) {
      issues.push('Template must have a meaningful description');
    }

    return {
      passed: issues.length === 0,
      issues,
      reason: issues.join('; ')
    };
  }

  /**
   * Unpublish a template from marketplace
   */
  async unpublishTemplate(templateId, userId) {
    const template = await templateService.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (template.user_id !== userId) {
      throw new Error('Unauthorized: not template owner');
    }

    // Remove from marketplace
    template.is_public = false;
    template.published_at = null;
    delete template.marketplace_data;

    await templateService.shareTemplate(templateId, false);

    // Remove from featured
    featuredTemplates.delete(templateId);

    return { success: true, templateId };
  }

  /**
   * Rate a template
   * @param {string} templateId - Template to rate
   * @param {string} userId - User rating
   * @param {number} rating - 1-5 stars
   * @param {string} comment - Optional review text
   * @returns {Promise<Object>} Created review
   */
  async rateTemplate(templateId, userId, rating, comment = '') {
    const template = await templateService.getTemplate(templateId);

    if (!template || !template.is_public) {
      throw new Error('Template not found or not public');
    }

    // Check for existing review
    const existingReview = Array.from(reviewStore.values())
      .find(r => r.template_id === templateId && r.user_id === userId);

    if (existingReview) {
      // Update existing review
      const oldRating = existingReview.rating;
      existingReview.rating = Math.max(1, Math.min(5, rating));
      existingReview.comment = comment;
      existingReview.updated_at = new Date().toISOString();
      reviewStore.set(existingReview.id, existingReview);

      // Update template rating
      template.rating_sum = template.rating_sum - oldRating + existingReview.rating;
      template.avg_rating = template.rating_sum / template.rating_count;

      return existingReview;
    }

    // Create new review
    const review = createTemplateReview(userId, templateId, rating, comment);
    reviewStore.set(review.id, review);

    // Update template rating
    template.rating_count++;
    template.rating_sum += review.rating;
    template.avg_rating = template.rating_sum / template.rating_count;

    return review;
  }

  /**
   * Get reviews for a template
   */
  async getTemplateReviews(templateId, options = {}) {
    let reviews = Array.from(reviewStore.values())
      .filter(r => r.template_id === templateId);

    // Sort options
    const sortBy = options.sortBy || 'recent';
    switch (sortBy) {
      case 'helpful':
        reviews.sort((a, b) => b.helpful_count - a.helpful_count);
        break;
      case 'rating_high':
        reviews.sort((a, b) => b.rating - a.rating);
        break;
      case 'rating_low':
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      case 'recent':
      default:
        reviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        break;
    }

    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return {
      reviews: reviews.slice(offset, offset + limit),
      total: reviews.length,
      avg_rating: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : null
    };
  }

  /**
   * Mark a review as helpful
   */
  async markReviewHelpful(reviewId, userId) {
    const review = reviewStore.get(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // In production, track which users have marked helpful
    review.helpful_count++;
    reviewStore.set(reviewId, review);

    return review;
  }

  /**
   * Search marketplace templates
   * @param {Object} query - Search parameters
   * @returns {Promise<Object>} Search results
   */
  async searchTemplates(query = {}) {
    let templates = (await templateService.getPublicTemplates()).templates;

    // Text search
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.store_id.toLowerCase().includes(searchLower) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // Store filter
    if (query.storeId) {
      templates = templates.filter(t => t.store_id === query.storeId);
    }

    // Category filter
    if (query.category) {
      templates = templates.filter(t =>
        t.marketplace_data?.category === query.category
      );
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      templates = templates.filter(t =>
        t.tags && query.tags.some(tag => t.tags.includes(tag))
      );
    }

    // Minimum rating filter
    if (query.minRating) {
      templates = templates.filter(t =>
        t.avg_rating !== null && t.avg_rating >= query.minRating
      );
    }

    // Minimum accuracy filter
    if (query.minAccuracy) {
      templates = templates.filter(t =>
        t.accuracy_score !== null && t.accuracy_score >= query.minAccuracy
      );
    }

    // Official templates filter
    if (query.officialOnly) {
      templates = templates.filter(t => t.is_official);
    }

    // Verified stores filter
    if (query.verifiedStoresOnly) {
      templates = templates.filter(t => storeVerifications.has(t.store_id));
    }

    // Sorting
    const sortBy = query.sortBy || 'relevance';
    switch (sortBy) {
      case 'rating':
        templates.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        break;
      case 'accuracy':
        templates.sort((a, b) => (b.accuracy_score || 0) - (a.accuracy_score || 0));
        break;
      case 'downloads':
        templates.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'recent':
        templates.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        break;
      case 'relevance':
      default:
        // Composite score: rating * 0.4 + accuracy * 0.3 + downloads * 0.3
        templates.sort((a, b) => {
          const scoreA = (a.avg_rating || 0) * 0.4 +
                        (a.accuracy_score || 0) * 5 * 0.3 +
                        Math.log(a.downloads + 1) * 0.3;
          const scoreB = (b.avg_rating || 0) * 0.4 +
                        (b.accuracy_score || 0) * 5 * 0.3 +
                        Math.log(b.downloads + 1) * 0.3;
          return scoreB - scoreA;
        });
        break;
    }

    // Pagination
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    return {
      templates: templates.slice(offset, offset + limit),
      total: templates.length,
      filters_applied: {
        search: query.search || null,
        storeId: query.storeId || null,
        category: query.category || null,
        minRating: query.minRating || null,
        minAccuracy: query.minAccuracy || null
      }
    };
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates() {
    const featured = [];

    for (const templateId of featuredTemplates) {
      const template = await templateService.getTemplate(templateId);
      if (template && template.is_public) {
        featured.push(template);
      }
    }

    return featured.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
  }

  /**
   * Feature a template (admin action)
   */
  async featureTemplate(templateId) {
    const template = await templateService.getTemplate(templateId);
    if (!template || !template.is_public) {
      throw new Error('Template not found or not public');
    }

    featuredTemplates.add(templateId);
    return { featured: true, templateId };
  }

  /**
   * Unfeature a template (admin action)
   */
  async unfeatureTemplate(templateId) {
    featuredTemplates.delete(templateId);
    return { featured: false, templateId };
  }

  /**
   * Get official templates (created by team)
   */
  async getOfficialTemplates(storeId = null) {
    let templates = [];

    for (const templateId of officialTemplates) {
      const template = await templateService.getTemplate(templateId);
      if (template && template.is_public && template.is_official) {
        if (!storeId || template.store_id === storeId) {
          templates.push(template);
        }
      }
    }

    return templates.sort((a, b) => b.downloads - a.downloads);
  }

  /**
   * Mark template as official (admin action)
   */
  async markAsOfficial(templateId) {
    const template = await templateService.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    template.is_official = true;
    officialTemplates.add(templateId);

    return template;
  }

  /**
   * Verify a store for template matching
   * @param {string} storeId - Store identifier
   * @param {Object} verification - Verification data
   */
  async verifyStore(storeId, verification) {
    const verificationData = {
      store_id: storeId,
      verified: true,
      verified_at: new Date().toISOString(),
      verified_by: verification.verified_by,
      store_name: verification.store_name,
      store_chain: verification.store_chain,
      regions: verification.regions || [],
      website: verification.website || null
    };

    storeVerifications.set(storeId, verificationData);
    return verificationData;
  }

  /**
   * Get store verification status
   */
  async getStoreVerification(storeId) {
    return storeVerifications.get(storeId) || null;
  }

  /**
   * Get verified stores list
   */
  async getVerifiedStores() {
    return Array.from(storeVerifications.values());
  }

  /**
   * Suggest templates for a store
   * @param {string} storeId - Store to get suggestions for
   * @returns {Promise<Array>} Suggested templates
   */
  async suggestTemplatesForStore(storeId) {
    // Get official templates first
    const official = await this.getOfficialTemplates(storeId);

    // Get community templates
    const community = (await templateService.getPublicTemplates({
      storeId,
      sortBy: 'rating'
    })).templates;

    // Filter out official from community
    const officialIds = new Set(official.map(t => t.id));
    const communityFiltered = community.filter(t => !officialIds.has(t.id));

    return {
      official: official.slice(0, 5),
      community: communityFiltered.slice(0, 10),
      store_verified: storeVerifications.has(storeId)
    };
  }

  /**
   * Get marketplace statistics
   */
  async getMarketplaceStats() {
    const allPublic = (await templateService.getPublicTemplates({ limit: 10000 })).templates;
    const allReviews = Array.from(reviewStore.values());

    const stats = {
      total_templates: allPublic.length,
      official_templates: officialTemplates.size,
      featured_templates: featuredTemplates.size,
      verified_stores: storeVerifications.size,
      total_reviews: allReviews.length,
      total_downloads: allPublic.reduce((sum, t) => sum + t.downloads, 0),
      avg_rating: allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : null,
      templates_by_store: {},
      top_contributors: {}
    };

    // Group by store
    allPublic.forEach(t => {
      stats.templates_by_store[t.store_id] =
        (stats.templates_by_store[t.store_id] || 0) + 1;
    });

    // Top contributors
    allPublic.forEach(t => {
      stats.top_contributors[t.user_id] =
        (stats.top_contributors[t.user_id] || 0) + 1;
    });

    return stats;
  }

  /**
   * Report a template for issues
   */
  async reportTemplate(templateId, userId, reason, details = '') {
    const template = await templateService.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const report = {
      id: uuidv4(),
      template_id: templateId,
      reporter_id: userId,
      reason, // 'incorrect_store', 'poor_quality', 'spam', 'inappropriate', 'other'
      details,
      status: 'pending',
      created_at: new Date().toISOString(),
      resolved_at: null,
      resolution: null
    };

    // In production, store in database
    return report;
  }

  /**
   * Get download statistics for a template
   */
  async getTemplateStats(templateId) {
    const template = await templateService.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const reviews = Array.from(reviewStore.values())
      .filter(r => r.template_id === templateId);

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach(r => {
      ratingDistribution[r.rating]++;
    });

    return {
      template_id: templateId,
      downloads: template.downloads,
      rating_count: template.rating_count,
      avg_rating: template.avg_rating,
      rating_distribution: ratingDistribution,
      accuracy_score: template.accuracy_score,
      test_count: template.test_count,
      success_rate: template.test_count > 0
        ? template.successful_extractions / template.test_count
        : null,
      published_at: template.published_at,
      last_updated: template.updated_at
    };
  }

  /**
   * Clear all marketplace data (for testing)
   */
  clearAll() {
    reviewStore.clear();
    storeVerifications.clear();
    officialTemplates.clear();
    featuredTemplates.clear();
  }
}

// Export singleton instance
module.exports = new MarketplaceService();
module.exports.MarketplaceService = MarketplaceService;
module.exports.reviewStore = reviewStore;
