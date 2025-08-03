const express = require('express');
const cors = require('cors');
require('dotenv').config();

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


app.post('/api/route', (req, res) => {
  const { source, destination } = req.body;


  if (!source || !destination) {
    return res.status(400).json({ 
      error: 'Source and destination coordinates are required' 
    });
  }
  
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
