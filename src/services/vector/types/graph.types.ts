/**
 * Knowledge Graph Types
 * Type definitions for ingredient knowledge graph
 */

/**
 * Graph node representing an entity
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  properties: Record<string, unknown>;
  embedding?: number[];
}

/**
 * Node types in the knowledge graph
 */
export type NodeType =
  | 'ingredient'
  | 'meal'
  | 'cuisine'
  | 'technique'
  | 'equipment'
  | 'flavor_profile'
  | 'dietary_restriction'
  | 'season';

/**
 * Graph edge representing a relationship
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: RelationshipType;
  weight: number;
  properties?: Record<string, unknown>;
}

/**
 * Relationship types between nodes
 */
export type RelationshipType =
  | 'SUBSTITUTES_FOR'
  | 'PAIRS_WITH'
  | 'CONTAINS'
  | 'REQUIRES'
  | 'ENHANCES'
  | 'CONFLICTS_WITH'
  | 'SIMILAR_TO'
  | 'CATEGORY_OF'
  | 'SEASON_FOR'
  | 'TECHNIQUE_FOR';

/**
 * Complete knowledge graph
 */
export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  metadata: GraphMetadata;
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  version: string;
  createdAt: Date;
  updatedAt: Date;
  nodeCount: number;
  edgeCount: number;
  nodeTypes: Record<NodeType, number>;
  relationshipTypes: Record<RelationshipType, number>;
}

/**
 * Ingredient substitution with context
 */
export interface IngredientSubstitution {
  /** Original ingredient */
  original: string;

  /** Substitute ingredient */
  substitute: string;

  /** Substitution ratio (e.g., 1.5 means use 1.5x amount) */
  ratio: number;

  /** Context where substitution works best */
  context: string[];

  /** Confidence score */
  confidence: number;

  /** Taste/texture impact */
  impact: 'minimal' | 'slight' | 'moderate' | 'significant';

  /** Notes on usage */
  notes?: string;
}

/**
 * Flavor pairing suggestion
 */
export interface FlavorPairing {
  /** Primary ingredient */
  ingredient1: string;

  /** Paired ingredient */
  ingredient2: string;

  /** Pairing strength (0-1) */
  strength: number;

  /** Cuisines where this pairing is common */
  cuisines: string[];

  /** Common dishes using this pairing */
  dishes: string[];

  /** Flavor compounds in common */
  sharedCompounds?: string[];
}

/**
 * Graph traversal result
 */
export interface GraphTraversalResult {
  /** Path of node IDs */
  path: string[];

  /** Total path weight */
  weight: number;

  /** Relationships along path */
  relationships: RelationshipType[];
}

/**
 * Subgraph query result
 */
export interface SubgraphResult {
  /** Central node */
  centerNode: GraphNode;

  /** Connected nodes */
  connectedNodes: GraphNode[];

  /** Edges in subgraph */
  edges: GraphEdge[];

  /** Depth of traversal */
  depth: number;
}

/**
 * Graph query filters
 */
export interface GraphQueryFilters {
  /** Node types to include */
  nodeTypes?: NodeType[];

  /** Relationship types to traverse */
  relationships?: RelationshipType[];

  /** Maximum depth */
  maxDepth?: number;

  /** Minimum edge weight */
  minWeight?: number;

  /** Property filters */
  propertyFilters?: Record<string, unknown>;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  avgDegree: number;
  maxDegree: number;
  density: number;
  connectedComponents: number;
  clusteredNodes: number;
}

/**
 * Community detection result
 */
export interface CommunityDetectionResult {
  /** Communities (clusters of related ingredients) */
  communities: Array<{
    id: string;
    nodes: string[];
    label: string;
    coherence: number;
  }>;

  /** Modularity score */
  modularity: number;
}

/**
 * Centrality metrics for nodes
 */
export interface CentralityMetrics {
  nodeId: string;
  degreeCentrality: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  pageRank: number;
}
