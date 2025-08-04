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
