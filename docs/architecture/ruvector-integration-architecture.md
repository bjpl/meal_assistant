# RuVector Integration Architecture

## Overview

This document describes the complete system architecture for integrating RuVector (vector database) into the meal_assistant application. The integration enables semantic search, intelligent recommendations, knowledge graph capabilities, and continuous learning.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (Redux Slices, UI Components, User Interactions)           │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Integration Layer                           │
│  • inventory.service ──→ RAG recommendations                │
│  • predictions.service ──→ Enhanced ML predictions          │
│  • prep-orchestrator ──→ Recipe semantic search            │
│  • mealsSlice ──→ Semantic meal logging                    │
│  • patternsSlice ──→ Pattern recommendations               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  Vector Service Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ RAG Services          │ Search Services              │  │
│  │ • Context Builder     │ • Semantic Search            │  │
│  │ • Recommender         │ • Hybrid Search              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Graph Services        │ Learning Services            │  │
│  │ • Knowledge Graph     │ • Feedback Collection        │  │
│  │ • Substitution Finder │ • Model Training             │  │
│  │ • Graph Builder       │ • Personalization            │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Core Layer                                │
│  • RuVectorService    - Vector DB client                    │
│  • EmbeddingService   - Text embeddings                     │
│  • CollectionService  - Collection management               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  RuVector Database                           │
│  Collections:                                                │
│  • meal_patterns   - Meal recipes and patterns              │
│  • ingredients     - Ingredient knowledge base              │
│  • recipe_steps    - Cooking instructions                   │
│  • meal_logs       - User meal history                      │
│  • cooking_techniques - Cooking method knowledge            │
└──────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/services/vector/
├── index.ts                     # Main exports
├── types/                       # Type definitions
│   ├── vector.types.ts          # Core vector types
│   ├── collections.types.ts     # Collection schemas
│   ├── graph.types.ts           # Knowledge graph types
│   ├── rag.types.ts             # RAG pipeline types
│   ├── learning.types.ts        # ML learning types
│   └── index.ts                 # Type exports
├── config/                      # Configuration
│   └── ruvector.config.ts       # RuVector configuration
├── core/                        # Core services
│   ├── ruvector.service.ts      # Main RuVector client
│   ├── embedding.service.ts     # Embedding generation
│   └── collection.service.ts    # Collection management
├── search/                      # Search services (TODO)
│   ├── semantic.service.ts      # Semantic search
│   └── hybrid.service.ts        # Hybrid search
├── graph/                       # Knowledge graph (TODO)
│   ├── graph.service.ts         # Graph operations
│   ├── builder.service.ts       # Graph construction
│   └── substitution.service.ts  # Ingredient substitution
├── rag/                         # RAG pipeline (TODO)
│   ├── rag.service.ts           # RAG orchestration
│   ├── context.service.ts       # Context building
│   └── recommender.service.ts   # Recommendations
├── learning/                    # ML learning (TODO)
│   ├── feedback.service.ts      # Feedback collection
│   ├── training.service.ts      # Model training
│   └── personalization.service.ts # User personalization
└── seeders/                     # Data seeding (TODO)
    ├── patterns.seeder.ts       # Seed meal patterns
    ├── ingredients.seeder.ts    # Seed ingredients
    └── graph.seeder.ts          # Seed graph relationships
```

## Type System

### Core Types

**VectorDocument<T>** - Base document with embedding and metadata
- `id`: Document identifier
- `embedding`: Vector embedding (number[])
- `metadata`: Typed metadata (generic)
- `createdAt`, `updatedAt`: Timestamps

**SearchQuery** - Query parameters for vector search
- `vector?`: Pre-computed embedding
- `text?`: Text to embed and search
- `filter?`: Metadata filters
- `topK?`: Result count
- `threshold?`: Similarity threshold

**SearchResult<T>** - Search result with score
- `id`: Document ID
- `score`: Similarity score (0-1)
- `document`: Document metadata
- `distance`: Vector distance

### Collection Schemas

**MealPatternMetadata** - Recipe/meal pattern
- `patternId`, `name`, `description`
- `mealType`, `cuisines`, `dietary`
- `ingredients`, `prepTime`, `cookTime`
- `difficulty`, `servings`, `cost`
- `nutrition`, `frequency`, `rating`

**IngredientMetadata** - Ingredient knowledge
- `ingredientId`, `name`, `aliases`
- `category`, `storageLocation`, `shelfLife`
- `substitutes`, `flavorProfile`
- `nutritionPer100g`, `costCategory`, `seasonal`

**RecipeStepMetadata** - Cooking instruction
- `stepId`, `recipeId`, `order`
- `instruction`, `equipment`, `ingredients`
- `duration`, `canParallel`, `requiresAttention`
- `temperature`, `techniques`

**MealLogMetadata** - Meal history entry
- `logId`, `mealName`, `timestamp`
- `mealType`, `patternId`, `ingredients`
- `tags`, `rating`, `notes`
- `leftoverAmount`, `feedback`

**CookingTechniqueMetadata** - Cooking technique knowledge
- `techniqueId`, `name`, `description`
- `equipment`, `skillLevel`, `typicalDuration`
- `temperatureRange`, `commonUses`, `relatedTechniques`

### Graph Types

**GraphNode** - Knowledge graph node
- `id`, `type`, `label`
- `properties`, `embedding`

**GraphEdge** - Knowledge graph relationship
- `id`, `source`, `target`
- `relationship`, `weight`, `properties`

**Relationship Types**:
- `SUBSTITUTES_FOR` - Ingredient substitutions
- `PAIRS_WITH` - Flavor pairings
- `CONTAINS` - Recipe contains ingredient
- `REQUIRES` - Technique requires equipment
- `ENHANCES` - Flavor enhancement
- `SIMILAR_TO` - Semantic similarity

### RAG Types

**RAGContext** - Retrieved context for generation
- `documents`: Retrieved docs with scores
- `query`: Original query
- `contextText`: Formatted context
- `retrievalMetadata`: Stats

**RAGRequest** - Generation request
- `query`: User query
- `collections`: Collections to search
- `topK`, `threshold`: Search params
- `generationParams`: LLM parameters

**RAGResponse** - Generated response
- `answer`: Generated text
- `sources`: Citations
- `confidence`: Confidence score
- `context`: Retrieved context

**RecommendationRequest** - Recommendation query
- `context`: User context (ingredients, restrictions, etc.)
- `recommendationType`: 'meal' | 'ingredient' | 'substitution'
- `topK`: Number of recommendations

### Learning Types

**FeedbackEvent** - User feedback
- `type`: 'rating' | 'click' | 'view' | 'prepare' | 'skip'
- `targetId`, `targetType`: What was rated
- `value`: Rating/preference
- `timestamp`, `notes`

**UserPreferenceProfile** - Learned preferences
- `ingredients`: liked/disliked/neutral
- `cuisines`: preferred/avoided
- `mealTypes`, `dietary`: Preferences
- `patterns`: Frequent meals, combinations, timing

## Service Patterns

### Service Class Pattern

All services follow this pattern (based on existing codebase):

```typescript
export class ServiceName {
  // Private state
  private config: ConfigType;
  private cache: Map<string, unknown> = new Map();

  // Constructor with optional config
  constructor(config?: Partial<ConfigType>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Initialization
  public async initialize(): Promise<void> {
    // Setup logic
  }

  // Core methods with JSDoc
  /**
   * Description
   * @param param Parameter description
   */
  public async methodName(param: Type): Promise<ReturnType> {
    // Implementation
  }

  // Private helpers
  private helperMethod(): void {
    // Helper logic
  }
}

// Export singleton instance
export const serviceName = new ServiceName();
```

### Error Handling Pattern

```typescript
import { VectorError, VectorErrorType } from '../types';

// Throw typed errors
throw new VectorError(
  VectorErrorType.SEARCH_FAILED,
  'Descriptive error message',
  originalError
);

// Validate preconditions
private ensureInitialized(): void {
  if (!this.initialized) {
    throw new VectorError(
      VectorErrorType.INITIALIZATION_FAILED,
      'Service not initialized'
    );
  }
}
```

### Async Operation Pattern

```typescript
// Single operation
public async operation(params: Type): Promise<Result> {
  this.ensureInitialized();

  try {
    // Operation logic
    const result = await this.performOperation(params);
    return result;
  } catch (error) {
    throw new VectorError(
      VectorErrorType.OPERATION_FAILED,
      'Operation failed',
      error
    );
  }
}

// Batch operation
public async batchOperation(items: Type[]): Promise<BatchResult> {
  const results: Result[] = [];
  const errors: Error[] = [];

  for (const item of items) {
    try {
      results.push(await this.operation(item));
    } catch (error) {
      errors.push(error);
    }
  }

  return {
    successful: results.length,
    failed: errors.length,
    results,
    errors
  };
}
```

## Integration Points

### 1. Inventory Service Integration

**Purpose**: Enhanced expiry recommendations using RAG

```typescript
// In inventory.service.ts
import { ragService } from '@/services/vector';

async getExpiryRecommendations(items: InventoryItem[]): Promise<Recommendation[]> {
  const ingredients = items.map(i => i.name);

  const recommendations = await ragService.recommendMeals({
    context: {
      availableIngredients: ingredients,
      timeConstraint: 30,
      // ... other context
    },
    recommendationType: 'meal',
    topK: 5
  });

  return recommendations;
}
```

### 2. Predictions Service Integration

**Purpose**: Enhanced ML predictions with learned patterns

```typescript
// In predictions.service.ts
import { learningService } from '@/services/vector';

async predictUsage(itemId: string): Promise<UsagePrediction> {
  // Get base prediction
  const basePrediction = this.calculateBasePrediction(itemId);

  // Enhance with learned patterns
  const userProfile = await learningService.getUserProfile(userId);
  const enhancedPrediction = this.adjustWithProfile(
    basePrediction,
    userProfile
  );

  return enhancedPrediction;
}
```

### 3. Prep Orchestrator Integration

**Purpose**: Semantic recipe search and technique lookup

```typescript
// In prep-orchestrator.ts
import { semanticSearchService } from '@/services/vector';

async findSimilarRecipes(description: string): Promise<Recipe[]> {
  const results = await semanticSearchService.searchMealPatterns({
    text: description,
    topK: 10,
    threshold: 0.70
  });

  return results.map(r => r.document);
}
```

### 4. Meals Slice Integration

**Purpose**: Semantic meal logging with automatic tagging

```typescript
// In mealsSlice.ts
import { ragService, learningService } from '@/services/vector';

async logMeal(meal: MealLog): Promise<void> {
  // Log to vector DB for semantic search
  await ragService.indexMealLog(meal);

  // Record feedback for learning
  await learningService.recordFeedback({
    type: 'prepare',
    targetId: meal.patternId,
    targetType: 'meal',
    value: { preference: 'positive' }
  });

  // Store locally
  dispatch(addMealLog(meal));
}
```

### 5. Patterns Slice Integration

**Purpose**: Intelligent pattern recommendations

```typescript
// In patternsSlice.ts
import { ragService } from '@/services/vector';

async getRecommendedPatterns(): Promise<MealPattern[]> {
  const userContext = this.buildUserContext();

  const recommendations = await ragService.recommendMeals({
    context: userContext,
    recommendationType: 'meal',
    topK: 10
  });

  return recommendations;
}
```

## Configuration

### RuVector Connection

```typescript
// Environment variables
RUVECTOR_API_URL=http://localhost:8000
RUVECTOR_API_KEY=your_api_key

// Configuration object
const config: RuVectorConfig = {
  apiUrl: process.env.RUVECTOR_API_URL,
  apiKey: process.env.RUVECTOR_API_KEY,
  timeout: 30000,
  defaultEmbeddingModel: 'all-MiniLM-L6-v2',
  defaultDimensions: 384,
  retry: {
    maxAttempts: 3,
    backoffMs: 1000
  },
  cache: {
    enabled: true,
    ttlSeconds: 3600,
    maxSize: 1000
  }
};
```

### Collection Configurations

```typescript
// HNSW index for meal patterns
mealPatterns: {
  name: 'meal_patterns',
  metric: 'cosine',
  dimensions: 384,
  indexType: 'hnsw',
  hnswConfig: {
    m: 16,              // Connections per layer
    efConstruction: 200, // Build quality
    efSearch: 100       // Search quality
  }
}
```

## Data Flow

### Semantic Search Flow

```
User Query
    ↓
EmbeddingService.embed(query)
    ↓
RuVectorService.search(collection, embedding)
    ↓
[RuVector performs ANN search]
    ↓
Results filtered by threshold
    ↓
Return SearchResult<Metadata>[]
```

### RAG Recommendation Flow

```
User Context (ingredients, preferences)
    ↓
RAGService.buildQuery(context)
    ↓
SemanticSearch across collections
    ↓
GraphService.findSubstitutions(missing)
    ↓
RAGService.buildContext(results)
    ↓
LLM generates recommendations
    ↓
LearningService.recordFeedback(implicit)
    ↓
Return MealRecommendation[]
```

### Learning Flow

```
User Interaction (rate, prepare, skip)
    ↓
FeedbackService.recordEvent(event)
    ↓
[Accumulate feedback events]
    ↓
TrainingService.createBatch(events)
    ↓
PersonalizationService.updateProfile(batch)
    ↓
[Update embeddings/weights]
    ↓
Improved recommendations
```

## Performance Considerations

### Caching Strategy

1. **Embedding Cache**: Cache generated embeddings (1 hour TTL)
2. **Search Cache**: Cache frequent search results (30 min TTL)
3. **Profile Cache**: Cache user profiles (1 hour TTL)
4. **Graph Cache**: Cache subgraph queries (permanent)

### Batch Operations

- Use `batchUpsert` for bulk document insertion
- Use `embedBatch` for multiple text embeddings
- Process feedback events in batches (32-64 events)

### Index Optimization

- Rebuild indexes weekly during low-traffic periods
- Use HNSW for fast approximate search
- Tune `efSearch` for speed/accuracy tradeoff

## Security Considerations

### API Security

- Store API keys in environment variables
- Use HTTPS for all RuVector communication
- Implement rate limiting on API calls
- Validate all user inputs before embedding

### Data Privacy

- Never embed PII (emails, phone numbers)
- Anonymize user IDs in feedback events
- Implement data retention policies
- Allow users to delete their data

## Testing Strategy

### Unit Tests

- Test each service in isolation
- Mock RuVector API responses
- Test error handling and edge cases
- Validate type safety

### Integration Tests

- Test service interactions
- Verify database connectivity
- Test batch operations
- Validate search quality

### Performance Tests

- Benchmark embedding generation
- Measure search latency
- Test batch operation throughput
- Monitor memory usage

## Deployment

### Initial Setup

1. Install RuVector database
2. Configure connection settings
3. Initialize collections
4. Seed initial data
5. Build indexes

### Data Migration

1. Export existing meal patterns
2. Generate embeddings
3. Bulk import to RuVector
4. Validate data integrity
5. Switch to vector search

### Monitoring

- Track API latency
- Monitor embedding generation time
- Track search quality metrics
- Monitor feedback collection rate
- Track model performance metrics

## Next Steps

### Phase 1: Core Implementation (Current)
- ✅ Type definitions complete
- ✅ Core services (RuVector, Embedding, Collection)
- ⏳ Configuration complete
- ⏳ Service stubs created

### Phase 2: Search & Graph
- Semantic search service
- Hybrid search service
- Knowledge graph service
- Substitution finder
- Graph builder

### Phase 3: RAG Pipeline
- RAG orchestration service
- Context builder
- Recommender service
- Query expansion

### Phase 4: Learning
- Feedback collection
- Model training
- Personalization service
- A/B testing framework

### Phase 5: Seeders & Data
- Meal pattern seeder
- Ingredient knowledge base
- Graph relationship seeding
- Initial data migration

## References

- RuVector Documentation: [Link to RuVector docs]
- Existing Service Patterns: `src/services/inventory/`
- Type Definitions: `src/types/`
- Configuration: `src/services/vector/config/`
