import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
// Leaflet CSS for interactive maps
import 'leaflet/dist/leaflet.css'
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css'
import 'leaflet-defaulticon-compatibility'

// Error boundary for development
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Aviation Weather App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cockpit-bg text-cockpit-text flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold mb-4 text-severity-high">
              FALCON Weather System Error
            </h1>
            <p className="text-gray-400 mb-4">
              Unable to load the aviation weather briefing system.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-cockpit-accent text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)