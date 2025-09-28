/**
 * Dependency Validation System
 * Validates project dependencies, versions, and configuration integrity
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

class DependencyValidator {
    constructor() {
        this.validationRules = new Map();
        this.securityRules = new Map();
        this.initializeValidationRules();
        this.initializeSecurityRules();
    }

    /**
     * Initialize dependency validation rules
     */
    initializeValidationRules() {
        // Node.js version requirements
        this.validationRules.set('node-version', {
            type: 'runtime',
            required: '>=16.0.0',
            recommended: '>=18.0.0',
            check: () => process.version
        });

        // NPM version requirements
        this.validationRules.set('npm-version', {
            type: 'tool',
            required: '>=8.0.0',
            recommended: '>=9.0.0',
            check: () => {
                try {
                    return execSync('npm --version', { encoding: 'utf8' }).trim();
                } catch {
                    return null;
                }
            }
        });

        // Critical backend dependencies
        this.validationRules.set('express', {
            type: 'dependency',
            project: 'backend',
            required: '>=4.18.0',
            security: 'critical'
        });

        this.validationRules.set('cors', {
            type: 'dependency',
            project: 'backend',
            required: '>=2.8.5',
            security: 'important'
        });

        // Critical frontend dependencies
        this.validationRules.set('react', {
            type: 'dependency',
            project: 'frontend',
            required: '>=18.0.0',
            security: 'critical'
        });

        this.validationRules.set('vite', {
            type: 'devDependency',
            project: 'frontend',
            required: '>=4.0.0',
            security: 'important'
        });

        // Development tools
        this.validationRules.set('nodemon', {
            type: 'devDependency',
            project: 'backend',
            required: '>=2.0.0',
            optional: true
        });

        this.validationRules.set('vitest', {
            type: 'devDependency',
            project: 'frontend',
            required: '>=0.30.0',
            optional: true
        });
    }

    /**
     * Initialize security validation rules
     */
    initializeSecurityRules() {
        this.securityRules.set('known-vulnerabilities', {
            description: 'Check for known security vulnerabilities',
            command: 'npm audit --audit-level=high',
            severity: 'critical'
        });

        this.securityRules.set('outdated-packages', {
            description: 'Check for severely outdated packages',
            command: 'npm outdated',
            severity: 'warning',
            threshold: 365 // days
        });

        this.securityRules.set('unused-dependencies', {
            description: 'Identify unused dependencies',
            severity: 'info',
            manual: true
        });
    }

    /**
     * Perform comprehensive dependency validation
     */
    async validateDependencies() {
        console.log('🔍 Validating project dependencies...');
        
        const validation = {
            timestamp: new Date().toISOString(),
            runtime: {},
            projects: {},
            security: {},
            overall: { status: 'unknown', score: 0, issues: [] }
        };

        try {
            // Validate runtime environment
            validation.runtime = await this.validateRuntime();
            
            // Validate each project's dependencies
            const projects = ['root', 'backend', 'frontend'];
            for (const project of projects) {
                validation.projects[project] = await this.validateProject(project);
            }

            // Perform security checks
            validation.security = await this.performSecurityChecks();

            // Calculate overall validation score
            validation.overall = this.calculateOverallScore(validation);

        } catch (error) {
            validation.overall = {
                status: 'error',
                score: 0,
                error: error.message,
                issues: [`Validation failed: ${error.message}`]
            };
        }

        return validation;
    }

    /**
     * Validate runtime environment (Node.js, npm, etc.)
     */
    async validateRuntime() {
        const runtime = {
            node: { status: 'unknown' },
            npm: { status: 'unknown' },
            system: await this.getSystemInfo()
        };

        // Check Node.js version
        try {
            const nodeVersion = process.version;
            const nodeRule = this.validationRules.get('node-version');
            
            runtime.node = {
                current: nodeVersion,
                required: nodeRule.required,
                recommended: nodeRule.recommended,
                status: this.checkVersionRequirement(nodeVersion, nodeRule.required),
                isRecommended: this.checkVersionRequirement(nodeVersion, nodeRule.recommended)
            };
        } catch (error) {
            runtime.node = { status: 'error', error: error.message };
        }

        // Check npm version
        try {
            const npmVersion = this.validationRules.get('npm-version').check();
            const npmRule = this.validationRules.get('npm-version');
            
            if (npmVersion) {
                runtime.npm = {
                    current: npmVersion,
                    required: npmRule.required,
                    recommended: npmRule.recommended,
                    status: this.checkVersionRequirement(npmVersion, npmRule.required),
                    isRecommended: this.checkVersionRequirement(npmVersion, npmRule.recommended)
                };
            } else {
                runtime.npm = { status: 'missing', error: 'npm not found' };
            }
        } catch (error) {
            runtime.npm = { status: 'error', error: error.message };
        }

        return runtime;
    }

    /**
     * Validate a specific project's dependencies
     */
    async validateProject(project) {
        const projectPath = project === 'root' ? '.' : project;
        const packageJsonPath = path.join(process.cwd(), projectPath, 'package.json');
        
        const projectValidation = {
            path: projectPath,
            packageJson: { exists: false },
            nodeModules: { exists: false },
            dependencies: {},
            devDependencies: {},
            issues: [],
            status: 'unknown'
        };

        try {
            // Check if package.json exists
            await fs.access(packageJsonPath);
            projectValidation.packageJson.exists = true;

            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            projectValidation.packageJson.data = packageJson;

            // Check if node_modules exists
            const nodeModulesPath = path.join(process.cwd(), projectPath, 'node_modules');
            try {
                await fs.access(nodeModulesPath);
                projectValidation.nodeModules.exists = true;
                
                // Count installed packages
                const installed = await fs.readdir(nodeModulesPath);
                projectValidation.nodeModules.count = installed.filter(item => !item.startsWith('.')).length;
            } catch {
                projectValidation.nodeModules.exists = false;
                projectValidation.issues.push('node_modules directory not found');
            }

            // Validate dependencies
            if (packageJson.dependencies) {
                projectValidation.dependencies = await this.validatePackageGroup(
                    packageJson.dependencies, 'dependency', project, projectPath
                );
            }

            // Validate devDependencies
            if (packageJson.devDependencies) {
                projectValidation.devDependencies = await this.validatePackageGroup(
                    packageJson.devDependencies, 'devDependency', project, projectPath
                );
            }

            // Determine overall project status
            const allDeps = { ...projectValidation.dependencies, ...projectValidation.devDependencies };
            const hasErrors = Object.values(allDeps).some(dep => dep.status === 'error' || dep.status === 'incompatible');
            const hasWarnings = Object.values(allDeps).some(dep => dep.status === 'outdated' || dep.status === 'vulnerable');
            
            if (hasErrors) {
                projectValidation.status = 'error';
            } else if (hasWarnings) {
                projectValidation.status = 'warning';
            } else {
                projectValidation.status = 'valid';
            }

        } catch (error) {
            projectValidation.status = 'error';
            projectValidation.error = error.message;
            
            if (error.code === 'ENOENT') {
                projectValidation.issues.push('package.json not found');
            } else {
                projectValidation.issues.push(`Error reading package.json: ${error.message}`);
            }
        }

        return projectValidation;
    }

    /**
     * Validate a group of packages (dependencies or devDependencies)
     */
    async validatePackageGroup(packages, type, project, projectPath) {
        const validation = {};

        for (const [packageName, specifiedVersion] of Object.entries(packages)) {
            const packageValidation = {
                specified: specifiedVersion,
                status: 'unknown'
            };

            try {
                // Get installed version
                const installedVersion = await this.getInstalledVersion(packageName, projectPath);
                packageValidation.installed = installedVersion;

                if (!installedVersion) {
                    packageValidation.status = 'missing';
                    packageValidation.issue = 'Package not installed';
                } else {
                    // Check if installed version satisfies specified version
                    if (semver.satisfies(installedVersion, specifiedVersion)) {
                        packageValidation.status = 'valid';
                    } else {
                        packageValidation.status = 'incompatible';
                        packageValidation.issue = `Installed ${installedVersion} doesn't satisfy ${specifiedVersion}`;
                    }

                    // Check validation rules for this package
                    const rule = this.validationRules.get(packageName);
                    if (rule && rule.project === project && rule.type === type) {
                        const ruleCheck = this.checkVersionRequirement(installedVersion, rule.required);
                        if (!ruleCheck) {
                            packageValidation.status = 'incompatible';
                            packageValidation.issue = `Version ${installedVersion} doesn't meet requirement ${rule.required}`;
                            packageValidation.security = rule.security;
                        }
                    }

                    // Check if package is outdated
                    packageValidation.outdated = await this.checkIfOutdated(packageName, installedVersion);
                }

            } catch (error) {
                packageValidation.status = 'error';
                packageValidation.error = error.message;
            }

            validation[packageName] = packageValidation;
        }

        return validation;
    }

    /**
     * Get installed version of a package
     */
    async getInstalledVersion(packageName, projectPath) {
        try {
            const packageJsonPath = path.join(process.cwd(), projectPath, 'node_modules', packageName, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            return packageJson.version;
        } catch {
            return null;
        }
    }

    /**
     * Check if a version meets requirements
     */
    checkVersionRequirement(current, required) {
        try {
            return semver.satisfies(current.replace(/^v/, ''), required);
        } catch {
            return false;
        }
    }

    /**
     * Check if a package is outdated
     */
    async checkIfOutdated(packageName, currentVersion) {
        try {
            // This would require npm registry API call in a real implementation
            // For now, we'll do a simple age-based check
            return {
                status: 'current', // Would be 'outdated', 'major-update', etc.
                latest: currentVersion // Would be actual latest version
            };
        } catch {
            return { status: 'unknown' };
        }
    }

    /**
     * Perform security checks
     */
    async performSecurityChecks() {
        const security = {
            audit: { status: 'unknown' },
            vulnerabilities: [],
            advisories: []
        };

        // Run npm audit for each project
        const projects = ['root', 'backend', 'frontend'];
        
        for (const project of projects) {
            try {
                const projectPath = project === 'root' ? '.' : project;
                const auditResult = await this.runSecurityAudit(projectPath);
                security[project] = auditResult;
            } catch (error) {
                security[project] = {
                    status: 'error',
                    error: error.message
                };
            }
        }

        return security;
    }

    /**
     * Run security audit for a project
     */
    async runSecurityAudit(projectPath) {
        try {
            const command = 'npm audit --json';
            const result = execSync(command, {
                cwd: path.join(process.cwd(), projectPath),
                encoding: 'utf8',
                timeout: 30000
            });

            const audit = JSON.parse(result);
            
            return {
                status: audit.metadata.vulnerabilities.total > 0 ? 'vulnerabilities' : 'clean',
                vulnerabilities: audit.metadata.vulnerabilities,
                advisories: Object.keys(audit.advisories || {}).length
            };
            
        } catch (error) {
            // npm audit returns non-zero exit code when vulnerabilities found
            if (error.stdout) {
                try {
                    const audit = JSON.parse(error.stdout);
                    return {
                        status: 'vulnerabilities',
                        vulnerabilities: audit.metadata.vulnerabilities,
                        advisories: Object.keys(audit.advisories || {}).length
                    };
                } catch {
                    return {
                        status: 'error',
                        error: 'Failed to parse audit result'
                    };
                }
            }
            
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Calculate overall validation score
     */
    calculateOverallScore(validation) {
        let score = 100;
        const issues = [];

        // Runtime environment scoring
        if (validation.runtime.node.status === 'error') {
            score -= 30;
            issues.push('Node.js version check failed');
        } else if (!validation.runtime.node.status) {
            score -= 20;
            issues.push(`Node.js version ${validation.runtime.node.current} doesn't meet requirements`);
        }

        if (validation.runtime.npm.status === 'error' || validation.runtime.npm.status === 'missing') {
            score -= 15;
            issues.push('npm not available or version check failed');
        }

        // Project dependency scoring
        for (const [project, projectValidation] of Object.entries(validation.projects)) {
            if (projectValidation.status === 'error') {
                score -= 25;
                issues.push(`${project}: Critical dependency issues`);
            } else if (projectValidation.status === 'warning') {
                score -= 10;
                issues.push(`${project}: Dependency warnings`);
            }

            if (!projectValidation.nodeModules.exists) {
                score -= 20;
                issues.push(`${project}: Dependencies not installed`);
            }
        }

        // Security scoring
        for (const [project, securityResult] of Object.entries(validation.security)) {
            if (typeof securityResult === 'object' && securityResult.status === 'vulnerabilities') {
                const vulns = securityResult.vulnerabilities;
                if (vulns.critical > 0) {
                    score -= 30;
                    issues.push(`${project}: ${vulns.critical} critical vulnerabilities`);
                }
                if (vulns.high > 0) {
                    score -= 15;
                    issues.push(`${project}: ${vulns.high} high severity vulnerabilities`);
                }
                if (vulns.moderate > 0) {
                    score -= 5;
                    issues.push(`${project}: ${vulns.moderate} moderate vulnerabilities`);
                }
            }
        }

        // Determine overall status
        let status = 'healthy';
        if (score < 50) {
            status = 'critical';
        } else if (score < 70) {
            status = 'warning';
        } else if (score < 90) {
            status = 'caution';
        }

        return {
            status,
            score: Math.max(0, score),
            issues,
            recommendations: this.generateRecommendations(validation, issues)
        };
    }

    /**
     * Generate recommendations based on validation results
     */
    generateRecommendations(validation, issues) {
        const recommendations = [];

        // Runtime recommendations
        if (validation.runtime.node.status !== true) {
            recommendations.push({
                priority: 'high',
                category: 'runtime',
                description: 'Update Node.js to a supported version',
                action: `Install Node.js ${validation.runtime.node.recommended} or later`
            });
        }

        // Dependency recommendations
        for (const [project, projectValidation] of Object.entries(validation.projects)) {
            if (!projectValidation.nodeModules.exists) {
                recommendations.push({
                    priority: 'high',
                    category: 'dependencies',
                    description: `Install ${project} dependencies`,
                    action: project === 'root' ? 'npm install' : `cd ${project} && npm install`
                });
            }

            // Check for critical package issues
            const allDeps = { ...projectValidation.dependencies, ...projectValidation.devDependencies };
            for (const [packageName, packageInfo] of Object.entries(allDeps)) {
                if (packageInfo.status === 'missing') {
                    recommendations.push({
                        priority: 'medium',
                        category: 'dependencies',
                        description: `Install missing package: ${packageName}`,
                        action: `cd ${project === 'root' ? '.' : project} && npm install ${packageName}`
                    });
                }
            }
        }

        // Security recommendations
        for (const [project, securityResult] of Object.entries(validation.security)) {
            if (typeof securityResult === 'object' && securityResult.status === 'vulnerabilities') {
                recommendations.push({
                    priority: 'high',
                    category: 'security',
                    description: `Fix security vulnerabilities in ${project}`,
                    action: `cd ${project === 'root' ? '.' : project} && npm audit fix`
                });
            }
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    /**
     * Get system information
     */
    async getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            npmVersion: (() => {
                try {
                    return execSync('npm --version', { encoding: 'utf8' }).trim();
                } catch {
                    return 'unknown';
                }
            })(),
            cwd: process.cwd(),
            environment: process.env.NODE_ENV || 'development'
        };
    }

    /**
     * Generate dependency report
     */
    async generateReport(validation) {
        const report = {
            title: 'Sky Sensi - Dependency Validation Report',
            timestamp: validation.timestamp,
            summary: {
                overallStatus: validation.overall.status,
                score: validation.overall.score,
                totalIssues: validation.overall.issues.length,
                recommendations: validation.overall.recommendations.length
            },
            details: validation,
            actionItems: validation.overall.recommendations.filter(r => r.priority === 'high')
        };

        return report;
    }

    /**
     * Fix common dependency issues automatically
     */
    async autoFixIssues(validation, options = {}) {
        const fixes = [];
        const dryRun = options.dryRun || false;

        console.log(dryRun ? '🔍 Analyzing potential fixes...' : '🔧 Attempting automated fixes...');

        // Fix missing node_modules
        for (const [project, projectValidation] of Object.entries(validation.projects)) {
            if (!projectValidation.nodeModules.exists && projectValidation.packageJson.exists) {
                const command = `cd ${project === 'root' ? '.' : project} && npm install`;
                
                if (dryRun) {
                    fixes.push({
                        project,
                        issue: 'Missing node_modules',
                        action: 'npm install',
                        command,
                        status: 'planned'
                    });
                } else {
                    try {
                        execSync(command, { encoding: 'utf8', timeout: 120000 });
                        fixes.push({
                            project,
                            issue: 'Missing node_modules',
                            action: 'npm install',
                            status: 'success'
                        });
                    } catch (error) {
                        fixes.push({
                            project,
                            issue: 'Missing node_modules',
                            action: 'npm install',
                            status: 'error',
                            error: error.message
                        });
                    }
                }
            }
        }

        return {
            attempted: fixes.length,
            successful: fixes.filter(f => f.status === 'success').length,
            failed: fixes.filter(f => f.status === 'error').length,
            fixes
        };
    }
}

module.exports = DependencyValidator;