import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Logger } from './logger';

/**
 * Configuration for Langflow client
 */
export interface LangflowClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Langflow API response wrapper
 */
export interface LangflowApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Langflow flow information
 */
export interface LangflowFlow {
  id: string;
  name: string;
  description?: string;
  data: any;
  is_component: boolean;
  updated_at: string;
  folder?: string;
  endpoint_name?: string;
}

/**
 * Langflow component information
 */
export interface LangflowComponent {
  name: string;
  display_name: string;
  description: string;
  base_classes: string[];
  template: Record<string, any>;
}

/**
 * Dedicated client for interacting with Langflow API
 * Provides higher-level methods for common operations
 */
export class LangflowClient {
  private readonly httpClient: AxiosInstance;
  private readonly logger: Logger;
  private readonly config: LangflowClientConfig;

  constructor(config: LangflowClientConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.logger = new Logger('langflow-client');

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RobustAI-Orchestrator-LangflowClient/1.0'
      }
    });

    // Add authentication if API key is provided
    if (this.config.apiKey) {
      this.httpClient.interceptors.request.use((requestConfig) => {
        requestConfig.headers.Authorization = `Bearer ${this.config.apiKey}`;
        return requestConfig;
      });
    }

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('Langflow API request failed', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Tests connection to Langflow instance
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      return response.status === 200;
    } catch (error) {
      // Try alternative health check endpoints
      try {
        const response = await this.httpClient.get('/api/v1/version');
        return response.status === 200;
      } catch (fallbackError) {
        this.logger.error('Connection test failed', { error, fallbackError });
        return false;
      }
    }
  }

  /**
   * Gets Langflow version information
   */
  async getVersion(): Promise<{ version: string; [key: string]: any }> {
    const response = await this.httpClient.get('/api/v1/version');
    return response.data;
  }

  /**
   * Lists all available flows
   */
  async listFlows(): Promise<LangflowFlow[]> {
    const response = await this.httpClient.get('/api/v1/flows');
    return response.data;
  }

  /**
   * Gets a specific flow by ID
   */
  async getFlow(flowId: string): Promise<LangflowFlow> {
    const response = await this.httpClient.get(`/api/v1/flows/${flowId}`);
    return response.data;
  }

  /**
   * Creates a new flow
   */
  async createFlow(flow: Partial<LangflowFlow>): Promise<LangflowFlow> {
    const response = await this.httpClient.post('/api/v1/flows', flow);
    return response.data;
  }

  /**
   * Updates an existing flow
   */
  async updateFlow(flowId: string, flow: Partial<LangflowFlow>): Promise<LangflowFlow> {
    const response = await this.httpClient.patch(`/api/v1/flows/${flowId}`, flow);
    return response.data;
  }

  /**
   * Deletes a flow
   */
  async deleteFlow(flowId: string): Promise<void> {
    await this.httpClient.delete(`/api/v1/flows/${flowId}`);
  }

  /**
   * Validates a flow definition
   */
  async validateFlow(flow: any): Promise<LangflowApiResponse> {
    const response = await this.httpClient.post('/api/v1/validate', { flow });
    return response.data;
  }

  /**
   * Runs a flow with given inputs
   */
  async runFlow(
    flowIdOrName: string,
    inputs: {
      input_value?: string;
      input_type?: string;
      output_type?: string;
      tweaks?: Record<string, any>;
      session_id?: string;
    }
  ): Promise<any> {
    const response = await this.httpClient.post(`/api/v1/run/${flowIdOrName}`, inputs);
    return response.data;
  }

  /**
   * Gets execution status
   */
  async getExecutionStatus(sessionId: string): Promise<{
    status: 'running' | 'completed' | 'error';
    result?: any;
    error?: string;
  }> {
    const response = await this.httpClient.get(`/api/v1/status/${sessionId}`);
    return response.data;
  }

  /**
   * Gets execution logs
   */
  async getExecutionLogs(sessionId: string): Promise<{
    logs: Array<{
      message: string;
      level: string;
      timestamp: string;
      node_id?: string;
      component?: string;
    }>;
  }> {
    const response = await this.httpClient.get(`/api/v1/logs/${sessionId}`);
    return response.data;
  }

  /**
   * Cancels a running execution
   */
  async cancelExecution(sessionId: string): Promise<void> {
    await this.httpClient.post(`/api/v1/cancel/${sessionId}`);
  }

  /**
   * Gets all available components
   */
  async getComponents(): Promise<Record<string, LangflowComponent>> {
    const response = await this.httpClient.get('/api/v1/all');
    return response.data;
  }

  /**
   * Gets components by category
   */
  async getComponentsByCategory(category: string): Promise<Record<string, LangflowComponent>> {
    const response = await this.httpClient.get(`/api/v1/all?category=${category}`);
    return response.data;
  }

  /**
   * Uploads a file to Langflow
   */
  async uploadFile(file: Buffer | Blob, filename: string): Promise<{ file_path: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);

    const response = await this.httpClient.post('/api/v1/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }

  /**
   * Downloads a file from Langflow
   */
  async downloadFile(filePath: string): Promise<Buffer> {
    const response = await this.httpClient.get(`/api/v1/files/${filePath}`, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  }

  /**
   * Gets flow execution history
   */
  async getExecutionHistory(flowId: string, limit = 50): Promise<Array<{
    session_id: string;
    timestamp: string;
    status: string;
    inputs: any;
    outputs?: any;
    error?: string;
  }>> {
    const response = await this.httpClient.get(`/api/v1/flows/${flowId}/history`, {
      params: { limit }
    });
    return response.data;
  }

  /**
   * Exports a flow to JSON
   */
  async exportFlow(flowId: string): Promise<any> {
    const response = await this.httpClient.get(`/api/v1/flows/${flowId}/export`);
    return response.data;
  }

  /**
   * Imports a flow from JSON
   */
  async importFlow(flowData: any): Promise<LangflowFlow> {
    const response = await this.httpClient.post('/api/v1/flows/import', flowData);
    return response.data;
  }

  /**
   * Gets flow statistics
   */
  async getFlowStats(flowId: string): Promise<{
    total_executions: number;
    successful_executions: number;
    failed_executions: number;
    average_execution_time: number;
    last_execution: string;
  }> {
    const response = await this.httpClient.get(`/api/v1/flows/${flowId}/stats`);
    return response.data;
  }

  /**
   * Creates a webhook for flow events
   */
  async createWebhook(flowId: string, webhookUrl: string, events: string[]): Promise<{
    webhook_id: string;
    url: string;
    events: string[];
    created_at: string;
  }> {
    const response = await this.httpClient.post(`/api/v1/flows/${flowId}/webhooks`, {
      url: webhookUrl,
      events
    });
    return response.data;
  }

  /**
   * Deletes a webhook
   */
  async deleteWebhook(flowId: string, webhookId: string): Promise<void> {
    await this.httpClient.delete(`/api/v1/flows/${flowId}/webhooks/${webhookId}`);
  }

  /**
   * Executes a custom request to Langflow API
   */
  async customRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpClient.request({
      method,
      url: endpoint,
      data,
      ...config
    });
    return response.data;
  }
}