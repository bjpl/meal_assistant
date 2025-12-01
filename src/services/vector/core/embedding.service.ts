/**
 * Embedding Service
 * Generates vector embeddings for text
 */

import { EmbeddingOptions, VectorError, VectorErrorType } from '../types';

/**
 * EmbeddingService class
 * Handles text-to-vector embedding generation
 */
export class EmbeddingService {
  private model: string;
  private dimensions: number;
  private cache: Map<string, number[]> = new Map();

  constructor(model: string = 'all-MiniLM-L6-v2', dimensions: number = 384) {
    this.model = model;
    this.dimensions = dimensions;
  }

  /**
   * Generate embedding for a single text
   * @param text Text to embed
   * @param options Embedding options
   */
  public async embed(
    text: string,
    options?: EmbeddingOptions
  ): Promise<number[]> {
    // Check cache first
    const cacheKey = this.getCacheKey(text, options);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Preprocess text
      const processed = this.preprocessText(text);

      // Generate embedding using simple approach
      // In production, this would call transformers.js or RuVector API
      const embedding = this.generateSimpleEmbedding(processed);

      // Normalize if requested
      const final = options?.normalize ? this.normalizeVector(embedding) : embedding;

      // Cache result
      this.cache.set(cacheKey, final);

      return final;
    } catch (error) {
      throw new VectorError(
        VectorErrorType.EMBEDDING_FAILED,
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts Texts to embed
   * @param options Embedding options
   */
  public async embedBatch(
    texts: string[],
    options?: EmbeddingOptions
  ): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text, options);
      results.push(embedding);
    }

    return results;
  }

  /**
   * Get embedding dimensions
   */
  public getDimensions(): number {
    return this.dimensions;
  }

  /**
   * Get current model
   */
  public getModel(): string {
    return this.model;
  }

  /**
   * Change embedding model
   * @param model Model name
   * @param dimensions Model dimensions
   */
  public setModel(model: string, dimensions: number): void {
    this.model = model;
    this.dimensions = dimensions;
    this.cache.clear(); // Clear cache when model changes
  }

  /**
   * Clear embedding cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Generate cache key
   * @private
   */
  private getCacheKey(text: string, options?: EmbeddingOptions): string {
    const optionsKey = options
      ? JSON.stringify({
          model: options.model || this.model,
          normalize: options.normalize,
          pooling: options.pooling
        })
      : 'default';
    return `${optionsKey}:${text}`;
  }

  /**
   * Preprocess text before embedding
   * @private
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, ''); // Remove punctuation
  }

  /**
   * Generate simple embedding using character-based hashing
   * This is a placeholder - in production use transformers.js or RuVector API
   * @private
   */
  private generateSimpleEmbedding(text: string): number[] {
    const embedding = new Array(this.dimensions).fill(0);
    const words = text.split(' ');

    // Simple word-based embedding using character codes
    words.forEach((word, wordIdx) => {
      for (let i = 0; i < word.length; i++) {
        const charCode = word.charCodeAt(i);
        const index = (charCode + wordIdx) % this.dimensions;
        embedding[index] += Math.sin(charCode * 0.01);
      }
    });

    // Add positional encoding
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] += Math.sin(i / this.dimensions) * 0.1;
    }

    return embedding;
  }

  /**
   * Normalize vector to unit length
   * @private
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  public cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new VectorError(
        VectorErrorType.INVALID_DIMENSIONS,
        'Embeddings must have same dimensions'
      );
    }

    const dotProduct = embedding1.reduce(
      (sum, val, i) => sum + val * embedding2[i],
      0
    );

    const magnitude1 = Math.sqrt(
      embedding1.reduce((sum, val) => sum + val * val, 0)
    );
    const magnitude2 = Math.sqrt(
      embedding2.reduce((sum, val) => sum + val * val, 0)
    );

    return magnitude1 > 0 && magnitude2 > 0
      ? dotProduct / (magnitude1 * magnitude2)
      : 0;
  }

  /**
   * Validate embedding dimensions
   */
  public validateDimensions(embedding: number[]): boolean {
    return embedding.length === this.dimensions;
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
