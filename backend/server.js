const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import services
const osmService = require('./src/services/osmService');
const GraphService = require('./src/services/graphService');
const routeController = require('./src/controllers/routeController');

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


// REAL ROUTING ENDPOINT - Use this for actual pathfinding
app.post('/api/route', (req, res) => routeController.calculateRoute(req, res));

// Cache statistics endpoint  
app.get('/api/cache-stats', (req, res) => routeController.getCacheStats(req, res));


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



})

module.exports = app;
