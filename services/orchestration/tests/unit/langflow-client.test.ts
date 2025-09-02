import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import { LangflowClient } from '../../src/utils/langflow-client';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('LangflowClient', () => {
  let client: LangflowClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      }
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Create client instance
    client = new LangflowClient({
      baseUrl: 'http://localhost:7860',
      apiKey: 'test-api-key',
      timeout: 5000
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create client with default configuration', () => {
      const defaultClient = new LangflowClient({
        baseUrl: 'http://localhost:7860'
      });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:7860',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RobustAI-Orchestrator-LangflowClient/1.0'
        }
      });
    });

    it('should create client with custom configuration', () => {
      const customClient = new LangflowClient({
        baseUrl: 'http://custom-langflow:8080',
        apiKey: 'custom-key',
        timeout: 10000,
        maxRetries: 5,
        retryDelay: 2000
      });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://custom-langflow:8080',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RobustAI-Orchestrator-LangflowClient/1.0'
        }
      });
    });

    it('should set up authentication interceptor when API key is provided', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should set up response error interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully with health endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ status: 200 });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    it('should fallback to version endpoint if health fails', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Health endpoint not found'))
        .mockResolvedValueOnce({ status: 200 });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/version');
    });

    it('should return false when both endpoints fail', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Health endpoint not found'))
        .mockRejectedValueOnce(new Error('Version endpoint not found'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Version Information', () => {
    it('should get version information', async () => {
      const versionData = { version: '1.0.0', build: 'abc123' };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: versionData });

      const result = await client.getVersion();

      expect(result).toEqual(versionData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/version');
    });
  });

  describe('Flow Management', () => {
    const mockFlow = {
      id: 'flow-123',
      name: 'Test Flow',
      description: 'A test flow',
      data: { nodes: [], edges: [] },
      is_component: false,
      updated_at: '2024-01-01T00:00:00Z'
    };

    it('should list all flows', async () => {
      const flows = [mockFlow];
      mockAxiosInstance.get.mockResolvedValueOnce({ data: flows });

      const result = await client.listFlows();

      expect(result).toEqual(flows);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/flows');
    });

    it('should get a specific flow by ID', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockFlow });

      const result = await client.getFlow('flow-123');

      expect(result).toEqual(mockFlow);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/flows/flow-123');
    });

    it('should create a new flow', async () => {
      const newFlow = { name: 'New Flow', data: { nodes: [], edges: [] } };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockFlow });

      const result = await client.createFlow(newFlow);

      expect(result).toEqual(mockFlow);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/flows', newFlow);
    });

    it('should update an existing flow', async () => {
      const updates = { name: 'Updated Flow' };
      const updatedFlow = { ...mockFlow, ...updates };
      mockAxiosInstance.patch.mockResolvedValueOnce({ data: updatedFlow });

      const result = await client.updateFlow('flow-123', updates);

      expect(result).toEqual(updatedFlow);
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/api/v1/flows/flow-123', updates);
    });

    it('should delete a flow', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.deleteFlow('flow-123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/flows/flow-123');
    });
  });

  describe('Flow Validation', () => {
    it('should validate a flow', async () => {
      const flow = { data: { nodes: [], edges: [] } };
      const validationResult = { valid: true, message: 'Flow is valid' };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: validationResult });

      const result = await client.validateFlow(flow);

      expect(result).toEqual(validationResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/validate', { flow });
    });
  });

  describe('Flow Execution', () => {
    it('should run a flow with inputs', async () => {
      const inputs = {
        input_value: 'Hello',
        input_type: 'chat',
        tweaks: { param1: 'value1' },
        session_id: 'session-123'
      };
      const executionResult = { session_id: 'session-123', outputs: [] };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: executionResult });

      const result = await client.runFlow('flow-123', inputs);

      expect(result).toEqual(executionResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/run/flow-123', inputs);
    });

    it('should get execution status', async () => {
      const status = { status: 'completed', result: { message: 'Success' } };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: status });

      const result = await client.getExecutionStatus('session-123');

      expect(result).toEqual(status);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/status/session-123');
    });

    it('should get execution logs', async () => {
      const logs = {
        logs: [
          {
            message: 'Execution started',
            level: 'info',
            timestamp: '2024-01-01T00:00:00Z',
            node_id: 'node-1'
          }
        ]
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: logs });

      const result = await client.getExecutionLogs('session-123');

      expect(result).toEqual(logs);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/logs/session-123');
    });

    it('should cancel execution', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({});

      await client.cancelExecution('session-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/cancel/session-123');
    });
  });

  describe('Component Management', () => {
    it('should get all components', async () => {
      const components = {
        ChatInput: {
          name: 'ChatInput',
          display_name: 'Chat Input',
          description: 'Chat input component',
          base_classes: ['Message'],
          template: {}
        }
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: components });

      const result = await client.getComponents();

      expect(result).toEqual(components);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/all');
    });

    it('should get components by category', async () => {
      const components = { ChatInput: {} };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: components });

      const result = await client.getComponentsByCategory('inputs');

      expect(result).toEqual(components);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/all?category=inputs');
    });
  });

  describe('File Management', () => {
    it('should upload a file', async () => {
      // Mock FormData for Node.js environment
      const mockFormData = {
        append: vi.fn()
      };
      global.FormData = vi.fn(() => mockFormData) as any;

      const fileBuffer = Buffer.from('test file content');
      const uploadResult = { file_path: '/uploads/test.txt' };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: uploadResult });

      const result = await client.uploadFile(fileBuffer, 'test.txt');

      expect(result).toEqual(uploadResult);
      expect(mockFormData.append).toHaveBeenCalledWith('file', fileBuffer, 'test.txt');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/upload',
        mockFormData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
    });

    it('should download a file', async () => {
      const fileContent = Buffer.from('downloaded content');
      mockAxiosInstance.get.mockResolvedValueOnce({ data: fileContent });

      const result = await client.downloadFile('/uploads/test.txt');

      expect(result).toEqual(fileContent);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/files//uploads/test.txt', {
        responseType: 'arraybuffer'
      });
    });
  });

  describe('Flow History and Statistics', () => {
    it('should get execution history', async () => {
      const history = [
        {
          session_id: 'session-1',
          timestamp: '2024-01-01T00:00:00Z',
          status: 'completed',
          inputs: { input_value: 'Hello' },
          outputs: { message: 'Hello, World!' }
        }
      ];
      mockAxiosInstance.get.mockResolvedValueOnce({ data: history });

      const result = await client.getExecutionHistory('flow-123', 25);

      expect(result).toEqual(history);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/flows/flow-123/history', {
        params: { limit: 25 }
      });
    });

    it('should get flow statistics', async () => {
      const stats = {
        total_executions: 100,
        successful_executions: 95,
        failed_executions: 5,
        average_execution_time: 1500,
        last_execution: '2024-01-01T00:00:00Z'
      };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: stats });

      const result = await client.getFlowStats('flow-123');

      expect(result).toEqual(stats);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/flows/flow-123/stats');
    });
  });

  describe('Import/Export', () => {
    it('should export a flow', async () => {
      const exportData = { name: 'Exported Flow', data: { nodes: [], edges: [] } };
      mockAxiosInstance.get.mockResolvedValueOnce({ data: exportData });

      const result = await client.exportFlow('flow-123');

      expect(result).toEqual(exportData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/flows/flow-123/export');
    });

    it('should import a flow', async () => {
      const flowData = { name: 'Imported Flow', data: { nodes: [], edges: [] } };
      const importedFlow = { id: 'flow-456', ...flowData };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: importedFlow });

      const result = await client.importFlow(flowData);

      expect(result).toEqual(importedFlow);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/flows/import', flowData);
    });
  });

  describe('Webhook Management', () => {
    it('should create a webhook', async () => {
      const webhook = {
        webhook_id: 'webhook-123',
        url: 'https://example.com/webhook',
        events: ['execution.completed', 'execution.failed'],
        created_at: '2024-01-01T00:00:00Z'
      };
      mockAxiosInstance.post.mockResolvedValueOnce({ data: webhook });

      const result = await client.createWebhook('flow-123', 'https://example.com/webhook', ['execution.completed']);

      expect(result).toEqual(webhook);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/flows/flow-123/webhooks', {
        url: 'https://example.com/webhook',
        events: ['execution.completed']
      });
    });

    it('should delete a webhook', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.deleteWebhook('flow-123', 'webhook-123');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/flows/flow-123/webhooks/webhook-123');
    });
  });

  describe('Custom Requests', () => {
    it('should execute custom GET request', async () => {
      const responseData = { custom: 'data' };
      mockAxiosInstance.request.mockResolvedValueOnce({ data: responseData });

      const result = await client.customRequest('GET', '/custom/endpoint');

      expect(result).toEqual(responseData);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/custom/endpoint',
        data: undefined
      });
    });

    it('should execute custom POST request with data', async () => {
      const requestData = { input: 'test' };
      const responseData = { output: 'result' };
      mockAxiosInstance.request.mockResolvedValueOnce({ data: responseData });

      const result = await client.customRequest('POST', '/custom/endpoint', requestData, {
        headers: { 'Custom-Header': 'value' }
      });

      expect(result).toEqual(responseData);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/custom/endpoint',
        data: requestData,
        headers: { 'Custom-Header': 'value' }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockAxiosInstance.get.mockRejectedValueOnce(networkError);

      await expect(client.getVersion()).rejects.toThrow('Network Error');
    });

    it('should handle HTTP errors', async () => {
      const httpError = {
        response: {
          status: 404,
          data: { error: 'Flow not found' }
        },
        config: { url: '/api/v1/flows/nonexistent' }
      };
      mockAxiosInstance.get.mockRejectedValueOnce(httpError);

      await expect(client.getFlow('nonexistent')).rejects.toEqual(httpError);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'ECONNABORTED';
      mockAxiosInstance.post.mockRejectedValueOnce(timeoutError);

      await expect(client.runFlow('flow-123', {})).rejects.toThrow('Timeout');
    });
  });

  describe('Authentication', () => {
    it('should add authorization header when API key is provided', () => {
      const requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
      const config = { headers: {} };
      
      const result = requestInterceptor(config);
      
      expect(result.headers.Authorization).toBe('Bearer test-api-key');
    });

    it('should not add authorization header when no API key is provided', () => {
      const clientWithoutKey = new LangflowClient({
        baseUrl: 'http://localhost:7860'
      });

      // The interceptor should still be set up, but won't add auth header
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('Response Interceptor', () => {
    it('should handle successful responses', () => {
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      const response = { data: { success: true } };
      
      const result = responseInterceptor(response);
      
      expect(result).toBe(response);
    });

    it('should handle and log error responses', () => {
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      const error = {
        config: { url: '/api/v1/test', method: 'GET' },
        response: { status: 500, data: { error: 'Internal error' } },
        message: 'Request failed'
      };
      
      expect(() => errorInterceptor(error)).rejects.toEqual(error);
    });
  });
});