const axios = require('axios');

class OSMService {
  constructor() {
    this.overpassUrl = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';
    this.timeout = parseInt(process.env.API_TIMEOUT) || 30000;
  }

  /**
   * Calculate bounding box around two points with padding
   * @param {Object} source - {lat, lng}
   * @param {Object} destination - {lat, lng}
   * @param {number} padding - padding in degrees (default: 0.01)
   * @returns {Object} bounding box {south, west, north, east}
   */
  calculateBoundingBox(source, destination, padding = 0.01) {
    const south = Math.min(source.lat, destination.lat) - padding;
    const north = Math.max(source.lat, destination.lat) + padding;
    const west = Math.min(source.lng, destination.lng) - padding;
    const east = Math.max(source.lng, destination.lng) + padding;
    
    return { south, west, north, east };
  }

  /**
   * Build Overpass API query for roads in bounding box
   * @param {Object} bbox - {south, west, north, east}
   * @returns {string} Overpass query
   */
  buildOverpassQuery(bbox) {
    return `
      [out:json][timeout:30];
      (
        way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"]
          (${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out geom;
    `;
  }

  /**
   * Fetch road data from OpenStreetMap
   * @param {Object} source - {lat, lng}
   * @param {Object} destination - {lat, lng}
   * @returns {Promise<Object>} OSM data
   */
  async getRoadData(source, destination) {
    try {
      console.log(`🗺️  Fetching OSM data for route from [${source.lat}, ${source.lng}] to [${destination.lat}, ${destination.lng}]`);
      
      // Calculate bounding box
      const bbox = this.calculateBoundingBox(source, destination);
      console.log(`📦 Bounding box: ${bbox.south}, ${bbox.west}, ${bbox.north}, ${bbox.east}`);
      
      // Build query
      const query = this.buildOverpassQuery(bbox);
      console.log(`🔍 Overpass query built`);
      
      // Make request to Overpass API
      const response = await axios.post(this.overpassUrl, query, {
        headers: {
          'Content-Type': 'text/plain',
        },
        timeout: this.timeout,
      });

      console.log(`✅ OSM data fetched: ${response.data.elements.length} road segments`);
      
      // Validate response
      if (!response.data || !response.data.elements) {
        throw new Error('Invalid response from Overpass API');
      }

      if (response.data.elements.length === 0) {
        throw new Error('No road data found in the specified area');
      }

      return {
        elements: response.data.elements,
        bbox: bbox,
        timestamp: new Date().toISOString(),
        stats: {
          totalWays: response.data.elements.length,
          area: this.calculateArea(bbox)
        }
      };

    } catch (error) {
      console.error('❌ Error fetching OSM data:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('OSM API request timed out. Try a smaller area.');
      }
      
      if (error.response && error.response.status === 429) {
        throw new Error('OSM API rate limit exceeded. Please try again later.');
      }
      
      if (error.response && error.response.status >= 500) {
        throw new Error('OSM API server error. Please try again later.');
      }
      
      throw new Error(`Failed to fetch road data: ${error.message}`);
    }
  }

  /**
   * Calculate area of bounding box in square kilometers
   * @param {Object} bbox - {south, west, north, east}
   * @returns {number} area in km²
   */
  calculateArea(bbox) {
    const latDiff = bbox.north - bbox.south;
    const lngDiff = bbox.east - bbox.west;
    
    // Rough calculation (not precise for large areas)
    const avgLat = (bbox.north + bbox.south) / 2;
    const latKm = latDiff * 111; // 1 degree lat ≈ 111 km
    const lngKm = lngDiff * 111 * Math.cos(avgLat * Math.PI / 180);
    
    return (latKm * lngKm).toFixed(2);
  }

  /**
   * Filter road data by road type
   * @param {Array} elements - OSM way elements
   * @param {Array} roadTypes - allowed road types
   * @returns {Array} filtered elements
   */
  filterRoadsByType(elements, roadTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential']) {
    return elements.filter(element => {
      const highway = element.tags && element.tags.highway;
      return highway && roadTypes.includes(highway);
    });
  }

  /**
   * Get statistics about fetched road data
   * @param {Array} elements - OSM way elements
   * @returns {Object} statistics
   */
  getRoadStats(elements) {
    const stats = {
      total: elements.length,
      byType: {},
      totalNodes: 0
    };

    elements.forEach(element => {
      const roadType = element.tags?.highway || 'unknown';
      stats.byType[roadType] = (stats.byType[roadType] || 0) + 1;
      stats.totalNodes += element.geometry?.length || 0;
    });

    return stats;
  }
}

module.exports = new OSMService();
