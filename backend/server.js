const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import OSM service
const osmService = require('./src/services/osmService');
const GraphService = require('./src/services/graphService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ 
    message: 'Route Finder Backend is running!', 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Test OSM data fetching
app.post('/api/test-osm', async (req, res) => {
  try {
    const { source, destination } = req.body;
    
    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination required' });
    }
    
    console.log('🧪 Testing OSM data fetch...');
    const osmData = await osmService.getRoadData(source, destination);
    const stats = osmService.getRoadStats(osmData.elements);
    
    res.json({
      success: true,
      message: 'OSM data fetched successfully!',
      stats: stats,
      bbox: osmData.bbox,
      area: osmData.stats.area + ' km²',
      sampleRoads: osmData.elements.slice(0, 3).map(road => ({
        id: road.id,
        type: road.tags?.highway,
        name: road.tags?.name || 'Unnamed',
        nodes: road.geometry?.length || 0
      }))
    });
    
  } catch (error) {
    console.error('❌ OSM test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test graph building
app.post('/api/test-graph', async (req, res) => {
  try {
    const { source, destination } = req.body;
    
    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination required' });
    }
    
    console.log('🧪 Testing graph building...');
    
    // Step 1: Fetch OSM data
    console.log('📡 Fetching OSM data...');
    const osmData = await osmService.getRoadData(source, destination);
    
    // Step 2: Build graph
    console.log('🏗️  Building graph...');
    const graphService = new GraphService();
    const result = graphService.buildGraph(osmData);
    
    // Step 3: Find nearest nodes to source/destination
    const nearestToSource = graphService.findNodesInRadius(source.lat, source.lng, 0.1);
    const nearestToDestination = graphService.findNodesInRadius(destination.lat, destination.lng, 0.1);
    
    res.json({
      success: true,
      message: 'Graph built successfully!',
      osmStats: {
        totalRoads: osmData.elements.length,
        area: osmData.stats.area + ' km²'
      },
      graphStats: result.stats,
      nearestNodes: {
        toSource: nearestToSource.slice(0, 3).map(n => ({
          nodeId: n.nodeId,
          distance: Math.round(n.distance * 1000) + 'm',
          coordinates: [n.node.lat.toFixed(6), n.node.lng.toFixed(6)]
        })),
        toDestination: nearestToDestination.slice(0, 3).map(n => ({
          nodeId: n.nodeId,
          distance: Math.round(n.distance * 1000) + 'm',
          coordinates: [n.node.lat.toFixed(6), n.node.lng.toFixed(6)]
        }))
      },
      sampleEdges: Array.from(result.graph.edges.entries()).slice(0, 5).map(([edgeId, edge]) => ({
        edgeId: edgeId,
        from: edge.from,
        to: edge.to,
        distance: Math.round(edge.distance * 1000) + 'm',
        weight: edge.weight.toFixed(2),
        roadType: edge.roadType,
        roadName: edge.roadName
      }))
    });
    
  } catch (error) {
    console.error('❌ Graph building test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


app.post('/api/route', (req, res) => {
  const { source, destination } = req.body;


  if (!source || !destination) {
    return res.status(400).json({ 
      error: 'Source and destination coordinates are required' 
    });
  }
   console.log('Received route request:', { source, destination }); 
  // For now, return a simple test response
  res.json({
    message: 'Route calculation endpoint working!',
    received: { source, destination },
    // Mock response for testing
    path: [
      source,
      { lat: (source.lat + destination.lat) / 2, lng: (source.lng + destination.lng) / 2 },
      destination
    ],
    distance: 1.5,
    duration: 8
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Start server
app.listen(PORT,()=>{
console.log(`Server is running on port ${PORT}`);
console.log(`📍 Health check: http://localhost:${PORT}/health`);
console.log(`🗺️  Route API: http://localhost:${PORT}/api/route`);


})

module.exports = app;
