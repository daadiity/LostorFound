const { calculateDistance } = require('../utils/distance');
const { ROAD_TYPE_WEIGHTS, INTERSECTION_TOLERANCE } = require('../utils/constants');

class GraphService {
  constructor() {
    this.graph = {
      nodes: new Map(),  // nodeId -> {lat, lng, edges: []}
      edges: new Map()   // edgeId -> {from, to, weight, distance, roadType}
    };
    this.nodeIdCounter = 0;
    this.edgeIdCounter = 0;
  }

  /**
   * Build graph from OSM road data
   * @param {Object} osmData - OSM data with elements array
   * @returns {Object} graph with nodes and edges
   */
  buildGraph(osmData) {
    console.log('🏗️  Building graph from OSM data...');
    
    // Reset graph
    this.graph.nodes.clear();
    this.graph.edges.clear();
    this.nodeIdCounter = 0;
    this.edgeIdCounter = 0;

    // Process each road (way) from OSM
    osmData.elements.forEach(way => {
      this.processWay(way);
    });

    // Merge nearby nodes (intersections)
    this.mergeIntersections();

    const stats = {
      totalNodes: this.graph.nodes.size,
      totalEdges: this.graph.edges.size,
      roadTypes: this.getRoadTypeStats()
    };

    console.log(`✅ Graph built: ${stats.totalNodes} nodes, ${stats.totalEdges} edges`);
    console.log('📊 Road types:', stats.roadTypes);

    return {
      graph: this.graph,
      stats: stats
    };
  }

  /**
   * Process a single OSM way (road) into graph nodes and edges
   * @param {Object} way - OSM way element
   */
  processWay(way) {
    const roadType = way.tags?.highway || 'default';
    const roadName = way.tags?.name || 'Unnamed Road';
    const geometry = way.geometry || [];

    if (geometry.length < 2) {
      return; // Skip roads with insufficient geometry
    }

    let previousNodeId = null;

    // Create nodes for each point in the road geometry
    geometry.forEach((point, index) => {
      const nodeId = this.findOrCreateNode(point.lat, point.lon);
      
      // Create edge between consecutive points
      if (previousNodeId !== null) {
        this.createEdge(previousNodeId, nodeId, roadType, roadName);
      }
      
      previousNodeId = nodeId;
    });
  }

  /**
   * Find existing node or create new one at given coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {string} node ID
   */
  findOrCreateNode(lat, lng) {
    // Check if node already exists at this location (within tolerance)
    for (const [nodeId, node] of this.graph.nodes) {
      const distance = calculateDistance(lat, lng, node.lat, node.lng);
      if (distance < INTERSECTION_TOLERANCE) {
        return nodeId; // Reuse existing node
      }
    }

    // Create new node
    const nodeId = `node_${this.nodeIdCounter++}`;
    this.graph.nodes.set(nodeId, {
      lat: lat,
      lng: lng,
      edges: []
    });

    return nodeId;
  }

  /**
   * Create edge between two nodes
   * @param {string} fromNodeId - Source node ID
   * @param {string} toNodeId - Destination node ID
   * @param {string} roadType - Type of road (primary, secondary, etc.)
   * @param {string} roadName - Name of the road
   */
  createEdge(fromNodeId, toNodeId, roadType, roadName) {
    if (fromNodeId === toNodeId) {
      return; // Skip self-loops
    }

    const fromNode = this.graph.nodes.get(fromNodeId);
    const toNode = this.graph.nodes.get(toNodeId);

    if (!fromNode || !toNode) {
      return; // Skip if nodes don't exist
    }

    // Calculate distance between nodes
    const distance = calculateDistance(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
    
    // Calculate weight (distance * road type multiplier)
    const roadWeight = ROAD_TYPE_WEIGHTS[roadType] || ROAD_TYPE_WEIGHTS.default;
    const weight = distance * roadWeight;

    // Create edge ID
    const edgeId = `edge_${this.edgeIdCounter++}`;

    // Create bidirectional edges (most roads allow travel in both directions)
    this.createDirectionalEdge(edgeId + '_forward', fromNodeId, toNodeId, weight, distance, roadType, roadName);
    this.createDirectionalEdge(edgeId + '_backward', toNodeId, fromNodeId, weight, distance, roadType, roadName);
  }

  /**
   * Create a directional edge
   * @param {string} edgeId - Unique edge ID
   * @param {string} fromNodeId - Source node ID
   * @param {string} toNodeId - Destination node ID
   * @param {number} weight - Edge weight for pathfinding
   * @param {number} distance - Actual distance in km
   * @param {string} roadType - Type of road
   * @param {string} roadName - Name of the road
   */
  createDirectionalEdge(edgeId, fromNodeId, toNodeId, weight, distance, roadType, roadName) {
    // Add edge to graph
    this.graph.edges.set(edgeId, {
      from: fromNodeId,
      to: toNodeId,
      weight: weight,
      distance: distance,
      roadType: roadType,
      roadName: roadName
    });

    // Add edge reference to source node
    const fromNode = this.graph.nodes.get(fromNodeId);
    fromNode.edges.push(edgeId);
  }

  /**
   * Merge nodes that are very close together (intersections)
   * This reduces graph complexity and improves pathfinding
   */
  mergeIntersections() {
    console.log('🔄 Merging nearby intersections...');
    
    const nodesToMerge = [];
    const processedNodes = new Set();

    // Find groups of nearby nodes
    for (const [nodeId1, node1] of this.graph.nodes) {
      if (processedNodes.has(nodeId1)) continue;

      const cluster = [nodeId1];
      processedNodes.add(nodeId1);

      for (const [nodeId2, node2] of this.graph.nodes) {
        if (processedNodes.has(nodeId2)) continue;

        const distance = calculateDistance(node1.lat, node1.lng, node2.lat, node2.lng);
        if (distance < INTERSECTION_TOLERANCE * 2) { // Slightly larger tolerance for merging
          cluster.push(nodeId2);
          processedNodes.add(nodeId2);
        }
      }

      if (cluster.length > 1) {
        nodesToMerge.push(cluster);
      }
    }

    // Merge each cluster into a single node
    nodesToMerge.forEach(cluster => {
      this.mergeNodeCluster(cluster);
    });

    console.log(`✅ Merged ${nodesToMerge.length} intersection clusters`);
  }

  /**
   * Merge a cluster of nearby nodes into a single node
   * @param {Array} nodeIds - Array of node IDs to merge
   */
  mergeNodeCluster(nodeIds) {
    if (nodeIds.length < 2) return;

    // Calculate average position for merged node
    let totalLat = 0, totalLng = 0;
    const allEdges = new Set();

    nodeIds.forEach(nodeId => {
      const node = this.graph.nodes.get(nodeId);
      totalLat += node.lat;
      totalLng += node.lng;
      node.edges.forEach(edgeId => allEdges.add(edgeId));
    });

    const avgLat = totalLat / nodeIds.length;
    const avgLng = totalLng / nodeIds.length;

    // Keep the first node, update its position
    const primaryNodeId = nodeIds[0];
    const primaryNode = this.graph.nodes.get(primaryNodeId);
    primaryNode.lat = avgLat;
    primaryNode.lng = avgLng;
    primaryNode.edges = Array.from(allEdges);

    // Update all edges to point to the primary node
    allEdges.forEach(edgeId => {
      const edge = this.graph.edges.get(edgeId);
      if (edge) {
        if (nodeIds.includes(edge.from)) {
          edge.from = primaryNodeId;
        }
        if (nodeIds.includes(edge.to)) {
          edge.to = primaryNodeId;
        }
      }
    });

    // Remove the other nodes
    nodeIds.slice(1).forEach(nodeId => {
      this.graph.nodes.delete(nodeId);
    });

    // Remove duplicate/self-loop edges
    this.removeDuplicateEdges();
  }

  /**
   * Remove duplicate and self-loop edges
   */
  removeDuplicateEdges() {
    const edgesToRemove = [];
    const edgeSignatures = new Set();

    for (const [edgeId, edge] of this.graph.edges) {
      // Remove self-loops
      if (edge.from === edge.to) {
        edgesToRemove.push(edgeId);
        continue;
      }

      // Create signature for duplicate detection
      const signature = `${edge.from}-${edge.to}`;
      if (edgeSignatures.has(signature)) {
        edgesToRemove.push(edgeId);
      } else {
        edgeSignatures.add(signature);
      }
    }

    // Remove flagged edges
    edgesToRemove.forEach(edgeId => {
      this.graph.edges.delete(edgeId);
    });

    // Update node edge references
    for (const [nodeId, node] of this.graph.nodes) {
      node.edges = node.edges.filter(edgeId => this.graph.edges.has(edgeId));
    }
  }

  /**
   * Get statistics about road types in the graph
   * @returns {Object} road type statistics
   */
  getRoadTypeStats() {
    const stats = {};
    
    for (const [edgeId, edge] of this.graph.edges) {
      const roadType = edge.roadType || 'unknown';
      stats[roadType] = (stats[roadType] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get the built graph
   * @returns {Object} graph object
   */
  getGraph() {
    return this.graph;
  }

  /**
   * Find nodes within a radius of given coordinates
   * @param {number} lat - Target latitude
   * @param {number} lng - Target longitude
   * @param {number} radiusKm - Search radius in kilometers
   * @returns {Array} array of nearby node IDs
   */
  findNodesInRadius(lat, lng, radiusKm = 0.1) {
    const nearbyNodes = [];

    for (const [nodeId, node] of this.graph.nodes) {
      const distance = calculateDistance(lat, lng, node.lat, node.lng);
      if (distance <= radiusKm) {
        nearbyNodes.push({
          nodeId: nodeId,
          distance: distance,
          node: node
        });
      }
    }

    // Sort by distance
    nearbyNodes.sort((a, b) => a.distance - b.distance);
    
    return nearbyNodes;
  }
}

module.exports = GraphService;
