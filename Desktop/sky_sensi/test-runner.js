#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Sky Sensi Aviation Weather Application
 * Orchestrates backend Node.js tests, frontend Vitest tests, and integration tests
 * Provides unified reporting and coverage analysis
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');

// Import utilities and configuration
const testConfig = require('./test-config.json');
const TestReporter = require('./test-reporter.js');
const TestUtils = require('./test-utils.js');

class TestRunner {
  constructor(options = {}) {
    this.options = {
      verbose: options.verbose || false,
      coverage: options.coverage !== false,
      suite: options.suite || 'all',
      reporter: options.reporter || 'console',
      ...options
    };
    
    this.results = {
      backend: null,
      frontend: null,
      integration: null,
      startTime: Date.now(),
      endTime: null
    };
    
    this.reporter = new TestReporter(this.options);
  }

  async run() {
    console.log('🚀 Starting Sky Sensi Test Suite');
    console.log(`Suite: ${this.options.suite}, Coverage: ${this.options.coverage}`);
    
    try {
      // Ensure output directories exist
      await this.ensureDirectories();
      
      // Run test suites based on options
      if (this.options.suite === 'all' || this.options.suite === 'backend') {
        this.results.backend = await this.runBackendTests();
      }
      
      if (this.options.suite === 'all' || this.options.suite === 'frontend') {
        this.results.frontend = await this.runFrontendTests();
      }
      
      if (this.options.suite === 'all' || this.options.suite === 'integration') {
        this.results.integration = await this.runIntegrationTests();
      }
      
      // Weather services specific tests
      if (this.options.suite === 'weather-services') {
        this.results.backend = await this.runBackendTests(['src/fetchers/metar.test.js', 'src/fetchers/taf.test.js']);
        this.results.frontend = await this.runFrontendTests(['test/components/WeatherMap.test.jsx']);
      }
      
      this.results.endTime = Date.now();
      
      // Generate reports
      const summary = await this.reporter.generateReport(this.results);
      
      // Display summary
      this.displaySummary(summary);
      
      // Exit with appropriate code
      const hasFailures = summary.totalFailed > 0 || !summary.coverageThresholdsMet;
      process.exit(hasFailures ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    }
  }

  async ensureDirectories() {
    const dirs = [
      'coverage',
      'coverage/backend',
      'coverage/frontend',
      'coverage/combined',
      'test-reports'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async runBackendTests(testPattern = []) {
    console.log('\n📦 Running Backend Tests');
    
    const args = ['--test'];
    
    // If testPattern contains file paths, use them directly
    // Otherwise use --test-name-pattern for test name filtering
    if (testPattern.length > 0) {
      // Check if testPattern contains file paths (has .js extension)
      const hasFilePaths = testPattern.some(pattern => pattern.endsWith('.js'));
      
      if (hasFilePaths) {
        // Replace --test with file paths
        args.splice(0, 1); // Remove --test
        args.push('--test', ...testPattern);
      } else {
        // Use pattern matching for test names
        args.push('--test-name-pattern', testPattern.join('|'));
      }
    }
    
    let cmd = 'node';
    let cmdArgs = args;
    
    if (this.options.coverage) {
      cmd = 'npx';
      cmdArgs = [
        'c8',
        '--reporter=json',
        '--reporter=text',
        '--reports-dir=../coverage/backend',
        'node',
        ...args
      ];
    }
    
    const result = await this.executeTest({
      command: cmd,
      args: cmdArgs,
      cwd: path.join(process.cwd(), 'backend'),
      testType: 'backend'
    });
    
    return result;
  }

  async runFrontendTests(testPattern = []) {
    console.log('\n🎨 Running Frontend Tests');
    
    let cmd = 'npx';
    let args = ['vitest', '--run'];
    
    if (this.options.coverage) {
      args.push('--coverage');
    }
    
    if (testPattern.length > 0) {
      args.push(...testPattern);
    }
    
    const result = await this.executeTest({
      command: cmd,
      args: args,
      cwd: path.join(process.cwd(), 'frontend'),
      testType: 'frontend'
    });
    
    return result;
  }

  async runIntegrationTests() {
    console.log('\n🔗 Running Integration Tests');
    
    const result = await this.executeTest({
      command: 'node',
      args: ['test-integration-enhanced.js'],
      cwd: process.cwd(),
      testType: 'integration'
    });
    
    return result;
  }

  async executeTest({ command, args, cwd, testType }) {
    return new Promise((resolve, reject) => {
      if (this.options.verbose) {
        console.log(`Executing: ${command} ${args.join(' ')} in ${cwd}`);
      }
      
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      const child = spawn(command, args, {
        cwd: cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
      
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        if (this.options.verbose) {
          process.stdout.write(output);
        }
      });
      
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (this.options.verbose) {
          process.stderr.write(output);
        }
      });
      
      child.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const result = {
          testType,
          exitCode: code,
          duration,
          stdout,
          stderr,
          success: code === 0
        };
        
        if (this.options.verbose) {
          console.log(`${testType} tests completed in ${duration}ms with exit code ${code}`);
        }
        
        resolve(result);
      });
      
      child.on('error', (error) => {
        reject(new Error(`Failed to execute ${testType} tests: ${error.message}`));
      });
    });
  }

  displaySummary(summary) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`✅ Passed: ${summary.totalPassed}`);
    console.log(`❌ Failed: ${summary.totalFailed}`);
    console.log(`⏱️  Duration: ${(this.results.endTime - this.results.startTime)}ms`);
    
    if (this.options.coverage && summary.coverage) {
      console.log('\n📈 COVERAGE SUMMARY');
      console.log(`Lines: ${summary.coverage.lines}%`);
      console.log(`Branches: ${summary.coverage.branches}%`);
      console.log(`Functions: ${summary.coverage.functions}%`);
      console.log(`Statements: ${summary.coverage.statements}%`);
      
      // Display threshold status
      const thresholdStatus = summary.coverageThresholdsMet ? '✅' : '❌';
      console.log(`${thresholdStatus} Coverage thresholds: ${summary.coverageThresholdsMet ? 'MET' : 'NOT MET'}`);
    }
    
    if (summary.totalFailed > 0) {
      console.log('\n❌ FAILED TESTS:');
      summary.failures.forEach(failure => {
        console.log(`  - ${failure.suite}: ${failure.test}`);
      });
    }
    
    console.log(`\n📁 Reports saved to: test-reports/`);
    if (this.options.coverage) {
      console.log(`📁 Coverage reports: coverage/`);
    }
  }
}

// CLI Configuration
program
  .name('test-runner')
  .description('Sky Sensi Test Runner')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-coverage', 'Disable coverage collection')
  .option('-s, --suite <type>', 'Test suite to run (all, backend, frontend, integration, weather-services)', 'all')
  .option('-r, --reporter <type>', 'Reporter type (console, json, html)', 'console')
  .action(async (options) => {
    const runner = new TestRunner(options);
    await runner.run();
  });

// Handle CLI execution
if (require.main === module) {
  program.parse();
}

module.exports = TestRunner;