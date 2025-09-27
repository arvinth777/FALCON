const { GoogleGenerativeAI } = require('@google/generative-ai');
const Bottleneck = require('bottleneck');

// In-memory cache for AI responses with TTL
const aiCache = new Map();
const AI_TTL_MS = 90 * 1000; // 90 seconds (60-120s range) to avoid duplicate calls

// Rate limiter to prevent hitting Gemini quota
const limiter = new Bottleneck({
  reservoir: 20,               // 20 tokens in burst bucket
  reservoirRefreshAmount: 20,  // refill amount
  reservoirRefreshInterval: 60 * 1000, // every 60s
  minTime: 200                 // at most 5 req/s
});

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
  this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; // SDK expects short model name
    this.temperature = parseFloat(process.env.GEMINI_TEMPERATURE || '0.4'); // Optimal for deterministic pilot responses
    this.maxOutputTokens = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '1024'); // Modest limit for concise responses
    this.timeout = parseInt(process.env.GEMINI_TIMEOUT_MS || '15000'); // Faster timeout

    if (!this.apiKey) {
      console.warn('GEMINI_API_KEY not configured - AI features will be disabled');
      this.isAvailable = false;
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.geminiModel = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxOutputTokens
        }
      });
      this.isAvailable = true;
      console.log(`Gemini AI service initialized with model: ${this.model}`);
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error.message);
      this.isAvailable = false;
    }
  }

  // Cache helpers
  cacheKey(route, type = 'summary') {
    return `${route}|${type}|${Math.floor(Date.now() / (60 * 1000))}`; // 1-minute buckets
  }

  setCache(key, value) {
    aiCache.set(key, { value, ts: Date.now() });
  }

  getCache(key) {
    const hit = aiCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > AI_TTL_MS) {
      aiCache.delete(key);
      return null;
    }
    return hit.value;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Robust AI call with retry, backoff, and rate limiting
   */
  async callGeminiWithRetry(prompt, maxRetries = 2) {
    return limiter.schedule(async () => {
      let lastError;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.geminiModel.generateContent(prompt);
          return result.response.text();
        } catch (error) {
          lastError = error;

          // Check for rate limiting or server errors (429/503)
          if (error.message.includes('429') || error.message.includes('503') || error.message.includes('quota') || error.message.includes('rate limit')) {
            if (attempt < maxRetries) {
              // Exponential backoff: 1s → 2s → 4s with jitter
              const baseDelay = 1000 * Math.pow(2, attempt);
              const jitter = Math.random() * 200; // Small jitter up to 200ms
              const delay = Math.min(8000, baseDelay + jitter);
              console.log(`Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
              await this.sleep(delay);
              continue;
            }
          }

          // Don't retry on other 4xx errors
          if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
            throw error;
          }

          // Retry on 5xx errors
          if (attempt < maxRetries) {
            const delay = 1000 * Math.pow(2, attempt);
            await this.sleep(delay);
            continue;
          }
        }
      }

      throw lastError;
    });
  }

  /**
   * Derive high-level overall conditions expected by the UI.
   * Prioritizes AI-provided labels when valid, otherwise falls back to
   * flight categories and notable hazards in the current briefing payload.
   *
   * @param {object} briefingData - Aggregated weather briefing data
   * @param {string|undefined} providedLabel - Raw label returned by the AI
   * @returns {"FAVORABLE"|"MARGINAL"|"CHALLENGING"|"UNKNOWN"}
   */
  computeOverallConditions(briefingData, providedLabel) {
    const normalizedProvided = (providedLabel || '').toString().trim().toUpperCase();
    const allowedLabels = new Set(['FAVORABLE', 'MARGINAL', 'CHALLENGING']);
    if (allowedLabels.has(normalizedProvided)) {
      return normalizedProvided;
    }

    const airports = Array.isArray(briefingData?.airports) ? briefingData.airports : [];
    const categories = airports
      .map(airport => (airport?.flightCategory || '').toString().trim().toUpperCase())
      .filter(Boolean);

    if (categories.some(cat => cat === 'LIFR' || cat === 'IFR')) {
      return 'CHALLENGING';
    }

    if (categories.some(cat => cat === 'MVFR')) {
      return 'MARGINAL';
    }

    if (categories.some(cat => cat === 'VFR')) {
      return 'FAVORABLE';
    }

    const hazards = briefingData?.hazards || {};
    const sigmetCount = hazards.sigmets?.active?.length || 0;
    const convectiveCount = hazards.convective?.active?.length || 0;
    const severePirep = Array.isArray(hazards.pireps?.recent)
      ? hazards.pireps.recent.some(pirep => {
          const intensity = (pirep?.turbulence?.intensity || '').toString().trim().toUpperCase();
          return intensity === 'SEVERE' || intensity === 'EXTREME';
        })
      : false;

    if (sigmetCount > 0 || convectiveCount > 0 || severePirep) {
      return 'CHALLENGING';
    }

    if (normalizedProvided.length > 0) {
      // Preserve legacy values (e.g., VFR/IFR) so downstream consumers can inspect them if needed.
      return allowedLabels.has(normalizedProvided) ? normalizedProvided : 'UNKNOWN';
    }

    return airports.length > 0 ? 'FAVORABLE' : 'UNKNOWN';
  }

  /**
   * Consolidated AI briefing generation (single call for everything)
   */
  async generateBriefingSummary(briefingData) {
    if (!this.isAvailable) {
      return this.getFallbackSummary(briefingData);
    }

    const cacheKey = this.cacheKey(briefingData.route, 'complete');
    const cached = this.getCache(cacheKey);
    if (cached) {
      console.log('Returning cached AI summary');
      return cached;
    }

    try {
      const prompt = this.buildConsolidatedPrompt(briefingData);
      const result = await this.callGeminiWithRetry(prompt);

      const parsed = this.parseConsolidatedResponse(result);
      parsed.overallConditions = this.computeOverallConditions(briefingData, parsed.overallConditions);
      this.setCache(cacheKey, parsed);

      return parsed;
    } catch (error) {
      console.error('Gemini AI error:', error.message);
      const fallback = this.getFallbackSummary(briefingData);
      fallback.overallConditions = this.computeOverallConditions(briefingData, fallback.overallConditions);
      this.setCache(cacheKey, fallback); // Cache fallback to prevent repeated failures
      return fallback;
    }
  }

  /**
   * Build single consolidated prompt for all AI features
   */
  buildConsolidatedPrompt(briefingData) {
    const airports = briefingData.airports || [];
    const hazards = briefingData.hazards || {};

    // Extract raw METAR data for pilot reference
    const rawMetars = {};
    airports.forEach(airport => {
      if (airport.hasMetar && briefingData.metarsByIcao?.[airport.icao]?.rawText) {
        rawMetars[airport.icao] = briefingData.metarsByIcao[airport.icao].rawText;
      }
    });

    // Analyze thunderstorm locations relative to route
    const thunderstormAnalysis = this.analyzeThunderstormRelevance(briefingData);

    // Compact the data to reduce tokens
    const compactData = {
      route: briefingData.route,
      airports: airports.map(airport => ({
        icao: airport.icao,
        name: airport.name,
        category: airport.flightCategory,
        hasData: airport.hasMetar && airport.hasTaf,
        wind: airport.metar?.wind,
        visibility: airport.metar?.visibility,
        ceiling: airport.metar?.ceiling,
        weather: airport.metar?.weatherPhenomena,
        forecast: airport.taf?.forecastBlocks?.[0],
        rawMetar: rawMetars[airport.icao]
      })).filter(a => a.hasData),
      hazards: {
        sigmets: hazards.sigmets?.active?.length || 0,
        pireps: hazards.pireps?.recent?.length || 0,
        thunderstorms: thunderstormAnalysis
      },
      rawMetars
    };

    return `You are an aviation weather assistant writing for both pilots and general aviation enthusiasts. Using the weather data below, output structured JSON that explains conditions in clear, plain English that anyone can understand. Avoid technical aviation jargon.

ROUTE: ${briefingData.route}

INPUT:
- Airports: ${JSON.stringify(compactData.airports)}
- Hazards: {sigmets:${compactData.hazards.sigmets}, pireps:${compactData.hazards.pireps}}
- Thunderstorms: ${JSON.stringify(compactData.hazards.thunderstorms)}

Return only JSON in this exact format:
{
  "summary": "Detailed, easy-to-understand weather explanation for non-pilots. Avoid aviation jargon like MVFR/VFR/IFR. Instead use plain language like 'excellent visibility', 'low clouds at 2500 feet', 'moderate visibility with some fog', 'poor visibility due to rain'. Explain conditions at each airport and along the route in 3-4 sentences that anyone can understand.",
  "hazards": [
    "Specific hazard 1 (e.g. 'Thunderstorms 30nm west of Phoenix with lightning and heavy rain')",
    "Specific hazard 2 in plain language",
    "Specific hazard 3 avoiding technical terms"
  ],
  "altitude": {
    "recommended": "FL300",
    "rationale": [
      "Primary reason explained in simple terms",
      "Secondary consideration in plain language"
    ]
  },
  "caveats": [
    "Important limitation or note in clear language",
    "Verification requirement explained simply"
  ]
}

Focus on safety-critical information. Write in plain English that both pilots and non-pilots can easily understand. Explain weather conditions clearly without technical aviation terminology.`;
  }

  /**
   * Analyze thunderstorm relevance to flight route
   */
  analyzeThunderstormRelevance(briefingData) {
    const hazards = briefingData.hazards || {};
    const sigmets = hazards.sigmets?.active || [];
    const airports = briefingData.airports || [];

    const thunderstorms = sigmets
      .filter(sigmet => sigmet.phenomenon === 'CONVECTIVE' || sigmet.rawText?.includes('TS'))
      .map(sigmet => {
        // Simple geographic analysis - get rough center of thunderstorm area
        const coords = sigmet.geometry?.coordinates?.[0] || [];
        if (coords.length === 0) return null;

        const centerLon = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
        const centerLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;

        // Determine relevance based on proximity to route airports
        let relevance = 'LOW';
        let nearestAirport = null;
        let minDistance = Infinity;

        airports.forEach(airport => {
          const distance = Math.sqrt(
            Math.pow(airport.latitude - centerLat, 2) +
            Math.pow(airport.longitude - centerLon, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestAirport = airport.icao;
          }
        });

        // Rough distance thresholds (in degrees, ~60nm per degree)
        if (minDistance < 1) relevance = 'HIGH';
        else if (minDistance < 2) relevance = 'MEDIUM';

        return {
          centerLat,
          centerLon,
          relevance,
          nearestAirport,
          validFrom: sigmet.validFrom,
          validTo: sigmet.validTo,
          rawText: sigmet.rawText
        };
      })
      .filter(Boolean);

    return thunderstorms;
  }

  /**
   * Parse consolidated AI response
   */
  parseConsolidatedResponse(responseText) {
    try {
      // Clean the response text
      let cleanText = responseText.trim();

      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\s*/, '').replace(/```\s*$/, '');

      const parsed = JSON.parse(cleanText);

      // Validate and transform to match new structure
      return {
        summary: parsed.summary || "Weather conditions along route - manual review recommended",
        hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [
          "AI analysis completed - review detailed weather data below"
        ],
        altitude: {
          recommended: parsed.altitude?.recommended || "FL300",
          rationale: Array.isArray(parsed.altitude?.rationale) ? parsed.altitude.rationale : [
            "Standard cruise altitude for this route type"
          ]
        },
        caveats: Array.isArray(parsed.caveats) ? parsed.caveats : [
          "Verify current NOTAMs and TFRs",
          "Check for updates before departure"
        ],
        // Legacy fields for backward compatibility
        routeSummary: parsed.summary || "Weather conditions along route - manual review recommended",
        keyFindings: Array.isArray(parsed.hazards) ? parsed.hazards : ["AI analysis completed"],
        overallConditions: 'UNKNOWN',
        confidence: 'MEDIUM',
        altitudeRecommendation: {
          recommended: parsed.altitude?.recommended || "FL300",
          alternatives: ["FL280", "FL320"],
          rationale: Array.isArray(parsed.altitude?.rationale) ? parsed.altitude.rationale.join('. ') : "Standard cruise altitude"
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);

      // Fallback parsing - extract what we can
      return {
        summary: responseText.slice(0, 200) + "...",
        hazards: ["AI response received but parsing failed", "Manual review recommended"],
        altitude: {
          recommended: "FL300",
          rationale: ["Default recommendation due to parsing error"]
        },
        caveats: ["Verify current weather conditions", "Check NOTAMs and TFRs"],
        // Legacy fields
        routeSummary: responseText.slice(0, 200) + "...",
        keyFindings: ["AI response received but parsing failed", "Manual review recommended"],
        overallConditions: 'UNKNOWN',
        confidence: 'LOW',
        altitudeRecommendation: {
          recommended: "FL300",
          alternatives: ["FL280", "FL320"],
          rationale: "Default recommendation due to parsing error"
        }
      };
    }
  }

  /**
   * Rule-based fallback when AI is unavailable  
   */
  getFallbackSummary(briefingData) {
    const airports = briefingData.airports || [];
    const activeAirports = airports.filter(a => a.hasMetar || a.hasTaf);
    const hazards = briefingData.hazards || {};

    // Basic condition analysis
    let overallConditions = 'VFR';
    const categories = activeAirports.map(a => a.flightCategory).filter(Boolean);
    if (categories.includes('LIFR')) overallConditions = 'LIFR';
    else if (categories.includes('IFR')) overallConditions = 'IFR';
    else if (categories.includes('MVFR')) overallConditions = 'MVFR';

    const hazardCount = (hazards.sigmets?.active?.length || 0);
    const derivedOverall = this.computeOverallConditions(briefingData, overallConditions);

    // Generate fallback summary using simple rules
    const summaryLabel = derivedOverall === 'UNKNOWN'
      ? 'Unknown'
      : derivedOverall.charAt(0) + derivedOverall.slice(1).toLowerCase();
    const summary = `${summaryLabel} conditions along route ${briefingData.route}. AI analysis unavailable - verify current SIGMETs/TAF.`;
    
    const fallbackHazards = [];
    if (hazardCount > 0) {
      fallbackHazards.push(`${hazardCount} active SIGMET(s) detected`);
    }
    if (hazards.pireps?.recent?.length > 0) {
      fallbackHazards.push(`${hazards.pireps.recent.length} recent PIREP(s)`);
    }
    if (categories.includes('LIFR') || categories.includes('IFR')) {
      fallbackHazards.push('Low visibility/ceiling conditions');
    }
    if (fallbackHazards.length === 0) {
      fallbackHazards.push('No significant hazards detected');
    }

    // FL300 default with rationale
    const altitudeRec = {
      recommended: "FL300",
      rationale: [
        "Default cruise altitude recommendation",
        "Verify SIGMETs for convective activity",
        "Check TAF for destination conditions"
      ]
    };

    const caveats = [
      "AI weather analysis temporarily unavailable", 
      "Manually verify all SIGMETs and TAFs",
      "Check NOTAMs and TFRs before departure",
      "Confirm runway conditions at destination"
    ];

    return {
      summary,
      hazards: fallbackHazards,
      altitude: altitudeRec,
      caveats,
      // Legacy fields for backward compatibility
      routeSummary: summary,
      keyFindings: fallbackHazards,
  overallConditions: derivedOverall,
      confidence: 'LOW',
      altitudeRecommendation: {
        recommended: "FL300",
        alternatives: ["FL280", "FL320"],
        rationale: altitudeRec.rationale.join('. ')
      }
    };
  }

  getFallbackAltitudeRecommendation(briefingData) {
    // Simple rule-based altitude recommendation
    const route = briefingData.route || "";
    const hazards = briefingData.hazards?.active?.length || 0;

    let recommended = "FL300";
    let rationale = "Standard cruise altitude for cross-country flight";

    // Adjust based on route length and hazards
    if (route.includes("KLAX") || route.includes("KJFK")) {
      recommended = "FL320";
      rationale = "Higher altitude recommended for transcontinental route";
    }

    if (hazards > 0) {
      recommended = "FL280";
      rationale = "Lower altitude recommended due to weather hazards";
    }

    return {
      recommended,
      alternatives: ["FL260", "FL300", "FL340"],
      rationale
    };
  }

  getFallbackThunderstormWarnings(thunderstormAnalysis) {
    return thunderstormAnalysis
      .filter(ts => ts.relevance === 'HIGH' || ts.relevance === 'MEDIUM')
      .map(ts => {
        const direction = ts.centerLat > 35 ? 'north' : 'south';
        const nearAirport = ts.nearestAirport ? ` near ${ts.nearestAirport}` : '';

        return {
          location: `Thunderstorm area ${direction} of route${nearAirport}`,
          relevanceToRoute: ts.relevance,
          recommendedAction: ts.relevance === 'HIGH' ?
            'Consider route deviation or altitude change' :
            'Monitor conditions and be prepared to deviate'
        };
      });
  }

  getFallbackAlerts(briefingData) {
    const alerts = [];
    const hazards = briefingData.hazards?.sigmets?.active?.length || 0;

    if (hazards > 0) {
      alerts.push({
        severity: 'MEDIUM',
        message: `${hazards} weather hazards detected along route`,
        affectedArea: 'Route area'
      });
    }

    alerts.push({
      severity: 'LOW',
      message: 'AI weather analysis temporarily unavailable - manual review recommended',
      affectedArea: 'System status'
    });

    return alerts;
  }

  /**
   * Handle chat questions with fallback
   */
  async answerPilotQuestion(question, briefingData) {
    if (!this.isAvailable) {
      return this.getFallbackAnswer(question);
    }

    const cacheKey = this.cacheKey(briefingData.route + question.slice(0, 50), 'chat');
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const prompt = `You are an aviation weather assistant. Answer this pilot's question briefly and accurately.

QUESTION: ${question}

ROUTE: ${briefingData.route}

CONTEXT: ${JSON.stringify({
        airports: briefingData.airports?.slice(0, 2).map(a => ({
          icao: a.icao,
          conditions: a.flightCategory,
          weather: a.metar?.weatherPhenomena
        })),
        hazards: briefingData.hazards?.active?.length || 0
      })}

Provide a brief, helpful response focused on safety. If you cannot answer with the available data, say so clearly.`;

      const result = await this.callGeminiWithRetry(prompt);

      const response = {
        answer: result.slice(0, 500), // Limit response length
        source: 'ai',
        timestamp: new Date().toISOString(),
        route: briefingData.route
      };

      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Gemini Q&A error:', error.message);
      const fallback = this.getFallbackAnswer(question);
      this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  getFallbackAnswer(question) {
    return {
      answer: `AI chat service is temporarily unavailable. Unable to respond to the question: "${question.slice(0, 100)}". Please review the detailed weather briefing data manually.`,
      source: 'fallback',
      timestamp: new Date().toISOString(),
      route: 'unknown'
    };
  }

  // Legacy method compatibility
  async generateAlerts(briefingData) {
    const summary = await this.generateBriefingSummary(briefingData);
    return summary.alerts || [];
  }

  async recommendAltitude(briefingData) {
    const summary = await this.generateBriefingSummary(briefingData);
    return summary.altitudeRecommendation || this.getFallbackAltitudeRecommendation(briefingData);
  }
}

module.exports = new GeminiService();