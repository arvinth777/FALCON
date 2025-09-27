const router = require('express').Router();
const geminiService = require('../services/geminiService');

/**
 * POST /api/ai/chat
 * AI chat endpoint for weather briefing questions
 */
router.post('/ai/chat', async (req, res) => {
  try {
    const { question, briefingData } = req.body || {};

    // Validate required fields
    if (!question || !briefingData) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Both "question" and "briefingData" fields are required',
        required: {
          question: 'string - The pilot\'s question about the weather',
          briefingData: 'object - The briefing data from /api/briefing'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid question',
        message: 'Question must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }

    if (typeof briefingData !== 'object' || !briefingData.route) {
      return res.status(400).json({
        error: 'Invalid briefingData',
        message: 'BriefingData must be a valid briefing object with a route field',
        timestamp: new Date().toISOString()
      });
    }

    // Log the request for debugging
    console.log(`AI Chat request: "${question}" for route: ${briefingData.route}`);

    // Check if AI service is available
    if (!geminiService.isAvailable) {
      return res.status(503).json({
        error: 'AI service unavailable',
        message: 'AI chat functionality requires GEMINI_API_KEY configuration',
        receivedQuestion: question,
        routeAnalyzed: briefingData.route,
        timestamp: new Date().toISOString(),
        setup: [
          'Add GEMINI_API_KEY to .env file',
          'Get API key from https://makersuite.google.com/app/apikey',
          'Restart the server after configuration'
        ]
      });
    }

    // Get AI response
    const aiResponse = await geminiService.answerPilotQuestion(question, briefingData);

    res.json({
      success: true,
      data: {
        question: question.trim(),
        answer: aiResponse.answer,
        dataReferences: aiResponse.dataReferences,
        recommendations: aiResponse.recommendations,
        confidence: aiResponse.confidence,
        route: aiResponse.route,
        timestamp: aiResponse.timestamp
      },
      metadata: {
        aiServiceAvailable: true,
        processingTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Chat route error:', error);
    
    // Handle AI service errors gracefully
    if (error.message.includes('API key') || error.message.includes('unauthorized')) {
      return res.status(401).json({
        error: 'AI authentication failed',
        message: 'Invalid or missing Gemini API key',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'AI service timeout',
        message: 'AI response took too long to generate',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'AI service error',
      message: 'Failed to generate AI response',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/ai/chat/status
 * Get AI chat service status
 */
router.get('/ai/chat/status', (req, res) => {
  res.json({
    service: 'AI Chat',
    status: geminiService.isAvailable ? 'active' : 'unavailable',
    message: geminiService.isAvailable 
      ? 'AI chat service is operational' 
      : 'AI chat service requires GEMINI_API_KEY configuration',
    timestamp: new Date().toISOString(),
    configuration: {
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-pro',
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.3')
    },
    capabilities: geminiService.isAvailable ? [
      'Natural language weather interpretation',
      'Flight safety recommendations',
      'Route-specific hazard analysis',
      'Pilot decision support',
      'Context-aware briefing Q&A'
    ] : [
      'Service unavailable - requires API key configuration'
    ]
  });
});

module.exports = router;