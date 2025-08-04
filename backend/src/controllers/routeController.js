const osmService = require('../services/osmService');
const GraphService = require('../services/graphService');
const DijkstraService = require('../services/dijkstraService');

class RouteController {
  constructor() {
    this.graphCache = new Map(); // Cache graphs by area
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Calculate shortest route between two points
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async calculateRoute(req, res) {
    try {
      const { source, destination } = req.body;
      
      // Validate input
      if (!this.validateCoordinates(source, destination)) {
        return res.status(400).json({
          error: 'Invalid coordinates. Please provide valid source and destination with lat/lng.'
        });
      }
      
      console.log(`🗺️  Route request: [${source.lat}, ${source.lng}] → [${destination.lat}, ${destination.lng}]`);
      
      const startTime = Date.now();
      
      // Step 1: Get or build road graph
      console.log('📡 Fetching road network data...');
      const graph = await this.getOrBuildGraph(source, destination);
      
      // Step 2: Find shortest path using Dijkstra
      console.log('🔍 Finding shortest path...');
      const dijkstraService = new DijkstraService();
      const result = await dijkstraService.findShortestPath(graph, source, destination);
      
      const processingTime = Date.now() - startTime;
      
      // Step 3: Return successful response
      res.json({
        success: true,
        path: result.path,
        distance: parseFloat(result.distance.toFixed(3)), // km
        duration: result.duration, // minutes
        metrics: {
          totalWeight: parseFloat(result.totalWeight.toFixed(2)),
          nodeCount: result.nodeCount,
          processingTime: `${processingTime}ms`,
          graphStats: {
            nodes: graph.nodes.size,
            edges: graph.edges.size
          }
        },
        debug: {
          sourceNode: result.sourceNode,
          destinationNode: result.destinationNode
        }
      });
      
      console.log(`✅ Route calculated in ${processingTime}ms: ${result.distance.toFixed(2)}km, ${result.duration}min`);
      
    } catch (error) {
      console.error('❌ Route calculation failed:', error.message);
      
      // Determine error type and response
      if (error.message.includes('No road data found')) {
        res.status(404).json({
          error: 'No roads found in the specified area. Try a different location.',
          details: error.message
        });
      } else if (error.message.includes('Could not find nearby intersections')) {
        res.status(404).json({
          error: 'No nearby intersections found. Try clicking closer to roads.',
          details: error.message
        });
      } else if (error.message.includes('No route found') || error.message.includes('No path exists')) {
        res.status(404).json({
          error: 'No route exists between these points. They may be on disconnected road networks.',
          details: error.message
        });
      } else if (error.message.includes('timed out')) {
        res.status(408).json({
          error: 'Request timed out. Try a smaller area or try again later.',
          details: error.message
        });
      } else {
        res.status(500).json({
          error: 'Internal server error during route calculation.',
          details: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later.'
        });
      }
    }
  }

  /**
   * Get cached graph or build new one
   * @param {Object} source - Source coordinates
   * @param {Object} destination - Destination coordinates
   * @returns {Object} Graph object
   */
  async getOrBuildGraph(source, destination) {
    // Create cache key based on area
    const cacheKey = this.createCacheKey(source, destination);
    
    // Check if we have a cached graph
    const cached = this.graphCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log('📋 Using cached graph');
      return cached.graph;
    }
    
    // Fetch new OSM data
    const osmData = await osmService.getRoadData(source, destination);
    
    // Build graph from OSM data
    const graphService = new GraphService();
    const graphResult = graphService.buildGraph(osmData);
    
    // Cache the graph
    this.graphCache.set(cacheKey, {
      graph: graphResult.graph,
      timestamp: Date.now(),
      stats: graphResult.stats
    });
    
    // Clean old cache entries
    this.cleanCache();
    
    return graphResult.graph;
  }

  /**
   * Create cache key from coordinates
   * @param {Object} source - Source coordinates
   * @param {Object} destination - Destination coordinates
   * @returns {string} Cache key
   */
  createCacheKey(source, destination) {
    // Round coordinates to create area-based caching
    const precision = 100; // ~1km precision
    const roundedSouth = Math.floor(Math.min(source.lat, destination.lat) * precision) / precision;
    const roundedNorth = Math.ceil(Math.max(source.lat, destination.lat) * precision) / precision;
    const roundedWest = Math.floor(Math.min(source.lng, destination.lng) * precision) / precision;
    const roundedEast = Math.ceil(Math.max(source.lng, destination.lng) * precision) / precision;
    
    return `${roundedSouth},${roundedWest},${roundedNorth},${roundedEast}`;
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, cached] of this.graphCache) {
      if (now - cached.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.graphCache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Validate coordinate inputs
   * @param {Object} source - Source coordinates
   * @param {Object} destination - Destination coordinates
   * @returns {boolean} True if valid
   */
  validateCoordinates(source, destination) {
    if (!source || !destination) {
      return false;
    }
    
    if (typeof source.lat !== 'number' || typeof source.lng !== 'number' ||
        typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
      return false;
    }
    
    // Check coordinate ranges
    if (source.lat < -90 || source.lat > 90 || destination.lat < -90 || destination.lat > 90) {
      return false;
    }
    
    if (source.lng < -180 || source.lng > 180 || destination.lng < -180 || destination.lng > 180) {
      return false;
    }
    
    // Check if points are too close (less than 10 meters)
    const { calculateDistance } = require('../utils/distance');
    const distance = calculateDistance(source.lat, source.lng, destination.lat, destination.lng);
    if (distance < 0.01) { // 10 meters
      return false;
    }
    
    return true;
  }

  /**
   * Get cache statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getCacheStats(req, res) {
    const stats = {
      totalCacheEntries: this.graphCache.size,
      cacheTimeout: this.cacheTimeout,
      entries: []
    };
    
    for (const [key, cached] of this.graphCache) {
      stats.entries.push({
        key: key,
        age: `${Math.round((Date.now() - cached.timestamp) / 1000)}s`,
        graphSize: {
          nodes: cached.graph.nodes.size,
          edges: cached.graph.edges.size
        }
      });
    }
    
    res.json(stats);
  }
}

module.exports = new RouteController();
