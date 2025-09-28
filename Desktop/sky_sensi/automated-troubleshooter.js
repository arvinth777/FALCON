/**
 * Automated Troubleshooting System
 * Analyzes health check failures and provides automated repair suggestions
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class AutomatedTroubleshooter {
    constructor() {
        this.repairPatterns = new Map();
        this.commonIssues = new Map();
        this.initializeRepairPatterns();
        this.initializeCommonIssues();
    }

    /**
     * Initialize repair patterns for different failure types
     */
    initializeRepairPatterns() {
        this.repairPatterns.set('ECONNREFUSED', {
            description: 'Service connection refused',
            suggestions: [
                { action: 'check-process', description: 'Verify the service is running' },
                { action: 'restart-service', description: 'Restart the service' },
                { action: 'check-port', description: 'Verify port is not blocked by firewall' }
            ]
        });

        this.repairPatterns.set('ENOTFOUND', {
            description: 'Network connectivity issue',
            suggestions: [
                { action: 'check-internet', description: 'Verify internet connection' },
                { action: 'check-dns', description: 'Check DNS resolution' },
                { action: 'check-proxy', description: 'Verify proxy settings if applicable' }
            ]
        });

        this.repairPatterns.set('MODULE_NOT_FOUND', {
            description: 'Missing dependency',
            suggestions: [
                { action: 'install-deps', description: 'Install missing dependencies' },
                { action: 'check-node-modules', description: 'Verify node_modules directory' },
                { action: 'clear-cache', description: 'Clear npm cache and reinstall' }
            ]
        });

        this.repairPatterns.set('INVALID_API_KEY', {
            description: 'API authentication issue',
            suggestions: [
                { action: 'check-env-vars', description: 'Verify environment variables' },
                { action: 'validate-api-key', description: 'Check API key format and validity' },
                { action: 'regenerate-key', description: 'Generate new API key if needed' }
            ]
        });
    }

    /**
     * Initialize common issue patterns
     */
    initializeCommonIssues() {
        this.commonIssues.set('backend-not-running', {
            symptoms: ['ECONNREFUSED', 'port 3001', 'backend'],
            solutions: [
                { 
                    command: 'cd backend && npm run dev',
                    description: 'Start the backend development server',
                    safety: 'safe'
                },
                {
                    command: 'cd backend && npm install',
                    description: 'Install backend dependencies first if needed',
                    safety: 'safe'
                }
            ]
        });

        this.commonIssues.set('frontend-not-running', {
            symptoms: ['ECONNREFUSED', 'port 3000', 'frontend'],
            solutions: [
                {
                    command: 'cd frontend && npm run dev',
                    description: 'Start the frontend development server',
                    safety: 'safe'
                },
                {
                    command: 'cd frontend && npm install',
                    description: 'Install frontend dependencies first if needed',
                    safety: 'safe'
                }
            ]
        });

        this.commonIssues.set('missing-env-vars', {
            symptoms: ['GEMINI_API_KEY not configured', 'VITE_OWM_KEY not configured'],
            solutions: [
                {
                    description: 'Copy environment file templates',
                    command: 'cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env',
                    safety: 'safe'
                },
                {
                    description: 'Edit .env files to add your API keys',
                    manual: true,
                    safety: 'manual'
                }
            ]
        });

        this.commonIssues.set('dependencies-not-installed', {
            symptoms: ['MODULE_NOT_FOUND', 'node_modules', 'Cannot resolve'],
            solutions: [
                {
                    command: 'npm install',
                    description: 'Install root dependencies',
                    safety: 'safe'
                },
                {
                    command: 'cd backend && npm install',
                    description: 'Install backend dependencies',
                    safety: 'safe'
                },
                {
                    command: 'cd frontend && npm install',
                    description: 'Install frontend dependencies',
                    safety: 'safe'
                }
            ]
        });
    }

    /**
     * Analyze issues and generate repair suggestions
     */
    async analyzeIssues(context) {
        const { errors, warnings, serviceStates } = context;
        const allIssues = [...errors, ...warnings];
        
        const analysis = {
            issues: allIssues,
            patterns: [],
            suggestions: [],
            autoRepairOptions: [],
            manualSteps: []
        };

        // Analyze each issue for patterns
        for (const issue of allIssues) {
            const patterns = this.identifyPatterns(issue);
            analysis.patterns.push(...patterns);
        }

        // Analyze service states for specific issues
        if (serviceStates) {
            for (const [service, state] of Object.entries(serviceStates)) {
                if (state.status !== 'healthy') {
                    const servicePatterns = this.analyzeServiceFailure(service, state);
                    analysis.patterns.push(...servicePatterns);
                }
            }
        }

        // Generate suggestions based on identified patterns
        analysis.suggestions = await this.generateSuggestions(analysis.patterns);
        
        // Separate automated vs manual repairs
        analysis.autoRepairOptions = analysis.suggestions.filter(s => s.automated);
        analysis.manualSteps = analysis.suggestions.filter(s => !s.automated);

        return analysis;
    }

    /**
     * Identify patterns in error messages
     */
    identifyPatterns(issue) {
        const patterns = [];
        
        // Check for known error patterns
        for (const [patternKey, patternData] of this.repairPatterns.entries()) {
            if (issue.includes(patternKey) || issue.toLowerCase().includes(patternKey.toLowerCase())) {
                patterns.push({
                    type: patternKey,
                    confidence: 'high',
                    issue: issue,
                    ...patternData
                });
            }
        }

        // Check for common issue patterns
        for (const [issueKey, issueData] of this.commonIssues.entries()) {
            const matchingSymptoms = issueData.symptoms.filter(symptom => 
                issue.toLowerCase().includes(symptom.toLowerCase())
            );
            
            if (matchingSymptoms.length > 0) {
                patterns.push({
                    type: issueKey,
                    confidence: matchingSymptoms.length > 1 ? 'high' : 'medium',
                    issue: issue,
                    matchedSymptoms: matchingSymptoms,
                    solutions: issueData.solutions
                });
            }
        }

        return patterns;
    }

    /**
     * Analyze specific service failure
     */
    analyzeServiceFailure(service, state) {
        const patterns = [];
        
        // Service-specific analysis
        switch (service) {
            case 'backend':
                if (state.message && state.message.includes('ECONNREFUSED')) {
                    patterns.push({
                        type: 'backend-not-running',
                        confidence: 'high',
                        service,
                        issue: state.message,
                        solutions: this.commonIssues.get('backend-not-running').solutions
                    });
                }
                break;
                
            case 'frontend':
                if (state.message && state.message.includes('not running')) {
                    patterns.push({
                        type: 'frontend-not-running',
                        confidence: 'high',
                        service,
                        issue: state.message,
                        solutions: this.commonIssues.get('frontend-not-running').solutions
                    });
                }
                break;
                
            case 'gemini':
                if (state.message && state.message.includes('not configured')) {
                    patterns.push({
                        type: 'missing-api-key',
                        confidence: 'high',
                        service,
                        issue: state.message,
                        solutions: [{
                            description: 'Configure GEMINI_API_KEY in backend/.env',
                            manual: true,
                            safety: 'manual'
                        }]
                    });
                }
                break;
                
            case 'openweathermap':
                if (state.message && state.message.includes('not configured')) {
                    patterns.push({
                        type: 'missing-api-key',
                        confidence: 'high',
                        service,
                        issue: state.message,
                        solutions: [{
                            description: 'Configure VITE_OWM_KEY in frontend/.env',
                            manual: true,
                            safety: 'manual'
                        }]
                    });
                }
                break;
        }
        
        return patterns;
    }

    /**
     * Generate repair suggestions based on patterns
     */
    async generateSuggestions(patterns) {
        const suggestions = [];
        const seenSuggestions = new Set();
        
        for (const pattern of patterns) {
            if (pattern.solutions) {
                for (const solution of pattern.solutions) {
                    const suggestionKey = `${solution.command || solution.description}`;
                    
                    if (!seenSuggestions.has(suggestionKey)) {
                        seenSuggestions.add(suggestionKey);
                        
                        suggestions.push({
                            description: solution.description,
                            command: solution.command,
                            automated: solution.safety === 'safe' && solution.command && !solution.manual,
                            confidence: pattern.confidence,
                            type: pattern.type,
                            safety: solution.safety || 'manual'
                        });
                    }
                }
            }
        }
        
        // Sort suggestions by confidence and safety
        return suggestions.sort((a, b) => {
            if (a.confidence !== b.confidence) {
                return a.confidence === 'high' ? -1 : 1;
            }
            return a.automated ? -1 : 1;
        });
    }

    /**
     * Execute automated repairs (safe operations only)
     */
    async executeAutomatedRepairs(suggestions, options = {}) {
        const results = [];
        const safeRepairs = suggestions.filter(s => s.automated && s.safety === 'safe');
        
        if (safeRepairs.length === 0) {
            return { executed: 0, results: [], message: 'No safe automated repairs available' };
        }

        console.log(`🔧 Executing ${safeRepairs.length} automated repairs...`);
        
        for (const repair of safeRepairs) {
            try {
                console.log(`  → ${repair.description}`);
                
                if (options.dryRun) {
                    results.push({
                        repair: repair.description,
                        command: repair.command,
                        status: 'dry-run',
                        message: 'Would execute (dry run mode)'
                    });
                } else {
                    const output = execSync(repair.command, { 
                        encoding: 'utf8',
                        timeout: 30000,
                        cwd: process.cwd()
                    });
                    
                    results.push({
                        repair: repair.description,
                        command: repair.command,
                        status: 'success',
                        output: output.trim()
                    });
                    
                    console.log(`    ✅ Success`);
                }
                
            } catch (error) {
                results.push({
                    repair: repair.description,
                    command: repair.command,
                    status: 'error',
                    error: error.message
                });
                
                console.log(`    ❌ Failed: ${error.message}`);
            }
        }
        
        return {
            executed: safeRepairs.length,
            successful: results.filter(r => r.status === 'success').length,
            failed: results.filter(r => r.status === 'error').length,
            results
        };
    }

    /**
     * Generate diagnostic report
     */
    async generateDiagnosticReport(analysisResult) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalIssues: analysisResult.issues.length,
                patternsIdentified: analysisResult.patterns.length,
                automatedSolutions: analysisResult.autoRepairOptions.length,
                manualSteps: analysisResult.manualSteps.length
            },
            issues: analysisResult.issues,
            patterns: analysisResult.patterns,
            recommendations: {
                immediate: this.getImmediateActions(analysisResult),
                automated: analysisResult.autoRepairOptions,
                manual: analysisResult.manualSteps
            },
            systemInfo: await this.gatherSystemInfo()
        };
        
        return report;
    }

    /**
     * Get immediate actions to resolve critical issues
     */
    getImmediateActions(analysisResult) {
        const immediate = [];
        
        // Prioritize high-confidence automated repairs
        const criticalRepairs = analysisResult.autoRepairOptions.filter(
            option => option.confidence === 'high'
        );
        
        if (criticalRepairs.length > 0) {
            immediate.push({
                action: 'run-automated-repairs',
                description: `Execute ${criticalRepairs.length} automated repairs`,
                command: 'npm run troubleshoot -- --execute'
            });
        }
        
        // Check for missing dependencies
        const depIssues = analysisResult.patterns.filter(p => 
            p.type === 'dependencies-not-installed' || p.type === 'MODULE_NOT_FOUND'
        );
        
        if (depIssues.length > 0) {
            immediate.push({
                action: 'install-dependencies',
                description: 'Install missing dependencies',
                command: 'npm run bootstrap'
            });
        }
        
        return immediate;
    }

    /**
     * Gather system information for diagnostics
     */
    async gatherSystemInfo() {
        const info = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cwd: process.cwd()
        };
        
        try {
            info.npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        } catch (error) {
            info.npmVersion = 'unknown';
        }
        
        try {
            // Check if git is available
            info.gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
        } catch (error) {
            info.gitVersion = 'not available';
        }
        
        // Check disk space in current directory
        try {
            if (process.platform !== 'win32') {
                const df = execSync('df -h .', { encoding: 'utf8' });
                info.diskSpace = df.split('\n')[1]; // Skip header
            }
        } catch (error) {
            info.diskSpace = 'unknown';
        }
        
        return info;
    }

    /**
     * Clear TTL cache (safe automated repair)
     */
    async clearTTLCache() {
        try {
            const cachePath = path.join(process.cwd(), 'backend', 'cache-data');
            
            try {
                await fs.access(cachePath);
                const files = await fs.readdir(cachePath);
                
                for (const file of files) {
                    await fs.unlink(path.join(cachePath, file));
                }
                
                return { success: true, message: `Cleared ${files.length} cache files` };
            } catch (error) {
                return { success: true, message: 'Cache directory not found or already empty' };
            }
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check and create environment files
     */
    async checkEnvironmentFiles() {
        const results = [];
        
        const envFiles = [
            { example: 'backend/.env.example', target: 'backend/.env' },
            { example: 'frontend/.env.example', target: 'frontend/.env' }
        ];
        
        for (const env of envFiles) {
            try {
                await fs.access(env.target);
                results.push({ file: env.target, status: 'exists' });
            } catch {
                try {
                    await fs.access(env.example);
                    await fs.copyFile(env.example, env.target);
                    results.push({ file: env.target, status: 'created', source: env.example });
                } catch (error) {
                    results.push({ file: env.target, status: 'error', error: error.message });
                }
            }
        }
        
        return results;
    }
}

module.exports = AutomatedTroubleshooter;