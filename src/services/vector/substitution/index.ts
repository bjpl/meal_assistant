/**
 * Substitution Services Index
 * Exports all substitution-related services
 */

export {
  SubstitutionService,
  getSubstitutionService,
  substitutionService
} from './substitution.service';

export type {
  DietaryRestriction,
  CookingContext,
  SubstitutionRequest,
  SubstitutionSuggestion,
  SubstitutionResult
} from './substitution.service';
