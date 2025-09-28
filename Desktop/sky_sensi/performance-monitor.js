/**
 * Performance Monitoring System
 * Tracks and analyzes system performance metrics for Sky Sensi application
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { performance, PerformanceObserver } = require('perf_hooks');

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = new Map();
        this.alertThresholds = new Map();
        this.performanceHistory = [];
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.initializeThresholds();
        this.setupPerformanceObservers();
    }

    /**
     * Initialize performance alert thresholds
     */
    initializeThresholds() {
        this.alertThresholds.set('cpu', {
            warning: 70, // 70% CPU usage
            critical: 85 // 85% CPU usage
        });

        this.alertThresholds.set('memory', {
            warning: 80, // 80% memory usage
            critical: 90 // 90% memory usage
        });

        this.alertThresholds.set('responseTime', {
            warning: 1000, // 1 second
            critical: 3000  // 3 seconds
        });

        this.alertThresholds.set('errorRate', {
            warning: 5,  // 5% error rate
            critical: 15 // 15% error rate
        });

        this.alertThresholds.set('diskUsage', {
            warning: 85, // 85% disk usage
            critical: 95 // 95% disk usage
        });
    }

    /**
     * Setup Node.js Performance Observers
     */
    setupPerformanceObservers() {
        // HTTP request performance observer
        const httpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                this.recordHttpMetric(entry);
            });
        });

        // Function call performance observer
        const functionObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                this.recordFunctionMetric(entry);
            });
        });

        this.observers.set('http', httpObserver);
        this.observers.set('function', functionObserver);
    }

    /**
     * Start performance monitoring
     */
    startMonitoring(interval = 10000) { // Default 10 seconds
        if (this.isMonitoring) {
            console.log('⚠️ Performance monitoring is already running');
            return;
        }

        console.log('🚀 Starting performance monitoring...');
        
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, interval);

        // Start performance observers
        this.observers.get('http').observe({ entryTypes: ['http'] });
        this.observers.get('function').observe({ entryTypes: ['function', 'measure'] });

        console.log(`✅ Performance monitoring started (interval: ${interval}ms)`);
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('⚠️ Performance monitoring is not running');
            return;
        }

        console.log('🛑 Stopping performance monitoring...');
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());

        console.log('✅ Performance monitoring stopped');
    }

    /**
     * Collect comprehensive system metrics
     */
    async collectMetrics() {
        const timestamp = Date.now();
        const metrics = {
            timestamp,
            system: await this.getSystemMetrics(),
            process: this.getProcessMetrics(),
            application: await this.getApplicationMetrics(),
            network: await this.getNetworkMetrics()
        };

        this.metrics.set(timestamp, metrics);
        this.performanceHistory.push(metrics);

        // Keep only last 1000 entries to prevent memory buildup
        if (this.performanceHistory.length > 1000) {
            const removed = this.performanceHistory.splice(0, this.performanceHistory.length - 1000);
            removed.forEach(entry => this.metrics.delete(entry.timestamp));
        }

        // Check for performance alerts
        await this.checkPerformanceAlerts(metrics);

        return metrics;
    }

    /**
     * Get system-level metrics
     */
    async getSystemMetrics() {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;

        // Calculate CPU usage
        const cpuUsage = await this.calculateCpuUsage();

        // Get disk usage
        const diskUsage = await this.getDiskUsage();

        return {
            cpu: {
                count: cpus.length,
                model: cpus[0].model,
                usage: cpuUsage,
                loadAverage: os.loadavg()
            },
            memory: {
                total: totalMemory,
                used: usedMemory,
                free: freeMemory,
                usage: memoryUsagePercent
            },
            disk: diskUsage,
            uptime: os.uptime(),
            platform: os.platform(),
            arch: os.arch()
        };
    }

    /**
     * Calculate CPU usage percentage
     */
    async calculateCpuUsage() {
        return new Promise((resolve) => {
            const startMeasure = this.cpuAverage();

            setTimeout(() => {
                const endMeasure = this.cpuAverage();
                
                const idleDifference = endMeasure.idle - startMeasure.idle;
                const totalDifference = endMeasure.total - startMeasure.total;
                
                const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
                resolve(percentageCPU);
            }, 1000);
        });
    }

    /**
     * Helper function to calculate CPU averages
     */
    cpuAverage() {
        const cpus = os.cpus();
        let totalIdle = 0, totalTick = 0;

        cpus.forEach(cpu => {
            for (type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        return {
            idle: totalIdle / cpus.length,
            total: totalTick / cpus.length
        };
    }

    /**
     * Get disk usage information
     */
    async getDiskUsage() {
        try {
            if (process.platform === 'win32') {
                // Windows disk usage check would require different approach
                return { usage: 0, available: 0, total: 0, error: 'Windows disk usage not implemented' };
            }

            const { execSync } = require('child_process');
            const output = execSync('df -h /', { encoding: 'utf8' });
            const lines = output.split('\n');
            const diskInfo = lines[1].split(/\s+/);

            return {
                total: diskInfo[1],
                used: diskInfo[2],
                available: diskInfo[3],
                usage: parseFloat(diskInfo[4])
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Get Node.js process metrics
     */
    getProcessMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external,
                arrayBuffers: memUsage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            pid: process.pid,
            version: process.version,
            activeHandles: process._getActiveHandles().length,
            activeRequests: process._getActiveRequests().length
        };
    }

    /**
     * Get application-specific metrics
     */
    async getApplicationMetrics() {
        const metrics = {
            requests: this.getRequestMetrics(),
            cache: await this.getCacheMetrics(),
            database: await this.getDatabaseMetrics(),
            errors: this.getErrorMetrics()
        };

        return metrics;
    }

    /**
     * Get request performance metrics
     */
    getRequestMetrics() {
        // This would be populated by HTTP request observers
        const recentRequests = this.getRecentHttpMetrics();
        
        if (recentRequests.length === 0) {
            return { count: 0, averageResponseTime: 0, errorRate: 0 };
        }

        const totalResponseTime = recentRequests.reduce((sum, req) => sum + req.duration, 0);
        const errorCount = recentRequests.filter(req => req.status >= 400).length;

        return {
            count: recentRequests.length,
            averageResponseTime: totalResponseTime / recentRequests.length,
            errorRate: (errorCount / recentRequests.length) * 100,
            slowQueries: recentRequests.filter(req => req.duration > 1000).length
        };
    }

    /**
     * Get cache performance metrics
     */
    async getCacheMetrics() {
        try {
            // Check TTL cache if it exists
            const cachePath = path.join(process.cwd(), 'backend', 'src', 'cache', 'ttlCache.js');
            
            try {
                await fs.access(cachePath);
                // Cache exists, try to get metrics
                // This would require integration with the actual cache implementation
                return {
                    hitRate: 0,
                    size: 0,
                    status: 'available'
                };
            } catch {
                return { status: 'not_available' };
            }
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Get database/external service metrics
     */
    async getDatabaseMetrics() {
        // Sky Sensi doesn't use traditional databases but external APIs
        return {
            externalServices: {
                gemini: { status: 'unknown', responseTime: 0 },
                awc: { status: 'unknown', responseTime: 0 },
                openweathermap: { status: 'unknown', responseTime: 0 },
                openmeteo: { status: 'unknown', responseTime: 0 }
            }
        };
    }

    /**
     * Get error metrics
     */
    getErrorMetrics() {
        // This would be populated by error tracking
        return {
            total: 0,
            rate: 0,
            types: {}
        };
    }

    /**
     * Get network performance metrics
     */
    async getNetworkMetrics() {
        return {
            interfaces: os.networkInterfaces(),
            activeConnections: await this.getActiveConnections()
        };
    }

    /**
     * Get active network connections
     */
    async getActiveConnections() {
        try {
            if (process.platform === 'win32') {
                return { error: 'Windows network connections not implemented' };
            }

            const { execSync } = require('child_process');
            const output = execSync('netstat -an | grep ESTABLISHED | wc -l', { encoding: 'utf8' });
            return { established: parseInt(output.trim()) };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Record HTTP request metric
     */
    recordHttpMetric(entry) {
        const httpMetrics = this.metrics.get('http') || [];
        httpMetrics.push({
            timestamp: Date.now(),
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
        });
        
        // Keep only last 100 HTTP metrics
        if (httpMetrics.length > 100) {
            httpMetrics.splice(0, httpMetrics.length - 100);
        }
        
        this.metrics.set('http', httpMetrics);
    }

    /**
     * Record function performance metric
     */
    recordFunctionMetric(entry) {
        const functionMetrics = this.metrics.get('functions') || [];
        functionMetrics.push({
            timestamp: Date.now(),
            name: entry.name,
            duration: entry.duration
        });
        
        // Keep only last 50 function metrics
        if (functionMetrics.length > 50) {
            functionMetrics.splice(0, functionMetrics.length - 50);
        }
        
        this.metrics.set('functions', functionMetrics);
    }

    /**
     * Get recent HTTP metrics
     */
    getRecentHttpMetrics(timeWindow = 60000) { // Default 1 minute
        const httpMetrics = this.metrics.get('http') || [];
        const cutoff = Date.now() - timeWindow;
        return httpMetrics.filter(metric => metric.timestamp > cutoff);
    }

    /**
     * Check for performance alerts
     */
    async checkPerformanceAlerts(metrics) {
        const alerts = [];

        // Check CPU usage
        if (metrics.system.cpu.usage > this.alertThresholds.get('cpu').critical) {
            alerts.push({
                type: 'cpu',
                level: 'critical',
                message: `CPU usage is ${metrics.system.cpu.usage}% (threshold: ${this.alertThresholds.get('cpu').critical}%)`,
                timestamp: metrics.timestamp
            });
        } else if (metrics.system.cpu.usage > this.alertThresholds.get('cpu').warning) {
            alerts.push({
                type: 'cpu',
                level: 'warning',
                message: `CPU usage is ${metrics.system.cpu.usage}% (threshold: ${this.alertThresholds.get('cpu').warning}%)`,
                timestamp: metrics.timestamp
            });
        }

        // Check memory usage
        if (metrics.system.memory.usage > this.alertThresholds.get('memory').critical) {
            alerts.push({
                type: 'memory',
                level: 'critical',
                message: `Memory usage is ${metrics.system.memory.usage.toFixed(1)}% (threshold: ${this.alertThresholds.get('memory').critical}%)`,
                timestamp: metrics.timestamp
            });
        } else if (metrics.system.memory.usage > this.alertThresholds.get('memory').warning) {
            alerts.push({
                type: 'memory',
                level: 'warning',
                message: `Memory usage is ${metrics.system.memory.usage.toFixed(1)}% (threshold: ${this.alertThresholds.get('memory').warning}%)`,
                timestamp: metrics.timestamp
            });
        }

        // Check disk usage
        if (metrics.system.disk.usage && typeof metrics.system.disk.usage === 'number') {
            if (metrics.system.disk.usage > this.alertThresholds.get('diskUsage').critical) {
                alerts.push({
                    type: 'disk',
                    level: 'critical',
                    message: `Disk usage is ${metrics.system.disk.usage}% (threshold: ${this.alertThresholds.get('diskUsage').critical}%)`,
                    timestamp: metrics.timestamp
                });
            } else if (metrics.system.disk.usage > this.alertThresholds.get('diskUsage').warning) {
                alerts.push({
                    type: 'disk',
                    level: 'warning',
                    message: `Disk usage is ${metrics.system.disk.usage}% (threshold: ${this.alertThresholds.get('diskUsage').warning}%)`,
                    timestamp: metrics.timestamp
                });
            }
        }

        // Check application response times
        if (metrics.application.requests.averageResponseTime > this.alertThresholds.get('responseTime').critical) {
            alerts.push({
                type: 'responseTime',
                level: 'critical',
                message: `Average response time is ${metrics.application.requests.averageResponseTime}ms (threshold: ${this.alertThresholds.get('responseTime').critical}ms)`,
                timestamp: metrics.timestamp
            });
        } else if (metrics.application.requests.averageResponseTime > this.alertThresholds.get('responseTime').warning) {
            alerts.push({
                type: 'responseTime',
                level: 'warning',
                message: `Average response time is ${metrics.application.requests.averageResponseTime}ms (threshold: ${this.alertThresholds.get('responseTime').warning}ms)`,
                timestamp: metrics.timestamp
            });
        }

        // Store alerts
        if (alerts.length > 0) {
            this.storeAlerts(alerts);
        }

        return alerts;
    }

    /**
     * Store performance alerts
     */
    storeAlerts(alerts) {
        const existingAlerts = this.metrics.get('alerts') || [];
        existingAlerts.push(...alerts);
        
        // Keep only last 100 alerts
        if (existingAlerts.length > 100) {
            existingAlerts.splice(0, existingAlerts.length - 100);
        }
        
        this.metrics.set('alerts', existingAlerts);
        
        // Log critical alerts
        alerts.filter(alert => alert.level === 'critical').forEach(alert => {
            console.log(`🚨 CRITICAL ALERT: ${alert.message}`);
        });
    }

    /**
     * Get performance summary
     */
    getPerformanceSummary(timeWindow = 300000) { // Default 5 minutes
        const cutoff = Date.now() - timeWindow;
        const recentMetrics = this.performanceHistory.filter(m => m.timestamp > cutoff);
        
        if (recentMetrics.length === 0) {
            return { error: 'No recent metrics available' };
        }

        const latest = recentMetrics[recentMetrics.length - 1];
        const alerts = this.metrics.get('alerts') || [];
        const recentAlerts = alerts.filter(alert => alert.timestamp > cutoff);

        return {
            timestamp: Date.now(),
            timeWindow: timeWindow,
            current: {
                cpu: latest.system.cpu.usage,
                memory: latest.system.memory.usage,
                uptime: latest.system.uptime
            },
            trends: this.calculateTrends(recentMetrics),
            alerts: {
                total: recentAlerts.length,
                critical: recentAlerts.filter(a => a.level === 'critical').length,
                warnings: recentAlerts.filter(a => a.level === 'warning').length
            },
            recommendations: this.generatePerformanceRecommendations(latest, recentAlerts)
        };
    }

    /**
     * Calculate performance trends
     */
    calculateTrends(metrics) {
        if (metrics.length < 2) {
            return { error: 'Insufficient data for trend analysis' };
        }

        const first = metrics[0];
        const last = metrics[metrics.length - 1];

        return {
            cpu: {
                change: last.system.cpu.usage - first.system.cpu.usage,
                trend: last.system.cpu.usage > first.system.cpu.usage ? 'increasing' : 'decreasing'
            },
            memory: {
                change: last.system.memory.usage - first.system.memory.usage,
                trend: last.system.memory.usage > first.system.memory.usage ? 'increasing' : 'decreasing'
            },
            requests: {
                responseTime: {
                    change: last.application.requests.averageResponseTime - first.application.requests.averageResponseTime,
                    trend: last.application.requests.averageResponseTime > first.application.requests.averageResponseTime ? 'slower' : 'faster'
                }
            }
        };
    }

    /**
     * Generate performance recommendations
     */
    generatePerformanceRecommendations(currentMetrics, recentAlerts) {
        const recommendations = [];

        // CPU recommendations
        if (currentMetrics.system.cpu.usage > 80) {
            recommendations.push({
                type: 'cpu',
                priority: 'high',
                message: 'High CPU usage detected',
                suggestions: [
                    'Check for CPU-intensive processes',
                    'Consider scaling horizontally',
                    'Review algorithm efficiency'
                ]
            });
        }

        // Memory recommendations
        if (currentMetrics.system.memory.usage > 85) {
            recommendations.push({
                type: 'memory',
                priority: 'high',
                message: 'High memory usage detected',
                suggestions: [
                    'Check for memory leaks',
                    'Optimize data structures',
                    'Consider increasing available memory'
                ]
            });
        }

        // Response time recommendations
        if (currentMetrics.application.requests.averageResponseTime > 1000) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: 'Slow response times detected',
                suggestions: [
                    'Implement caching strategies',
                    'Optimize database queries',
                    'Review API efficiency'
                ]
            });
        }

        return recommendations;
    }

    /**
     * Export performance data
     */
    async exportPerformanceData(format = 'json', timeWindow = 3600000) { // Default 1 hour
        const cutoff = Date.now() - timeWindow;
        const data = this.performanceHistory.filter(m => m.timestamp > cutoff);
        const alerts = (this.metrics.get('alerts') || []).filter(a => a.timestamp > cutoff);

        const exportData = {
            metadata: {
                exportTime: new Date().toISOString(),
                timeWindow,
                recordCount: data.length,
                alertCount: alerts.length
            },
            metrics: data,
            alerts,
            summary: this.getPerformanceSummary(timeWindow)
        };

        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(exportData);
        }

        return exportData;
    }

    /**
     * Convert performance data to CSV format
     */
    convertToCSV(data) {
        const csvLines = [];
        
        // Headers
        csvLines.push('timestamp,cpu_usage,memory_usage,disk_usage,response_time,request_count,error_rate');
        
        // Data rows
        data.metrics.forEach(metric => {
            csvLines.push([
                new Date(metric.timestamp).toISOString(),
                metric.system.cpu.usage,
                metric.system.memory.usage.toFixed(2),
                metric.system.disk.usage || 0,
                metric.application.requests.averageResponseTime,
                metric.application.requests.count,
                metric.application.requests.errorRate.toFixed(2)
            ].join(','));
        });
        
        return csvLines.join('\n');
    }

    /**
     * Run performance checks (alias for collectMetrics for backward compatibility)
     */
    async runChecks() {
        const metrics = await this.collectMetrics();
        
        // Return a format compatible with existing code expectations
        return {
            bottlenecks: [],  // Legacy format compatibility
            metrics: metrics,
            alerts: this.metrics.get('alerts') || [],
            summary: this.getPerformanceSummary()
        };
    }

    /**
     * Clean up and reset metrics
     */
    cleanup() {
        this.stopMonitoring();
        this.metrics.clear();
        this.performanceHistory = [];
        console.log('✅ Performance monitoring cleanup completed');
    }
}

module.exports = PerformanceMonitor;