const router = require('express').Router();
const BriefingService = require('../services/briefingService');

/**
 * GET /api/briefing?route=KLAX,KSFO,KPHX
 * Get weather briefing for a route of ICAO airport codes
 */
router.get('/briefing', async (req, res, next) => {
  try {
    const { route } = req.query;

    // Validate route parameter
    if (!route || typeof route !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'route parameter is required (e.g., ?route=KLAX,KSFO)',
        timestamp: new Date().toISOString()
      });
    }

    // Parse ICAO codes
    const icaoCodes = route.split(',').map(code => code.trim().toUpperCase());
    const validIcaos = icaoCodes.filter(code => /^[A-Z]{4}$/.test(code));

    if (validIcaos.length === 0) {
      return res.status(400).json({
        error: 'Invalid ICAO list',
        message: 'No valid 4-letter ICAO codes found in route parameter',
        provided: route,
        timestamp: new Date().toISOString()
      });
    }

    if (validIcaos.length !== icaoCodes.length) {
      console.warn(`Some invalid ICAO codes filtered out: ${icaoCodes} -> ${validIcaos}`);
    }

    // Get briefing data
    console.log(`Processing briefing request for: ${validIcaos.join(',')}`);
    const briefingData = await BriefingService.getBriefing(validIcaos.join(','));

    res.json({
      success: true,
      data: briefingData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Briefing route error:', error);
    
    // Handle specific error types
    if (error.message.includes('No valid ICAO codes')) {
      return res.status(400).json({
        error: 'Invalid ICAO codes',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
      return res.status(502).json({
        error: 'Upstream service error',
        message: 'Failed to fetch weather data from Aviation Weather Center',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }

    // Pass to global error handler
    next(error);
  }
});

/**
 * GET /api/briefing/summary?route=KLAX,KSFO
 * Get summary briefing (lighter response)
 */
router.get('/briefing/summary', async (req, res, next) => {
  try {
    const { route } = req.query;

    if (!route || typeof route !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'route parameter is required',
        timestamp: new Date().toISOString()
      });
    }

    const summaryData = await BriefingService.getBriefingSummary(route);

    res.json({
      success: true,
      data: summaryData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Briefing summary route error:', error);
    next(error);
  }
});

module.exports = router;