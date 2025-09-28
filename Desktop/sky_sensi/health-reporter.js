/**
 * Health Reporting System
 * Generates comprehensive health reports and documentation for Sky Sensi
 */

const fs = require('fs').promises;
const path = require('path');

class HealthReporter {
    constructor() {
        this.reportTemplates = new Map();
        this.initializeTemplates();
    }

    /**
     * Initialize report templates
     */
    initializeTemplates() {
        this.reportTemplates.set('summary', {
            name: 'Health Summary Report',
            description: 'Concise overview of system health',
            sections: ['executive_summary', 'key_metrics', 'critical_issues', 'recommendations']
        });

        this.reportTemplates.set('detailed', {
            name: 'Detailed Health Report',
            description: 'Comprehensive system health analysis',
            sections: ['executive_summary', 'system_overview', 'service_health', 'performance_metrics', 
                      'dependency_analysis', 'environment_validation', 'security_assessment', 
                      'troubleshooting_log', 'recommendations', 'appendix']
        });

        this.reportTemplates.set('incident', {
            name: 'Incident Health Report',
            description: 'Health report focused on specific incidents',
            sections: ['incident_summary', 'timeline', 'impact_analysis', 'root_cause', 
                      'resolution_steps', 'lessons_learned', 'prevention_measures']
        });

        this.reportTemplates.set('performance', {
            name: 'Performance Health Report',
            description: 'Performance-focused health analysis',
            sections: ['performance_summary', 'system_metrics', 'application_metrics', 
                      'bottleneck_analysis', 'optimization_recommendations']
        });
    }

    /**
     * Generate comprehensive health report
     */
    async generateHealthReport(data, options = {}) {
        const {
            type = 'detailed',
            format = 'markdown',
            includeCharts = false,
            timeWindow = '24h'
        } = options;

        console.log(`📊 Generating ${type} health report...`);

        const template = this.reportTemplates.get(type);
        if (!template) {
            throw new Error(`Unknown report type: ${type}`);
        }

        const report = {
            metadata: {
                title: template.name,
                generated: new Date().toISOString(),
                type,
                format,
                timeWindow,
                version: '1.0.0'
            },
            data: await this.processHealthData(data),
            content: {}
        };

        // Generate each section
        for (const section of template.sections) {
            report.content[section] = await this.generateSection(section, report.data, options);
        }

        // Format the report
        const formattedReport = await this.formatReport(report, format);

        console.log(`✅ Health report generated successfully`);
        return formattedReport;
    }

    /**
     * Process and normalize health data
     */
    async processHealthData(rawData) {
        const processedData = {
            timestamp: new Date().toISOString(),
            services: {},
            performance: {},
            dependencies: {},
            environment: {},
            security: {},
            alerts: [],
            metrics: {}
        };

        // Process service health data
        if (rawData.serviceStates) {
            processedData.services = this.processServiceData(rawData.serviceStates);
        }

        // Process performance data
        if (rawData.performance) {
            processedData.performance = this.processPerformanceData(rawData.performance);
        }

        // Process dependency data
        if (rawData.dependencies) {
            processedData.dependencies = this.processDependencyData(rawData.dependencies);
        }

        // Process environment data
        if (rawData.environment) {
            processedData.environment = this.processEnvironmentData(rawData.environment);
        }

        // Process alerts
        if (rawData.alerts) {
            processedData.alerts = this.processAlertData(rawData.alerts);
        }

        return processedData;
    }

    /**
     * Process service health data
     */
    processServiceData(serviceStates) {
        const processed = {
            total: Object.keys(serviceStates).length,
            healthy: 0,
            unhealthy: 0,
            unknown: 0,
            services: {}
        };

        for (const [service, state] of Object.entries(serviceStates)) {
            const processedState = {
                name: service,
                status: state.status,
                uptime: state.uptime || 0,
                responseTime: state.responseTime || 0,
                lastChecked: state.lastChecked || new Date().toISOString(),
                message: state.message || '',
                details: state.details || {}
            };

            processed.services[service] = processedState;

            // Count status types
            if (state.status === 'healthy') {
                processed.healthy++;
            } else if (state.status === 'unhealthy') {
                processed.unhealthy++;
            } else {
                processed.unknown++;
            }
        }

        return processed;
    }

    /**
     * Process performance data
     */
    processPerformanceData(performanceData) {
        return {
            current: {
                cpu: performanceData.current?.cpu || 0,
                memory: performanceData.current?.memory || 0,
                disk: performanceData.current?.disk || 0,
                responseTime: performanceData.current?.responseTime || 0
            },
            trends: performanceData.trends || {},
            alerts: performanceData.alerts || { total: 0, critical: 0, warnings: 0 },
            recommendations: performanceData.recommendations || []
        };
    }

    /**
     * Process dependency data
     */
    processDependencyData(dependencyData) {
        return {
            overall: {
                status: dependencyData.overall?.status || 'unknown',
                score: dependencyData.overall?.score || 0,
                issues: dependencyData.overall?.issues || []
            },
            runtime: dependencyData.runtime || {},
            projects: dependencyData.projects || {},
            security: dependencyData.security || {}
        };
    }

    /**
     * Process environment data
     */
    processEnvironmentData(environmentData) {
        return {
            overall: {
                status: environmentData.overall?.status || 'unknown',
                score: environmentData.overall?.score || 0,
                issues: environmentData.overall?.issues || []
            },
            configFiles: environmentData.configFiles || {},
            environments: environmentData.environments || {}
        };
    }

    /**
     * Process alert data
     */
    processAlertData(alertData) {
        if (Array.isArray(alertData)) {
            return alertData.map(alert => ({
                timestamp: alert.timestamp || new Date().toISOString(),
                level: alert.level || 'info',
                type: alert.type || 'unknown',
                message: alert.message || '',
                resolved: alert.resolved || false
            }));
        }
        return [];
    }

    /**
     * Generate individual report sections
     */
    async generateSection(sectionName, data, options) {
        switch (sectionName) {
            case 'executive_summary':
                return this.generateExecutiveSummary(data);
            case 'system_overview':
                return this.generateSystemOverview(data);
            case 'service_health':
                return this.generateServiceHealthSection(data);
            case 'performance_metrics':
                return this.generatePerformanceSection(data);
            case 'dependency_analysis':
                return this.generateDependencySection(data);
            case 'environment_validation':
                return this.generateEnvironmentSection(data);
            case 'security_assessment':
                return this.generateSecuritySection(data);
            case 'troubleshooting_log':
                return this.generateTroubleshootingSection(data);
            case 'recommendations':
                return this.generateRecommendationsSection(data);
            case 'key_metrics':
                return this.generateKeyMetrics(data);
            case 'critical_issues':
                return this.generateCriticalIssues(data);
            case 'appendix':
                return this.generateAppendix(data, options);
            default:
                return { title: sectionName.replace('_', ' ').toUpperCase(), content: 'Section not implemented' };
        }
    }

    /**
     * Generate executive summary section
     */
    generateExecutiveSummary(data) {
        const healthyServices = data.services.healthy || 0;
        const totalServices = data.services.total || 0;
        const criticalAlerts = data.alerts.filter(a => a.level === 'critical').length;
        
        const overallHealth = this.calculateOverallHealth(data);
        
        return {
            title: 'Executive Summary',
            content: {
                overallHealth: overallHealth,
                keyMetrics: {
                    serviceHealth: `${healthyServices}/${totalServices} services healthy`,
                    criticalAlerts: `${criticalAlerts} critical alerts`,
                    performanceScore: `${data.performance.current.cpu || 0}% CPU, ${data.performance.current.memory || 0}% Memory`,
                    dependencyScore: `${data.dependencies.overall.score || 0}/100`
                },
                summary: this.generateHealthSummaryText(overallHealth, data),
                lastUpdated: data.timestamp
            }
        };
    }

    /**
     * Generate system overview section
     */
    generateSystemOverview(data) {
        return {
            title: 'System Overview',
            content: {
                architecture: {
                    components: ['Frontend (React + Vite)', 'Backend (Node.js + Express)', 'External APIs (Gemini, AWC, OpenWeatherMap, Open-Meteo)'],
                    deployment: 'Development Environment',
                    monitoring: 'Health Monitor + Service Checkers'
                },
                currentStatus: {
                    services: data.services,
                    uptime: this.calculateSystemUptime(data),
                    lastHealthCheck: data.timestamp
                }
            }
        };
    }

    /**
     * Generate service health section
     */
    generateServiceHealthSection(data) {
        const services = data.services.services || {};
        
        return {
            title: 'Service Health Analysis',
            content: {
                summary: {
                    total: data.services.total,
                    healthy: data.services.healthy,
                    unhealthy: data.services.unhealthy,
                    unknown: data.services.unknown
                },
                services: Object.entries(services).map(([name, service]) => ({
                    name: name,
                    status: service.status,
                    uptime: service.uptime,
                    responseTime: service.responseTime,
                    lastChecked: service.lastChecked,
                    issues: service.status !== 'healthy' ? [service.message] : []
                })),
                trends: this.analyzeServiceTrends(services)
            }
        };
    }

    /**
     * Generate performance section
     */
    generatePerformanceSection(data) {
        return {
            title: 'Performance Metrics',
            content: {
                current: data.performance.current,
                trends: data.performance.trends,
                alerts: data.performance.alerts,
                analysis: {
                    cpuHealth: this.assessMetric(data.performance.current.cpu, 'cpu'),
                    memoryHealth: this.assessMetric(data.performance.current.memory, 'memory'),
                    responseTimeHealth: this.assessMetric(data.performance.current.responseTime, 'responseTime')
                },
                recommendations: data.performance.recommendations
            }
        };
    }

    /**
     * Generate dependency section
     */
    generateDependencySection(data) {
        return {
            title: 'Dependency Analysis',
            content: {
                overall: data.dependencies.overall,
                runtime: data.dependencies.runtime,
                projects: data.dependencies.projects,
                security: data.dependencies.security,
                riskAssessment: this.assessDependencyRisks(data.dependencies)
            }
        };
    }

    /**
     * Generate environment section
     */
    generateEnvironmentSection(data) {
        return {
            title: 'Environment Validation',
            content: {
                overall: data.environment.overall,
                configFiles: data.environment.configFiles,
                environments: data.environment.environments,
                compliance: this.assessEnvironmentCompliance(data.environment)
            }
        };
    }

    /**
     * Generate security section
     */
    generateSecuritySection(data) {
        return {
            title: 'Security Assessment',
            content: {
                vulnerabilities: data.dependencies.security || {},
                apiKeys: this.assessApiKeySecurity(data.environment),
                recommendations: [
                    'Regular dependency updates',
                    'API key rotation',
                    'Environment variable security',
                    'Access control review'
                ]
            }
        };
    }

    /**
     * Generate troubleshooting section
     */
    generateTroubleshootingSection(data) {
        const recentIssues = data.alerts.filter(alert => 
            new Date(alert.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        return {
            title: 'Recent Troubleshooting Activity',
            content: {
                recentIssues: recentIssues,
                commonProblems: this.identifyCommonProblems(data),
                resolutionSummary: this.summarizeResolutions(recentIssues)
            }
        };
    }

    /**
     * Generate recommendations section
     */
    generateRecommendationsSection(data) {
        const allRecommendations = [];

        // Collect recommendations from all sources
        if (data.performance.recommendations) {
            allRecommendations.push(...data.performance.recommendations.map(r => ({ ...r, source: 'performance' })));
        }
        if (data.dependencies.overall.recommendations) {
            allRecommendations.push(...data.dependencies.overall.recommendations.map(r => ({ ...r, source: 'dependencies' })));
        }
        if (data.environment.overall.recommendations) {
            allRecommendations.push(...data.environment.overall.recommendations.map(r => ({ ...r, source: 'environment' })));
        }

        // Prioritize and deduplicate
        const prioritizedRecommendations = this.prioritizeRecommendations(allRecommendations);

        return {
            title: 'Recommendations',
            content: {
                immediate: prioritizedRecommendations.filter(r => r.priority === 'high'),
                shortTerm: prioritizedRecommendations.filter(r => r.priority === 'medium'),
                longTerm: prioritizedRecommendations.filter(r => r.priority === 'low'),
                summary: `${prioritizedRecommendations.filter(r => r.priority === 'high').length} immediate actions required`
            }
        };
    }

    /**
     * Generate key metrics section
     */
    generateKeyMetrics(data) {
        return {
            title: 'Key Metrics',
            content: {
                availability: `${((data.services.healthy / data.services.total) * 100).toFixed(1)}%`,
                performance: {
                    cpu: `${data.performance.current.cpu}%`,
                    memory: `${data.performance.current.memory}%`,
                    responseTime: `${data.performance.current.responseTime}ms`
                },
                quality: {
                    dependencyScore: `${data.dependencies.overall.score}/100`,
                    environmentScore: `${data.environment.overall.score}/100`
                },
                alerts: {
                    total: data.alerts.length,
                    critical: data.alerts.filter(a => a.level === 'critical').length
                }
            }
        };
    }

    /**
     * Generate critical issues section
     */
    generateCriticalIssues(data) {
        const criticalIssues = [];

        // Service issues
        Object.entries(data.services.services || {}).forEach(([name, service]) => {
            if (service.status === 'unhealthy') {
                criticalIssues.push({
                    type: 'service',
                    service: name,
                    issue: service.message,
                    impact: 'high'
                });
            }
        });

        // Performance issues
        if (data.performance.current.cpu > 85) {
            criticalIssues.push({
                type: 'performance',
                issue: `Critical CPU usage: ${data.performance.current.cpu}%`,
                impact: 'high'
            });
        }

        // Dependency issues
        data.dependencies.overall.issues?.forEach(issue => {
            if (issue.includes('critical') || issue.includes('missing')) {
                criticalIssues.push({
                    type: 'dependency',
                    issue: issue,
                    impact: 'medium'
                });
            }
        });

        return {
            title: 'Critical Issues',
            content: {
                count: criticalIssues.length,
                issues: criticalIssues,
                requiresImmediateAttention: criticalIssues.filter(i => i.impact === 'high').length
            }
        };
    }

    /**
     * Generate appendix section
     */
    generateAppendix(data, options) {
        return {
            title: 'Appendix',
            content: {
                rawData: options.includeRawData ? data : 'Raw data excluded for brevity',
                glossary: this.generateGlossary(),
                references: this.generateReferences()
            }
        };
    }

    /**
     * Format report based on specified format
     */
    async formatReport(report, format) {
        switch (format) {
            case 'markdown':
                return this.formatAsMarkdown(report);
            case 'html':
                return this.formatAsHtml(report);
            case 'json':
                return JSON.stringify(report, null, 2);
            case 'text':
                return this.formatAsText(report);
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    /**
     * Format report as Markdown
     */
    formatAsMarkdown(report) {
        let markdown = `# ${report.metadata.title}\n\n`;
        markdown += `**Generated:** ${report.metadata.generated}\n`;
        markdown += `**Type:** ${report.metadata.type}\n`;
        markdown += `**Time Window:** ${report.metadata.timeWindow}\n\n`;

        markdown += '---\n\n';

        // Generate table of contents
        markdown += '## Table of Contents\n\n';
        Object.keys(report.content).forEach((section, index) => {
            const title = report.content[section].title;
            markdown += `${index + 1}. [${title}](#${title.toLowerCase().replace(/\s+/g, '-')})\n`;
        });
        markdown += '\n---\n\n';

        // Generate sections
        Object.values(report.content).forEach(section => {
            markdown += `## ${section.title}\n\n`;
            markdown += this.formatSectionContentAsMarkdown(section.content);
            markdown += '\n---\n\n';
        });

        return markdown;
    }

    /**
     * Format section content as Markdown
     */
    formatSectionContentAsMarkdown(content) {
        let markdown = '';

        if (typeof content === 'string') {
            return content + '\n\n';
        }

        if (typeof content === 'object') {
            Object.entries(content).forEach(([key, value]) => {
                markdown += `### ${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}\n\n`;
                
                if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        value.forEach(item => {
                            if (typeof item === 'object') {
                                markdown += `- **${item.name || item.type || 'Item'}:** ${item.message || item.description || JSON.stringify(item)}\n`;
                            } else {
                                markdown += `- ${item}\n`;
                            }
                        });
                    } else {
                        Object.entries(value).forEach(([subKey, subValue]) => {
                            markdown += `- **${subKey}:** ${typeof subValue === 'object' ? JSON.stringify(subValue, null, 2) : subValue}\n`;
                        });
                    }
                } else {
                    markdown += `${value}\n`;
                }
                
                markdown += '\n';
            });
        }

        return markdown;
    }

    /**
     * Calculate overall system health
     */
    calculateOverallHealth(data) {
        const serviceHealth = (data.services.healthy / data.services.total) * 100;
        const performanceHealth = this.calculatePerformanceHealth(data.performance);
        const dependencyHealth = data.dependencies.overall.score;
        const environmentHealth = data.environment.overall.score;

        const overallScore = (serviceHealth + performanceHealth + dependencyHealth + environmentHealth) / 4;

        if (overallScore >= 90) return 'excellent';
        if (overallScore >= 75) return 'good';
        if (overallScore >= 60) return 'fair';
        if (overallScore >= 40) return 'poor';
        return 'critical';
    }

    /**
     * Calculate performance health score
     */
    calculatePerformanceHealth(performance) {
        let score = 100;
        
        // CPU score
        if (performance.current.cpu > 85) score -= 30;
        else if (performance.current.cpu > 70) score -= 15;
        
        // Memory score
        if (performance.current.memory > 90) score -= 25;
        else if (performance.current.memory > 80) score -= 10;
        
        // Response time score
        if (performance.current.responseTime > 3000) score -= 20;
        else if (performance.current.responseTime > 1000) score -= 10;

        return Math.max(0, score);
    }

    /**
     * Helper methods for analysis
     */
    calculateSystemUptime(data) {
        // Calculate average uptime across all services
        const services = Object.values(data.services.services || {});
        if (services.length === 0) return 0;
        
        const totalUptime = services.reduce((sum, service) => sum + (service.uptime || 0), 0);
        return totalUptime / services.length;
    }

    analyzeServiceTrends(services) {
        // Placeholder for trend analysis
        return {
            improving: [],
            declining: [],
            stable: Object.keys(services)
        };
    }

    assessMetric(value, type) {
        const thresholds = {
            cpu: { good: 50, warning: 70, critical: 85 },
            memory: { good: 60, warning: 80, critical: 90 },
            responseTime: { good: 500, warning: 1000, critical: 3000 }
        };

        const threshold = thresholds[type];
        if (!threshold) return 'unknown';

        if (value <= threshold.good) return 'good';
        if (value <= threshold.warning) return 'warning';
        return 'critical';
    }

    assessDependencyRisks(dependencies) {
        const risks = [];
        
        if (dependencies.overall.score < 70) {
            risks.push('Low dependency health score');
        }
        
        if (dependencies.security && Object.values(dependencies.security).some(s => s.status === 'vulnerabilities')) {
            risks.push('Security vulnerabilities detected');
        }

        return risks;
    }

    assessEnvironmentCompliance(environment) {
        return {
            configurationComplete: environment.overall.score > 80,
            securityCompliant: true, // Would check actual security compliance
            bestPractices: environment.overall.score > 90
        };
    }

    assessApiKeySecurity(environment) {
        return {
            keysConfigured: true, // Would check actual API key configuration
            rotationNeeded: false, // Would check key age
            secureStorage: true // Would verify secure storage
        };
    }

    identifyCommonProblems(data) {
        const problems = [];
        
        // Check for common service issues
        Object.entries(data.services.services || {}).forEach(([name, service]) => {
            if (service.status === 'unhealthy') {
                problems.push({
                    type: 'service_down',
                    service: name,
                    frequency: 'recurring'
                });
            }
        });

        return problems;
    }

    summarizeResolutions(issues) {
        return {
            totalResolved: issues.filter(i => i.resolved).length,
            averageResolutionTime: '15 minutes', // Placeholder
            commonResolutions: ['Service restart', 'Configuration fix', 'Dependency update']
        };
    }

    prioritizeRecommendations(recommendations) {
        return recommendations.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    generateHealthSummaryText(overallHealth, data) {
        const serviceStatus = `${data.services.healthy}/${data.services.total} services are healthy`;
        const alertCount = data.alerts.length;
        
        switch (overallHealth) {
            case 'excellent':
                return `System health is excellent. ${serviceStatus} with minimal alerts (${alertCount}).`;
            case 'good':
                return `System health is good. ${serviceStatus} with some minor issues (${alertCount} alerts).`;
            case 'fair':
                return `System health is fair. ${serviceStatus}. Attention needed for ${alertCount} alerts.`;
            case 'poor':
                return `System health is poor. ${serviceStatus}. Immediate attention required for ${alertCount} alerts.`;
            case 'critical':
                return `System health is critical. ${serviceStatus}. Emergency response needed for ${alertCount} alerts.`;
            default:
                return `System health status unknown. ${serviceStatus} with ${alertCount} alerts.`;
        }
    }

    generateGlossary() {
        return {
            'Service Health': 'Status of individual system components and external services',
            'Performance Metrics': 'System resource utilization and response time measurements',
            'Dependency Analysis': 'Evaluation of software dependencies and their health',
            'Environment Validation': 'Verification of configuration and environment setup'
        };
    }

    generateReferences() {
        return [
            'Sky Sensi Documentation',
            'Health Monitoring System Guide',
            'Service Level Objectives (SLOs)',
            'Incident Response Procedures'
        ];
    }

    /**
     * Save report to file
     */
    async saveReport(report, filename, directory = './reports') {
        try {
            // Ensure reports directory exists
            await fs.mkdir(directory, { recursive: true });
            
            const filePath = path.join(directory, filename);
            await fs.writeFile(filePath, report, 'utf8');
            
            console.log(`📄 Report saved to ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('Failed to save report:', error);
            throw error;
        }
    }

    /**
     * Generate automated report filename
     */
    generateReportFilename(type, format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        return `sky-sensi-health-${type}-${timestamp}.${format === 'markdown' ? 'md' : format}`;
    }
}

module.exports = HealthReporter;