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

Create a `.env` file based on `.env.example`:

```bash
# Backend API URL
VITE_API_BASE_URL=http://localhost:5000/api

# Environment
VITE_ENV=development
# Optional: enables OpenWeatherMap cloud overlay on the route map
VITE_OWM_KEY=your_openweather_api_key
```

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

## Troubleshooting

### Common Issues

**Frontend won't start:**
- Ensure Node.js 18+ is installed
- Delete `node_modules/` and run `npm install` again
- Check for port conflicts (default: 3000)

**API connection errors:**
- Verify backend server is running on the correct port
- Check `VITE_API_BASE_URL` in your `.env` file
- Ensure CORS is properly configured in the backend

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