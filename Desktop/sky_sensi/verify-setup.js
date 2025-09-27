#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');

/**
 * Sky Sensi Development Environment Verification Script
 * 
 * This script verifies that the development environment is properly configured
 * for the Sky Sensi aviation weather briefing system.
 */

class EnvironmentVerifier {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.success = [];
        this.requiredNodeVersion = '18.0.0';
        this.requiredPorts = [3000, 3001];
        this.backendEnvPath = path.join(__dirname, 'backend', '.env');
        this.frontendEnvPath = path.join(__dirname, 'frontend', '.env');
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
     * Run all verification checks
     */
    async verify() {
        this.log('🔍 Sky Sensi Environment Verification Starting...', 'info');
        console.log('');

        // Check Node.js and npm
        this.checkNodeVersion();
        this.checkNpmVersion();

        // Check ports
        await this.checkPorts();

        // Check .env files
        this.checkBackendEnv();
        this.checkFrontendEnv();

        // Check Google AI SDK
        this.checkGoogleAI();

        // Display results
        console.log('\n' + '='.repeat(60));
        this.log('VERIFICATION RESULTS', 'info');
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

        this.generateRemediationSteps();

        const hasErrors = this.errors.length > 0;
        const hasWarnings = this.warnings.length > 0;

        console.log('\n' + '='.repeat(60));
        
        if (!hasErrors && !hasWarnings) {
            this.log('🎉 Environment verification PASSED! Ready to develop.', 'success');
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

// Run verification if called directly
if (require.main === module) {
    const verifier = new EnvironmentVerifier();
    verifier.verify().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Verification failed with error:', error);
        process.exit(1);
    });
}

module.exports = EnvironmentVerifier;