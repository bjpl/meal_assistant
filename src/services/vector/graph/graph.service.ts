/**
 * Graph Service
 * Knowledge graph operations for ingredients and relationships
 */

import {
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  GraphTraversalResult,
  SubgraphResult,
  GraphQueryFilters,
  IngredientSubstitution,
  FlavorPairing,
  NodeType,
  RelationshipType
} from '../types/graph.types';
import { VectorError, VectorErrorType } from '../types';

/**
 * Graph query result
 */
export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths?: GraphTraversalResult[];
}

/**
 * Graph path
 */
export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
}

/**
 * Graph Service
 */
export class GraphService {
  private graph: KnowledgeGraph;

  constructor() {
    // Initialize empty graph
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      metadata: {
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        nodeCount: 0,
        edgeCount: 0,
        nodeTypes: {} as any,
        relationshipTypes: {} as any
      }
    };
  }

  /**
   * Execute Cypher-style query (simplified implementation)
   * @param cypher Query string
   * @param params Query parameters
   */
  public async executeQuery(
    cypher: string,
    params?: Record<string, unknown>
  ): Promise<GraphQueryResult> {
    try {
      // This is a simplified implementation
      // In production, this would parse and execute actual Cypher queries
      console.log('[Graph] Executing query:', cypher, params);

      return {
        nodes: Array.from(this.graph.nodes.values()),
        edges: Array.from(this.graph.edges.values())
      };
    } catch (error) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create a node in the graph
   * @param type Node type
   * @param properties Node properties
   */
  public async createNode(
    type: NodeType,
    properties: Record<string, unknown>
  ): Promise<string> {
    const id = this.generateId();
    const node: GraphNode = {
      id,
      type,
      label: properties.name as string || type,
      properties
    };

    this.graph.nodes.set(id, node);
    this.graph.metadata.nodeCount++;
    this.graph.metadata.updatedAt = new Date();

    return id;
  }

  /**
   * Create an edge between nodes
   * @param from Source node ID
   * @param to Target node ID
   * @param type Relationship type
   * @param properties Edge properties
   */
  public async createEdge(
    from: string,
    to: string,
    type: RelationshipType,
    properties?: Record<string, unknown>
  ): Promise<void> {
    // Validate nodes exist
    if (!this.graph.nodes.has(from) || !this.graph.nodes.has(to)) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        'Source or target node not found'
      );
    }

    const id = this.generateId();
    const edge: GraphEdge = {
      id,
      source: from,
      target: to,
      relationship: type,
      weight: (properties?.weight as number) || 1.0,
      properties
    };

    this.graph.edges.set(id, edge);
    this.graph.metadata.edgeCount++;
    this.graph.metadata.updatedAt = new Date();
  }

  /**
   * Find path between two nodes
   * @param fromId Starting node ID
   * @param toId Target node ID
   * @param maxHops Maximum hops
   */
  public async findPath(
    fromId: string,
    toId: string,
    maxHops: number = 5
  ): Promise<GraphPath> {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edges: GraphEdge[] }> = [
      { nodeId: fromId, path: [fromId], edges: [] }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === toId) {
        // Found path
        const nodes = current.path.map(id => this.graph.nodes.get(id)!);
        const totalWeight = current.edges.reduce((sum, e) => sum + e.weight, 0);
        return { nodes, edges: current.edges, totalWeight };
      }

      if (current.path.length >= maxHops) {
        continue;
      }

      if (visited.has(current.nodeId)) {
        continue;
      }

      visited.add(current.nodeId);

      // Find outgoing edges
      for (const edge of this.graph.edges.values()) {
        if (edge.source === current.nodeId && !visited.has(edge.target)) {
          queue.push({
            nodeId: edge.target,
            path: [...current.path, edge.target],
            edges: [...current.edges, edge]
          });
        }
      }
    }

    // No path found
    return { nodes: [], edges: [], totalWeight: 0 };
  }

  /**
   * Get ingredient substitutions
   * @param ingredientId Ingredient node ID
   * @param topK Number of substitutes to return
   */
  public async getSubstitutions(
    ingredientId: string,
    topK: number = 5
  ): Promise<IngredientSubstitution[]> {
    const substitutions: IngredientSubstitution[] = [];

    // Find all SUBSTITUTES_FOR edges
    for (const edge of this.graph.edges.values()) {
      if (
        edge.relationship === 'SUBSTITUTES_FOR' &&
        (edge.source === ingredientId || edge.target === ingredientId)
      ) {
        const sourceNode = this.graph.nodes.get(edge.source);
        const targetNode = this.graph.nodes.get(edge.target);

        if (sourceNode && targetNode) {
          const isForward = edge.source === ingredientId;
          const substituteNode = isForward ? targetNode : sourceNode;

          substitutions.push({
            original: sourceNode.label,
            substitute: substituteNode.label,
            ratio: (edge.properties?.ratio as number) || 1.0,
            context: (edge.properties?.context as string[]) || [],
            confidence: edge.weight,
            impact: (edge.properties?.impact as any) || 'moderate',
            notes: edge.properties?.notes as string
          });
        }
      }
    }

    // Sort by confidence and return top K
    return substitutions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, topK);
  }

  /**
   * Get flavor pairings for an ingredient
   * @param ingredientId Ingredient node ID
   * @param topK Number of pairings to return
   */
  public async getFlavorPairings(
    ingredientId: string,
    topK: number = 10
  ): Promise<FlavorPairing[]> {
    const pairings: FlavorPairing[] = [];

    const node = this.graph.nodes.get(ingredientId);
    if (!node) return [];

    // Find all PAIRS_WITH edges
    for (const edge of this.graph.edges.values()) {
      if (
        edge.relationship === 'PAIRS_WITH' &&
        (edge.source === ingredientId || edge.target === ingredientId)
      ) {
        const pairedNodeId = edge.source === ingredientId ? edge.target : edge.source;
        const pairedNode = this.graph.nodes.get(pairedNodeId);

        if (pairedNode) {
          pairings.push({
            ingredient1: node.label,
            ingredient2: pairedNode.label,
            strength: edge.weight,
            cuisines: (edge.properties?.cuisines as string[]) || [],
            dishes: (edge.properties?.dishes as string[]) || [],
            sharedCompounds: (edge.properties?.sharedCompounds as string[]) || []
          });
        }
      }
    }

    // Sort by strength and return top K
    return pairings
      .sort((a, b) => b.strength - a.strength)
      .slice(0, topK);
  }

  /**
   * Get subgraph around a node
   * @param nodeId Central node ID
   * @param depth Depth of traversal
   * @param filters Optional filters
   */
  public async getSubgraph(
    nodeId: string,
    depth: number = 2,
    filters?: GraphQueryFilters
  ): Promise<SubgraphResult> {
    const centerNode = this.graph.nodes.get(nodeId);
    if (!centerNode) {
      throw new VectorError(
        VectorErrorType.SEARCH_FAILED,
        `Node '${nodeId}' not found`
      );
    }

    const connectedNodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const visited = new Set<string>([nodeId]);

    // BFS to collect nodes and edges
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: nodeId, currentDepth: 0 }
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.currentDepth >= depth) {
        continue;
      }

      // Find connected edges
      for (const edge of this.graph.edges.values()) {
        let connectedNodeId: string | null = null;

        if (edge.source === current.id) {
          connectedNodeId = edge.target;
        } else if (edge.target === current.id) {
          connectedNodeId = edge.source;
        }

        if (connectedNodeId && !visited.has(connectedNodeId)) {
          const connectedNode = this.graph.nodes.get(connectedNodeId);
          if (connectedNode && this.matchesFilters(connectedNode, edge, filters)) {
            visited.add(connectedNodeId);
            connectedNodes.push(connectedNode);
            edges.push(edge);
            queue.push({
              id: connectedNodeId,
              currentDepth: current.currentDepth + 1
            });
          }
        }
      }
    }

    return {
      centerNode,
      connectedNodes,
      edges,
      depth
    };
  }

  /**
   * Get graph statistics
   */
  public getStats() {
    return this.graph.metadata;
  }

  /**
   * Generate unique ID
   * @private
   */
  private generateId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if node/edge matches filters
   * @private
   */
  private matchesFilters(
    node: GraphNode,
    edge: GraphEdge,
    filters?: GraphQueryFilters
  ): boolean {
    if (!filters) return true;

    if (filters.nodeTypes && !filters.nodeTypes.includes(node.type)) {
      return false;
    }

    if (filters.relationships && !filters.relationships.includes(edge.relationship)) {
      return false;
    }

    if (filters.minWeight && edge.weight < filters.minWeight) {
      return false;
    }

    if (filters.propertyFilters) {
      for (const [key, value] of Object.entries(filters.propertyFilters)) {
        if (node.properties[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Clear the graph
   */
  public clear(): void {
    this.graph.nodes.clear();
    this.graph.edges.clear();
    this.graph.metadata.nodeCount = 0;
    this.graph.metadata.edgeCount = 0;
    this.graph.metadata.updatedAt = new Date();
  }

  /**
   * Export graph to JSON
   */
  public export(): string {
    return JSON.stringify({
      nodes: Array.from(this.graph.nodes.values()),
      edges: Array.from(this.graph.edges.values()),
      metadata: this.graph.metadata
    });
  }

  /**
   * Import graph from JSON
   */
  public import(jsonData: string): void {
    const data = JSON.parse(jsonData);

    this.clear();

    for (const node of data.nodes) {
      this.graph.nodes.set(node.id, node);
    }

    for (const edge of data.edges) {
      this.graph.edges.set(edge.id, edge);
    }

    this.graph.metadata = data.metadata;
  }
}

// Export singleton instance
export const graphService = new GraphService();
