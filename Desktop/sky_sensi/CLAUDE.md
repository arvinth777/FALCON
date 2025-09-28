# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with the Sky Sensi/FALCON aviation weather briefing system.

## Project Overview

**Sky Sensi (FALCON)** is a full-stack aviation weather briefing application that provides pilots with comprehensive weather data aggregation, AI-powered analysis, and interactive visualization for flight planning.

**Tech Stack:**
- **Backend**: Express.js/Node.js with specialized aviation data fetchers
- **Frontend**: React + Vite with Leaflet maps and Recharts visualization
- **AI Integration**: Google Gemini 2.0 Flash API for intelligent weather analysis
- **Architecture**: NPM workspace-based monorepo with comprehensive health monitoring
- **Testing**: Vitest (frontend) + Node.js built-in test runner (backend)
- **Styling**: TailwindCSS with aviation-specific design system
- **Maps**: Leaflet with OpenWeatherMap tile overlays

## Development Commands

### Root Workspace Commands (Recommended)

**Development Workflow:**
```bash
# Verify environment setup and health
npm run verify-setup                    # Comprehensive environment verification
npm run health:check                    # Enhanced health monitoring system

# Install dependencies
npm run bootstrap                       # Install deps for both workspaces
npm run clean-install                   # Clean reinstall of all dependencies

# Start development servers
npm run dev                            # Concurrent backend + frontend development
npm run backend:dev                    # Backend only (port 3001)
npm run frontend:dev                   # Frontend only (port 3000)

# Health monitoring
npm run health:quick                   # Quick health check
npm run health:monitor                 # Continuous monitoring mode
npm run health-ping                    # Ping both services
```

**Advanced Development Tools:**
```bash
# Performance monitoring
npm run performance:monitor            # Start performance monitoring
npm run performance:report             # Generate performance metrics

# Dependency management
npm run dependencies:validate          # Check dependency health
npm run dependencies:fix              # Auto-fix dependency issues

# Environment management
npm run environment:validate          # Validate environment variables
npm run environment:setup             # Create missing .env files

# Automated troubleshooting
npm run troubleshoot                  # Analyze and suggest fixes
npm run troubleshoot:dry-run          # Show potential fixes without applying
```

### Backend Commands
```bash
cd backend

# Development
npm run dev                           # Nodemon with auto-reload
npm start                            # Production mode
npm run validate-env                  # Pre-flight environment check

# Testing & Health
npm test                             # Run all tests with coverage
npm run test:unit                    # Unit tests only
npm run test:watch                   # Watch mode testing
npm run health                       # Backend health endpoint check

# Service-specific health checks
npm run health:gemini                # Google Gemini AI service
npm run health:awc                   # Aviation Weather Center APIs
npm run health:backend               # Internal backend health
```

### Frontend Commands
```bash
cd frontend

# Development
npm run dev                          # Vite dev server (port 3000)
npm run build                        # Production build
npm run preview                      # Preview production build
npm run validate-env                 # Environment validation

# Testing & Quality
npm test                            # Vitest test runner
npm run test:coverage               # Coverage reports
npm run test:watch                  # Watch mode
npm run lint                        # ESLint code quality

# Service health checks
npm run health:frontend             # Frontend service health
npm run health:owm                  # OpenWeatherMap integration
npm run health:openmeteo            # Open-Meteo service
```

## Environment Setup

### Required Environment Files

**Backend (.env):**
```bash
# Server Configuration
PORT=3001
NODE_ENV=development
USER_AGENT=Falcon/1.0 (Hackathon Demo)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3001

# AI Integration
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# Caching (optional)
CACHE_TTL_MINUTES=8
```

**Frontend (.env):**
```bash
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:3001/api

# Environment Settings
VITE_ENV=development
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG_LOGS=true

# Weather Map Integration (optional)
VITE_OWM_KEY=your_openweathermap_api_key
```

### API Key Sources
- **Google Gemini API**: https://makersuite.google.com/app/apikey (required for AI features)
- **OpenWeatherMap**: https://openweathermap.org/api (optional, for weather tile overlays)

### Environment Validation
The system includes comprehensive environment validation:
- **Pre-flight checks**: Both backend and frontend validate required variables before startup
- **Health monitoring**: Continuous validation of API keys and service connectivity
- **Auto-setup**: `npm run environment:setup` can create missing .env files

## Architecture Patterns

### Backend Architecture (`backend/src/`)

**Data Fetchers** (`fetchers/`) - Aviation Weather Center API integrations:
- `metar.js` - Current weather observations with validation
- `taf.js` - Terminal aerodrome forecasts with comprehensive parsing
- `pirep.js` - Pilot reports with geographic filtering
- `sigmet.js` - Domestic significant weather (US/Canada)
- `isigmet.js` - International significant weather with normalization

**Services** (`services/`) - Business logic orchestration:
- `briefingService.js` - Weather data aggregation and coordination
- `geminiService.js` - Google AI integration for weather analysis
- `openMeteoService.js` - Alternative weather data source

**Parsers** (`parsers/`) - Specialized data processing:
- `tafParser.js` - TAF forecast block parsing with time validation

**Cache System** (`cache/`) - Performance optimization:
- `ttlCache.js` - Time-to-live caching for external API rate limiting

**Utilities** (`utils/`) - Core aviation calculations:
- `bbox.js` - Bounding box calculations for geographic weather queries
- `corridor.js` - Flight corridor analysis and weather routing
- `geo.js` - Geographic utilities and coordinate transformations
- `reliabilityCalculator.js` - Forecast accuracy and confidence metrics
- `awcClient.js` - Aviation Weather Center API client with retry logic
- `timestampUtils.js` - Aviation time format handling (Zulu, local, etc.)

### Frontend Architecture (`frontend/src/`)

**Core Components** (`components/`):
- `WeatherMap.jsx` - Interactive Leaflet maps with aviation overlays
- `TAFTimeline.jsx` - Recharts-based forecast timeline visualization
- `AISummary.jsx` - Google Gemini AI-powered weather analysis
- `ChatInterface.jsx` - Interactive weather Q&A system
- `ForecastVsReality.jsx` - METAR vs TAF comparison and accuracy analysis
- `RouteInput.jsx` - Flight route planning interface
- `AlertsDisplay.jsx` - Weather hazard alerts and warnings
- `CorridorSummaryStrip.jsx` - Flight corridor weather summary
- `AltitudeHintBar.jsx` - Altitude-based weather recommendations
- `SkeletonLoader.jsx` - Loading states and UI skeletons
- `MapPopup.jsx` - Interactive map popups for airports and weather

**Services** (`services/`) - External integrations:
- `api.js` - Axios-based API client with error handling and retries

**Utilities** (`utils/`) - Frontend helpers:
- `chartUtils.js` - Chart data processing and formatting
- `mapUtils.js` - Leaflet map utilities and coordinate helpers
- `flightPlanningUtils.js` - Flight planning calculations
- `formatters.js` - Data display formatting
- `validation.js` - Input validation and data integrity checks
- `layoutUtils.js` - Responsive layout and UI utilities

**Hooks** (`hooks/`) - React state management:
- `useLayerPrefs.js` - Map layer preferences and settings

### Health Monitoring System (Root Level)

**Core Modules:**
- `verify-setup.js` - Comprehensive environment verification
- `service-health-checkers.js` - Individual service health validation
- `health-monitor.js` - Continuous health monitoring
- `performance-monitor.js` - System performance tracking
- `dependency-validator.js` - NPM dependency health checking
- `environment-validator.js` - Environment variable validation
- `automated-troubleshooter.js` - Automated issue detection and repair
- `health-reporter.js` - Health status reporting and alerts

### Key Integration Points

1. **Aviation Data Pipeline**: AWC APIs → Backend Fetchers → TTL Cache → Data Services → Frontend Components
2. **AI Integration**: Weather Data + User Context → Gemini 2.0 Flash → Contextual Analysis → UI Display
3. **Map Visualization**: Airport Coordinates + SIGMET Polygons + Weather Overlays → Leaflet Maps
4. **Time-based Analysis**: TAF Forecasts → Parsed Time Blocks → Timeline Charts → Accuracy Tracking
5. **Health Monitoring**: Service Checkers → Performance Monitors → Health Reports → Auto-troubleshooting
6. **Flight Planning**: Route Input → Corridor Analysis → Weather Aggregation → Pilot Briefing

## Testing Strategy

### Backend Testing
- **Framework**: Node.js built-in test runner with c8 coverage
- **Test Structure**: 
  - `backend/src/fetchers/*.test.js` - Aviation data fetcher unit tests
  - `backend/src/parsers/*.test.js` - TAF parsing validation
  - `backend/src/utils/*.test.js` - Utility function tests
- **Coverage**: JSON + HTML reports in `backend/coverage/`
- **Commands**: 
  - `npm test` - Full test suite with coverage
  - `npm run test:watch` - Watch mode for development
  - `npm run test:unit` - Unit tests only

### Frontend Testing  
- **Framework**: Vitest + Testing Library + jsdom
- **Test Structure**:
  - `frontend/test/components/*.test.jsx` - React component tests
  - `frontend/test/services/*.test.js` - API service tests  
  - `frontend/test/utils/*.test.js` - Utility function tests
- **Setup**: `frontend/test/setup.js` - Global test configuration
- **Fixtures**: `frontend/test/fixtures/` - Mock data for testing
- **Commands**:
  - `npm test` - Interactive test runner
  - `npm run test:coverage` - Coverage reports
  - `npm run test:unit` - Single run mode

### Integration Testing
- **Health Monitoring**: Comprehensive service connectivity tests
- **API Integration**: Live Aviation Weather Center API validation
- **End-to-end**: Route planning workflow validation
- **Performance**: Response time and throughput monitoring

## Development Workflow

### Initial Setup Process
1. **Environment Verification**: `npm run verify-setup` - Comprehensive system check
2. **Dependency Installation**: `npm run bootstrap` - Install all workspace dependencies  
3. **Environment Configuration**: 
   - Copy `.env.example` files in both `backend/` and `frontend/`
   - Add required API keys (especially `GEMINI_API_KEY`)
   - Run `npm run environment:validate` to verify configuration
4. **Health Check**: `npm run health:check` - Validate all systems ready
5. **Start Development**: `npm run dev` - Launch both servers concurrently

### Daily Development Routine
```bash
# Morning startup
npm run verify-setup              # Quick environment check
npm run dev                       # Start both servers

# During development  
npm run health:quick              # Periodic health monitoring
npm run performance:report        # Check performance metrics

# Before committing
npm run test:all                  # Run full test suite
npm run lint                      # Code quality check (frontend)
npm run dependencies:validate     # Dependency health check
```

### Port Configuration & Services
- **Backend API Server**: `http://localhost:3001`
  - Health endpoint: `http://localhost:3001/health`
  - API routes: `http://localhost:3001/api/*`
- **Frontend Dev Server**: `http://localhost:3000`  
  - Vite proxy automatically routes `/api/*` to backend
  - Hot module replacement enabled for React components
- **Service Dependencies**:
  - Aviation Weather Center APIs (external)
  - Google Gemini 2.0 Flash API (external)
  - OpenWeatherMap tiles (optional, external)

### Environment-Specific Features

**Development Mode Features:**
- Detailed request/response logging
- Hot module replacement
- Source maps enabled
- Debug logging configurable via `VITE_ENABLE_DEBUG_LOGS`
- Extended API timeouts for debugging

**Production Considerations:**
- `npm run start` - Production server mode
- `npm run frontend:preview` - Production build preview
- Optimized asset bundling with vendor chunk splitting
- Compressed API responses and caching headers

## Advanced Features & Monitoring

### Health Monitoring System
The application includes a sophisticated health monitoring system:

**Automated Health Checks:**
- **Service Connectivity**: Aviation Weather Center, Google Gemini, OpenWeatherMap
- **Environment Validation**: Required variables, API key formats, port availability
- **Dependency Health**: NPM package integrity, security vulnerabilities
- **Performance Monitoring**: Response times, memory usage, error rates
- **System Resources**: Node.js version, npm compatibility, disk space

**Health Check Commands:**
```bash
npm run health:check              # Comprehensive health assessment
npm run health:monitor            # Continuous monitoring mode
npm run health:performance        # Performance-focused monitoring
npm run troubleshoot              # Automated issue detection and suggestions
```

**Real-time Monitoring Features:**
- Service uptime tracking
- API response time monitoring  
- Error rate detection and alerting
- Automatic dependency vulnerability scanning
- Performance bottleneck identification

### Automated Troubleshooting
- **Dependency Issues**: Auto-detection of outdated or vulnerable packages
- **Environment Problems**: Missing variables, invalid API keys, port conflicts
- **Service Outages**: External API availability monitoring and fallback suggestions
- **Performance Issues**: Memory leaks, slow queries, timeout analysis

### Performance Optimization
- **Caching Strategy**: TTL caching for expensive Aviation Weather Center API calls
- **Bundle Optimization**: Vite-based code splitting and tree shaking
- **API Efficiency**: Request batching, response compression, selective data loading
- **Monitoring**: Real-time performance metrics collection and reporting

## Code Quality & Standards

### Linting & Formatting
- **Frontend**: ESLint with React-specific rules, React Hooks linting
- **Code Style**: Consistent formatting with aviation terminology standards
- **Commands**: `npm run lint` from frontend directory
- **Configuration**: Modern React/ES6+ standards with accessibility rules

### Environment Validation
**Comprehensive Pre-flight Checks:**
- **Backend**: `GEMINI_API_KEY`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`, `GEMINI_MODEL`
- **Frontend**: `VITE_API_BASE_URL`, `VITE_ENV`, `VITE_API_TIMEOUT`, `VITE_ENABLE_DEBUG_LOGS`
- **Validation**: Format checking, connectivity testing, compatibility verification
- **Automation**: Pre-start validation hooks prevent misconfigured launches

### Development Standards
- **Aviation Terminology**: Consistent use of ICAO standards and aviation language
- **Error Handling**: Graceful degradation when external services are unavailable
- **Accessibility**: Cockpit-friendly design with high contrast and clear typography
- **Performance**: Optimized for real-time weather data processing and display

## Common Issues & Solutions

### Service Integration Issues
**CORS Configuration:**
- Backend `CORS_ORIGINS` must include all frontend development ports
- Default includes: `http://localhost:3000,http://localhost:5173,http://localhost:3001`
- Update when running on different ports or domains

**API Integration Challenges:**
- Aviation Weather Center APIs may return 204 (No Content) for valid requests
- All fetchers implement graceful fallbacks when data sources are unavailable
- Rate limiting handled with exponential backoff and TTL caching
- AI features require valid `GEMINI_API_KEY` - service degrades gracefully without it

**External Service Dependencies:**
- **AWC APIs**: Respect rate limits, implement caching, handle outages gracefully
- **Google Gemini**: API key validation, quota monitoring, fallback to cached responses  
- **OpenWeatherMap**: Optional service for weather tile overlays, degrades without impact

### Development Environment Issues
**Port Conflicts:**
- Use `npm run verify-setup` to check port availability before starting
- Default ports: Backend 3001, Frontend 3000
- Vite will auto-increment ports if conflicts detected

**Dependency Problems:**
- Run `npm run dependencies:validate` to check for issues
- Use `npm run clean-install` for complete dependency refresh
- Monitor for security vulnerabilities with `npm audit`

**Performance Issues:**
- Monitor with `npm run performance:report`
- Aviation APIs can be slow - timeouts set to 30+ seconds
- Cache TTL configured for optimal balance of freshness vs performance

### Map & Visualization Issues
**Leaflet Dependencies:**
- Requires CSS imports and default icon compatibility package
- Components handle coordinate validation for airport positioning
- Map tiles may fail to load - fallback to simplified display

**Chart Rendering:**
- Recharts requires proper data formatting for time-based displays
- TAF timeline handles complex forecast period overlaps
- Responsive design tested across cockpit display sizes

## Documentation Resources

### Additional Guides
- `SETUP_INSTRUCTIONS.md` - Detailed setup walkthrough
- `DEBUGGING_NOTES.md` - Common debugging scenarios and solutions  
- `HEALTH_MONITORING_GUIDE.md` - Health monitoring system documentation
- `ENVIRONMENT_SETUP_GUIDE.md` - Environment configuration best practices
- `FRONTEND_VERIFICATION_REPORT.md` - Frontend-specific setup verification

### Project Structure
- **Root**: Workspace configuration, health monitoring, verification scripts
- **Backend**: Express API server with aviation data fetchers and AI integration
- **Frontend**: React SPA with interactive maps and visualization components

This comprehensive guide should help you understand and work effectively with the Sky Sensi/FALCON aviation weather system. The application is designed for reliability and graceful degradation, making it suitable for aviation use where data availability and accuracy are critical. 