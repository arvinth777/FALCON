#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');
const ServiceHealthCheckers = require('./service-health-checkers');
const HealthMonitor = require('./health-monitor');
const AutomatedTroubleshooter = require('./automated-troubleshooter');
const DependencyValidator = require('./dependency-validator');
const PerformanceMonitor = require('./performance-monitor');
const EnvironmentValidator = require('./environment-validator');
const HealthReporter = require('./health-reporter');

/**
 * Sky Sensi Development Environment Verification Script
 * 
 * This script verifies that the development environment is properly configured
 * for the Sky Sensi aviation weather briefing system with comprehensive health monitoring.
 */

class EnvironmentVerifier {
    constructor(options = {}) {
        this.errors = [];
        this.warnings = [];
        this.success = [];
        this.requiredNodeVersion = '18.0.0';
        this.requiredPorts = [3000, 3001];
        this.backendEnvPath = path.join(__dirname, 'backend', '.env');
        this.frontendEnvPath = path.join(__dirname, 'frontend', '.env');
        
        // Enhanced health monitoring properties
        this.serviceHealthStates = new Map();
        this.healthMonitor = null;
        this.troubleshooter = new AutomatedTroubleshooter();
        this.dependencyValidator = new DependencyValidator();
        this.performanceMonitor = new PerformanceMonitor();
        this.environmentValidator = new EnvironmentValidator();
        this.healthReporter = new HealthReporter();
        this.monitoringInterval = null;
        this.options = {
            mode: 'quick', // quick, comprehensive, continuous
            enableTroubleshooting: true,
            enablePerformanceMonitoring: false,
            reportFormat: 'markdown', // markdown, json, html, text
            monitoringIntervalMs: 30000,
            ...options
        };
        
        // Service health checkers
        this.serviceCheckers = new ServiceHealthCheckers();
    }

    log(message, type = 'info') {
        const colors = {
            error: '\x1b[31m',
            warning: '\x1b[33m',
            success: '\x1b[32m',
            info: '\x1b[36m',
            reset: '\x1b[0m'
        };
        
        const icon = {
            error: '❌',
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️'
        };

        console.log(`${colors[type]}${icon[type]} ${message}${colors.reset}`);
    }

    /**
     * Check if Node.js version meets requirements
     */
    checkNodeVersion() {
        try {
            const nodeVersion = process.version.replace('v', '');
            const [major, minor, patch] = nodeVersion.split('.').map(Number);
            const [reqMajor, reqMinor, reqPatch] = this.requiredNodeVersion.split('.').map(Number);

            if (major > reqMajor || 
                (major === reqMajor && minor > reqMinor) || 
                (major === reqMajor && minor === reqMinor && patch >= reqPatch)) {
                this.success.push(`Node.js version ${nodeVersion} meets requirement (>=${this.requiredNodeVersion})`);
                return true;
            } else {
                this.errors.push(`Node.js version ${nodeVersion} does not meet requirement (>=${this.requiredNodeVersion})`);
                this.errors.push('Please upgrade Node.js: https://nodejs.org/');
                return false;
            }
        } catch (error) {
            this.errors.push(`Failed to check Node.js version: ${error.message}`);
            return false;
        }
    }

    /**
     * Check npm version
     */
    checkNpmVersion() {
        try {
            const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
            const [major] = npmVersion.split('.').map(Number);
            
            if (major >= 9) {
                this.success.push(`npm version ${npmVersion} is compatible`);
                return true;
            } else {
                this.warnings.push(`npm version ${npmVersion} is older than recommended (>=9.0.0)`);
                this.warnings.push('Consider upgrading: npm install -g npm@latest');
                return true; // Not critical
            }
        } catch (error) {
            this.errors.push(`Failed to check npm version: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if a port is available
     */
    checkPortAvailability(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            
            server.listen(port, () => {
                server.close(() => resolve(true));
            });
            
            server.on('error', () => resolve(false));
        });
    }

    /**
     * Check all required ports
     */
    async checkPorts() {
        for (const port of this.requiredPorts) {
            const isAvailable = await this.checkPortAvailability(port);
            
            if (isAvailable) {
                this.success.push(`Port ${port} is available`);
            } else {
                this.warnings.push(`Port ${port} is in use`);
                this.warnings.push(`To free port ${port}: npx kill-port ${port} (or lsof -ti:${port} | xargs kill -9 on Unix)`);
            }
        }
    }

    /**
     * Check if .env file exists and validate its content
     */
    checkEnvFile(filePath, requiredVars, isBackend = false) {
        const envName = isBackend ? 'Backend' : 'Frontend';
        
        if (!fs.existsSync(filePath)) {
            this.errors.push(`${envName} .env file not found at ${filePath}`);
            this.errors.push(`Create it by copying from .env.example if available`);
            return false;
        }

        try {
            const envContent = fs.readFileSync(filePath, 'utf8');
            const envVars = {};
            
            envContent.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    envVars[key.trim()] = value.trim();
                }
            });

            let allValid = true;
            
            for (const varName of requiredVars) {
                if (!envVars[varName] || envVars[varName] === '') {
                    this.errors.push(`${envName} .env missing required variable: ${varName}`);
                    allValid = false;
                } else {
                    // Special validation for Gemini API key
                    if (varName === 'GEMINI_API_KEY') {
                        if (!envVars[varName].startsWith('AIzaSy')) {
                            this.warnings.push('GEMINI_API_KEY format may be invalid (should start with "AIzaSy")');
                        } else {
                            this.success.push('GEMINI_API_KEY format appears valid');
                        }
                    }
                    
                    this.success.push(`${envName} .env has valid ${varName}`);
                }
            }

            return allValid;
            
        } catch (error) {
            this.errors.push(`Failed to read ${envName} .env file: ${error.message}`);
            return false;
        }
    }

    /**
     * Check backend .env file
     */
    checkBackendEnv() {
        const requiredVars = ['GEMINI_API_KEY', 'PORT', 'NODE_ENV', 'CORS_ORIGINS'];
        return this.checkEnvFile(this.backendEnvPath, requiredVars, true);
    }

    /**
     * Check frontend .env file
     */
    checkFrontendEnv() {
        const requiredVars = ['VITE_API_BASE_URL', 'VITE_ENV', 'VITE_API_TIMEOUT', 'VITE_ENABLE_DEBUG_LOGS'];
        return this.checkEnvFile(this.frontendEnvPath, requiredVars, false);
    }

    /**
     * Check if Google Generative AI SDK can be loaded (if node_modules exists)
     */
    checkGoogleAI() {
        const backendNodeModules = path.join(__dirname, 'backend', 'node_modules');
        
        if (!fs.existsSync(backendNodeModules)) {
            this.warnings.push('Backend dependencies not installed yet');
            this.warnings.push('Run: cd backend && npm install');
            return true; // Not an error if deps aren't installed yet
        }

        try {
            const packagePath = path.join(backendNodeModules, '@google', 'generative-ai', 'package.json');
            if (fs.existsSync(packagePath)) {
                this.success.push('Google Generative AI SDK is available');
                return true;
            } else {
                this.errors.push('@google/generative-ai package not found');
                this.errors.push('Run: cd backend && npm install');
                return false;
            }
        } catch (error) {
            this.warnings.push(`Could not verify Google AI SDK: ${error.message}`);
            return true;
        }
    }

    /**
     * Generate remediation steps
     */
    generateRemediationSteps() {
        if (this.errors.length === 0 && this.warnings.length === 0) {
            return;
        }

        this.log('\n📋 REMEDIATION STEPS:', 'info');
        
        if (this.errors.length > 0) {
            this.log('\nCritical Issues (must fix):', 'error');
            this.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        if (this.warnings.length > 0) {
            this.log('\nWarnings (recommended to fix):', 'warning');
            this.warnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
        }

        this.log('\n🔧 Quick Setup Commands:', 'info');
        console.log('  1. Install dependencies: npm run bootstrap');
        console.log('  2. Start backend: cd backend && npm run dev');
        console.log('  3. Start frontend: cd frontend && npm run dev');
        console.log('  4. Run full health check: npm run health-check');
    }

    /**
     * Run comprehensive service connectivity tests
     */
    async runServiceConnectivityTests() {
        this.log('🌐 Running Service Connectivity Tests...', 'info');
        
        const services = ['gemini', 'awc', 'openweathermap', 'openmeteo', 'backend', 'frontend'];
        const results = {};
        
        for (const service of services) {
            try {
                const result = await this.serviceCheckers.checkService(service);
                results[service] = result;
                this.serviceHealthStates.set(service, result);
                
                if (result.status === 'healthy') {
                    this.success.push(`${service} service connectivity: OK`);
                } else {
                    this.warnings.push(`${service} service: ${result.message}`);
                }
            } catch (error) {
                this.errors.push(`${service} service check failed: ${error.message}`);
                results[service] = { status: 'error', message: error.message };
            }
        }
        
        return results;
    }

    /**
     * Run automated troubleshooting for detected issues
     */
    async runAutomatedTroubleshooting() {
        if (!this.options.enableTroubleshooting || this.errors.length === 0) {
            return null;
        }
        
        this.log('🔧 Running Automated Troubleshooting...', 'info');
        
        const troubleshootingResults = await this.troubleshooter.analyzeIssues({
            errors: this.errors,
            warnings: this.warnings,
            serviceStates: Object.fromEntries(this.serviceHealthStates)
        });
        
        if (troubleshootingResults.suggestions.length > 0) {
            this.log('\n🔧 AUTOMATED REPAIR SUGGESTIONS:', 'info');
            troubleshootingResults.suggestions.forEach((suggestion, index) => {
                console.log(`  ${index + 1}. ${suggestion.description}`);
                if (suggestion.command) {
                    console.log(`     Command: ${suggestion.command}`);
                }
            });
        }
        
        return troubleshootingResults;
    }

    /**
     * Start real-time health monitoring
     */
    async startContinuousMonitoring() {
        if (this.options.mode !== 'continuous') {
            return;
        }
        
        this.log('📡 Starting Continuous Health Monitoring...', 'info');
        
        this.healthMonitor = new HealthMonitor({
            interval: this.options.monitoringIntervalMs,
            serviceCheckers: this.serviceCheckers,
            reporter: this.healthReporter
        });
        
        await this.healthMonitor.start();
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.stopMonitoring());
        process.on('SIGTERM', () => this.stopMonitoring());
    }

    /**
     * Stop health monitoring
     */
    async stopMonitoring() {
        if (this.healthMonitor) {
            this.log('🛑 Stopping Health Monitoring...', 'info');
            await this.healthMonitor.stop();
            this.healthMonitor = null;
        }
        
        if (this.performanceMonitor) {
            await this.performanceMonitor.stop();
        }
        
        process.exit(0);
    }

    /**
     * Run performance monitoring checks
     */
    async runPerformanceChecks() {
        if (!this.options.enablePerformanceMonitoring) {
            return null;
        }
        
        this.log('⚡ Running Performance Checks...', 'info');
        
        try {
            const performanceResults = await this.performanceMonitor.collectMetrics();
            
            if (performanceResults && performanceResults.system && performanceResults.system.cpu) {
                if (performanceResults.system.cpu.usage > 80) {
                    this.warnings.push(`High CPU usage detected: ${performanceResults.system.cpu.usage}%`);
                }
            }
            
            if (performanceResults && performanceResults.system && performanceResults.system.memory) {
                if (performanceResults.system.memory.usage > 80) {
                    this.warnings.push(`High memory usage detected: ${performanceResults.system.memory.usage.toFixed(1)}%`);
                }
            }
            
            return performanceResults;
        } catch (error) {
            this.warnings.push(`Performance monitoring failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Generate comprehensive health report
     */
    async generateHealthReport() {
        const reportData = {
            timestamp: new Date().toISOString(),
            mode: this.options.mode,
            summary: {
                totalChecks: this.success.length + this.warnings.length + this.errors.length,
                passed: this.success.length,
                warnings: this.warnings.length,
                errors: this.errors.length,
                overallHealth: this.errors.length === 0 ? 'healthy' : 'unhealthy'
            },
            serviceStates: Object.fromEntries(this.serviceHealthStates),
            performance: {
                current: {
                    cpu: 0,
                    memory: 0,
                    disk: 0,
                    responseTime: 0
                },
                trends: {},
                alerts: { total: 0, critical: 0, warnings: 0 },
                recommendations: []
            },
            dependencies: {
                overall: {
                    status: 'unknown',
                    score: 0,
                    issues: []
                }
            },
            environment: {
                overall: {
                    status: 'unknown',
                    score: 0,
                    issues: []
                }
            },
            alerts: [],
            recommendations: [],
            environmentInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                cwd: process.cwd()
            }
        };
        
        return await this.healthReporter.generateHealthReport(reportData, {
            type: 'summary',
            format: this.options.reportFormat || 'markdown'
        });
    }
    /**
     * Run all verification checks with enhanced capabilities
     */
    async verify() {
        this.log('🔍 Sky Sensi Enhanced Environment Verification Starting...', 'info');
        console.log('');

        // Basic system checks
        this.checkNodeVersion();
        this.checkNpmVersion();
        await this.checkPorts();
        
        // Enhanced validation checks
        if (this.options.mode === 'comprehensive' || this.options.mode === 'continuous') {
            // Dependency validation
            const depResults = await this.dependencyValidator.validateDependencies();
            if (depResults.overall.status !== 'healthy') {
                this.warnings.push(`Dependency issues found: ${depResults.overall.issues.join(', ')}`);
            }
            
            // Environment validation
            const envResults = await this.environmentValidator.validateEnvironments();
            if (envResults.overall.status !== 'healthy') {
                this.warnings.push(`Environment issues found: ${envResults.overall.issues.join(', ')}`);
            }
        }

        // Check .env files
        this.checkBackendEnv();
        this.checkFrontendEnv();

        // Check Google AI SDK
        this.checkGoogleAI();

        // Service connectivity tests (if not basic mode)
        if (this.options.mode !== 'quick') {
            await this.runServiceConnectivityTests();
        }

        // Performance monitoring
        const performanceResults = await this.runPerformanceChecks();

        // Automated troubleshooting
        const troubleshootingResults = await this.runAutomatedTroubleshooting();

        // Display results
        console.log('\n' + '='.repeat(60));
        this.log('ENHANCED VERIFICATION RESULTS', 'info');
        console.log('='.repeat(60));

        if (this.success.length > 0) {
            this.log('\n✅ PASSED CHECKS:', 'success');
            this.success.forEach(msg => console.log(`  • ${msg}`));
        }

        if (this.warnings.length > 0) {
            this.log('\n⚠️  WARNINGS:', 'warning');
            this.warnings.forEach(msg => console.log(`  • ${msg}`));
        }

        if (this.errors.length > 0) {
            this.log('\n❌ FAILED CHECKS:', 'error');
            this.errors.forEach(msg => console.log(`  • ${msg}`));
        }

        // Generate comprehensive health report
        const healthReport = await this.generateHealthReport();

        this.generateRemediationSteps();

        // Start continuous monitoring if requested
        if (this.options.mode === 'continuous') {
            await this.startContinuousMonitoring();
            return; // Keep running
        }

        const hasErrors = this.errors.length > 0;
        const hasWarnings = this.warnings.length > 0;

        console.log('\n' + '='.repeat(60));
        
        if (!hasErrors && !hasWarnings) {
            this.log('🎉 Enhanced environment verification PASSED! System is healthy and ready.', 'success');
            console.log('\nNext steps:');
            console.log('  1. cd backend && npm run dev');
            console.log('  2. cd frontend && npm run dev');
            console.log('  3. Open http://localhost:3000');
            return true;
        } else if (!hasErrors) {
            this.log('✅ Environment verification PASSED with warnings.', 'success');
            this.log('Consider addressing warnings for optimal development experience.', 'info');
            return true;
        } else {
            this.log('❌ Environment verification FAILED. Please fix errors above.', 'error');
            return false;
        }
    }
}

// CLI argument parsing and execution
async function main() {
    const args = process.argv.slice(2);
    const options = {
        mode: 'quick',
        enableTroubleshooting: true,
        enablePerformanceMonitoring: false,
        reportFormat: 'markdown'
    };
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--mode':
                options.mode = args[++i] || 'quick';
                break;
            case '--comprehensive':
                options.mode = 'comprehensive';
                break;
            case '--monitor':
                options.mode = 'continuous';
                break;
            case '--no-troubleshooting':
                options.enableTroubleshooting = false;
                break;
            case '--performance':
                options.enablePerformanceMonitoring = true;
                break;
            case '--format':
                options.reportFormat = args[++i] || 'console';
                break;
            case '--help':
                console.log(`
Sky Sensi Enhanced Environment Verifier

Usage: node verify-setup.js [options]

Options:
  --mode <type>           Verification mode: quick, comprehensive, continuous
  --comprehensive         Run comprehensive verification
  --monitor              Start continuous health monitoring
  --performance          Enable performance monitoring
  --no-troubleshooting   Disable automated troubleshooting
  --format <type>        Report format: console, json, html
  --help                 Show this help message

Examples:
  node verify-setup.js                    # Quick verification
  node verify-setup.js --comprehensive    # Comprehensive checks
  node verify-setup.js --monitor         # Continuous monitoring
  node verify-setup.js --performance     # Include performance checks
                `);
                return;
        }
    }
    
    const verifier = new EnvironmentVerifier(options);
    
    try {
        await verifier.verify();
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    }
}

// Export for module usage
module.exports = EnvironmentVerifier;

// CLI execution
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Verification script failed:', error.message);
        process.exit(1);
    });
}