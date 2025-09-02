/**
 * Robust AI Orchestrator TypeScript/JavaScript SDK
 * 
 * This SDK provides a convenient interface for interacting with the
 * Robust AI Orchestrator API from TypeScript and JavaScript applications.
 */

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
  version?: string;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    correlationId: string;
    timestamp: string;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  engineType: 'langflow' | 'n8n' | 'langsmith';
  definition: any;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isPublic: boolean;
  organizationId: string;
}

export interface Execution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  parameters: any;
  result?: any;
  metrics?: any;
  executorId: string;
  userId: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'viewer';
  organizationId: string;
  permissions: string[];
  preferences: any;
  createdAt: string;
  lastLoginAt: string;
}

export class RobustAIOrchestrator {
  private config: Required<ApiConfig>;
  private correlationId: string;

  constructor(config: ApiConfig) {
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

  private generateCorrelationId(): string {
    return 'sdk-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
  }

  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: { retries?: number } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const retries = options.retries ?? this.config.retries;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': this.correlationId,
      'X-API-Version': this.config.version,
      'User-Agent': 'RobustAIOrchestrator-SDK/1.0.0'
    };

    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const requestOptions: RequestInit = {
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
        const result = await response.json() as ApiResponse<T>;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${result.error?.message || 'Request failed'}`);
        }

        return result;
      } catch (error) {
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
  async login(email: string, password: string): Promise<ApiResponse<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: User;
  }>> {
    const response = await this.makeRequest('POST', '/auth/login', { email, password });
    
    if (response.success && response.data) {
      this.config.accessToken = (response.data as any).accessToken;
    }
    
    return response as ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: User;
    }>;
  }

  async register(userData: {
    email: string;
    password: string;
    name: string;
    organizationName?: string;
  }): Promise<ApiResponse<{ user: User; message: string }>> {
    return this.makeRequest('POST', '/auth/register', userData);
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{
    accessToken: string;
    expiresIn: number;
  }>> {
    const response = await this.makeRequest('POST', '/auth/refresh', { refreshToken });
    
    if (response.success && response.data) {
      this.config.accessToken = (response.data as any).accessToken;
    }
    
    return response as ApiResponse<{
      accessToken: string;
      expiresIn: number;
    }>;
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    const response = await this.makeRequest('POST', '/auth/logout');
    this.config.accessToken = '';
    return response as ApiResponse<{ message: string }>;
  }

  // User methods
  async getUserProfile(): Promise<ApiResponse<User>> {
    return this.makeRequest('GET', '/users/profile');
  }

  async updateUserProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeRequest('PUT', '/users/profile', updates);
  }

  async listUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    organizationId?: string;
  }): Promise<ApiResponse<{ users: User[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/users?${query.toString()}`);
  }

  // Workflow methods
  async listWorkflows(params?: {
    page?: number;
    limit?: number;
    engineType?: 'langflow' | 'n8n' | 'langsmith';
    tags?: string;
    search?: string;
  }): Promise<ApiResponse<{ workflows: Workflow[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/workflows?${query.toString()}`);
  }

  async getWorkflow(workflowId: string): Promise<ApiResponse<Workflow>> {
    return this.makeRequest('GET', `/workflows/${workflowId}`);
  }

  async createWorkflow(workflow: {
    name: string;
    description?: string;
    engineType: 'langflow' | 'n8n' | 'langsmith';
    definition: any;
    tags?: string[];
    isPublic?: boolean;
  }): Promise<ApiResponse<Workflow>> {
    return this.makeRequest('POST', '/workflows', workflow);
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<ApiResponse<Workflow>> {
    return this.makeRequest('PUT', `/workflows/${workflowId}`, updates);
  }

  async deleteWorkflow(workflowId: string): Promise<ApiResponse<void>> {
    return this.makeRequest('DELETE', `/workflows/${workflowId}`);
  }

  async getWorkflowVersions(workflowId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ versions: any[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/workflows/${workflowId}/versions?${query.toString()}`);
  }

  // Execution methods
  async listExecutions(params?: {
    page?: number;
    limit?: number;
    workflowId?: string;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ executions: Execution[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/executions?${query.toString()}`);
  }

  async executeWorkflow(request: {
    workflowId: string;
    parameters?: any;
    version?: number;
  }): Promise<ApiResponse<Execution>> {
    return this.makeRequest('POST', '/executions', request);
  }

  async getExecution(executionId: string): Promise<ApiResponse<Execution>> {
    return this.makeRequest('GET', `/executions/${executionId}`);
  }

  async cancelExecution(executionId: string): Promise<ApiResponse<Execution>> {
    return this.makeRequest('DELETE', `/executions/${executionId}`);
  }

  async getExecutionLogs(executionId: string, params?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    startTime?: string;
    endTime?: string;
  }): Promise<ApiResponse<{ logs: any[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/executions/${executionId}/logs?${query.toString()}`);
  }

  // Monitoring methods
  async getSystemMetrics(params?: {
    timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
    metrics?: string;
  }): Promise<ApiResponse<{ metrics: any[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/monitoring/metrics?${query.toString()}`);
  }

  async listAlerts(params?: {
    page?: number;
    limit?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'active' | 'resolved' | 'acknowledged';
  }): Promise<ApiResponse<{ alerts: any[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/monitoring/alerts?${query.toString()}`);
  }

  // Marketplace methods
  async browseMarketplaceWorkflows(params?: {
    page?: number;
    limit?: number;
    category?: string;
    tags?: string;
    search?: string;
    sortBy?: 'popularity' | 'rating' | 'recent' | 'name';
  }): Promise<ApiResponse<{ workflows: any[] }>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) query.append(key, value.toString());
      });
    }
    
    return this.makeRequest('GET', `/marketplace/workflows?${query.toString()}`);
  }

  // Utility methods
  async getHealth(): Promise<ApiResponse<{
    status: string;
    timestamp: string;
    version: string;
    uptime: number;
  }>> {
    return this.makeRequest('GET', '/health');
  }

  async getVersion(): Promise<ApiResponse<{
    version: string;
    apiVersion: string;
    buildDate: string;
  }>> {
    return this.makeRequest('GET', '/version');
  }

  // Configuration methods
  setAccessToken(token: string): void {
    this.config.accessToken = token;
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
  }

  setVersion(version: string): void {
    this.config.version = version;
  }

  getConfig(): Readonly<ApiConfig> {
    return { ...this.config };
  }
}

// Export default instance factory
export const createClient = (config: ApiConfig): RobustAIOrchestrator => {
  return new RobustAIOrchestrator(config);
};

// Export types
export * from './types';

// Default export
export default RobustAIOrchestrator;