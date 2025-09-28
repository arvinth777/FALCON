/**
 * Environment Validation System
 * Validates environment configurations, API keys, and service settings
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class EnvironmentValidator {
    constructor() {
        this.requiredEnvVars = new Map();
        this.optionalEnvVars = new Map();
        this.configFiles = new Map();
        this.initializeRequirements();
    }

    /**
     * Initialize environment requirements
     */
    initializeRequirements() {
        // Backend environment variables
        this.requiredEnvVars.set('backend', new Map([
            ['GEMINI_API_KEY', {
                description: 'Google Gemini AI API key',
                validator: (value) => value && value.length > 20 && value.startsWith('AI'),
                example: 'AIzaSy...',
                documentation: 'Get from Google AI Studio'
            }],
            ['PORT', {
                description: 'Backend server port',
                validator: (value) => !isNaN(value) && parseInt(value) > 0 && parseInt(value) < 65536,
                example: '3001',
                default: '3001'
            }]
        ]));

        // Frontend environment variables
        this.requiredEnvVars.set('frontend', new Map([
            ['VITE_OWM_KEY', {
                description: 'OpenWeatherMap API key',
                validator: (value) => value && value.length === 32 && /^[a-f0-9]+$/.test(value),
                example: 'abcd1234...',
                documentation: 'Get from OpenWeatherMap.org'
            }],
            ['VITE_BACKEND_URL', {
                description: 'Backend API URL',
                validator: (value) => value && (value.startsWith('http://') || value.startsWith('https://')),
                example: 'http://localhost:3001',
                default: 'http://localhost:3001'
            }]
        ]));

        // Optional environment variables
        this.optionalEnvVars.set('backend', new Map([
            ['NODE_ENV', {
                description: 'Node.js environment',
                validator: (value) => ['development', 'production', 'test'].includes(value),
                default: 'development'
            }],
            ['LOG_LEVEL', {
                description: 'Logging level',
                validator: (value) => ['debug', 'info', 'warn', 'error'].includes(value),
                default: 'info'
            }],
            ['CACHE_TTL', {
                description: 'Cache time-to-live in seconds',
                validator: (value) => !isNaN(value) && parseInt(value) > 0,
                default: '300'
            }]
        ]));

        // Configuration files
        this.configFiles.set('backend/.env', {
            required: true,
            example: 'backend/.env.example',
            description: 'Backend environment configuration'
        });

        this.configFiles.set('frontend/.env', {
            required: true,
            example: 'frontend/.env.example',
            description: 'Frontend environment configuration'
        });

        this.configFiles.set('backend/package.json', {
            required: true,
            description: 'Backend package configuration',
            validator: this.validatePackageJson
        });

        this.configFiles.set('frontend/package.json', {
            required: true,
            description: 'Frontend package configuration',
            validator: this.validatePackageJson
        });
    }

    /**
     * Validate all environment configurations
     */
    async validateEnvironments() {
        console.log('🔍 Validating environment configurations...');
        
        const validation = {
            timestamp: new Date().toISOString(),
            configFiles: {},
            environments: {},
            systemInfo: await this.getSystemInfo(),
            overall: { status: 'unknown', score: 0, issues: [] }
        };

        try {
            // Validate configuration files
            validation.configFiles = await this.validateConfigFiles();
            
            // Validate environment variables
            validation.environments.backend = await this.validateEnvironmentVariables('backend');
            validation.environments.frontend = await this.validateEnvironmentVariables('frontend');

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
     * Validate configuration files
     */
    async validateConfigFiles() {
        const results = {};

        for (const [filePath, config] of this.configFiles.entries()) {
            const fullPath = path.join(process.cwd(), filePath);
            
            try {
                await fs.access(fullPath);
                
                const fileStats = await fs.stat(fullPath);
                const content = await fs.readFile(fullPath, 'utf8');
                
                const fileValidation = {
                    exists: true,
                    size: fileStats.size,
                    lastModified: fileStats.mtime,
                    status: 'valid'
                };

                // Run custom validator if provided
                if (config.validator) {
                    const validationResult = await config.validator(content, filePath);
                    Object.assign(fileValidation, validationResult);
                }

                // Special validation for .env files
                if (filePath.endsWith('.env')) {
                    const envValidation = await this.validateEnvFile(content, filePath);
                    Object.assign(fileValidation, envValidation);
                }

                results[filePath] = fileValidation;
                
            } catch (error) {
                results[filePath] = {
                    exists: false,
                    status: 'missing',
                    error: error.message,
                    canCreate: config.example ? await this.checkExampleFile(config.example) : false
                };
            }
        }

        return results;
    }

    /**
     * Validate environment variables for a specific project
     */
    async validateEnvironmentVariables(project) {
        const envPath = path.join(process.cwd(), project, '.env');
        const envVars = {};
        
        // Load environment variables from .env file
        try {
            const envContent = await fs.readFile(envPath, 'utf8');
            const lines = envContent.split('\n');
            
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        envVars[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });
        } catch (error) {
            return {
                status: 'error',
                error: `Cannot read .env file: ${error.message}`,
                issues: ['Environment file not found or not readable']
            };
        }

        const validation = {
            file: envPath,
            required: {},
            optional: {},
            unknown: {},
            issues: []
        };

        // Validate required variables
        const requiredVars = this.requiredEnvVars.get(project) || new Map();
        for (const [varName, config] of requiredVars.entries()) {
            const value = envVars[varName];
            
            const varValidation = {
                configured: value !== undefined,
                value: value ? (varName.includes('KEY') || varName.includes('TOKEN') ? '[REDACTED]' : value) : undefined,
                valid: false,
                required: true
            };

            if (!value) {
                varValidation.status = 'missing';
                varValidation.suggestion = config.example || config.default;
                validation.issues.push(`Missing required variable: ${varName}`);
            } else if (config.validator) {
                varValidation.valid = config.validator(value);
                varValidation.status = varValidation.valid ? 'valid' : 'invalid';
                
                if (!varValidation.valid) {
                    validation.issues.push(`Invalid value for ${varName}`);
                    varValidation.suggestion = config.example;
                }
            } else {
                varValidation.valid = true;
                varValidation.status = 'valid';
            }

            validation.required[varName] = varValidation;
        }

        // Validate optional variables
        const optionalVars = this.optionalEnvVars.get(project) || new Map();
        for (const [varName, config] of optionalVars.entries()) {
            const value = envVars[varName];
            
            if (value) {
                const varValidation = {
                    configured: true,
                    value: value,
                    valid: config.validator ? config.validator(value) : true,
                    required: false,
                    status: 'configured'
                };
                
                if (config.validator && !varValidation.valid) {
                    varValidation.status = 'invalid';
                    validation.issues.push(`Invalid value for optional variable: ${varName}`);
                }
                
                validation.optional[varName] = varValidation;
            }
        }

        // Identify unknown variables
        const knownVars = new Set([...requiredVars.keys(), ...optionalVars.keys()]);
        for (const varName of Object.keys(envVars)) {
            if (!knownVars.has(varName)) {
                validation.unknown[varName] = {
                    value: varName.includes('KEY') || varName.includes('TOKEN') ? '[REDACTED]' : envVars[varName],
                    status: 'unknown'
                };
            }
        }

        // Calculate validation status
        const requiredCount = requiredVars.size;
        const validRequiredCount = Object.values(validation.required).filter(v => v.valid).length;
        
        if (validRequiredCount === requiredCount) {
            validation.status = 'valid';
        } else if (validRequiredCount > 0) {
            validation.status = 'partial';
        } else {
            validation.status = 'invalid';
        }

        return validation;
    }

    /**
     * Validate .env file content
     */
    async validateEnvFile(content, filePath) {
        const validation = {
            lineCount: 0,
            variableCount: 0,
            commentCount: 0,
            emptyLines: 0,
            issues: []
        };

        const lines = content.split('\n');
        validation.lineCount = lines.length;

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            if (!trimmed) {
                validation.emptyLines++;
            } else if (trimmed.startsWith('#')) {
                validation.commentCount++;
            } else if (trimmed.includes('=')) {
                validation.variableCount++;
                
                // Check for common issues
                if (trimmed.includes(' = ')) {
                    validation.issues.push(`Line ${index + 1}: Spaces around = are not recommended`);
                }
                
                if (trimmed.startsWith('=')) {
                    validation.issues.push(`Line ${index + 1}: Missing variable name`);
                }
            } else {
                validation.issues.push(`Line ${index + 1}: Invalid format - not a comment or variable assignment`);
            }
        });

        return validation;
    }

    /**
     * Check if example file exists
     */
    async checkExampleFile(examplePath) {
        try {
            await fs.access(path.join(process.cwd(), examplePath));
            return { exists: true, path: examplePath };
        } catch {
            return { exists: false, path: examplePath };
        }
    }

    /**
     * Validate package.json file
     */
    async validatePackageJson(content, filePath) {
        const validation = {
            validJson: false,
            hasName: false,
            hasVersion: false,
            hasScripts: false,
            hasDependencies: false,
            issues: []
        };

        try {
            const packageJson = JSON.parse(content);
            validation.validJson = true;

            // Check required fields
            if (packageJson.name) {
                validation.hasName = true;
            } else {
                validation.issues.push('Missing package name');
            }

            if (packageJson.version) {
                validation.hasVersion = true;
            } else {
                validation.issues.push('Missing package version');
            }

            if (packageJson.scripts && Object.keys(packageJson.scripts).length > 0) {
                validation.hasScripts = true;
                validation.scripts = Object.keys(packageJson.scripts);
            } else {
                validation.issues.push('No scripts defined');
            }

            if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {
                validation.hasDependencies = true;
                validation.dependencyCount = Object.keys(packageJson.dependencies).length;
            }

            if (packageJson.devDependencies) {
                validation.devDependencyCount = Object.keys(packageJson.devDependencies).length;
            }

            validation.status = validation.issues.length === 0 ? 'valid' : 'warning';

        } catch (error) {
            validation.validJson = false;
            validation.status = 'error';
            validation.error = `Invalid JSON: ${error.message}`;
        }

        return validation;
    }

    /**
     * Calculate overall validation score
     */
    calculateOverallScore(validation) {
        let score = 100;
        const issues = [];

        // Configuration files scoring
        for (const [filePath, fileValidation] of Object.entries(validation.configFiles)) {
            if (!fileValidation.exists) {
                score -= 20;
                issues.push(`Missing configuration file: ${filePath}`);
            } else if (fileValidation.status === 'error') {
                score -= 15;
                issues.push(`Configuration error in ${filePath}`);
            } else if (fileValidation.issues && fileValidation.issues.length > 0) {
                score -= 5;
                issues.push(`Configuration warnings in ${filePath}`);
            }
        }

        // Environment variables scoring
        for (const [project, envValidation] of Object.entries(validation.environments)) {
            if (envValidation.status === 'error') {
                score -= 25;
                issues.push(`${project}: Environment configuration error`);
            } else if (envValidation.status === 'invalid') {
                score -= 20;
                issues.push(`${project}: Invalid environment variables`);
            } else if (envValidation.status === 'partial') {
                score -= 10;
                issues.push(`${project}: Some environment variables missing or invalid`);
            }

            if (envValidation.issues) {
                envValidation.issues.forEach(issue => {
                    if (!issues.includes(`${project}: ${issue}`)) {
                        issues.push(`${project}: ${issue}`);
                    }
                });
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

        // Missing configuration files
        for (const [filePath, fileValidation] of Object.entries(validation.configFiles)) {
            if (!fileValidation.exists && fileValidation.canCreate) {
                recommendations.push({
                    priority: 'high',
                    category: 'configuration',
                    description: `Create missing configuration file: ${filePath}`,
                    action: `Copy from ${fileValidation.canCreate.path}`,
                    command: `cp ${fileValidation.canCreate.path} ${filePath}`
                });
            }
        }

        // Environment variable recommendations
        for (const [project, envValidation] of Object.entries(validation.environments)) {
            if (envValidation.required) {
                for (const [varName, varInfo] of Object.entries(envValidation.required)) {
                    if (varInfo.status === 'missing') {
                        recommendations.push({
                            priority: 'high',
                            category: 'environment',
                            description: `Configure missing environment variable: ${varName}`,
                            action: `Add ${varName} to ${project}/.env`,
                            example: varInfo.suggestion
                        });
                    } else if (varInfo.status === 'invalid') {
                        recommendations.push({
                            priority: 'medium',
                            category: 'environment',
                            description: `Fix invalid environment variable: ${varName}`,
                            action: `Update ${varName} in ${project}/.env`,
                            example: varInfo.suggestion
                        });
                    }
                }
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
            cwd: process.cwd(),
            environment: process.env.NODE_ENV || 'development',
            user: process.env.USER || process.env.USERNAME || 'unknown'
        };
    }

    /**
     * Create missing environment files
     */
    async createMissingEnvFiles() {
        const results = [];

        for (const [filePath, config] of this.configFiles.entries()) {
            if (filePath.endsWith('.env')) {
                try {
                    const fullPath = path.join(process.cwd(), filePath);
                    await fs.access(fullPath);
                    results.push({
                        file: filePath,
                        status: 'exists',
                        action: 'none'
                    });
                } catch {
                    // File doesn't exist, try to create from example
                    if (config.example) {
                        try {
                            const examplePath = path.join(process.cwd(), config.example);
                            const fullPath = path.join(process.cwd(), filePath);
                            
                            const exampleContent = await fs.readFile(examplePath, 'utf8');
                            await fs.writeFile(fullPath, exampleContent);
                            
                            results.push({
                                file: filePath,
                                status: 'created',
                                action: 'copied from example',
                                source: config.example
                            });
                        } catch (error) {
                            results.push({
                                file: filePath,
                                status: 'error',
                                error: error.message
                            });
                        }
                    } else {
                        results.push({
                            file: filePath,
                            status: 'missing',
                            error: 'No example file available'
                        });
                    }
                }
            }
        }

        return results;
    }

    /**
     * Generate environment validation report
     */
    async generateReport(validation) {
        return {
            title: 'Sky Sensi - Environment Validation Report',
            timestamp: validation.timestamp,
            summary: {
                overallStatus: validation.overall.status,
                score: validation.overall.score,
                totalIssues: validation.overall.issues.length,
                recommendations: validation.overall.recommendations.length
            },
            configFiles: validation.configFiles,
            environments: validation.environments,
            systemInfo: validation.systemInfo,
            actionItems: validation.overall.recommendations.filter(r => r.priority === 'high')
        };
    }

    /**
     * Validate API keys
     */
    async validateApiKeys() {
        const results = {};

        // Validate Gemini API key
        try {
            const backendEnvPath = path.join(process.cwd(), 'backend', '.env');
            const envContent = await fs.readFile(backendEnvPath, 'utf8');
            const geminiMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
            
            if (geminiMatch) {
                const apiKey = geminiMatch[1].trim();
                results.gemini = {
                    configured: true,
                    format: apiKey.startsWith('AI') && apiKey.length > 20 ? 'valid' : 'invalid',
                    redacted: apiKey.substring(0, 8) + '...'
                };
            } else {
                results.gemini = { configured: false };
            }
        } catch (error) {
            results.gemini = { configured: false, error: error.message };
        }

        // Validate OpenWeatherMap API key
        try {
            const frontendEnvPath = path.join(process.cwd(), 'frontend', '.env');
            const envContent = await fs.readFile(frontendEnvPath, 'utf8');
            const owmMatch = envContent.match(/VITE_OWM_KEY=(.+)/);
            
            if (owmMatch) {
                const apiKey = owmMatch[1].trim();
                results.openweathermap = {
                    configured: true,
                    format: /^[a-f0-9]{32}$/.test(apiKey) ? 'valid' : 'invalid',
                    redacted: apiKey.substring(0, 8) + '...'
                };
            } else {
                results.openweathermap = { configured: false };
            }
        } catch (error) {
            results.openweathermap = { configured: false, error: error.message };
        }

        return results;
    }
}

module.exports = EnvironmentValidator;