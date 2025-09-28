# Sky Sensi Health Monitoring System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Health Monitoring Commands](#health-monitoring-commands)
4. [System Components](#system-components)
5. [Report Types](#report-types)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)
8. [Configuration](#configuration)
9. [API Reference](#api-reference)

## Overview

Sky Sensi includes a comprehensive health monitoring system that provides real-time insights into system performance, service availability, dependency health, and environmental configuration. The system helps ensure optimal application performance and provides automated troubleshooting capabilities.

### Key Features

- **Real-time Health Monitoring**: Continuous monitoring of all system components
- **Service Health Checks**: Monitor backend, frontend, and external API services
- **Performance Monitoring**: Track CPU, memory, disk usage, and response times
- **Dependency Validation**: Verify Node.js runtime, npm packages, and security
- **Environment Validation**: Check configuration files and environment variables
- **Automated Troubleshooting**: Identify and suggest fixes for common issues
- **Comprehensive Reporting**: Generate detailed health reports in multiple formats
- **Automated Repairs**: Safe automated fixes for common configuration issues

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+
- Sky Sensi application properly installed

### Quick Health Check

Run a quick health check to get started:

```bash
npm run health:quick
```

This performs a basic health assessment of all system components.

### Comprehensive Health Check

For a detailed analysis:

```bash
npm run health:check
```

This runs a comprehensive health assessment including all services, performance metrics, and dependency validation.

## Health Monitoring Commands

### Root Level Commands

These commands are available from the root directory:

#### Basic Health Checks
```bash
# Quick health check (basic status)
npm run health:quick

# Comprehensive health check (detailed analysis)
npm run health:check

# Continuous monitoring (real-time)
npm run health:monitor
```

#### Health Reports
```bash
# Generate detailed health report
npm run health:report

# Generate summary health report
npm run health:summary

# Generate performance-focused report
npm run health:performance
```

#### Performance Monitoring
```bash
# Start performance monitoring
npm run performance:monitor

# Get current performance snapshot
npm run performance:report
```

#### Dependency Management
```bash
# Validate all dependencies
npm run dependencies:validate

# Automatically fix dependency issues
npm run dependencies:fix
```

#### Environment Management
```bash
# Validate environment configuration
npm run environment:validate

# Setup missing environment files
npm run environment:setup
```

#### Troubleshooting
```bash
# Analyze issues and show potential fixes
npm run troubleshoot

# Execute safe automated repairs
npm run troubleshoot:execute

# Show potential fixes without executing (dry run)
npm run troubleshoot:dry-run
```

### Backend-Specific Commands

Run from the root directory:

```bash
# Check backend service health
npm run backend:health:check

# Test Gemini AI service connection
npm run backend:health:gemini

# Test Aviation Weather Center connection
npm run backend:health:awc

# Check backend server status
npm run backend:health:backend

# Monitor backend performance
npm run backend:performance:check

# Validate backend environment
npm run backend:environment:check

# Security audit for backend dependencies
npm run backend:dependencies:audit
```

### Frontend-Specific Commands

Run from the root directory:

```bash
# Check frontend service health
npm run frontend:health:check

# Test frontend server status
npm run frontend:health:frontend

# Test OpenWeatherMap API connection
npm run frontend:health:owm

# Test Open-Meteo API connection
npm run frontend:health:openmeteo

# Validate frontend environment
npm run frontend:environment:check

# Monitor frontend performance
npm run frontend:performance:check
```

## System Components

### 1. Health Monitor (`health-monitor.js`)

The central monitoring system that:
- Orchestrates all health checks
- Maintains service status history
- Emits health events for real-time monitoring
- Generates alerts based on thresholds
- Provides trend analysis

### 2. Service Health Checkers (`service-health-checkers.js`)

Individual health checkers for:
- **Backend Service**: HTTP connectivity and response validation
- **Frontend Service**: Development server and build status
- **Gemini AI**: API authentication and connectivity
- **Aviation Weather Center**: Data service availability
- **OpenWeatherMap**: Weather API connectivity
- **Open-Meteo**: Alternative weather service status

### 3. Performance Monitor (`performance-monitor.js`)

Tracks system performance:
- **System Metrics**: CPU, memory, disk usage
- **Process Metrics**: Node.js process statistics
- **Application Metrics**: Response times, error rates
- **Network Metrics**: Connection status and throughput
- **Alert System**: Threshold-based performance alerts

### 4. Dependency Validator (`dependency-validator.js`)

Validates project dependencies:
- **Runtime Environment**: Node.js and npm versions
- **Package Dependencies**: Version compatibility and security
- **Security Auditing**: Known vulnerability scanning
- **Automatic Fixes**: Safe dependency issue resolution

### 5. Environment Validator (`environment-validator.js`)

Checks configuration integrity:
- **Environment Variables**: Required and optional variables
- **Configuration Files**: package.json, .env files
- **API Key Validation**: Format and basic connectivity checks
- **Environment Setup**: Automated configuration file creation

### 6. Automated Troubleshooter (`automated-troubleshooter.js`)

Intelligent issue resolution:
- **Pattern Recognition**: Identify common failure patterns
- **Repair Suggestions**: Actionable fix recommendations  
- **Automated Repairs**: Safe execution of common fixes
- **Diagnostic Reports**: Detailed problem analysis

### 7. Health Reporter (`health-reporter.js`)

Comprehensive reporting system:
- **Multiple Report Types**: Summary, detailed, incident, performance
- **Multiple Formats**: Markdown, HTML, JSON, CSV
- **Automated Generation**: Scheduled and on-demand reports
- **Report Storage**: Organized report archival

## Report Types

### Summary Report

Quick overview of system health:
- Overall health score
- Critical issues count
- Service availability summary
- Key performance metrics

**Generate with:**
```bash
npm run health:summary
```

### Detailed Report

Comprehensive system analysis:
- Executive summary
- Service health details
- Performance metrics
- Dependency analysis
- Environment validation
- Security assessment
- Troubleshooting history
- Detailed recommendations

**Generate with:**
```bash
npm run health:report
```

### Performance Report

Performance-focused analysis:
- System resource utilization
- Application performance metrics
- Bottleneck identification
- Performance trends
- Optimization recommendations

**Generate with:**
```bash
npm run health:performance
```

### Incident Report

Incident-specific health analysis:
- Incident timeline
- Impact assessment
- Root cause analysis
- Resolution steps
- Prevention measures

**Generate programmatically for specific incidents**

## Troubleshooting

### Common Issues and Solutions

#### 1. Services Not Running

**Symptoms:**
- `ECONNREFUSED` errors
- Service health checks failing

**Solutions:**
```bash
# Check and start backend
npm run backend:dev

# Check and start frontend  
npm run frontend:dev

# Automated troubleshooting
npm run troubleshoot:execute
```

#### 2. Missing Environment Variables

**Symptoms:**
- "not configured" errors
- API authentication failures

**Solutions:**
```bash
# Setup environment files
npm run environment:setup

# Validate configuration
npm run environment:validate
```

#### 3. Dependency Issues

**Symptoms:**
- Module not found errors
- Version incompatibility warnings

**Solutions:**
```bash
# Validate and fix dependencies
npm run dependencies:fix

# Clean install
npm run clean-install
```

#### 4. Performance Issues

**Symptoms:**
- Slow response times
- High resource usage

**Solutions:**
```bash
# Monitor performance
npm run performance:monitor

# Generate performance report
npm run health:performance
```

### Automated Troubleshooting Workflow

1. **Issue Detection**: Health monitoring identifies problems
2. **Pattern Analysis**: System analyzes error patterns
3. **Solution Matching**: Maps issues to known solutions
4. **Safety Assessment**: Evaluates repair safety
5. **Automated Execution**: Performs safe repairs
6. **Verification**: Confirms issue resolution

## Advanced Usage

### Continuous Monitoring

Start continuous health monitoring:

```bash
npm run health:monitor
```

This runs indefinitely, checking system health every 30 seconds and generating alerts for issues.

### Custom Health Checks

Extend the system with custom health checkers:

```javascript
const ServiceHealthCheckers = require('./service-health-checkers.js');

const checkers = new ServiceHealthCheckers();

// Add custom service check
async function checkCustomService() {
    try {
        // Your custom health check logic
        return { status: 'healthy', message: 'Service OK' };
    } catch (error) {
        return { status: 'unhealthy', message: error.message };
    }
}

// Register custom checker
checkers.customCheckers.set('my-service', checkCustomService);
```

### Performance Monitoring Integration

Start performance monitoring programmatically:

```javascript
const PerformanceMonitor = require('./performance-monitor.js');

const monitor = new PerformanceMonitor();

// Start monitoring
monitor.startMonitoring(5000); // 5-second intervals

// Handle performance alerts
monitor.on('alert', (alert) => {
    console.log(`Performance Alert: ${alert.message}`);
});
```

### Report Automation

Generate reports programmatically:

```javascript
const HealthReporter = require('./health-reporter.js');

const reporter = new HealthReporter();

// Generate and save report
async function generateDailyReport() {
    const healthData = await collectHealthData();
    const report = await reporter.generateHealthReport(healthData, {
        type: 'detailed',
        format: 'markdown'
    });
    
    const filename = reporter.generateReportFilename('detailed', 'markdown');
    await reporter.saveReport(report, filename);
}
```

## Configuration

### Health Monitor Configuration

The health monitoring system can be configured through environment variables:

```bash
# Health check interval (milliseconds)
HEALTH_CHECK_INTERVAL=30000

# Performance monitoring enabled
ENABLE_PERFORMANCE_MONITORING=true

# Performance data retention (milliseconds)
PERFORMANCE_DATA_RETENTION=3600000
```

### Alert Thresholds

Customize performance alert thresholds:

```javascript
const PerformanceMonitor = require('./performance-monitor.js');

const monitor = new PerformanceMonitor();

// Customize CPU thresholds
monitor.alertThresholds.set('cpu', {
    warning: 60,  // 60% CPU
    critical: 80  // 80% CPU
});
```

### Troubleshooter Configuration

Configure automated troubleshooting behavior:

```bash
# Enable automated repairs
ENABLE_AUTO_REPAIR=true

# Maximum repair attempts
MAX_REPAIR_ATTEMPTS=3

# Repair safety level (safe, moderate, aggressive)
REPAIR_SAFETY_LEVEL=safe
```

## API Reference

### Environment Verifier Methods

```javascript
const verifier = new EnvironmentVerifier();

// Basic verification
await verifier.performBasicChecks();

// Service connectivity testing
await verifier.testServiceConnectivity();

// Real-time monitoring
verifier.startRealTimeMonitoring();
```

### Health Monitor Events

```javascript
const monitor = new HealthMonitor();

monitor.on('service-status-change', (service, status) => {
    console.log(`${service} status changed to ${status}`);
});

monitor.on('performance-alert', (alert) => {
    console.log(`Performance alert: ${alert.message}`);
});

monitor.on('health-report-ready', (report) => {
    console.log('Health report generated');
});
```

### Service Health Checker API

```javascript
const checkers = new ServiceHealthCheckers();

// Check individual services
const backendHealth = await checkers.checkBackendHealth();
const geminiHealth = await checkers.checkGeminiHealth();

// Check all services
const allHealthResults = await checkers.checkAllServices();
```

### Performance Monitor API

```javascript
const monitor = new PerformanceMonitor();

// Collect metrics
const metrics = await monitor.collectMetrics();

// Get performance summary
const summary = monitor.getPerformanceSummary();

// Export performance data
const csvData = await monitor.exportPerformanceData('csv');
```

## Best Practices

### 1. Regular Health Checks

- Run comprehensive health checks daily
- Use quick checks for frequent monitoring
- Set up continuous monitoring for production

### 2. Performance Monitoring

- Monitor performance trends over time
- Set appropriate alert thresholds
- Review performance reports weekly

### 3. Dependency Management

- Validate dependencies after updates
- Run security audits regularly
- Keep dependencies up to date

### 4. Environment Management

- Validate environment configuration after changes
- Use environment templates for consistency
- Document environment requirements

### 5. Incident Response

- Generate incident reports for major issues
- Review troubleshooting logs
- Implement prevention measures

## Support and Maintenance

### Log Files

Health monitoring logs are available in:
- Console output for real-time monitoring
- System logs for background processes
- Report files in `./reports` directory

### Cleanup and Maintenance

```bash
# Clean old performance data
npm run performance:cleanup

# Archive old reports
npm run reports:archive

# Reset monitoring state
npm run health:reset
```

### Updates and Upgrades

The health monitoring system is designed to be:
- **Backward Compatible**: Works with existing configurations
- **Extensible**: Easy to add new health checks
- **Maintainable**: Clear separation of concerns
- **Configurable**: Customizable thresholds and behaviors

---

For additional support or feature requests, please refer to the project documentation or create an issue in the project repository.