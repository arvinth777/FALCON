/**
 * Individual Health Checker Modules for Service Dependencies
 * Provides specialized health checking for each external and internal service
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

// Load environment variables from both root and backend .env files
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
require('dotenv').config({ path: path.join(__dirname, 'frontend', '.env') });

class ServiceHealthCheckers {
    constructor() {
        this.checkers = {
            gemini: new GeminiHealthChecker(),
            awc: new AWCHealthChecker(),
            openweathermap: new OpenWeatherMapHealthChecker(),
            openmeteo: new OpenMeteoHealthChecker(),
            backend: new BackendHealthChecker(),
            frontend: new FrontendHealthChecker()
        };
    }

    /**
     * Check the health of a specific service
     */
    async checkService(serviceName) {
        const checker = this.checkers[serviceName];
        if (!checker) {
            throw new Error(`Unknown service: ${serviceName}`);
        }
        
        const startTime = Date.now();
        try {
            const result = await checker.check();
            const responseTime = Date.now() - startTime;
            
            return {
                ...result,
                service: serviceName,
                responseTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: error.message,
                service: serviceName,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Check all services
     */
    async checkAllServices() {
        const results = {};
        
        for (const serviceName of Object.keys(this.checkers)) {
            results[serviceName] = await this.checkService(serviceName);
        }
        
        return results;
    }

    /**
     * Get available service names
     */
    getAvailableServices() {
        return Object.keys(this.checkers);
    }

    // Individual service health check helper methods
    async checkGeminiHealth() {
        return await this.checkService('gemini');
    }

    async checkAwcHealth() {
        return await this.checkService('awc');
    }

    async checkOpenWeatherMapHealth() {
        return await this.checkService('openweathermap');
    }

    async checkOpenMeteoHealth() {
        return await this.checkService('openmeteo');
    }

    async checkBackendHealth() {
        return await this.checkService('backend');
    }

    async checkFrontendHealth() {
        return await this.checkService('frontend');
    }
}

/**
 * Gemini AI Health Checker
 */
class GeminiHealthChecker {
    async check() {
        // Check if Gemini service is configured
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return {
                status: 'warning',
                message: 'GEMINI_API_KEY not configured - AI features will be unavailable'
            };
        }
        
        // Validate API key format
        if (!this.isValidGeminiKey(geminiKey)) {
            return {
                status: 'error',
                message: 'GEMINI_API_KEY format appears invalid'
            };
        }
        
        // Test basic connectivity with lightweight request
        try {
            const { GoogleGenerativeAI } = require('./backend/node_modules/@google/generative-ai');
            const genAI = new GoogleGenerativeAI(geminiKey);
            
            // Try to get model (doesn't make API call, just validates setup)
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            
            if (!model) {
                return {
                    status: 'error',
                    message: 'Failed to initialize Gemini model'
                };
            }
            
            return {
                status: 'healthy',
                message: 'Gemini AI service is configured and ready',
                details: {
                    keyLength: geminiKey.length,
                    keyPrefix: geminiKey.substring(0, 8) + '...',
                    modelAvailable: true
                }
            };
            
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                return {
                    status: 'error',
                    message: '@google/generative-ai package not installed'
                };
            }
            
            return {
                status: 'error',
                message: `Gemini service error: ${error.message}`
            };
        }
    }
    
    isValidGeminiKey(key) {
        // Basic validation - Gemini keys typically start with 'AIza' and have specific length
        return typeof key === 'string' && key.startsWith('AIza') && key.length > 30;
    }
}

/**
 * Aviation Weather Center (AWC) Health Checker
 */
class AWCHealthChecker {
    async check() {
        try {
            // Test AWC API connectivity with a simple METAR request
            const testUrl = 'https://aviationweather.gov/api/data/metar?ids=KORD&format=json';
            
            const response = await this.makeHttpRequest(testUrl, { timeout: 10000 });
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                
                if (Array.isArray(data) || (data && typeof data === 'object')) {
                    return {
                        status: 'healthy',
                        message: 'AWC API is accessible and responding',
                        details: {
                            endpoint: 'aviationweather.gov',
                            responseSize: response.body.length,
                            hasData: Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0
                        }
                    };
                }
            }
            
            return {
                status: 'warning',
                message: `AWC API returned status ${response.statusCode}`,
                details: {
                    statusCode: response.statusCode,
                    responseSize: response.body ? response.body.length : 0
                }
            };
            
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return {
                    status: 'error',
                    message: 'Cannot reach AWC API - check internet connection'
                };
            }
            
            if (error.code === 'ETIMEDOUT') {
                return {
                    status: 'warning',
                    message: 'AWC API response timeout - service may be slow'
                };
            }
            
            return {
                status: 'error',
                message: `AWC API error: ${error.message}`
            };
        }
    }
    
    makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.get(url, {
                timeout: options.timeout || 10000,
                headers: {
                    'User-Agent': 'Sky-Sensi-Health-Check/1.0'
                }
            }, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }
}

/**
 * OpenWeatherMap Health Checker
 */
class OpenWeatherMapHealthChecker {
    async check() {
        const owmKey = process.env.VITE_OWM_KEY;
        
        if (!owmKey) {
            return {
                status: 'warning',
                message: 'VITE_OWM_KEY not configured - weather tile overlays will be unavailable'
            };
        }
        
        try {
            // Test tile service connectivity (doesn't count against API quota)
            const tileUrl = `https://tile.openweathermap.org/map/temp_new/1/0/0.png?appid=${owmKey}`;
            
            const response = await this.makeHttpRequest(tileUrl, { timeout: 10000 });
            
            if (response.statusCode === 200) {
                return {
                    status: 'healthy',
                    message: 'OpenWeatherMap tile service is accessible',
                    details: {
                        keyLength: owmKey.length,
                        endpoint: 'tile.openweathermap.org',
                        responseSize: response.body ? response.body.length : 0
                    }
                };
            } else if (response.statusCode === 401) {
                return {
                    status: 'error',
                    message: 'OpenWeatherMap API key is invalid'
                };
            } else {
                return {
                    status: 'warning',
                    message: `OpenWeatherMap service returned status ${response.statusCode}`
                };
            }
            
        } catch (error) {
            return {
                status: 'error',
                message: `OpenWeatherMap service error: ${error.message}`
            };
        }
    }
    
    makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.get(url, {
                timeout: options.timeout || 10000
            }, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }
}

/**
 * Open-Meteo Health Checker
 */
class OpenMeteoHealthChecker {
    async check() {
        try {
            // Test Open-Meteo API with a simple weather request
            const testUrl = 'https://api.open-meteo.com/v1/forecast?latitude=41.98&longitude=-87.90&current_weather=true';
            
            const response = await this.makeHttpRequest(testUrl, { timeout: 10000 });
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                
                if (data && data.current_weather) {
                    return {
                        status: 'healthy',
                        message: 'Open-Meteo API is accessible and responding',
                        details: {
                            endpoint: 'api.open-meteo.com',
                            responseSize: response.body.length,
                            hasCurrentWeather: !!data.current_weather,
                            temperature: data.current_weather.temperature
                        }
                    };
                }
            }
            
            return {
                status: 'warning',
                message: `Open-Meteo API returned status ${response.statusCode}`,
                details: {
                    statusCode: response.statusCode
                }
            };
            
        } catch (error) {
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return {
                    status: 'error',
                    message: 'Cannot reach Open-Meteo API - check internet connection'
                };
            }
            
            return {
                status: 'error',
                message: `Open-Meteo API error: ${error.message}`
            };
        }
    }
    
    makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.get(url, {
                timeout: options.timeout || 10000,
                headers: {
                    'User-Agent': 'Sky-Sensi-Health-Check/1.0'
                }
            }, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }
}

/**
 * Backend Health Checker
 */
class BackendHealthChecker {
    async check() {
        try {
            // Check if backend server is running on expected port
            const response = await this.makeHttpRequest('http://localhost:3001/health', { timeout: 5000 });
            
            if (response.statusCode === 200) {
                const data = JSON.parse(response.body);
                
                if (data && data.status === 'ok') {
                    return {
                        status: 'healthy',
                        message: 'Backend server is running and healthy',
                        details: {
                            port: 3001,
                            endpoint: '/health',
                            serverTime: data.timestamp,
                            uptime: data.uptime
                        }
                    };
                }
            }
            
            return {
                status: 'warning',
                message: `Backend server responded with status ${response.statusCode}`
            };
            
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return {
                    status: 'error',
                    message: 'Backend server is not running on port 3001'
                };
            }
            
            return {
                status: 'error',
                message: `Backend server error: ${error.message}`
            };
        }
    }
    
    makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const req = http.get(url, {
                timeout: options.timeout || 5000
            }, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }
}

/**
 * Frontend Health Checker
 */
class FrontendHealthChecker {
    async check() {
        try {
            // Check if frontend build exists
            const frontendPath = path.join(process.cwd(), 'frontend');
            const distPath = path.join(frontendPath, 'dist');
            const packagePath = path.join(frontendPath, 'package.json');
            
            // Check if package.json exists
            try {
                await fs.access(packagePath);
            } catch {
                return {
                    status: 'error',
                    message: 'Frontend package.json not found'
                };
            }
            
            // Check if frontend dependencies are installed
            const nodeModulesPath = path.join(frontendPath, 'node_modules');
            try {
                await fs.access(nodeModulesPath);
            } catch {
                return {
                    status: 'warning',
                    message: 'Frontend dependencies not installed - run npm install in frontend directory'
                };
            }
            
            // Try to connect to development server if running
            try {
                const response = await this.makeHttpRequest('http://localhost:3000', { timeout: 3000 });
                
                if (response.statusCode === 200) {
                    return {
                        status: 'healthy',
                        message: 'Frontend development server is running',
                        details: {
                            port: 3000,
                            hasDistBuild: await this.checkDistExists(distPath),
                            hasDependencies: true
                        }
                    };
                }
            } catch {
                // Development server not running, check other indicators
            }
            
            // Check if production build exists
            const hasDistBuild = await this.checkDistExists(distPath);
            
            return {
                status: 'warning',
                message: 'Frontend development server not running',
                details: {
                    hasDependencies: true,
                    hasDistBuild,
                    suggestion: hasDistBuild ? 'Start dev server with: cd frontend && npm run dev' : 'Build frontend with: cd frontend && npm run build'
                }
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: `Frontend check error: ${error.message}`
            };
        }
    }
    
    async checkDistExists(distPath) {
        try {
            const stat = await fs.stat(distPath);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }
    
    makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const req = http.get(url, {
                timeout: options.timeout || 3000
            }, (res) => {
                let body = '';
                
                res.on('data', chunk => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }
}

module.exports = ServiceHealthCheckers;