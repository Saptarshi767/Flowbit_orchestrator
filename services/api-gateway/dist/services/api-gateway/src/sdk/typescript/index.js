"use strict";
/**
 * Robust AI Orchestrator TypeScript/JavaScript SDK
 *
 * This SDK provides a convenient interface for interacting with the
 * Robust AI Orchestrator API from TypeScript and JavaScript applications.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = exports.RobustAIOrchestrator = void 0;
class RobustAIOrchestrator {
    constructor(config) {
        this.config = {
            baseUrl: config.baseUrl.replace(/\/$/, ''),
            apiKey: config.apiKey || '',
            accessToken: config.accessToken || '',
            version: config.version || '1.1',
            timeout: config.timeout || 30000,
            retries: config.retries || 3
        };
        this.correlationId = this.generateCorrelationId();
    }
    generateCorrelationId() {
        return 'sdk-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }
    async makeRequest(method, endpoint, data, options = {}) {
        const url = `${this.config.baseUrl}${endpoint}`;
        const retries = options.retries ?? this.config.retries;
        const headers = {
            'Content-Type': 'application/json',
            'X-Correlation-ID': this.correlationId,
            'X-API-Version': this.config.version,
            'User-Agent': 'RobustAIOrchestrator-SDK/1.0.0'
        };
        if (this.config.accessToken) {
            headers['Authorization'] = `Bearer ${this.config.accessToken}`;
        }
        else if (this.config.apiKey) {
            headers['X-API-Key'] = this.config.apiKey;
        }
        const requestOptions = {
            method,
            headers,
            signal: AbortSignal.timeout(this.config.timeout)
        };
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            requestOptions.body = JSON.stringify(data);
        }
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, requestOptions);
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${result.error?.message || 'Request failed'}`);
                }
                return result;
            }
            catch (error) {
                if (attempt === retries) {
                    throw new Error(`Request failed after ${retries + 1} attempts: ${error}`);
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
        throw new Error('Request failed');
    }
    // Authentication methods
    async login(email, password) {
        const response = await this.makeRequest('POST', '/auth/login', { email, password });
        if (response.success && response.data) {
            this.config.accessToken = response.data.accessToken;
        }
        return response;
    }
    async register(userData) {
        return this.makeRequest('POST', '/auth/register', userData);
    }
    async refreshToken(refreshToken) {
        const response = await this.makeRequest('POST', '/auth/refresh', { refreshToken });
        if (response.success && response.data) {
            this.config.accessToken = response.data.accessToken;
        }
        return response;
    }
    async logout() {
        const response = await this.makeRequest('POST', '/auth/logout');
        this.config.accessToken = '';
        return response;
    }
    // User methods
    async getUserProfile() {
        return this.makeRequest('GET', '/users/profile');
    }
    async updateUserProfile(updates) {
        return this.makeRequest('PUT', '/users/profile', updates);
    }
    async listUsers(params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/users?${query.toString()}`);
    }
    // Workflow methods
    async listWorkflows(params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/workflows?${query.toString()}`);
    }
    async getWorkflow(workflowId) {
        return this.makeRequest('GET', `/workflows/${workflowId}`);
    }
    async createWorkflow(workflow) {
        return this.makeRequest('POST', '/workflows', workflow);
    }
    async updateWorkflow(workflowId, updates) {
        return this.makeRequest('PUT', `/workflows/${workflowId}`, updates);
    }
    async deleteWorkflow(workflowId) {
        return this.makeRequest('DELETE', `/workflows/${workflowId}`);
    }
    async getWorkflowVersions(workflowId, params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/workflows/${workflowId}/versions?${query.toString()}`);
    }
    // Execution methods
    async listExecutions(params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/executions?${query.toString()}`);
    }
    async executeWorkflow(request) {
        return this.makeRequest('POST', '/executions', request);
    }
    async getExecution(executionId) {
        return this.makeRequest('GET', `/executions/${executionId}`);
    }
    async cancelExecution(executionId) {
        return this.makeRequest('DELETE', `/executions/${executionId}`);
    }
    async getExecutionLogs(executionId, params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/executions/${executionId}/logs?${query.toString()}`);
    }
    // Monitoring methods
    async getSystemMetrics(params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/monitoring/metrics?${query.toString()}`);
    }
    async listAlerts(params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/monitoring/alerts?${query.toString()}`);
    }
    // Marketplace methods
    async browseMarketplaceWorkflows(params) {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined)
                    query.append(key, value.toString());
            });
        }
        return this.makeRequest('GET', `/marketplace/workflows?${query.toString()}`);
    }
    // Utility methods
    async getHealth() {
        return this.makeRequest('GET', '/health');
    }
    async getVersion() {
        return this.makeRequest('GET', '/version');
    }
    // Configuration methods
    setAccessToken(token) {
        this.config.accessToken = token;
    }
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
    }
    setVersion(version) {
        this.config.version = version;
    }
    getConfig() {
        return { ...this.config };
    }
}
exports.RobustAIOrchestrator = RobustAIOrchestrator;
// Export default instance factory
const createClient = (config) => {
    return new RobustAIOrchestrator(config);
};
exports.createClient = createClient;
// Export types
__exportStar(require("./types"), exports);
// Default export
exports.default = RobustAIOrchestrator;
//# sourceMappingURL=index.js.map