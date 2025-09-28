/**
 * Test Utilities Module
 * Shared utilities for test setup, mocking, and helper functions
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class TestUtils {
  constructor() {
    this.mockData = new Map();
    this.temporaryFiles = [];
  }

  /**
   * Setup test environment with common configurations
   */
  static async setupTestEnvironment() {
    // Ensure test directories exist
    await TestUtils.ensureDir('coverage');
    await TestUtils.ensureDir('test-reports');
    await TestUtils.ensureDir('coverage/backend');
    await TestUtils.ensureDir('coverage/frontend');
    
    // Set common test environment variables
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.TEST_TIMEOUT = '30000';
    
    return true;
  }

  /**
   * Cleanup test environment
   */
  static async cleanupTestEnvironment() {
    // Clean up temporary test files
    const tempFiles = [
      'test-output.json',
      '.nyc_output',
      'coverage-temp'
    ];
    
    for (const file of tempFiles) {
      try {
        await fs.rm(file, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    return true;
  }

  /**
   * Ensure directory exists
   */
  static async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Create mock weather service responses
   */
  static createWeatherServiceMocks() {
    return {
      openWeatherMap: {
        weatherMap: {
          list: [
            {
              coord: { lon: -122.42, lat: 37.77 },
              weather: [{ id: 800, main: "Clear", description: "clear sky" }],
              main: { temp: 20.5, feels_like: 19.8, humidity: 65 },
              wind: { speed: 3.2, deg: 240 },
              dt: Date.now() / 1000
            }
          ]
        },
        forecast: {
          list: Array.from({ length: 8 }, (_, i) => ({
            dt: Date.now() / 1000 + (i * 3 * 3600),
            main: { temp: 18 + i, humidity: 60 + i * 2 },
            weather: [{ main: i % 2 === 0 ? "Clear" : "Clouds" }],
            wind: { speed: 2 + i * 0.5 }
          }))
        }
      },
      openMeteo: {
        hourly: {
          time: Array.from({ length: 24 }, (_, i) => {
            const date = new Date();
            date.setHours(date.getHours() + i);
            return date.toISOString();
          }),
          temperature_2m: Array.from({ length: 24 }, (_, i) => 15 + Math.sin(i * Math.PI / 12) * 5),
          relative_humidity_2m: Array.from({ length: 24 }, () => 65 + Math.random() * 20),
          wind_speed_10m: Array.from({ length: 24 }, () => 5 + Math.random() * 10),
          wind_direction_10m: Array.from({ length: 24 }, () => Math.random() * 360),
          visibility: Array.from({ length: 24 }, () => 8000 + Math.random() * 2000)
        }
      },
      aviationWeather: {
        metar: {
          data: [
            {
              icaoId: "KORD",
              obsTime: new Date().toISOString(),
              temp: "18",
              dewp: "12",
              wdir: "270",
              wspd: "12",
              wgst: null,
              visib: "10",
              altim: "30.15",
              wxString: "CLR",
              fltcat: "VFR"
            }
          ]
        },
        taf: {
          data: [
            {
              icaoId: "KORD",
              issueTime: new Date().toISOString(),
              validTimeFrom: new Date().toISOString(),
              validTimeTo: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              rawTAF: "TAF KORD 241720Z 2418/2524 27012KT P6SM FEW250 FM242000 28008KT P6SM SCT250"
            }
          ]
        }
      }
    };
  }

  /**
   * Create mock flight route for testing
   */
  static createMockFlightRoute() {
    return {
      departure: {
        icao: "KORD",
        name: "Chicago O'Hare International Airport",
        lat: 41.9786,
        lon: -87.9048
      },
      destination: {
        icao: "KLAX",
        name: "Los Angeles International Airport", 
        lat: 33.9425,
        lon: -118.4081
      },
      waypoints: [
        { lat: 41.9786, lon: -87.9048, name: "KORD" },
        { lat: 39.7392, lon: -104.9903, name: "KDEN" },
        { lat: 33.9425, lon: -118.4081, name: "KLAX" }
      ],
      distance: 1745.2,
      estimatedTime: 240,
      altitude: 35000
    };
  }

  /**
   * Mock HTTP requests for testing
   */
  static mockHttpRequests(mockResponses = {}) {
    const originalFetch = global.fetch;
    
    // Create mock function based on available testing framework
    let mockFn;
    if (typeof global.vi !== 'undefined') {
      // Vitest environment
      mockFn = global.vi.fn();
    } else if (typeof global.jest !== 'undefined') {
      // Jest environment
      mockFn = global.jest.fn();
    } else {
      // Plain Node.js - create manual mock
      const calls = [];
      mockFn = function(...args) {
        calls.push(args);
        return mockFn._mockImplementation(...args);
      };
      mockFn._mockImplementation = () => Promise.resolve({ ok: false });
      mockFn.mockImplementation = (impl) => { mockFn._mockImplementation = impl; };
      mockFn.getCalls = () => calls;
    }
    
    global.fetch = mockFn.mockImplementation((url, options) => {
      const urlStr = url.toString();
      
      // Check for specific URL patterns and return appropriate mocks
      if (urlStr.includes('openweathermap.org')) {
        if (urlStr.includes('weather?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponses.openWeatherCurrent || TestUtils.createWeatherServiceMocks().openWeatherMap.weatherMap)
          });
        } else if (urlStr.includes('forecast?')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponses.openWeatherForecast || TestUtils.createWeatherServiceMocks().openWeatherMap.forecast)
          });
        }
      }
      
      if (urlStr.includes('api.open-meteo.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponses.openMeteo || TestUtils.createWeatherServiceMocks().openMeteo)
        });
      }
      
      if (urlStr.includes('aviationweather.gov')) {
        if (urlStr.includes('metar')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponses.metar || TestUtils.createWeatherServiceMocks().aviationWeather.metar)
          });
        } else if (urlStr.includes('taf')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponses.taf || TestUtils.createWeatherServiceMocks().aviationWeather.taf)
          });
        }
      }
      
      // Fallback to original fetch or reject
      if (originalFetch) {
        return originalFetch(url, options);
      }
      
      return Promise.reject(new Error(`Unmocked request: ${url}`));
    });
    
    return () => {
      global.fetch = originalFetch;
    };
  }

  /**
   * Wait for a condition to be true with timeout
   */
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await TestUtils.sleep(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start test servers (backend and optionally frontend)
   */
  static async startTestServers(options = {}) {
    const servers = {};
    
    // Start backend server
    console.log('🚀 Starting backend server...');
    const backendProcess = spawn('node', ['src/server.js'], {
      cwd: path.join(process.cwd(), 'backend'),
      stdio: 'pipe',
      env: { 
        ...process.env, 
        PORT: '3001', 
        NODE_ENV: 'test',
        LOG_LEVEL: 'error'
      }
    });

    let backendReady = false;
    const backendTimeout = setTimeout(() => {
      if (!backendReady) {
        backendProcess.kill();
        throw new Error('Backend server startup timeout');
      }
    }, 15000);

    // Wait for backend to be ready
    await new Promise((resolve, reject) => {
      backendProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running') || output.includes('listening')) {
          backendReady = true;
          clearTimeout(backendTimeout);
          resolve();
        }
      });

      backendProcess.stderr?.on('data', (data) => {
        console.warn('Backend stderr:', data.toString());
      });

      backendProcess.on('error', (error) => {
        clearTimeout(backendTimeout);
        reject(error);
      });

      backendProcess.on('exit', (code) => {
        if (code !== 0 && !backendReady) {
          clearTimeout(backendTimeout);
          reject(new Error(`Backend server exited with code ${code}`));
        }
      });
    });

    // Verify backend health endpoint
    await TestUtils.waitFor(async () => {
      try {
        const response = await fetch('http://localhost:3001/health');
        return response.ok;
      } catch (error) {
        return false;
      }
    }, 10000, 500);

    servers.backend = backendProcess;
    console.log('✅ Backend server ready on port 3001');

    // Start frontend server if requested
    if (options.startFrontend) {
      console.log('🚀 Starting frontend server...');
      const frontendProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(process.cwd(), 'frontend'),
        stdio: 'pipe',
        env: { 
          ...process.env, 
          PORT: '3000',
          NODE_ENV: 'test'
        }
      });

      let frontendReady = false;
      const frontendTimeout = setTimeout(() => {
        if (!frontendReady) {
          frontendProcess.kill();
          throw new Error('Frontend server startup timeout');
        }
      }, 20000);

      // Wait for frontend to be ready
      await new Promise((resolve, reject) => {
        frontendProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Local:') || output.includes('localhost:3000') || output.includes('ready')) {
            frontendReady = true;
            clearTimeout(frontendTimeout);
            resolve();
          }
        });

        frontendProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Local:') || output.includes('localhost:3000')) {
            frontendReady = true;
            clearTimeout(frontendTimeout);
            resolve();
          }
        });

        frontendProcess.on('error', (error) => {
          clearTimeout(frontendTimeout);
          reject(error);
        });

        frontendProcess.on('exit', (code) => {
          if (code !== 0 && !frontendReady) {
            clearTimeout(frontendTimeout);
            reject(new Error(`Frontend server exited with code ${code}`));
          }
        });
      });

      // Verify frontend is accessible
      await TestUtils.waitFor(async () => {
        try {
          const response = await fetch('http://localhost:3000');
          return response.ok || response.status === 404; // 404 is ok for SPA
        } catch (error) {
          return false;
        }
      }, 15000, 1000);

      servers.frontend = frontendProcess;
      console.log('✅ Frontend server ready on port 3000');
    }

    return servers;
  }

  /**
   * Stop test servers cleanly
   */
  static async stopTestServers(servers) {
    const stopPromises = [];

    if (servers.backend && !servers.backend.killed) {
      console.log('🛑 Stopping backend server...');
      stopPromises.push(new Promise((resolve) => {
        servers.backend.on('exit', () => {
          console.log('✅ Backend server stopped');
          resolve();
        });
        
        servers.backend.kill('SIGTERM');
        
        // Force kill after 5 seconds if not stopped gracefully
        setTimeout(() => {
          if (!servers.backend.killed) {
            servers.backend.kill('SIGKILL');
          }
        }, 5000);
      }));
    }

    if (servers.frontend && !servers.frontend.killed) {
      console.log('🛑 Stopping frontend server...');
      stopPromises.push(new Promise((resolve) => {
        servers.frontend.on('exit', () => {
          console.log('✅ Frontend server stopped');
          resolve();
        });
        
        servers.frontend.kill('SIGTERM');
        
        // Force kill after 5 seconds if not stopped gracefully
        setTimeout(() => {
          if (!servers.frontend.killed) {
            servers.frontend.kill('SIGKILL');
          }
        }, 5000);
      }));
    }

    // Wait for all servers to stop
    await Promise.all(stopPromises);
  }

  /**
   * Execute command with timeout and return result
   */
  static executeCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 30000;
      let stdout = '';
      let stderr = '';
      let startTime = Date.now();
      
      const child = spawn(command, args, {
        stdio: 'pipe',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env }
      });
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timeout after ${timeout}ms: ${command} ${args.join(' ')}`));
      }, timeout);
      
      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr,
          duration
        });
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Generate test coverage thresholds based on current coverage
   */
  static async generateCoverageThresholds() {
    const thresholds = {
      backend: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80
      },
      frontend: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85
      }
    };
    
    // Try to read existing coverage and adjust thresholds
    try {
      const backendCoverage = await TestUtils.readCoverageFile('coverage/backend/coverage-summary.json');
      if (backendCoverage && backendCoverage.total) {
        thresholds.backend.lines = Math.max(70, Math.floor(backendCoverage.total.lines.pct * 0.9));
        thresholds.backend.branches = Math.max(65, Math.floor(backendCoverage.total.branches.pct * 0.9));
      }
    } catch (error) {
      // Use default thresholds
    }
    
    try {
      const frontendCoverage = await TestUtils.readCoverageFile('frontend/coverage/coverage-summary.json');
      if (frontendCoverage && frontendCoverage.total) {
        thresholds.frontend.lines = Math.max(75, Math.floor(frontendCoverage.total.lines.pct * 0.9));
        thresholds.frontend.branches = Math.max(70, Math.floor(frontendCoverage.total.branches.pct * 0.9));
      }
    } catch (error) {
      // Use default thresholds
    }
    
    return thresholds;
  }

  /**
   * Read and parse coverage file
   */
  static async readCoverageFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create temporary test file with content
   */
  async createTempFile(content, extension = '.tmp') {
    const tempDir = path.join(process.cwd(), 'temp');
    await TestUtils.ensureDir(tempDir);
    
    const filename = `test-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
    const filePath = path.join(tempDir, filename);
    
    await fs.writeFile(filePath, content);
    this.temporaryFiles.push(filePath);
    
    return filePath;
  }

  /**
   * Clean up temporary files created during tests
   */
  async cleanup() {
    for (const file of this.temporaryFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.temporaryFiles = [];
  }

  /**
   * Validate test environment setup
   */
  static async validateTestEnvironment() {
    const checks = [];
    
    // Check Node.js version
    const nodeVersion = process.version;
    checks.push({
      name: 'Node.js Version',
      status: nodeVersion.startsWith('v18') || nodeVersion.startsWith('v20') ? 'pass' : 'warn',
      message: `Current: ${nodeVersion}, Recommended: v18+ or v20+`
    });
    
    // Check required directories
    const requiredDirs = ['backend', 'frontend', 'test-reports', 'coverage'];
    for (const dir of requiredDirs) {
      try {
        await fs.access(dir);
        checks.push({ name: `Directory: ${dir}`, status: 'pass', message: 'Exists' });
      } catch (error) {
        checks.push({ name: `Directory: ${dir}`, status: 'fail', message: 'Missing' });
      }
    }
    
    // Check environment variables
    const requiredEnvVars = ['NODE_ENV'];
    for (const envVar of requiredEnvVars) {
      checks.push({
        name: `Env Var: ${envVar}`,
        status: process.env[envVar] ? 'pass' : 'warn',
        message: process.env[envVar] || 'Not set'
      });
    }
    
    return checks;
  }

  /**
   * Generate test data for specific test scenarios
   */
  static generateTestData(type) {
    const generators = {
      'weather-briefing': () => ({
        route: TestUtils.createMockFlightRoute(),
        weather: TestUtils.createWeatherServiceMocks(),
        briefingId: `briefing_${Date.now()}`,
        timestamp: new Date().toISOString()
      }),
      
      'airport-data': () => ({
        icao: 'KORD',
        name: "Chicago O'Hare International Airport",
        coordinates: { lat: 41.9786, lon: -87.9048 },
        runways: ['10L/28R', '10R/28L', '14R/32L', '14L/32R'],
        elevation: 672
      }),
      
      'flight-plan': () => ({
        aircraft: 'C172',
        departure: 'KORD',
        destination: 'KLAX', 
        cruiseAltitude: 8500,
        route: 'KORD BAMBI KUMP KLAX',
        estimatedTime: 180
      })
    };
    
    return generators[type] ? generators[type]() : null;
  }
}

module.exports = TestUtils;