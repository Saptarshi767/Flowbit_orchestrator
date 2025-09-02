import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Logger } from './logger';
import { CircuitBreaker } from './circuit-breaker';

/**
 * N8N API client configuration
 */
export interface N8NClientConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  timeout: number;
  retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  webhookConfig?: {
    baseUrl: string;
    path: string;
    secret?: string;
  };
}

/**
 * N8N workflow import/export formats
 */
export interface N8NWorkflowExport {
  name: string;
  nodes: any[];
  connections: any;
  active: boolean;
  settings: any;
  staticData: any;
  tags: string[];
  pinData: any;
  versionId: string;
  meta: {
    instanceId: string;
  };
}

/**
 * N8N credential export format
 */
export interface N8NCredentialExport {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
  nodesAccess: Array<{
    nodeType: string;
  }>;
}

/**
 * N8N execution data
 */
export interface N8NExecutionData {
  id: string;
  finished: boolean;
  mode: string;
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  workflowId: string;
  workflowData: any;
  data: {
    resultData: {
      runData: Record<string, any>;
      pinData?: Record<string, any>;
      lastNodeExecuted?: string;
      error?: {
        message: string;
        node?: {
          name: string;
          type: string;
        };
        timestamp: number;
      };
    };
    executionData?: {
      contextData: Record<string, any>;
      nodeExecutionStack: any[];
      metadata: Record<string, any>;
      waitingExecution: Record<string, any>;
      waitingExecutionSource: Record<string, any>;
    };
  };
}

/**
 * N8N webhook registration
 */
export interface N8NWebhookRegistration {
  workflowId: string;
  webhookPath: string;
  method: string;
  node: string;
  webhookId: string;
  isFullPath?: boolean;
}

/**
 * Enhanced N8N API client with webhook support and credential management
 */
export class N8NClient {
  private readonly httpClient: AxiosInstance;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: N8NClientConfig;
  private authToken?: string;

  constructor(config: N8NClientConfig) {
    this.config = config;
    this.logger = new Logger('n8n-client');
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 10000
    });

    // Configure HTTP client
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RobustAI-Orchestrator-N8N/1.0'
      }
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use(async (requestConfig) => {
      if (config.apiKey) {
        requestConfig.headers['X-N8N-API-KEY'] = config.apiKey;
      } else if (config.username && config.password) {
        // Use session-based authentication
        if (!this.authToken) {
          await this.authenticate();
        }
        if (this.authToken) {
          requestConfig.headers.Authorization = `Bearer ${this.authToken}`;
        }
      }
      return requestConfig;
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle authentication errors
        if (error.response?.status === 401 && this.config.username && this.config.password) {
          this.logger.warn('Authentication token expired, refreshing...');
          this.authToken = undefined;
          await this.authenticate();
          
          // Retry the original request
          if (this.authToken && error.config) {
            error.config.headers.Authorization = `Bearer ${this.authToken}`;
            return this.httpClient.request(error.config);
          }
        }
        
        this.logger.error('N8N API request failed', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticates with N8N using username/password
   */
  private async authenticate(): Promise<void> {
    if (!this.config.username || !this.config.password) {
      throw new Error('Username and password required for authentication');
    }

    try {
      const response = await this.httpClient.post('/api/v1/auth/login', {
        email: this.config.username,
        password: this.config.password
      });

      this.authToken = response.data.data.token;
      this.logger.info('Successfully authenticated with N8N');
    } catch (error) {
      this.logger.error('Failed to authenticate with N8N', { error });
      throw new Error('N8N authentication failed');
    }
  }

  /**
   * Tests connection to N8N instance
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.circuitBreaker.execute(async () => {
        const response = await this.httpClient.get('/api/v1/version');
        return response.status === 200;
      });
      return true;
    } catch (error) {
      this.logger.error('N8N connection test failed', { error });
      return false;
    }
  }

  /**
   * Gets N8N version information
   */
  async getVersion(): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/version');
    });
    return response.data;
  }

  /**
   * Gets available node types
   */
  async getNodeTypes(): Promise<Record<string, any>> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/node-types');
    });
    return response.data;
  }

  /**
   * Creates a new workflow
   */
  async createWorkflow(workflow: any): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post('/api/v1/workflows', workflow);
    });
    return response.data;
  }

  /**
   * Updates an existing workflow
   */
  async updateWorkflow(workflowId: string, workflow: any): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.put(`/api/v1/workflows/${workflowId}`, workflow);
    });
    return response.data;
  }

  /**
   * Gets a workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get(`/api/v1/workflows/${workflowId}`);
    });
    return response.data;
  }

  /**
   * Deletes a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      return await this.httpClient.delete(`/api/v1/workflows/${workflowId}`);
    });
  }

  /**
   * Executes a workflow
   */
  async executeWorkflow(workflowId: string, executionData: any): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post(`/api/v1/workflows/${workflowId}/execute`, executionData);
    });
    return response.data;
  }

  /**
   * Gets execution by ID
   */
  async getExecution(executionId: string): Promise<N8NExecutionData> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get(`/api/v1/executions/${executionId}`);
    });
    return response.data;
  }

  /**
   * Gets executions for a workflow
   */
  async getExecutions(workflowId?: string, limit: number = 20): Promise<N8NExecutionData[]> {
    const params: any = { limit };
    if (workflowId) {
      params.workflowId = workflowId;
    }

    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/executions', { params });
    });
    return response.data.data;
  }

  /**
   * Stops a running execution
   */
  async stopExecution(executionId: string): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post(`/api/v1/executions/${executionId}/stop`);
    });
    return response.data;
  }

  /**
   * Deletes an execution
   */
  async deleteExecution(executionId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      return await this.httpClient.delete(`/api/v1/executions/${executionId}`);
    });
  }

  /**
   * Gets all credentials
   */
  async getCredentials(): Promise<any[]> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/credentials');
    });
    return response.data.data;
  }

  /**
   * Creates a new credential
   */
  async createCredential(credential: any): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post('/api/v1/credentials', credential);
    });
    return response.data;
  }

  /**
   * Updates a credential
   */
  async updateCredential(credentialId: string, credential: any): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.put(`/api/v1/credentials/${credentialId}`, credential);
    });
    return response.data;
  }

  /**
   * Deletes a credential
   */
  async deleteCredential(credentialId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      return await this.httpClient.delete(`/api/v1/credentials/${credentialId}`);
    });
  }

  /**
   * Tests a credential
   */
  async testCredential(credentialId: string): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post(`/api/v1/credentials/${credentialId}/test`);
    });
    return response.data;
  }

  /**
   * Exports a workflow
   */
  async exportWorkflow(workflowId: string): Promise<N8NWorkflowExport> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get(`/api/v1/workflows/${workflowId}/export`);
    });
    return response.data;
  }

  /**
   * Imports a workflow
   */
  async importWorkflow(workflowData: N8NWorkflowExport): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post('/api/v1/workflows/import', workflowData);
    });
    return response.data;
  }

  /**
   * Registers a webhook
   */
  async registerWebhook(registration: N8NWebhookRegistration): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post('/api/v1/webhooks', registration);
    });
    return response.data;
  }

  /**
   * Unregisters a webhook
   */
  async unregisterWebhook(webhookId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      return await this.httpClient.delete(`/api/v1/webhooks/${webhookId}`);
    });
  }

  /**
   * Gets active webhooks
   */
  async getWebhooks(): Promise<any[]> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/webhooks');
    });
    return response.data.data;
  }

  /**
   * Validates a workflow
   */
  async validateWorkflow(workflow: any): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post('/api/v1/workflows/validate', { workflow });
    });
    return response.data;
  }

  /**
   * Gets workflow execution statistics
   */
  async getExecutionStats(workflowId: string, timeRange?: { from: Date; to: Date }): Promise<any> {
    const params: any = {};
    if (timeRange) {
      params.from = timeRange.from.toISOString();
      params.to = timeRange.to.toISOString();
    }

    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get(`/api/v1/workflows/${workflowId}/stats`, { params });
    });
    return response.data;
  }

  /**
   * Gets system health status
   */
  async getHealthStatus(): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/health');
    });
    return response.data;
  }

  /**
   * Gets system metrics
   */
  async getMetrics(): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/metrics');
    });
    return response.data;
  }

  /**
   * Activates a workflow
   */
  async activateWorkflow(workflowId: string): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post(`/api/v1/workflows/${workflowId}/activate`);
    });
    return response.data;
  }

  /**
   * Deactivates a workflow
   */
  async deactivateWorkflow(workflowId: string): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post(`/api/v1/workflows/${workflowId}/deactivate`);
    });
    return response.data;
  }

  /**
   * Gets workflow tags
   */
  async getTags(): Promise<string[]> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.get('/api/v1/tags');
    });
    return response.data.data;
  }

  /**
   * Creates a new tag
   */
  async createTag(name: string): Promise<any> {
    const response = await this.circuitBreaker.execute(async () => {
      return await this.httpClient.post('/api/v1/tags', { name });
    });
    return response.data;
  }

  /**
   * Deletes a tag
   */
  async deleteTag(tagId: string): Promise<void> {
    await this.circuitBreaker.execute(async () => {
      return await this.httpClient.delete(`/api/v1/tags/${tagId}`);
    });
  }
}