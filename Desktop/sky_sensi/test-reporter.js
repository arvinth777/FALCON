/**
 * Test Result Aggregation and Reporting Module
 * Processes test outputs from all test suites and generates unified reports
 */

const fs = require('fs').promises;
const path = require('path');

class TestReporter {
  constructor(options = {}) {
    this.options = options;
    this.reportsDir = path.join(process.cwd(), 'test-reports');
  }

  async generateReport(results) {
    const timestamp = new Date().toISOString();
    
    // Parse individual test results
    const parsedResults = {
      backend: this.parseBackendResults(results.backend),
      frontend: this.parseFrontendResults(results.frontend),
      integration: this.parseIntegrationResults(results.integration),
      timestamp,
      duration: results.endTime - results.startTime
    };

    // Calculate aggregated metrics
    const summary = this.calculateSummary(parsedResults);

    // Load and merge coverage data
    if (this.options.coverage) {
      const combinedCoverage = await this.aggregateCoverage();
      if (combinedCoverage) {
        // Convert to plain percentage numbers
        summary.coverage = {
          lines: combinedCoverage.lines.pct,
          branches: combinedCoverage.branches.pct,
          functions: combinedCoverage.functions.pct,
          statements: combinedCoverage.statements.pct
        };
        
        // Check thresholds against test-config.json or defaults
        summary.coverageThresholdsMet = this.checkCoverageThresholds(summary.coverage);
      }
    }

    // Generate reports in different formats
    await this.generateJsonReport(summary, parsedResults);
    await this.generateHtmlReport(summary, parsedResults);
    await this.generateConsoleReport(summary);

    // Generate failure analysis if there are failures
    if (summary.totalFailed > 0) {
      await this.generateFailureReport(parsedResults);
    }

    return summary;
  }

  parseBackendResults(result) {
    if (!result || !result.success) {
      return {
        tests: 0,
        passed: 0,
        failed: result ? 1 : 0,
        duration: result?.duration || 0,
        failures: result ? [{ suite: 'backend', error: result.stderr }] : []
      };
    }

    // Parse Node.js test runner TAP output
    const tapOutput = result.stdout;
    const tests = this.parseTapOutput(tapOutput);
    
    return {
      tests: tests.total,
      passed: tests.passed,
      failed: tests.failed,
      duration: result.duration,
      failures: tests.failures,
      coverage: this.extractBackendCoverage(result.stdout)
    };
  }

  parseFrontendResults(result) {
    if (!result || !result.success) {
      return {
        tests: 0,
        passed: 0,
        failed: result ? 1 : 0,
        duration: result?.duration || 0,
        failures: result ? [{ suite: 'frontend', error: result.stderr }] : []
      };
    }

    // Parse Vitest output
    const vitestOutput = result.stdout;
    const tests = this.parseVitestOutput(vitestOutput);
    
    return {
      tests: tests.total,
      passed: tests.passed,
      failed: tests.failed,
      duration: result.duration,
      failures: tests.failures,
      coverage: this.extractFrontendCoverage(vitestOutput)
    };
  }

  parseIntegrationResults(result) {
    if (!result || !result.success) {
      return {
        tests: 0,
        passed: 0,
        failed: result ? 1 : 0,
        duration: result?.duration || 0,
        failures: result ? [{ suite: 'integration', error: result.stderr }] : []
      };
    }

    // Parse custom integration test output
    return this.parseCustomTestOutput(result.stdout, result.duration);
  }

  parseTapOutput(tapOutput) {
    const lines = tapOutput.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const line of lines) {
      if (line.includes('✔') || line.startsWith('ok ')) {
        total++;
        passed++;
      } else if (line.includes('✖') || line.startsWith('not ok ')) {
        total++;
        failed++;
        failures.push({
          suite: 'backend',
          test: this.extractTestName(line),
          error: line
        });
      }
    }

    return { total, passed, failed, failures };
  }

  parseVitestOutput(vitestOutput) {
    const lines = vitestOutput.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const line of lines) {
      if (line.includes('✓') && (line.includes('passed') || line.includes(')'))) {
        const match = line.match(/(\d+) passed/);
        if (match) {
          const testCount = parseInt(match[1]);
          total += testCount;
          passed += testCount;
        }
      } else if (line.includes('failed') && line.includes('Tests')) {
        const match = line.match(/(\d+) failed/);
        if (match) {
          const failedCount = parseInt(match[1]);
          failed += failedCount;
          total += failedCount;
        }
      }
    }

    // Extract failure details
    let inFailureSection = false;
    for (const line of lines) {
      if (line.includes('FAIL') && line.includes('test/')) {
        inFailureSection = true;
        failures.push({
          suite: 'frontend',
          test: this.extractTestName(line),
          error: line
        });
      }
    }

    return { total, passed, failed, failures };
  }

  parseCustomTestOutput(output, duration) {
    // Parse custom integration test results format
    const lines = output.split('\n');
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const line of lines) {
      if (line.includes('✅') || line.includes('PASS')) {
        passed++;
      } else if (line.includes('❌') || line.includes('FAIL')) {
        failed++;
        failures.push({
          suite: 'integration',
          test: this.extractTestName(line),
          error: line
        });
      }
    }

    return {
      tests: passed + failed,
      passed,
      failed,
      duration,
      failures
    };
  }

  extractTestName(line) {
    // Extract test name from various output formats
    const patterns = [
      /✖\s+(.+?)\s+\(/,
      /FAIL\s+(.+?)\s+>/,
      /not ok\s+\d+\s+(.+)/,
      /❌\s+(.+)/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[1].trim();
    }

    return line.trim();
  }

  extractBackendCoverage(output) {
    // Extract coverage data from c8 output
    const coverageRegex = /Lines\s+:\s+([\d.]+)%.*Branches\s+:\s+([\d.]+)%.*Functions\s+:\s+([\d.]+)%.*Statements\s+:\s+([\d.]+)%/s;
    const match = output.match(coverageRegex);
    
    if (match) {
      return {
        lines: parseFloat(match[1]),
        branches: parseFloat(match[2]),
        functions: parseFloat(match[3]),
        statements: parseFloat(match[4])
      };
    }
    
    return null;
  }

  extractFrontendCoverage(output) {
    // Extract coverage data from Vitest output
    const lines = output.split('\n');
    const coverage = {};
    
    for (const line of lines) {
      if (line.includes('% Lines')) {
        const match = line.match(/([\d.]+)% Lines/);
        if (match) coverage.lines = parseFloat(match[1]);
      }
      if (line.includes('% Branches')) {
        const match = line.match(/([\d.]+)% Branches/);
        if (match) coverage.branches = parseFloat(match[1]);
      }
      if (line.includes('% Functions')) {
        const match = line.match(/([\d.]+)% Functions/);
        if (match) coverage.functions = parseFloat(match[1]);
      }
      if (line.includes('% Statements')) {
        const match = line.match(/([\d.]+)% Statements/);
        if (match) coverage.statements = parseFloat(match[1]);
      }
    }
    
    return Object.keys(coverage).length > 0 ? coverage : null;
  }

  calculateSummary(parsedResults) {
    const totalTests = (parsedResults.backend?.tests || 0) + 
                      (parsedResults.frontend?.tests || 0) + 
                      (parsedResults.integration?.tests || 0);
    
    const totalPassed = (parsedResults.backend?.passed || 0) + 
                       (parsedResults.frontend?.passed || 0) + 
                       (parsedResults.integration?.passed || 0);
    
    const totalFailed = (parsedResults.backend?.failed || 0) + 
                       (parsedResults.frontend?.failed || 0) + 
                       (parsedResults.integration?.failed || 0);

    const failures = [
      ...(parsedResults.backend?.failures || []),
      ...(parsedResults.frontend?.failures || []),
      ...(parsedResults.integration?.failures || [])
    ];

    return {
      totalTests,
      totalPassed,
      totalFailed,
      duration: parsedResults.duration,
      failures,
      timestamp: parsedResults.timestamp,
      coverageThresholdsMet: true // Will be updated if coverage is available
    };
  }

  async aggregateCoverage() {
    try {
      // Try to read backend coverage
      let backendCoverage = null;
      try {
        const backendCoverageFile = await fs.readFile(
          path.join(process.cwd(), 'coverage', 'backend', 'coverage-final.json'),
          'utf8'
        );
        backendCoverage = JSON.parse(backendCoverageFile);
      } catch (e) {
        // Backend coverage not available
      }

      // Try to read frontend coverage
      let frontendCoverage = null;
      try {
        const frontendCoverageFile = await fs.readFile(
          path.join(process.cwd(), 'frontend', 'coverage', 'coverage-final.json'),
          'utf8'
        );
        frontendCoverage = JSON.parse(frontendCoverageFile);
      } catch (e) {
        // Frontend coverage not available
      }

      // Aggregate coverage data
      return this.combineCoverageData(backendCoverage, frontendCoverage);
    } catch (error) {
      console.warn('Could not aggregate coverage data:', error.message);
      return null;
    }
  }

  combineCoverageData(backendCoverage, frontendCoverage) {
    // Combine coverage data from both backend and frontend
    const combined = {
      lines: { covered: 0, total: 0, pct: 0 },
      branches: { covered: 0, total: 0, pct: 0 },
      functions: { covered: 0, total: 0, pct: 0 },
      statements: { covered: 0, total: 0, pct: 0 }
    };

    let fileCount = 0;

    // Process backend coverage
    if (backendCoverage) {
      Object.values(backendCoverage).forEach(file => {
        if (file.lines && typeof file.lines.total === 'number') {
          combined.lines.total += file.lines.total;
          combined.lines.covered += file.lines.covered || 0;
        }
        if (file.branches && typeof file.branches.total === 'number') {
          combined.branches.total += file.branches.total;
          combined.branches.covered += file.branches.covered || 0;
        }
        if (file.functions && typeof file.functions.total === 'number') {
          combined.functions.total += file.functions.total;
          combined.functions.covered += file.functions.covered || 0;
        }
        if (file.statements && typeof file.statements.total === 'number') {
          combined.statements.total += file.statements.total;
          combined.statements.covered += file.statements.covered || 0;
        }
        fileCount++;
      });
    }

    // Process frontend coverage
    if (frontendCoverage) {
      Object.values(frontendCoverage).forEach(file => {
        if (file.lines && typeof file.lines.total === 'number') {
          combined.lines.total += file.lines.total;
          combined.lines.covered += file.lines.covered || 0;
        }
        if (file.branches && typeof file.branches.total === 'number') {
          combined.branches.total += file.branches.total;
          combined.branches.covered += file.branches.covered || 0;
        }
        if (file.functions && typeof file.functions.total === 'number') {
          combined.functions.total += file.functions.total;
          combined.functions.covered += file.functions.covered || 0;
        }
        if (file.statements && typeof file.statements.total === 'number') {
          combined.statements.total += file.statements.total;
          combined.statements.covered += file.statements.covered || 0;
        }
        fileCount++;
      });
    }

    // Calculate percentages
    if (combined.lines.total > 0) {
      combined.lines.pct = Math.round((combined.lines.covered / combined.lines.total) * 100 * 100) / 100;
    }
    if (combined.branches.total > 0) {
      combined.branches.pct = Math.round((combined.branches.covered / combined.branches.total) * 100 * 100) / 100;
    }
    if (combined.functions.total > 0) {
      combined.functions.pct = Math.round((combined.functions.covered / combined.functions.total) * 100 * 100) / 100;
    }
    if (combined.statements.total > 0) {
      combined.statements.pct = Math.round((combined.statements.covered / combined.statements.total) * 100 * 100) / 100;
    }

    return fileCount > 0 ? combined : null;
  }

  checkCoverageThresholds(coverage) {
    // Load thresholds from test-config.json or use defaults
    let thresholds;
    try {
      const configPath = path.join(process.cwd(), 'test-config.json');
      const config = require(configPath);
      thresholds = config.coverage?.thresholds || this.getDefaultThresholds();
    } catch (error) {
      thresholds = this.getDefaultThresholds();
    }

    // Check each metric against threshold
    const checks = {
      lines: coverage.lines >= thresholds.lines,
      branches: coverage.branches >= thresholds.branches,
      functions: coverage.functions >= thresholds.functions,
      statements: coverage.statements >= thresholds.statements
    };

    // All thresholds must be met
    return Object.values(checks).every(check => check);
  }

  getDefaultThresholds() {
    return {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80
    };
  }

  async generateJsonReport(summary, parsedResults) {
    const report = {
      summary,
      results: parsedResults,
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: 'sky-sensi-test-runner',
        version: '1.0.0'
      }
    };

    await fs.writeFile(
      path.join(this.reportsDir, 'test-results.json'),
      JSON.stringify(report, null, 2)
    );
  }

  async generateHtmlReport(summary, parsedResults) {
    const html = this.generateHtmlTemplate(summary, parsedResults);
    await fs.writeFile(
      path.join(this.reportsDir, 'index.html'),
      html
    );
  }

  generateHtmlTemplate(summary, parsedResults) {
    const statusColor = summary.totalFailed === 0 ? '#10b981' : '#ef4444';
    const coverageColor = summary.coverage && summary.coverage.lines >= 80 ? '#10b981' : '#f59e0b';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sky Sensi Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f9fafb; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .title { font-size: 28px; font-weight: bold; color: #111827; margin-bottom: 10px; }
        .subtitle { color: #6b7280; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-title { font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; margin-bottom: 10px; }
        .metric-value { font-size: 32px; font-weight: bold; color: #111827; }
        .status-passed { color: #10b981; }
        .status-failed { color: #ef4444; }
        .failures { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .failure-item { padding: 15px; margin: 10px 0; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 5px; }
        .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🛩️ Sky Sensi Test Report</h1>
            <p class="subtitle">Generated on ${new Date(parsedResults.timestamp).toLocaleString()}</p>
            <p class="subtitle">Duration: ${Math.round(parsedResults.duration)}ms</p>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <div class="metric-title">Total Tests</div>
                <div class="metric-value">${summary.totalTests}</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Passed</div>
                <div class="metric-value status-passed">${summary.totalPassed}</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Failed</div>
                <div class="metric-value status-failed">${summary.totalFailed}</div>
            </div>
            ${summary.coverage ? `
            <div class="metric-card">
                <div class="metric-title">Coverage</div>
                <div class="metric-value" style="color: ${coverageColor}">${summary.coverage.lines || 0}%</div>
            </div>
            ` : ''}
        </div>

        <div class="metrics">
            <div class="metric-card">
                <div class="metric-title">Backend</div>
                <div class="metric-value">${parsedResults.backend?.tests || 0} tests</div>
                <div style="margin-top: 10px;">
                    <span class="status-passed">${parsedResults.backend?.passed || 0} passed</span> • 
                    <span class="status-failed">${parsedResults.backend?.failed || 0} failed</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Frontend</div>
                <div class="metric-value">${parsedResults.frontend?.tests || 0} tests</div>
                <div style="margin-top: 10px;">
                    <span class="status-passed">${parsedResults.frontend?.passed || 0} passed</span> • 
                    <span class="status-failed">${parsedResults.frontend?.failed || 0} failed</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Integration</div>
                <div class="metric-value">${parsedResults.integration?.tests || 0} tests</div>
                <div style="margin-top: 10px;">
                    <span class="status-passed">${parsedResults.integration?.passed || 0} passed</span> • 
                    <span class="status-failed">${parsedResults.integration?.failed || 0} failed</span>
                </div>
            </div>
        </div>

        ${summary.totalFailed > 0 ? `
        <div class="failures">
            <h3 style="color: #ef4444; margin-top: 0;">❌ Test Failures</h3>
            ${summary.failures.map(failure => `
                <div class="failure-item">
                    <strong>${failure.suite}</strong>: ${failure.test || 'Unknown test'}
                    <div style="font-family: monospace; font-size: 12px; margin-top: 5px; color: #6b7280;">
                        ${failure.error}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
    </div>
</body>
</html>
    `.trim();
  }

  async generateConsoleReport(summary) {
    // Console report is handled by the test runner
  }

  async generateFailureReport(parsedResults) {
    const failureReport = {
      timestamp: new Date().toISOString(),
      failures: [
        ...(parsedResults.backend?.failures || []),
        ...(parsedResults.frontend?.failures || []),
        ...(parsedResults.integration?.failures || [])
      ],
      insights: this.generateFailureInsights(parsedResults)
    };

    await fs.writeFile(
      path.join(this.reportsDir, 'failures.json'),
      JSON.stringify(failureReport, null, 2)
    );
  }

  generateFailureInsights(parsedResults) {
    const insights = [];
    
    // Analyze failure patterns
    const failuresByType = {};
    const allFailures = [
      ...(parsedResults.backend?.failures || []),
      ...(parsedResults.frontend?.failures || []),
      ...(parsedResults.integration?.failures || [])
    ];

    allFailures.forEach(failure => {
      if (!failuresByType[failure.suite]) {
        failuresByType[failure.suite] = [];
      }
      failuresByType[failure.suite].push(failure);
    });

    // Generate insights based on failure patterns
    Object.keys(failuresByType).forEach(suite => {
      const failures = failuresByType[suite];
      insights.push({
        type: 'failure_concentration',
        suite,
        count: failures.length,
        message: `${suite} has ${failures.length} failing test(s). Consider reviewing ${suite} test setup or implementation.`
      });
    });

    return insights;
  }
}

module.exports = TestReporter;