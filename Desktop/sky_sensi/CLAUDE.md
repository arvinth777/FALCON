# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sky Sensi is a full-stack aviation weather briefing application that aggregates METAR, TAF, PIREP, and SIGMET data from Aviation Weather Center APIs. It provides pilots with comprehensive weather analysis and AI-powered insights for flight planning.

**Tech Stack:**
- Backend: Express/Node.js with aviation data fetchers
- Frontend: React + Vite with Leaflet maps and Recharts
- AI Integration: Google Gemini API for weather analysis
- Architecture: Workspace-based monorepo (backend/ + frontend/)

## Development Commands

### Root Workspace Commands (Recommended)
```bash
# Start both backend and frontend in development mode
npm run dev

# Install dependencies for both workspaces
npm run bootstrap

# Run health checks for both services
npm run health-ping

# Clean and reinstall all dependencies
npm run clean-install
```

### Backend Commands
```bash
cd backend

# Development with auto-reload
npm run dev

# Production start
npm start

# Run tests
npm test

# Validate environment variables
npm run validate-env

# Health check
npm run health
```

### Frontend Commands
```bash
cd frontend

# Development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests with Vitest
npm test

# Lint code with ESLint
npm run lint

# Validate environment variables
npm run validate-env
```

## Environment Setup

### Required Environment Files

**Backend (.env):**
```
PORT=3001
GEMINI_API_KEY=your_google_gemini_api_key
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
CACHE_TTL_MINUTES=8
```

**Frontend (.env):**
```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_ENV=development
```

### Getting API Keys
- Google Gemini API key: https://makersuite.google.com/app/apikey

## Architecture Patterns

### Backend Architecture
- **Data Fetchers** (`backend/src/fetchers/`): Aviation Weather Center API integrations
  - `metar.js` - Current weather observations
  - `taf.js` - Terminal aerodrome forecasts with parsing
  - `pirep.js` - Pilot reports
  - `sigmet.js` - Domestic significant weather
  - `isigmet.js` - International significant weather
- **Services** (`backend/src/services/`): Business logic orchestration
- **Cache System** (`backend/src/cache/`): TTL caching for API rate limiting
- **Parsers** (`backend/src/parsers/`): TAF forecast block parsing
- **Utils** (`backend/src/utils/`): Bounding box calculations for hazard queries

### Frontend Architecture
- **Component Structure** (`frontend/src/components/`):
  - `WeatherMap.jsx` - Leaflet-based interactive maps
  - `TAFTimeline.jsx` - Recharts timeline visualization
  - `AISummary.jsx` - AI-powered weather analysis
  - `ChatInterface.jsx` - Interactive weather questions
  - `ForecastVsReality.jsx` - METAR vs TAF comparison
- **Services** (`frontend/src/services/`): API communication layer
- **Utils** (`frontend/src/utils/`): Chart and map utilities

### Key Integration Points
1. **Aviation Data Flow**: AWC APIs → Backend Fetchers → TTL Cache → Frontend Components
2. **AI Integration**: Weather Data + User Questions → Gemini API → Contextual Responses
3. **Map Visualization**: Airport coordinates + SIGMET polygons → Leaflet maps
4. **Time-based Data**: TAF forecasts → Parsed time blocks → Timeline charts

## Testing

### Backend Testing
- Framework: Node.js built-in test runner
- Test files: `backend/src/fetchers/*.test.js`
- Command: `npm test` (from backend directory)

### Frontend Testing
- Framework: Vitest + Testing Library
- Test files: `frontend/test/**/*.test.js` and `frontend/test/**/*.test.jsx`
- Setup: `frontend/test/setup.js`
- Command: `npm test` (from frontend directory)

## Development Workflow

### Starting Development
1. Ensure Node.js 18+ is installed
2. Copy `.env.example` to `.env` in both backend/ and frontend/
3. Add your GEMINI_API_KEY to backend/.env
4. Run `npm run bootstrap` from root to install dependencies
5. Run `npm run dev` from root to start both servers

### Port Configuration
- Backend API: `http://localhost:3001`
- Frontend Dev Server: `http://localhost:3000`
- Vite proxy configuration handles `/api` routing to backend

### API Rate Limiting
- Aviation Weather Center APIs are cached for 5-10 minutes
- Respects AWC rate limits (<100 requests/minute)
- Implements exponential backoff for 429 responses

## Code Quality

### Linting
- Frontend: ESLint with React-specific rules
- Command: `npm run lint` (from frontend directory)
- Configuration: Standard React/React Hooks rules

### Environment Validation
Both backend and frontend include pre-flight environment validation:
- Backend validates: `GEMINI_API_KEY`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`
- Frontend validates: `VITE_API_BASE_URL`, `VITE_ENV`

## Common Issues

### CORS Configuration
- Backend CORS_ORIGINS must include frontend development ports
- Default includes: `http://localhost:3000`, `http://localhost:5173`, `http://localhost:3001`

### API Integration
- Aviation Weather Center APIs may return 204 (No Content) for valid requests
- All fetchers handle graceful degradation when data sources are unavailable
- AI features require valid GEMINI_API_KEY configuration

### Map Dependencies
- Leaflet requires CSS imports and default icon compatibility
- Components handle coordinate validation for airport positioning