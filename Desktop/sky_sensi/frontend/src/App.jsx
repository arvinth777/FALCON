import { useState, useCallback } from 'react'
import { Plane, Cloud, AlertTriangle, Map, BarChart3, TrendingUp } from 'lucide-react'
import RouteInput from './components/RouteInput.jsx'
import CorridorSummaryStrip from './components/CorridorSummaryStrip.jsx'
import AISummary from './components/AISummary.jsx'
import AlertsDisplay from './components/AlertsDisplay.jsx'
import ForecastVsReality from './components/ForecastVsReality.jsx'
import ChatInterface from './components/ChatInterface.jsx'
import WeatherMap from './components/WeatherMap.jsx'
import TAFTimeline from './components/TAFTimeline.jsx'
import AltitudeHintBar from './components/AltitudeHintBar.jsx'
import SkeletonLoader, { 
  MapSkeleton, 
  ChartSkeleton, 
  AISummarySkeleton, 
  AlertSkeleton, 
  ForecastSkeleton, 
  ChatMessageSkeleton, 
  AltitudeBandSkeleton 
} from './components/SkeletonLoader.jsx'
import { fetchBriefing } from './services/api.js'

function App() {
  // State management for the weather briefing interface
  const [briefingData, setBriefingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('');
  const [showRawData, setShowRawData] = useState(false);
  
  // State for advanced visualization components
  const [activeTab, setActiveTab] = useState('overview'); // overview, map, timeline, altitude
  const [mapData, setMapData] = useState({ airports: [], sigmets: [], pireps: [], openMeteoForecasts: {} });
  const [tafTimelineData, setTafTimelineData] = useState([]);
  const [altitudeData, setAltitudeData] = useState({ pireps: [], sigmets: [], winds: [] });

  // Handle fetching weather briefing from backend API
  const handleFetchBriefing = useCallback(async (route) => {
    setLoading(true);
    setError(null);
    setCurrentRoute(route);

    try {
      const validatedData = await fetchBriefing(route);
      setBriefingData(validatedData);
      
      // Process data for visualization components
      if (validatedData) {
        // Prepare map data - handle both root-level and hazards-nested data
  const airports = validatedData.airports || [];
  const sigmets = validatedData.sigmets || validatedData.hazards?.sigmets?.active || [];
  const pireps = validatedData.pireps || validatedData.hazards?.pireps?.recent || [];
  const openMeteoForecasts = validatedData.openMeteoForecasts || {};

  setMapData({ airports, sigmets, pireps, openMeteoForecasts });
        
        // Prepare TAF timeline data - use flightTimeline for simpler visualization
        const tafData = [];
        airports.forEach(airport => {
          if (airport.flightTimeline && Array.isArray(airport.flightTimeline)) {
            // Add airport info to each timeline entry
            const airportTimelineData = {
              icao: airport.icao || airport.icaoCode,
              name: airport.name,
              flightTimeline: airport.flightTimeline
            };
            tafData.push(airportTimelineData);
          }
        });
        setTafTimelineData(tafData);
        
        // Prepare altitude data with graceful fallbacks
        setAltitudeData({
          pireps: pireps.filter(p => (
            (p.altitude && typeof p.altitude === 'object' && typeof p.altitude.feet === 'number') ||
            typeof p.altitudeFt === 'number' ||
            typeof p.altitude === 'number'
          )),
          sigmets: sigmets.filter(sigmet => sigmet && (typeof sigmet.altitudeLow === 'number' || typeof sigmet.altitudeHigh === 'number')),
          winds: validatedData.windsAloft || []
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch weather briefing');
      setBriefingData(null);
      // Reset visualization data on error
  setMapData({ airports: [], sigmets: [], pireps: [], openMeteoForecasts: {} });
  setTafTimelineData([]);
      setAltitudeData({ pireps: [], sigmets: [], winds: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset briefing data
  const handleReset = useCallback(() => {
    setBriefingData(null);
    setError(null);
    setCurrentRoute('');
    setShowRawData(false);
    setActiveTab('overview');
  setMapData({ airports: [], sigmets: [], pireps: [], openMeteoForecasts: {} });
  setTafTimelineData([]);
    setAltitudeData({ pireps: [], sigmets: [], winds: [] });
  }, []);

  return (
    <div className="min-h-screen bg-cockpit-bg text-cockpit-text">
      {/* Header */}
      <header className="bg-cockpit-panel border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <Plane className="h-8 w-8 text-cockpit-accent" />
            <div>
              <h1 className="text-2xl font-bold text-white">FALCON</h1>
              <p className="text-sm text-gray-400">Aviation Weather Briefing System</p>
            </div>
          </div>
          
          {briefingData && (
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <Cloud className="h-4 w-4" />
                <span>Generated: {new Date(briefingData.generatedAt).toLocaleTimeString()}</span>
              </div>
              <button
                onClick={handleReset}
                className="text-cockpit-accent hover:text-blue-400 transition-colors"
              >
                New Briefing
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Route Input - Always visible at top */}
        <div className="mb-6">
          <RouteInput
            onFetchBriefing={handleFetchBriefing}
            loading={loading}
            currentRoute={currentRoute}
          />
        </div>

        {/* Corridor Summary Strip */}
        {briefingData && briefingData.corridorSummary && (
          <CorridorSummaryStrip
            summary={briefingData.corridorSummary}
            updatedAt={briefingData.generatedAt}
          />
        )}

        {/* Error State */}
        {error && (
          <div className="bg-severity-high/10 border border-severity-high/30 rounded-lg p-6 mb-6">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-severity-high" />
              <div>
                <h3 className="font-semibold text-severity-high">Weather Briefing Error</h3>
                <p className="text-gray-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Briefing Results Layout with Tabbed Interface - Always render when loading or has data */}
        {(briefingData || loading) && (
          <div className="space-y-6">
            {/* Tabbed Navigation */}
            <div className="bg-cockpit-panel rounded-lg border border-gray-700">
              <div className="flex flex-wrap border-b border-gray-700">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'overview'
                      ? 'bg-cockpit-accent text-white border-b-2 border-cockpit-accent'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span>Overview</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('map')}
                  className={`px-6 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'map'
                      ? 'bg-cockpit-accent text-white border-b-2 border-cockpit-accent'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  <span>Interactive Map</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-6 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'timeline'
                      ? 'bg-cockpit-accent text-white border-b-2 border-cockpit-accent'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>TAF Timeline</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('altitude')}
                  className={`px-6 py-3 text-sm font-medium transition-colors flex items-center space-x-2 ${
                    activeTab === 'altitude'
                      ? 'bg-cockpit-accent text-white border-b-2 border-cockpit-accent'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Altitude Risks</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
              {/* Overview Tab - Original 3-column layout */}
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - AI Summary and Alerts */}
                  <div className="lg:col-span-1 space-y-6">
                    {loading ? (
                      <>
                        <AISummarySkeleton />
                        <AlertSkeleton />
                        <AlertSkeleton />
                      </>
                    ) : (
                      <>
                        <AISummary 
                          briefingData={briefingData}
                          showRawData={showRawData}
                          onToggleRawData={() => setShowRawData(!showRawData)}
                        />
                        
                        <AlertsDisplay 
                          briefingData={briefingData}
                        />
                      </>
                    )}
                  </div>

                  {/* Middle Column - Forecast vs Reality */}
                  <div className="lg:col-span-1">
                    {loading ? (
                      <ForecastSkeleton />
                    ) : (
                      <ForecastVsReality 
                        briefingData={briefingData}
                      />
                    )}
                  </div>

                  {/* Right Column - Chat Interface */}
                  <div className="lg:col-span-1">
                    {loading ? (
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <ChatMessageSkeleton className="mb-4" />
                        <ChatMessageSkeleton className="mb-4" />
                        <ChatMessageSkeleton />
                      </div>
                    ) : (
                      <ChatInterface 
                        briefingData={briefingData}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Interactive Map Tab */}
              {activeTab === 'map' && (
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                  {/* Map takes up 3 columns */}
                  <div className="xl:col-span-3">
                    {loading ? (
                      <MapSkeleton height="600px" />
                    ) : (
                      <WeatherMap
                        airports={mapData.airports}
                        sigmets={mapData.sigmets}
                        isigmets={briefingData?.isigmets || []}
                        pireps={mapData.pireps}
                        metarsByIcao={briefingData?.metarsByIcao || {}}
                        tafsByIcao={briefingData?.tafsByIcao || {}}
                        openMeteoForecasts={mapData.openMeteoForecasts || {}}
                        className="h-[600px]"
                        onAirportClick={(airport) => console.log('Airport clicked:', airport)}
                        onSigmetClick={(sigmet) => console.log('SIGMET clicked:', sigmet)}
                        onIsigmetClick={(isigmet) => console.log('ISIGMET clicked:', isigmet)}
                        onPirepClick={(pirep) => console.log('PIREP clicked:', pirep)}
                      />
                    )}
                  </div>
                  
                  {/* Sidebar with alerts and summary */}
                  <div className="xl:col-span-1 space-y-4">
                    {loading ? (
                      <>
                        <AlertSkeleton />
                        <AlertSkeleton />
                        <div className="bg-cockpit-panel rounded-lg border border-gray-700 p-4">
                          <SkeletonLoader type="text" height={20} width={120} className="mb-3" />
                          <div className="space-y-2">
                            <SkeletonLoader type="text" height={16} width="100%" />
                            <SkeletonLoader type="text" height={16} width="100%" />
                            <SkeletonLoader type="text" height={16} width="100%" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <AlertsDisplay 
                          briefingData={briefingData}
                          compact={true}
                        />
                        <div className="bg-cockpit-panel rounded-lg border border-gray-700 p-4">
                          <h4 className="font-semibold text-white mb-3">Route Summary</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Airports:</span>
                              <span className="text-white">{mapData.airports.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">SIGMETs:</span>
                              <span className="text-white">{mapData.sigmets.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">PIREPs:</span>
                              <span className="text-white">{mapData.pireps.length}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAF Timeline Tab */}
              {activeTab === 'timeline' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Timeline chart takes up 2 columns */}
                  <div className="xl:col-span-2">
                    {loading ? (
                      <ChartSkeleton />
                    ) : (
                      <TAFTimeline 
                        tafData={tafTimelineData}
                        height={500}
                        showDetails={true}
                      />
                    )}
                  </div>
                  
                  {/* Sidebar with forecast summary and chat */}
                  <div className="xl:col-span-1 space-y-4">
                    {loading ? (
                      <>
                        <ForecastSkeleton />
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <ChatMessageSkeleton className="mb-4" />
                          <ChatMessageSkeleton />
                        </div>
                      </>
                    ) : (
                      <>
                        <ForecastVsReality 
                          briefingData={briefingData}
                          compact={true}
                        />
                        <ChatInterface 
                          briefingData={briefingData}
                          height={300}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Altitude Risks Tab */}
              {activeTab === 'altitude' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Altitude risk chart takes up 2 columns */}
                  <div className="xl:col-span-2">
                    {loading ? (
                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="border-b border-gray-200 p-4">
                          <AltitudeBandSkeleton className="mb-2" />
                        </div>
                        <div className="p-4 space-y-2">
                          <AltitudeBandSkeleton />
                          <AltitudeBandSkeleton />
                          <AltitudeBandSkeleton />
                          <AltitudeBandSkeleton />
                          <AltitudeBandSkeleton />
                        </div>
                      </div>
                    ) : (
                      <AltitudeHintBar
                        pireps={altitudeData.pireps}
                        sigmets={altitudeData.sigmets}
                        winds={altitudeData.winds}
                        maxAltitude={45000}
                        minAltitude={0}
                        recommendedAltitude={
                          briefingData?.aiSummary?.altitudeRecommendation?.recommendedAltitude
                        }
                        recommendationNote={
                          briefingData?.aiSummary?.altitudeRecommendation?.rationale
                        }
                      />
                    )}
                  </div>
                  
                  {/* Sidebar with relevant alerts and AI summary */}
                  <div className="xl:col-span-1 space-y-4">
                    {loading ? (
                      <>
                        <AISummarySkeleton />
                        <AlertSkeleton />
                        <AlertSkeleton />
                      </>
                    ) : (
                      <>
                        <AISummary 
                          briefingData={briefingData}
                          showRawData={false}
                          compact={true}
                        />
                        <AlertsDisplay 
                          briefingData={briefingData}
                          filterByType={['TURBULENCE', 'ICING', 'CONVECTIVE']}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Welcome State - when no briefing data */}
        {!briefingData && !loading && !error && (
          <div className="text-center py-16">
            <Cloud className="h-24 w-24 text-gray-600 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-300 mb-4">
              Welcome to FALCON Weather Briefing
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Enter your route above to get an AI-powered weather briefing with current conditions, 
              forecasts, hazard alerts, and interactive Q&A assistance for your flight planning.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-vfr-500 rounded-full"></div>
                <span>VFR Conditions</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-mvfr-500 rounded-full"></div>
                <span>MVFR Conditions</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-ifr-500 rounded-full"></div>
                <span>IFR Conditions</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-lifr-500 rounded-full"></div>
                <span>LIFR Conditions</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-cockpit-panel mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center text-sm text-gray-400">
            <div className="flex space-x-6">
              <span>FALCON Aviation Weather System</span>
              <span>•</span>
              <span>Data from Aviation Weather Center</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>AI-Enhanced Briefings</span>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;