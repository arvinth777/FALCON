const express = require('express');
const path = require('path');

// Import health monitoring system
const ServiceHealthCheckers = require(path.join(process.cwd(), 'service-health-checkers.js'));

const router = express.Router();

// Initialize health checkers
const healthCheckers = new ServiceHealthCheckers();

/**
 * Enhanced health endpoint with detailed service status
 * GET /api/health
 */
router.get('/health', async (req, res) => {
  try {
    const services = ['gemini', 'awc', 'openweathermap', 'openmeteo', 'backend', 'frontend'];
    const serviceResults = {};
    let overallHealthy = true;

    // Check each service
    for (const service of services) {
      try {
        const result = await healthCheckers.checkService(service);
        serviceResults[service] = result;

        if (result.status !== 'healthy') {
          overallHealthy = false;
        }
      } catch (error) {
        serviceResults[service] = {
          status: 'error',
          message: error.message,
          service,
          timestamp: new Date().toISOString(),
          responseTime: -1
        };
        overallHealthy = false;
      }
    }

    const healthReport = {
      overall: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: serviceResults,
      summary: {
        total: services.length,
        healthy: Object.values(serviceResults).filter(s => s.status === 'healthy').length,
        degraded: Object.values(serviceResults).filter(s => s.status === 'degraded').length,
        error: Object.values(serviceResults).filter(s => s.status === 'error').length
      }
    };

    // Return appropriate HTTP status
    const statusCode = overallHealthy ? 200 : 503;
    res.status(statusCode).json(healthReport);

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      overall: 'error',
      message: 'Health check system failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Service status endpoint for real-time monitoring
 * GET /api/health/status
 */
router.get('/health/status', async (req, res) => {
  try {
    const { service } = req.query;

    if (service) {
      // Check specific service
      const result = await healthCheckers.checkService(service);
      res.json(result);
    } else {
      // Quick status check for all services
      const services = ['gemini', 'awc', 'openweathermap', 'openmeteo', 'backend', 'frontend'];
      const quickStatus = {};

      for (const serviceName of services) {
        try {
          const result = await healthCheckers.checkService(serviceName);
          quickStatus[serviceName] = {
            status: result.status,
            responseTime: result.responseTime,
            lastCheck: result.timestamp
          };
        } catch (error) {
          quickStatus[serviceName] = {
            status: 'error',
            message: error.message,
            lastCheck: new Date().toISOString()
          };
        }
      }

      res.json({
        timestamp: new Date().toISOString(),
        services: quickStatus
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Status check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Data source availability endpoint
 * GET /api/health/datasources
 */
router.get('/health/datasources', async (req, res) => {
  try {
    // Check critical aviation data sources
    const dataSources = {
      metar: { service: 'awc', critical: true },
      taf: { service: 'awc', critical: true },
      pirep: { service: 'awc', critical: false },
      sigmet: { service: 'awc', critical: false },
      ai: { service: 'gemini', critical: false },
      weather_overlay: { service: 'openweathermap', critical: false }
    };

    const availability = {};

    for (const [dataSource, config] of Object.entries(dataSources)) {
      try {
        const serviceHealth = await healthCheckers.checkService(config.service);
        availability[dataSource] = {
          available: serviceHealth.status === 'healthy',
          status: serviceHealth.status,
          critical: config.critical,
          service: config.service,
          responseTime: serviceHealth.responseTime,
          lastCheck: serviceHealth.timestamp,
          message: serviceHealth.message
        };
      } catch (error) {
        availability[dataSource] = {
          available: false,
          status: 'error',
          critical: config.critical,
          service: config.service,
          error: error.message,
          lastCheck: new Date().toISOString()
        };
      }
    }

    // Calculate overall data availability
    const criticalSources = Object.entries(availability).filter(([_, config]) => config.critical);
    const criticalAvailable = criticalSources.filter(([_, status]) => status.available);

    const dataQuality = {
      overall: criticalAvailable.length === criticalSources.length ? 'complete' : 'partial',
      critical_available: criticalAvailable.length,
      critical_total: criticalSources.length,
      optional_services: Object.entries(availability).filter(([_, config]) => !config.critical).length
    };

    res.json({
      timestamp: new Date().toISOString(),
      data_quality: dataQuality,
      sources: availability
    });

  } catch (error) {
    res.status(500).json({
      error: 'Data source check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;