const express = require('express');
const cors = require('cors');
require('dotenv').config();

const briefingRoutes = require('./routes/briefingRoute');
const chatRoutes = require('./routes/chatRoute');

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

// API Routes
app.use('/api', briefingRoutes);
app.use('/api', chatRoutes);

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error.message);
  console.error('Request path:', req.path);
  console.error('Request query:', req.query);
  
  // Don't log stack trace in production, but do in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', error.stack);
  }
  
  // Handle specific error types with helpful messages
  let statusCode = 500;
  let clientMessage = 'Internal server error while processing your request';
  let suggestion = null;
  
  if (error.message.includes('No weather data available')) {
    statusCode = 404;
    clientMessage = error.message;
    suggestion = 'Double-check ICAO codes (e.g., KJFK not KJFX) or try busier airports like KLAX, KJFK, KORD, KSFO';
  } else if (error.message.includes('ICAO') && error.message.includes('typo')) {
    statusCode = 400;
    clientMessage = 'Likely typo in airport code detected';
    suggestion = 'Check airport codes: did you mean KJFK instead of KJFX?';
  } else if (error.message.includes('fetch failed') || error.message.includes('AWC')) {
    statusCode = 502;
    clientMessage = 'Weather service temporarily unavailable';
    suggestion = 'Aviation Weather Center may be down. Try again in a few minutes.';
  } else if (error.message.includes('timeout')) {
    statusCode = 504;
    clientMessage = 'Weather service request timed out';
    suggestion = 'Service is slow. Try again or use fewer airports in your route.';
  } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
    statusCode = 400;
    clientMessage = 'Invalid request format';
    suggestion = 'Check your route format: ?route=KLAX,KJFK (4-letter airport codes)';
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    clientMessage = 'Request validation failed';
    suggestion = 'Please check your input format and try again';
  } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    statusCode = 502;
    clientMessage = 'External weather service connection failed';
    suggestion = 'Weather data service may be temporarily unavailable';
  }
  
  // Build response object
  const errorResponse = {
    error: clientMessage,
    timestamp: new Date().toISOString(),
    path: req.path
  };
  
  // Add suggestion if available
  if (suggestion) {
    errorResponse.suggestion = suggestion;
  }
  
  // Add helpful examples for briefing requests
  if (req.path.includes('/briefing')) {
    errorResponse.examples = [
      'Try: ?route=KLAX,KJFK (Los Angeles to New York)',
      'Try: ?route=KORD,KEWR (Chicago to Newark)',
      'Try: ?route=KSFO,KBOS (San Francisco to Boston)'
    ];
  }
  
  // Don't expose sensitive error details in production
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = error.message;
  }
  
  res.status(statusCode).json(errorResponse);
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