const express = require('express');
const cors = require('cors');
require('dotenv').config();

const briefingRoutes = require('./routes/briefingRoute');
const chatRoutes = require('./routes/chatRoute');
const healthRoutes = require('./routes/healthRoute');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Sky Sensi Aviation Weather API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      briefing: '/api/briefing?route=ICAO1,ICAO2,ICAO3',
      chat: '/api/chat'
    },
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api', briefingRoutes);
app.use('/api', chatRoutes);
app.use('/api', healthRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Sky Sensi Backend API running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});