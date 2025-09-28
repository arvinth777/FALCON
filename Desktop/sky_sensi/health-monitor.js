/**
 * Comprehensive Health Monitoring System
 * Provides real-time monitoring capabilities for all services and dependencies
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class HealthMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            interval: 30000, // 30 seconds default
            maxHistory: 100,
            healthCheckTimeout: 10000,
            alertThreshold: 3, // consecutive failures before alert
            persistState: true,
            stateFile: path.join(process.cwd(), '.health-monitor-state.json'),
            ...options
        };
        
        this.serviceCheckers = options.serviceCheckers;
        this.reporter = options.reporter;
        this.isRunning = false;
        this.intervalId = null;
        this.healthHistory = new Map();
        this.consecutiveFailures = new Map();
        this.alertStates = new Map();
        this.startTime = null;
        this.totalChecks = 0;
        
        // Service status tracking
        this.currentStatus = {
            overall: 'unknown',
            services: {},
            lastCheck: null,
            uptime: 0
        };
    }

    /**
     * Start the health monitoring system
     */
    async start() {
        if (this.isRunning) {
            throw new Error('Health monitor is already running');
        }
        
        this.log('🚀 Starting health monitor...', 'info');
        this.startTime = Date.now();
        this.isRunning = true;
        
        // Load previous state if available
        await this.loadState();
        
        // Perform initial health check
        await this.performHealthCheck();
        
        // Schedule periodic checks
        this.scheduleNextCheck();
        
        this.emit('started');
        this.log(`✅ Health monitor started. Checking every ${this.options.interval}ms`, 'success');
        
        return this.currentStatus;
    }

    /**
     * Stop the health monitoring system
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.log('🛑 Stopping health monitor...', 'info');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
        
        // Save current state
        await this.saveState();
        
        this.emit('stopped');
        this.log('✅ Health monitor stopped', 'success');
    }

    /**
     * Schedule the next health check
     */
    scheduleNextCheck() {
        if (!this.isRunning) {
            return;
        }
        
        this.intervalId = setTimeout(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.log(`❌ Health check failed: ${error.message}`, 'error');
                this.emit('error', error);
            }
            
            this.scheduleNextCheck();
        }, this.options.interval);
    }

    /**
     * Perform a comprehensive health check
     */
    async performHealthCheck() {
        const checkStartTime = Date.now();
        this.totalChecks++;
        
        this.log('🔍 Performing health check...', 'info');
        
        const services = ['gemini', 'awc', 'openweathermap', 'openmeteo', 'backend', 'frontend'];
        const checkResults = {};
        let overallHealthy = true;
        
        // Check each service
        for (const service of services) {
            try {
                const result = await this.checkServiceWithTimeout(service);
                checkResults[service] = result;
                
                // Track health history
                this.updateHealthHistory(service, result);
                
                // Check for consecutive failures
                this.updateFailureTracking(service, result);
                
                if (result.status !== 'healthy') {
                    overallHealthy = false;
                }
                
            } catch (error) {
                checkResults[service] = {
                    status: 'error',
                    message: `Health check failed: ${error.message}`,
                    timestamp: new Date().toISOString(),
                    responseTime: -1
                };
                
                this.updateHealthHistory(service, checkResults[service]);
                this.updateFailureTracking(service, checkResults[service]);
                overallHealthy = false;
            }
        }
        
        // Update current status
        const checkDuration = Date.now() - checkStartTime;
        this.currentStatus = {
            overall: overallHealthy ? 'healthy' : 'unhealthy',
            services: checkResults,
            lastCheck: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            checkDuration,
            totalChecks: this.totalChecks
        };
        
        // Emit health status change events
        this.emitStatusEvents(checkResults);
        
        // Generate alerts for persistent failures
        await this.checkAndGenerateAlerts();
        
        // Log summary
        const healthyCount = Object.values(checkResults).filter(r => r.status === 'healthy').length;
        this.log(`📊 Health check complete: ${healthyCount}/${services.length} services healthy (${checkDuration}ms)`, 
                healthyCount === services.length ? 'success' : 'warning');
        
        return this.currentStatus;
    }

    /**
     * Check a service with timeout protection
     */
    async checkServiceWithTimeout(service) {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Health check timeout for ${service} (${this.options.healthCheckTimeout}ms)`));
            }, this.options.healthCheckTimeout);
            
            try {
                const result = await this.serviceCheckers.checkService(service);
                clearTimeout(timeout);
                resolve(result);
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    /**
     * Update health history for a service
     */
    updateHealthHistory(service, result) {
        if (!this.healthHistory.has(service)) {
            this.healthHistory.set(service, []);
        }
        
        const history = this.healthHistory.get(service);
        history.push({
            ...result,
            timestamp: result.timestamp || new Date().toISOString()
        });
        
        // Limit history size
        if (history.length > this.options.maxHistory) {
            history.splice(0, history.length - this.options.maxHistory);
        }
    }

    /**
     * Update failure tracking for alerting
     */
    updateFailureTracking(service, result) {
        const isHealthy = result.status === 'healthy';
        
        if (isHealthy) {
            // Reset failure count on success
            this.consecutiveFailures.set(service, 0);
            if (this.alertStates.get(service)) {
                this.alertStates.set(service, false);
                this.emit('alert-resolved', { service, result });
            }
        } else {
            // Increment failure count
            const failures = (this.consecutiveFailures.get(service) || 0) + 1;
            this.consecutiveFailures.set(service, failures);
        }
    }

    /**
     * Check for conditions that require alerts
     */
    async checkAndGenerateAlerts() {
        for (const [service, failures] of this.consecutiveFailures.entries()) {
            if (failures >= this.options.alertThreshold && !this.alertStates.get(service)) {
                this.alertStates.set(service, true);
                
                const alert = {
                    type: 'service-failure',
                    service,
                    consecutiveFailures: failures,
                    timestamp: new Date().toISOString(),
                    history: this.healthHistory.get(service)?.slice(-5) || []
                };
                
                this.emit('alert', alert);
                this.log(`🚨 ALERT: ${service} has failed ${failures} consecutive health checks`, 'error');
                
                // Generate automated repair suggestions if troubleshooter is available
                if (this.serviceCheckers.troubleshooter) {
                    try {
                        const suggestions = await this.serviceCheckers.troubleshooter.analyzeServiceFailure(service, alert);
                        if (suggestions.length > 0) {
                            this.log('🔧 Automated repair suggestions available:', 'info');
                            suggestions.forEach((suggestion, index) => {
                                console.log(`  ${index + 1}. ${suggestion.description}`);
                            });
                        }
                    } catch (error) {
                        this.log(`⚠️  Failed to generate repair suggestions: ${error.message}`, 'warning');
                    }
                }
            }
        }
    }

    /**
     * Emit status change events
     */
    emitStatusEvents(checkResults) {
        for (const [service, result] of Object.entries(checkResults)) {
            this.emit('service-status', { service, status: result.status, result });
        }
        
        this.emit('health-check-complete', this.currentStatus);
    }

    /**
     * Get current system health status
     */
    getStatus() {
        return {
            ...this.currentStatus,
            isMonitoring: this.isRunning,
            monitoringDuration: this.startTime ? Date.now() - this.startTime : 0
        };
    }

    /**
     * Get health history for a service
     */
    getServiceHistory(service, limit = 20) {
        const history = this.healthHistory.get(service) || [];
        return history.slice(-limit);
    }

    /**
     * Get aggregated health statistics
     */
    getHealthStatistics() {
        const stats = {
            totalChecks: this.totalChecks,
            servicesMonitored: Array.from(this.healthHistory.keys()),
            averageResponseTimes: {},
            uptimePercentages: {},
            recentAlerts: []
        };
        
        // Calculate statistics for each service
        for (const [service, history] of this.healthHistory.entries()) {
            if (history.length === 0) continue;
            
            // Average response time
            const responseTimes = history.filter(h => h.responseTime > 0).map(h => h.responseTime);
            stats.averageResponseTimes[service] = responseTimes.length > 0 
                ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                : 0;
            
            // Uptime percentage
            const healthyChecks = history.filter(h => h.status === 'healthy').length;
            stats.uptimePercentages[service] = Math.round((healthyChecks / history.length) * 100);
        }
        
        return stats;
    }

    /**
     * Save monitoring state to disk
     */
    async saveState() {
        if (!this.options.persistState) {
            return;
        }
        
        try {
            const state = {
                healthHistory: Object.fromEntries(this.healthHistory),
                consecutiveFailures: Object.fromEntries(this.consecutiveFailures),
                alertStates: Object.fromEntries(this.alertStates),
                totalChecks: this.totalChecks,
                savedAt: new Date().toISOString()
            };
            
            await fs.writeFile(this.options.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            this.log(`⚠️  Failed to save state: ${error.message}`, 'warning');
        }
    }

    /**
     * Load monitoring state from disk
     */
    async loadState() {
        if (!this.options.persistState) {
            return;
        }
        
        try {
            const stateData = await fs.readFile(this.options.stateFile, 'utf8');
            const state = JSON.parse(stateData);
            
            this.healthHistory = new Map(Object.entries(state.healthHistory || {}));
            this.consecutiveFailures = new Map(Object.entries(state.consecutiveFailures || {}));
            this.alertStates = new Map(Object.entries(state.alertStates || {}));
            this.totalChecks = state.totalChecks || 0;
            
            // Convert arrays back to proper format
            for (const [service, history] of this.healthHistory.entries()) {
                this.healthHistory.set(service, Array.isArray(history) ? history : []);
            }
            
            this.log('📁 Previous monitoring state loaded', 'info');
        } catch (error) {
            // State file doesn't exist or is invalid - start fresh
            this.log('📁 Starting with fresh monitoring state', 'info');
        }
    }

    /**
     * Generate health trend report
     */
    generateTrendReport(timeRange = '1h') {
        const now = Date.now();
        const ranges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        
        const rangeMs = ranges[timeRange] || ranges['1h'];
        const cutoffTime = now - rangeMs;
        
        const report = {
            timeRange,
            generatedAt: new Date().toISOString(),
            services: {}
        };
        
        for (const [service, history] of this.healthHistory.entries()) {
            const recentHistory = history.filter(h => new Date(h.timestamp).getTime() > cutoffTime);
            
            if (recentHistory.length === 0) {
                continue;
            }
            
            const healthy = recentHistory.filter(h => h.status === 'healthy').length;
            const uptime = (healthy / recentHistory.length) * 100;
            
            report.services[service] = {
                totalChecks: recentHistory.length,
                healthyChecks: healthy,
                uptimePercentage: Math.round(uptime * 100) / 100,
                averageResponseTime: this.calculateAverageResponseTime(recentHistory),
                issues: recentHistory.filter(h => h.status !== 'healthy').length
            };
        }
        
        return report;
    }

    /**
     * Calculate average response time from history
     */
    calculateAverageResponseTime(history) {
        const validTimes = history.filter(h => h.responseTime > 0).map(h => h.responseTime);
        if (validTimes.length === 0) return 0;
        return Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length);
    }

    /**
     * Utility logging method
     */
    log(message, type = 'info') {
        const colors = {
            error: '\x1b[31m',
            warning: '\x1b[33m',
            success: '\x1b[32m',
            info: '\x1b[36m',
            reset: '\x1b[0m'
        };
        
        const timestamp = new Date().toISOString();
        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }
}

module.exports = HealthMonitor;