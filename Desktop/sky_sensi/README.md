# FALCON - Aviation Weather Briefing & Visualization

An intelligent aviation weather briefing system that aggregates METAR, TAF, PIREP, and SIGMET data from the Aviation Weather Center (AWC) APIs, providing pilots with comprehensive weather analysis and AI-powered insights for flight planning.

## Architecture Overview

```
Frontend (React/Vue) ←→ Backend (Node.js/Express) ←→ Aviation Weather Center APIs
                                ↓
                         AI Analysis (Gemini API)
```

## Current Implementation Status

### ✅ Backend Foundation (Phase 1 - Complete)
- Express server with CORS and middleware
- Aviation weather data fetchers (METAR, TAF, PIREP, SIGMET, ISIGMET)
- TTL caching system for API rate limiting
- TAF parser for forecast time blocks
- Briefing orchestration service
- Bounding box calculations for hazard queries
- AI chat interface with Gemini integration
- Interactive weather visualization maps
- Real-time weather alerts

### ✅ Frontend Implementation (Phase 2 - Complete)
- React-based weather briefing interface
- Interactive maps with weather overlays
- TAF timeline visualization
- AI-powered weather analysis
- Chat interface for weather questions
- Altitude recommendation system

## Quick Start

### Prerequisites
- Node.js 16.0 or higher
- npm or yarn package manager

### Setup Instructions

1. **Clone and setup backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env file to set your GEMINI_API_KEY (get from https://makersuite.google.com/app/apikey)
   ```

2. **Setup frontend:**
   ```bash
   cd ../frontend
   npm install
   ```

3. **Start both servers:**
   ```bash
   # Terminal 1 - Backend (port 3001)
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend (port 3000)
   cd frontend
   npm run dev
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health check: http://localhost:3001/health

## API Documentation

### Base URL
`http://localhost:3001` (development)

### Endpoints

#### Health Check
```
GET /health
```
Returns server status and timestamp.

#### Weather Briefing
```
GET /api/briefing?route=KLAX,KSFO,KPHX
```

**Parameters:**
- `route` (required): Comma-separated list of 4-letter ICAO airport codes

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "generatedAt": "2025-09-26T10:30:00.000Z",
    "route": "KLAX,KSFO,KPHX",
    "boundingBox": "-122.5,32.5,-112.0,38.5",
    "airports": [
      {
        "icao": "KLAX",
        "name": "Los Angeles International Airport",
        "coordinates": { "lat": 33.9425, "lon": -118.4081 },
        "hasMetar": true,
        "hasTaf": true,
        "forecastComparison": { /* forecast vs reality analysis */ }
      }
    ],
    "metarsByIcao": {
      "KLAX": {
        "icao": "KLAX",
        "observationTime": "2025-09-26T10:00:00Z",
        "temperature": 22,
        "visibility": 10,
        "flightCategory": "VFR",
        "rawText": "KLAX 261000Z 25008KT 10SM FEW015 22/18 A3010"
      }
    },
    "tafsByIcao": {
      "KLAX": {
        "icao": "KLAX",
        "rawTAF": "TAF KLAX...",
        "forecastBlocks": [
          {
            "type": "FM",
            "startTime": "2025-09-26T12:00:00Z",
            "visibility": { "value": "6", "unit": "SM" },
            "ceiling": { "altitude": 2500, "coverage": "BKN" }
          }
        ]
      }
    },
    "hazards": {
      "pireps": {
        "total": 12,
        "recent": [ /* PIREPs from last 3 hours */ ],
        "byType": {
          "turbulence": [ /* turbulence reports */ ],
          "icing": [ /* icing reports */ ]
        }
      },
      "sigmets": {
        "total": 2,
        "active": [ /* currently valid SIGMETs */ ]
      }
    },
    "summary": {
      "airportsWithData": 3,
      "totalHazards": 14,
      "activeWarnings": 2
    }
  }
}
```

> The frontend API client automatically unwraps the top-level `{ "success", "data" }` envelope so consuming components receive the briefing payload directly.

#### AI Chat (Placeholder)
```
POST /api/ai/chat
```

**Request Body:**
```json
{
  "question": "Is it safe to fly VFR from KLAX to KSFO?",
  "briefing": { /* briefing data from /api/briefing */ }
}
```

**Response:** Currently returns 501 (Not Implemented) - AI integration planned for future phases.

### Error Responses

**400 Bad Request:**
```json
{
  "error": "Invalid ICAO list",
  "message": "No valid 4-letter ICAO codes found in route parameter"
}
```

**502 Bad Gateway:**
```json
{
  "error": "Upstream service error",
  "message": "Failed to fetch weather data from Aviation Weather Center"
}
```

## Data Sources

### Aviation Weather Center (AWC) APIs
- **METAR:** Current weather observations
- **TAF:** Terminal aerodrome forecasts  
- **PIREP:** Pilot reports of weather conditions
- **SIGMET:** Significant meteorological information (domestic)
- **ISIGMET:** International significant meteorological information

### Rate Limiting & Caching
- API calls are cached for 5-10 minutes using TTL cache
- Respects AWC rate limits (<100 requests/minute)
- Implements exponential backoff for 429 responses
- Graceful handling of 204 (No Content) responses

## Project Structure

```
backend/
├── src/
│   ├── server.js              # Express application entry point
│   ├── routes/
│   │   ├── briefingRoute.js   # Weather briefing endpoints
│   │   └── chatRoute.js       # AI chat endpoints (placeholder)
│   ├── services/
│   │   └── briefingService.js # Weather data orchestration
│   ├── fetchers/
│   │   ├── metar.js          # METAR data fetcher
│   │   ├── taf.js            # TAF data fetcher
│   │   ├── pirep.js          # PIREP data fetcher
│   │   ├── sigmet.js         # SIGMET data fetcher
│   │   └── isigmet.js        # International SIGMET fetcher
│   ├── parsers/
│   │   └── tafParser.js      # TAF forecast parsing
│   ├── cache/
│   │   └── ttlCache.js       # TTL caching utility
│   └── utils/
│       └── bbox.js           # Bounding box calculations
├── package.json
├── .env.example
└── README.md
```

## Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm test` - Run tests (placeholder)

### Environment Variables
- `PORT` - Server port (default: 3001)
- `CACHE_TTL_MINUTES` - Cache TTL in minutes (default: 8)
- `GEMINI_API_KEY` - Gemini API key (for future AI integration)

## Example Usage

### Get briefing for LAX to SFO route:
```bash
curl "http://localhost:3001/api/briefing?route=KLAX,KSFO"
```

### Get briefing summary:
```bash
curl "http://localhost:3001/api/briefing/summary?route=KLAX,KSFO,KPHX"
```

### Test AI chat (returns 501):
```bash
curl -X POST http://localhost:3001/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the weather conditions?", "briefingData": {"route": "KLAX,KSFO"}}'
```

## Troubleshooting

### Common Issues

#### 1. Port Conflicts
**Symptom:** `EADDRINUSE` error when starting servers
**Solution:** 
- Backend should run on port 3001
- Frontend should run on port 3000
- Check for conflicting processes: `lsof -ti:3001 | xargs kill -9`

#### 2. CORS Errors
**Symptom:** "Access to fetch blocked by CORS policy"
**Solution:**
- Ensure backend includes frontend port in CORS_ORIGINS
- Check that frontend .env points to correct backend URL: `http://localhost:3001/api`
- Restart both servers after environment changes

#### 3. API Key Issues
**Symptom:** "AI service unavailable" or "GEMINI_API_KEY not configured"
**Solution:**
- Get API key from https://makersuite.google.com/app/apikey
- Add to backend/.env: `GEMINI_API_KEY=your_key_here`
- Restart backend server
- Verify with: `curl http://localhost:3001/health`

#### 4. Weather Data Not Loading
**Symptom:** Empty responses or "Failed to fetch weather briefing"
**Solution:**
- Check internet connection to Aviation Weather Center APIs
- Verify ICAO codes are valid 4-letter codes
- Check browser network tab for specific error codes
- Test individual endpoints: `curl "http://localhost:3001/api/briefing?route=KLAX"`

#### 5. Frontend Not Connecting to Backend
**Symptom:** Network errors, API calls failing
**Solution:**
- Verify both servers are running
- Check frontend/.env has correct API base URL: `VITE_API_BASE_URL=http://localhost:3001/api`
- Check vite.config.js proxy settings point to localhost:3001
- Clear browser cache and restart frontend dev server

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
# Backend
DEBUG=falcon:* npm run dev

# Frontend
VITE_ENABLE_DEBUG_LOGS=true npm run dev
```

## Future Development

### Planned AI Features
- Natural language weather interpretation
- Flight safety recommendations  
- Route-specific hazard analysis
- Pilot decision support system

### Frontend Integration
- React/Vue.js weather visualization dashboard
- Interactive maps with weather overlays
- Real-time weather alerts and notifications
- Mobile-responsive design for cockpit use

## Contributing

This project is structured for modular development:
- Backend team focuses on data aggregation and APIs
- AI team will integrate Gemini for natural language processing
- Frontend team will build visualization interfaces

## License

MIT License - See LICENSE file for details

---

**Note:** This is Phase 1 implementation focusing on backend weather data aggregation. AI chat and frontend visualization features will be implemented in subsequent phases by specialized team members.