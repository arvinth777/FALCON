import React from 'react';

/**
 * Enhanced Error Boundary with production error reporting and recovery options
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Always log errors with structured data for monitoring
    const errorReport = {
      component: this.props.componentName || 'Unknown',
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount,
      props: this.props.errorContext || {}
    };

    console.error('Component Error Boundary:', errorReport);

    // In development, show full error details
    if (import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true') {
      console.error('Full error context:', error, errorInfo);
    }

    // Send error to monitoring service (if available)
    if (window.reportError) {
      window.reportError(this.props.componentName || 'ErrorBoundary', errorReport);
    }

    this.setState({ errorInfo });
  }

  handleRetry = () => {
    // Reset error state to retry rendering
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));

    // Call optional retry callback
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  }

  handleRefresh = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      const {
        fallback: FallbackComponent,
        componentName = 'Component',
        showRetry = true,
        showRefresh = false,
        className = ''
      } = this.props;

      // Use custom fallback if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error}
            retry={this.handleRetry}
            refresh={this.handleRefresh}
            retryCount={this.state.retryCount}
          />
        );
      }

      // Default error UI with recovery options
      return (
        <div className={`bg-red-50 rounded-lg border-2 border-red-200 p-6 text-center ${className}`}>
          <div className="text-red-600">
            {/* Error icon */}
            <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>

            {/* Error message */}
            <p className="text-lg font-medium text-red-900 mb-2">
              {componentName} Unavailable
            </p>
            <p className="text-sm text-red-700 mb-4">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>

            {/* Retry count indicator */}
            {this.state.retryCount > 0 && (
              <p className="text-xs text-red-600 mb-4">
                Retry attempts: {this.state.retryCount}
              </p>
            )}

            {/* Recovery options */}
            <div className="space-y-2">
              {showRetry && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.retryCount >= 3}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {this.state.retryCount >= 3 ? 'Max Retries Reached' : 'Retry Component'}
                </button>
              )}

              {showRefresh && (
                <button
                  onClick={this.handleRefresh}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ml-2"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Page
                </button>
              )}
            </div>

            {/* Helpful message */}
            <div className="text-xs text-red-600 mt-4">
              This component is temporarily unavailable. Other parts of the briefing may still be accessible.
            </div>

            {/* Debug information (development only) */}
            {import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true' && this.state.errorInfo && (
              <details className="text-left mt-4">
                <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                  Debug Information
                </summary>
                <div className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error?.message}
                  </div>
                  <div className="mb-2">
                    <strong>Component Stack:</strong>
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;