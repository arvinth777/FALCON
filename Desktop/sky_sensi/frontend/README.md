# Sky Sensi Frontend

A modern React frontend for the Sky Sensi aviation weather briefing system. This application provides pilots with AI-enhanced weather briefings, real-time hazard alerts, and interactive Q&A capabilities.

## Features

- **Real-time Weather Data**: Current METAR and TAF data from Aviation Weather Center
- **AI-Enhanced Briefings**: Intelligent weather summaries powered by Google Gemini
- **Route-based Analysis**: Multi-airport weather briefings with reliability assessments
- **Interactive Chat**: Ask the AI specific questions about your flight conditions
- **Responsive Design**: Optimized for tablet and desktop use in cockpit environments
- **Dark Theme**: Aviation-friendly interface with high contrast and readability

## Technology Stack

- **React 18** - Modern React with hooks and concurrent features
- **Vite** - Fast build tool and development server
- **TailwindCSS** - Utility-first CSS framework with custom aviation themes
- **Axios** - HTTP client for API communication
- **Lucide React** - Beautiful icons optimized for React

## Prerequisites

- Node.js 18+ 
- npm or yarn package manager
- Sky Sensi backend server running (see `../backend/README.md`)

## Installation

1. **Clone and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your backend API URL
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:3000`

## Environment Configuration

Create a `.env.local` file based on `.env.example`:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:3001/api

# Environment
VITE_ENV=development

# OpenWeatherMap Integration
VITE_OWM_KEY=your_openweather_api_key_here
```

### OpenWeatherMap Integration Setup

Sky Sensi includes interactive weather overlays powered by OpenWeatherMap. Follow these steps to enable weather layer functionality:

#### 1. Obtain a Free API Key

1. **Sign up for OpenWeatherMap:**
   - Visit [https://openweathermap.org/api](https://openweathermap.org/api)
   - Click "Sign Up" and create a free account
   - Verify your email address

2. **Generate your API key:**
   - Log into your OpenWeatherMap account
   - Navigate to the "API keys" section
   - Copy your default API key (typically 32 characters long)
   - Free tier keys work perfectly for development purposes

#### 2. Configure Environment Variables

1. **Add the API key to your local environment:**
   ```bash
   # In your .env.local file
   VITE_OWM_KEY=75706f6d6424c82ed53bbcf3783eef2b
   ```

2. **Restart the development server:**
   ```bash
   # Stop the current dev server (Ctrl+C)
   npm run dev
   ```
   
   **Important:** You MUST restart the Vite development server after adding or modifying environment variables.

#### 3. Available Weather Overlays

The application supports multiple weather layer types that can be toggled on/off through the map controls:

- **Clouds** - Cloud coverage and density
- **Precipitation** - Rain, snow, and precipitation intensity  
- **Wind** - Wind speed and direction patterns
- **Temperature** - Surface temperature distribution
- **Pressure** - Atmospheric pressure systems
- **Snow** - Snow coverage and accumulation

#### 4. Usage and Attribution

- **Free Tier Limits:** OpenWeatherMap free accounts include 1,000 API calls per day
- **Attribution:** Weather data attribution is automatically included in map overlays
- **Data Updates:** Weather layers update every 10-30 minutes depending on the data type
- **Coverage:** Global coverage with higher resolution in populated areas

#### 5. Troubleshooting Weather Overlays

**Weather overlays show "(set VITE_OWM_KEY)" instead of data:**
- Verify your API key is correctly set in `.env.local`
- Ensure you restarted the Vite dev server after adding the key
- Check that your API key is at least 24 characters long
- Verify the key doesn't have extra spaces or quotes

**Weather tiles fail to load:**
- Open browser Developer Tools (F12) and check the Network tab for errors
- Look for 401 (unauthorized) or 403 (forbidden) responses indicating API key issues
- Check for 429 (rate limit) responses if you've exceeded free tier limits
- Verify your internet connection and firewall settings

**Browser extension interference:**
- Some ad blockers or privacy extensions may block weather tile requests
- Try disabling browser extensions temporarily to test
- Whitelist `tile.openweathermap.org` in your ad blocker if needed

**Network connectivity issues:**
- Ensure your network allows HTTPS requests to `tile.openweathermap.org`
- Check corporate firewalls that might block external tile services
- Test direct access to a weather tile URL in your browser

**API key validation:**
- New API keys may take up to 2 hours to become active
- Verify your OpenWeatherMap account is in good standing
- Check the API key hasn't been revoked or expired

## Component Architecture

### Core Components

- **`App.jsx`** - Main application container with state management
- **`RouteInput.jsx`** - ICAO code input with validation
- **`AISummary.jsx`** - AI-generated weather briefing display
- **`AlertsDisplay.jsx`** - Weather hazard alerts with severity indicators
- **`ForecastVsReality.jsx`** - TAF vs METAR comparison with reliability scores
- **`ChatInterface.jsx`** - Interactive AI Q&A interface

### Services & Utilities

- **`services/api.js`** - Axios-based API client with retry logic
- **`utils/validation.js`** - ICAO code validation and route parsing
- **`utils/formatters.js`** - Weather data formatting utilities

### Styling

- **Custom TailwindCSS configuration** with aviation-specific color schemes
- **Flight category colors**: VFR (green), MVFR (yellow), IFR (red), LIFR (purple)
- **Dark cockpit theme** optimized for low-light environments
- **Responsive design** for tablet and desktop use

## API Integration

The frontend integrates with the Sky Sensi backend through two main endpoints:

### Weather Briefing
```javascript
GET /api/briefing?route=KLAX,KSFO,KPHX
```
Fetches comprehensive weather data and AI analysis for the specified route.

### AI Chat
```javascript
POST /api/ai/chat
{
  "question": "What's the best altitude for this route?",
  "briefingData": { ... }
}
```
Sends pilot questions to the AI system with current weather context.

## Development

### Available Scripts

- **`npm run dev`** - Start development server with hot reload
- **`npm run build`** - Build for production
- **`npm run preview`** - Preview production build locally
- **`npm run lint`** - Run ESLint for code quality

### Code Organization

```
src/
├── components/          # React UI components
├── services/           # API and external service integrations
├── utils/              # Utility functions and helpers
├── styles/             # Global CSS and TailwindCSS styles
├── App.jsx             # Main application component
└── main.jsx            # Application entry point
```

### Development Guidelines

- Use functional components with React hooks
- Follow aviation terminology in UI text and comments  
- Maintain accessibility standards for cockpit use
- Test with various ICAO airport codes and route combinations
- Ensure responsive design works on different screen sizes

## Production Build

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Test the production build:**
   ```bash
   npm run preview
   ```

3. **Deploy the `dist/` folder** to your web server or CDN

## Features in Detail

### Route Input
- Real-time ICAO code validation
- Support for multiple airports separated by commas
- Quick-select buttons for common routes
- Error messaging for invalid codes

### AI Summary
- One-line weather briefing for quick assessment
- Key findings with specific weather data references
- Overall flight conditions assessment (Favorable/Marginal/Challenging)
- Confidence levels for AI analysis accuracy
- Toggle to show/hide raw METAR/TAF data

### Weather Alerts
- Prioritized alerts based on flight safety impact
- Severity levels: HIGH (red), MEDIUM (orange), LOW (green)
- Alert types: Turbulence, Icing, Convective, IFR conditions
- Expandable details with rationale and affected areas
- Recommended altitude display

### Forecast vs Reality
- TAF predictions compared to actual METAR observations
- Reliability scoring for visibility, ceiling, and weather phenomena
- Color-coded accuracy indicators
- Trending arrows showing forecast vs actual differences

### Interactive Chat
- Natural language questions about weather conditions
- Context-aware responses using current briefing data
- Suggested questions for common pilot inquiries
- Confidence levels and data references in responses
- Conversation history maintained during session

### Weather Map Overlays
- **Interactive weather layers** powered by OpenWeatherMap
- **Multiple overlay types:** clouds, precipitation, wind, temperature, pressure, snow
- **Real-time data** updated every 10-30 minutes
- **Toggle controls** to enable/disable individual weather layers
- **Zoom-dependent detail** with higher resolution at closer zoom levels
- **Attribution display** for weather data sources and usage compliance

## Troubleshooting

### Common Issues

**Frontend won't start:**
- Ensure Node.js 18+ is installed
- Delete `node_modules/` and run `npm install` again
- Check for port conflicts (default: 3000)

**API connection errors:**
- Verify backend server is running on the correct port
- Check `VITE_API_BASE_URL` in your `.env.local` file
- Ensure CORS is properly configured in the backend

**Weather overlay issues:**
- Verify `VITE_OWM_KEY` is set correctly in `.env.local`
- Restart the Vite dev server after modifying environment variables
- Check browser Developer Tools Network tab for tile loading errors
- Ensure OpenWeatherMap API key is active (may take up to 2 hours for new keys)
- Disable browser extensions that might block external tile requests

**Build errors:**
- Run `npm run lint` to check for code issues
- Ensure all imports are correct
- Check TailwindCSS class names for typos

**Styling issues:**
- Verify TailwindCSS is processing correctly
- Check custom color definitions in `tailwind.config.js`
- Ensure PostCSS is configured properly

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

Optimized for tablet use in cockpit environments with support for touch interactions.

## Contributing

1. Follow the existing code style and patterns
2. Test thoroughly with various weather scenarios
3. Maintain aviation terminology accuracy
4. Ensure accessibility standards are met
5. Update documentation for new features

## License

Part of the Sky Sensi Aviation Weather Briefing System.
