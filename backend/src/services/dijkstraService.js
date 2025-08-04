const { findNearestNode } = require('../utils/distance');

class DijkstraService {
  constructor() {
    this.graph = null;
  }

  /**
   * Find shortest path between two coordinates using Dijkstra's algorithm
   * @param {Object} graph - Graph with nodes and edges
   * @param {Object} source - Source coordinates {lat, lng}
   * @param {Object} destination - Destination coordinates {lat, lng}
   * @returns {Object} Result with path, distance, and duration
   */
  async findShortestPath(graph, source, destination) {
    console.log('🔍 Starting Dijkstra pathfinding...');
    
    this.graph = graph;
    
    try {
      // Step 1: Find nearest nodes to source and destination coordinates
      const sourceNodeId = findNearestNode(graph.nodes, source.lat, source.lng);
      const destNodeId = findNearestNode(graph.nodes, destination.lat, destination.lng);
      
      if (!sourceNodeId || !destNodeId) {
        throw new Error('Could not find nearby intersections for start or end point');
      }
      
      console.log(`📍 Start node: ${sourceNodeId}, End node: ${destNodeId}`);
      
      // Step 2: Run Dijkstra's algorithm
      const pathResult = this.dijkstra(sourceNodeId, destNodeId);
      
      if (!pathResult.path || pathResult.path.length === 0) {
        throw new Error('No route found between the specified points');
      }
      
      // Step 3: Convert node path to coordinate path
      const coordinatePath = this.convertPathToCoordinates(pathResult.path, source, destination);
      
      // Step 4: Calculate additional metrics
      const totalDistance = this.calculatePathDistance(coordinatePath);
      const estimatedDuration = this.estimateTravelTime(pathResult.path);
      
      console.log(`✅ Path found: ${pathResult.path.length} nodes, ${totalDistance.toFixed(2)}km`);
      
      return {
        path: coordinatePath,
        distance: totalDistance,
        duration: estimatedDuration,
        totalWeight: pathResult.totalWeight,
        nodeCount: pathResult.path.length,
        sourceNode: sourceNodeId,
        destinationNode: destNodeId
      };
      
    } catch (error) {
      console.error('❌ Pathfinding failed:', error.message);
      throw error;
    }
  }

  /**
   * Dijkstra's algorithm implementation
   * @param {string} startNodeId - Starting node ID
   * @param {string} endNodeId - Destination node ID
   * @returns {Object} Result with path and total weight
   */
  dijkstra(startNodeId, endNodeId) {
    console.log(`🚀 Running Dijkstra from ${startNodeId} to ${endNodeId}`);
    
    // Initialize data structures
    const distances = new Map();      // nodeId -> shortest distance from start
    const previous = new Map();       // nodeId -> previous node in shortest path
    const unvisited = new Set();      // Set of unvisited nodes
    const visited = new Set();        // Set of visited nodes
    
    // Initialize all distances to infinity
    for (const [nodeId] of this.graph.nodes) {
      distances.set(nodeId, Infinity);
      unvisited.add(nodeId);
    }
    
    // Distance to start node is 0
    distances.set(startNodeId, 0);
    
    let currentNodeId = startNodeId;
    let iterations = 0;
    const maxIterations = this.graph.nodes.size * 2; // Safety limit
    
    // Main Dijkstra loop
    while (unvisited.size > 0 && currentNodeId && iterations < maxIterations) {
      iterations++;
      
      // Mark current node as visited
      visited.add(currentNodeId);
      unvisited.delete(currentNodeId);
      
      // If we reached the destination, we can stop
      if (currentNodeId === endNodeId) {
        console.log(`🎯 Reached destination in ${iterations} iterations`);
        break;
      }
      
      // Examine all neighbors of current node
      const currentNode = this.graph.nodes.get(currentNodeId);
      const currentDistance = distances.get(currentNodeId);
      
      if (currentNode && currentNode.edges) {
        for (const edgeId of currentNode.edges) {
          const edge = this.graph.edges.get(edgeId);
          
          if (!edge || visited.has(edge.to)) {
            continue; // Skip if edge doesn't exist or neighbor already visited
          }
          
          // Calculate distance through current node
          const newDistance = currentDistance + edge.weight;
          const neighborDistance = distances.get(edge.to);
          
          // If we found a shorter path, update it
          if (newDistance < neighborDistance) {
            distances.set(edge.to, newDistance);
            previous.set(edge.to, currentNodeId);
          }
        }
      }
      
      // Find next unvisited node with smallest distance
      currentNodeId = this.findMinimumDistanceNode(unvisited, distances);
      
      // Progress logging for large graphs
      if (iterations % 100 === 0) {
        console.log(`⏳ Processed ${iterations} nodes, ${unvisited.size} remaining`);
      }
    }
    
    // Check if we found a path
    if (!visited.has(endNodeId)) {
      throw new Error('No path exists between the specified points');
    }
    
    // Reconstruct the path
    const path = this.reconstructPath(previous, startNodeId, endNodeId);
    const totalWeight = distances.get(endNodeId);
    
    console.log(`✅ Dijkstra completed in ${iterations} iterations`);
    
    return {
      path: path,
      totalWeight: totalWeight,
      iterations: iterations,
      nodesExplored: visited.size
    };
  }

  /**
   * Find the unvisited node with minimum distance
   * @param {Set} unvisited - Set of unvisited node IDs
   * @param {Map} distances - Map of node distances
   * @returns {string|null} Node ID with minimum distance
   */
  findMinimumDistanceNode(unvisited, distances) {
    let minDistance = Infinity;
    let minNodeId = null;
    
    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId);
      if (distance < minDistance) {
        minDistance = distance;
        minNodeId = nodeId;
      }
    }
    
    return minNodeId;
  }

  /**
   * Reconstruct the shortest path from the previous nodes map
   * @param {Map} previous - Map of previous nodes
   * @param {string} startNodeId - Starting node ID
   * @param {string} endNodeId - Ending node ID
   * @returns {Array} Array of node IDs representing the path
   */
  reconstructPath(previous, startNodeId, endNodeId) {
    const path = [];
    let currentNodeId = endNodeId;
    
    // Work backwards from destination to source
    while (currentNodeId !== undefined) {
      path.unshift(currentNodeId);
      
      if (currentNodeId === startNodeId) {
        break; // Reached the start
      }
      
      currentNodeId = previous.get(currentNodeId);
    }
    
    // Verify we have a complete path
    if (path[0] !== startNodeId || path[path.length - 1] !== endNodeId) {
      throw new Error('Failed to reconstruct complete path');
    }
    
    return path;
  }

  /**
   * Convert node path to coordinate path for frontend display
   * @param {Array} nodePath - Array of node IDs
   * @param {Object} originalSource - Original source coordinates
   * @param {Object} originalDestination - Original destination coordinates
   * @returns {Array} Array of coordinate objects
   */
  convertPathToCoordinates(nodePath, originalSource, originalDestination) {
    const coordinatePath = [];
    
    // Add original source point
    coordinatePath.push({
      lat: originalSource.lat,
      lng: originalSource.lng
    });
    
    // Add coordinates for each node in the path
    nodePath.forEach((nodeId, index) => {
      const node = this.graph.nodes.get(nodeId);
      if (node) {
        // Skip first and last nodes if they're very close to original points
        const isFirst = index === 0;
        const isLast = index === nodePath.length - 1;
        
        if (!isFirst && !isLast) {
          coordinatePath.push({
            lat: node.lat,
            lng: node.lng
          });
        }
      }
    });
    
    // Add original destination point
    coordinatePath.push({
      lat: originalDestination.lat,
      lng: originalDestination.lng
    });
    
    return coordinatePath;
  }

  /**
   * Calculate total distance of coordinate path
   * @param {Array} coordinatePath - Array of coordinate objects
   * @returns {number} Total distance in kilometers
   */
  calculatePathDistance(coordinatePath) {
    const { calculateDistance } = require('../utils/distance');
    let totalDistance = 0;
    
    for (let i = 0; i < coordinatePath.length - 1; i++) {
      const point1 = coordinatePath[i];
      const point2 = coordinatePath[i + 1];
      
      totalDistance += calculateDistance(
        point1.lat, point1.lng,
        point2.lat, point2.lng
      );
    }
    
    return totalDistance;
  }

  /**
   * Estimate travel time based on path and road types
   * @param {Array} nodePath - Array of node IDs
   * @returns {number} Estimated time in minutes
   */
  estimateTravelTime(nodePath) {
    const { AVERAGE_SPEEDS } = require('../utils/constants');
    let totalTime = 0; // in hours
    
    for (let i = 0; i < nodePath.length - 1; i++) {
      const currentNodeId = nodePath[i];
      const nextNodeId = nodePath[i + 1];
      
      // Find the edge between current and next node
      const currentNode = this.graph.nodes.get(currentNodeId);
      if (!currentNode) continue;
      
      let edgeFound = false;
      for (const edgeId of currentNode.edges) {
        const edge = this.graph.edges.get(edgeId);
        if (edge && edge.to === nextNodeId) {
          const speed = AVERAGE_SPEEDS[edge.roadType] || AVERAGE_SPEEDS.default;
          const time = edge.distance / speed; // hours
          totalTime += time;
          edgeFound = true;
          break;
        }
      }
      
      // Fallback if edge not found
      if (!edgeFound) {
        const defaultSpeed = AVERAGE_SPEEDS.default;
        const currentNode = this.graph.nodes.get(currentNodeId);
        const nextNode = this.graph.nodes.get(nextNodeId);
        
        if (currentNode && nextNode) {
          const { calculateDistance } = require('../utils/distance');
          const distance = calculateDistance(
            currentNode.lat, currentNode.lng,
            nextNode.lat, nextNode.lng
          );
          totalTime += distance / defaultSpeed;
        }
      }
    }
    
    // Convert hours to minutes and round
    return Math.round(totalTime * 60);
  }

  /**
   * Get detailed path information for debugging
   * @param {Array} nodePath - Array of node IDs
   * @returns {Array} Array of path segment details
   */
  getPathDetails(nodePath) {
    const details = [];
    
    for (let i = 0; i < nodePath.length - 1; i++) {
      const currentNodeId = nodePath[i];
      const nextNodeId = nodePath[i + 1];
      
      const currentNode = this.graph.nodes.get(currentNodeId);
      const nextNode = this.graph.nodes.get(nextNodeId);
      
      // Find the connecting edge
      let edge = null;
      if (currentNode) {
        for (const edgeId of currentNode.edges) {
          const candidateEdge = this.graph.edges.get(edgeId);
          if (candidateEdge && candidateEdge.to === nextNodeId) {
            edge = candidateEdge;
            break;
          }
        }
      }
      
      details.push({
        from: currentNodeId,
        to: nextNodeId,
        fromCoords: currentNode ? [currentNode.lat, currentNode.lng] : null,
        toCoords: nextNode ? [nextNode.lat, nextNode.lng] : null,
        roadType: edge ? edge.roadType : 'unknown',
        roadName: edge ? edge.roadName : 'Unknown Road',
        distance: edge ? edge.distance : 0,
        weight: edge ? edge.weight : 0
      });
    }
    
    return details;
  }
}

module.exports = DijkstraService;
