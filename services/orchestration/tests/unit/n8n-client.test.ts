import { describe, it, expect, beforeEach, vi } from 'vitest';
import { N8NClient, N8NClientConfig } from '../../src/utils/n8n-client';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('N8NClient Unit Tests', () => {
  let client: N8NClient;
  let mockAxiosInstance: any;

  const mockConfig: N8NClientConfig = {
    baseUrl: 'http://localhost:5678',
    apiKey: 'test-api-key',
    timeout: 30000,
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn()
        },
        response: {
          use: vi.fn()
        }
      }
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockAxiosInstance);
    client = new N8NClient(mockConfig);
  });

  describe('Authentication', () => {
    it('should use API key authentication', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: mockConfig.baseUrl,
          timeout: mockConfig.timeout,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'RobustAI-Orchestrator-N8N/1.0'
          })
        })
      );
    });

    it('should handle username/password authentication', async () => {
      const configWithCredentials: N8NClientConfig = {
        ...mockConfig,
        apiKey: undefined,
        username: 'test@example.com',
        password: 'password123'
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          data: {
            token: 'auth-token-123'
          }
        }
      });

      const clientWithAuth = new N8NClient(configWithCredentials);

      // Trigger authentication by making a request
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      await clientWithAuth.testConnection();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        {
          email: 'test@example.com',
          password: 'password123'
        }
      );
    });

    it('should handle authentication failure', async () => {
      const configWithCredentials: N8NClientConfig = {
        ...mockConfig,
        apiKey: undefined,
        username: 'test@example.com',
        password: 'wrongpassword'
      };

      mockAxiosInstance.post.mockRejectedValueOnce(
        new Error('Invalid credentials')
      );

      expect(() => new N8NClient(configWithCredentials)).not.toThrow();
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/version');
    });

    it('should handle connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Version and Node Types', () => {
    it('should get version information', async () => {
      const mockVersion = { version: '1.0.0', build: '123' };
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockVersion
      });

      const version = await client.getVersion();

      expect(version).toEqual(mockVersion);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/version');
    });

    it('should get node types', async () => {
      const mockNodeTypes = {
        'n8n-nodes-base.httpRequest': {
          displayName: 'HTTP Request',
          description: 'Makes HTTP requests'
        },
        'n8n-nodes-base.set': {
          displayName: 'Set',
          description: 'Sets data'
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockNodeTypes
      });

      const nodeTypes = await client.getNodeTypes();

      expect(nodeTypes).toEqual(mockNodeTypes);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/node-types');
    });
  });

  describe('Workflow Management', () => {
    const mockWorkflow = {
      name: 'Test Workflow',
      active: false,
      nodes: [],
      connections: {},
      settings: {},
      staticData: {},
      tags: [],
      pinData: {}
    };

    it('should create workflow', async () => {
      const createdWorkflow = { id: 'wf-123', ...mockWorkflow };
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: createdWorkflow
      });

      const result = await client.createWorkflow(mockWorkflow);

      expect(result).toEqual(createdWorkflow);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/workflows',
        mockWorkflow
      );
    });

    it('should update workflow', async () => {
      const workflowId = 'wf-123';
      const updatedWorkflow = { id: workflowId, ...mockWorkflow, name: 'Updated' };
      
      mockAxiosInstance.put.mockResolvedValueOnce({
        data: updatedWorkflow
      });

      const result = await client.updateWorkflow(workflowId, mockWorkflow);

      expect(result).toEqual(updatedWorkflow);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}`,
        mockWorkflow
      );
    });

    it('should get workflow', async () => {
      const workflowId = 'wf-123';
      const workflow = { id: workflowId, ...mockWorkflow };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: workflow
      });

      const result = await client.getWorkflow(workflowId);

      expect(result).toEqual(workflow);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}`
      );
    });

    it('should delete workflow', async () => {
      const workflowId = 'wf-123';
      
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.deleteWorkflow(workflowId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}`
      );
    });

    it('should activate workflow', async () => {
      const workflowId = 'wf-123';
      const activatedWorkflow = { id: workflowId, active: true };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: activatedWorkflow
      });

      const result = await client.activateWorkflow(workflowId);

      expect(result).toEqual(activatedWorkflow);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}/activate`
      );
    });

    it('should deactivate workflow', async () => {
      const workflowId = 'wf-123';
      const deactivatedWorkflow = { id: workflowId, active: false };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: deactivatedWorkflow
      });

      const result = await client.deactivateWorkflow(workflowId);

      expect(result).toEqual(deactivatedWorkflow);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}/deactivate`
      );
    });
  });

  describe('Execution Management', () => {
    it('should execute workflow', async () => {
      const workflowId = 'wf-123';
      const executionData = { input: 'test' };
      const executionResult = { id: 'exec-123', status: 'running' };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: executionResult
      });

      const result = await client.executeWorkflow(workflowId, executionData);

      expect(result).toEqual(executionResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}/execute`,
        executionData
      );
    });

    it('should get execution', async () => {
      const executionId = 'exec-123';
      const execution = {
        id: executionId,
        finished: true,
        mode: 'manual',
        startedAt: '2024-01-01T10:00:00Z',
        data: {}
      };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: execution
      });

      const result = await client.getExecution(executionId);

      expect(result).toEqual(execution);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/api/v1/executions/${executionId}`
      );
    });

    it('should get executions with filters', async () => {
      const workflowId = 'wf-123';
      const limit = 10;
      const executions = [
        { id: 'exec-1', workflowId },
        { id: 'exec-2', workflowId }
      ];
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: executions }
      });

      const result = await client.getExecutions(workflowId, limit);

      expect(result).toEqual(executions);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/v1/executions',
        {
          params: {
            workflowId,
            limit
          }
        }
      );
    });

    it('should stop execution', async () => {
      const executionId = 'exec-123';
      const stopResult = { success: true };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: stopResult
      });

      const result = await client.stopExecution(executionId);

      expect(result).toEqual(stopResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/executions/${executionId}/stop`
      );
    });

    it('should delete execution', async () => {
      const executionId = 'exec-123';
      
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.deleteExecution(executionId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/api/v1/executions/${executionId}`
      );
    });
  });

  describe('Credential Management', () => {
    const mockCredential = {
      name: 'Test Credential',
      type: 'httpBasicAuth',
      data: {
        user: 'testuser',
        password: 'testpass'
      },
      nodesAccess: [
        { nodeType: 'n8n-nodes-base.httpRequest' }
      ]
    };

    it('should get credentials', async () => {
      const credentials = [
        { id: 'cred-1', ...mockCredential },
        { id: 'cred-2', ...mockCredential }
      ];
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: credentials }
      });

      const result = await client.getCredentials();

      expect(result).toEqual(credentials);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/credentials');
    });

    it('should create credential', async () => {
      const createdCredential = { id: 'cred-123', ...mockCredential };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: createdCredential
      });

      const result = await client.createCredential(mockCredential);

      expect(result).toEqual(createdCredential);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/credentials',
        mockCredential
      );
    });

    it('should update credential', async () => {
      const credentialId = 'cred-123';
      const updatedCredential = { id: credentialId, ...mockCredential };
      
      mockAxiosInstance.put.mockResolvedValueOnce({
        data: updatedCredential
      });

      const result = await client.updateCredential(credentialId, mockCredential);

      expect(result).toEqual(updatedCredential);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        `/api/v1/credentials/${credentialId}`,
        mockCredential
      );
    });

    it('should delete credential', async () => {
      const credentialId = 'cred-123';
      
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.deleteCredential(credentialId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/api/v1/credentials/${credentialId}`
      );
    });

    it('should test credential', async () => {
      const credentialId = 'cred-123';
      const testResult = { success: true };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: testResult
      });

      const result = await client.testCredential(credentialId);

      expect(result).toEqual(testResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/credentials/${credentialId}/test`
      );
    });
  });

  describe('Import/Export', () => {
    it('should export workflow', async () => {
      const workflowId = 'wf-123';
      const exportData = {
        name: 'Test Workflow',
        nodes: [],
        connections: {},
        active: false,
        settings: {},
        staticData: {},
        tags: [],
        pinData: {},
        versionId: 'v1',
        meta: {
          instanceId: 'instance-123'
        }
      };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: exportData
      });

      const result = await client.exportWorkflow(workflowId);

      expect(result).toEqual(exportData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}/export`
      );
    });

    it('should import workflow', async () => {
      const workflowData = {
        name: 'Imported Workflow',
        nodes: [],
        connections: {},
        active: false,
        settings: {},
        staticData: {},
        tags: [],
        pinData: {},
        versionId: 'v1',
        meta: {
          instanceId: 'instance-123'
        }
      };
      
      const importResult = { id: 'wf-imported', ...workflowData };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: importResult
      });

      const result = await client.importWorkflow(workflowData);

      expect(result).toEqual(importResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/workflows/import',
        workflowData
      );
    });
  });

  describe('Webhook Management', () => {
    it('should register webhook', async () => {
      const registration = {
        workflowId: 'wf-123',
        webhookPath: 'test-webhook',
        method: 'POST',
        node: 'Webhook',
        webhookId: 'webhook-123'
      };
      
      const webhookResult = { id: 'webhook-reg-123', ...registration };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: webhookResult
      });

      const result = await client.registerWebhook(registration);

      expect(result).toEqual(webhookResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/webhooks',
        registration
      );
    });

    it('should unregister webhook', async () => {
      const webhookId = 'webhook-123';
      
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.unregisterWebhook(webhookId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/api/v1/webhooks/${webhookId}`
      );
    });

    it('should get webhooks', async () => {
      const webhooks = [
        { id: 'webhook-1', path: 'webhook1' },
        { id: 'webhook-2', path: 'webhook2' }
      ];
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: webhooks }
      });

      const result = await client.getWebhooks();

      expect(result).toEqual(webhooks);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/webhooks');
    });
  });

  describe('Validation and Stats', () => {
    it('should validate workflow', async () => {
      const workflow = { name: 'Test', nodes: [], connections: {} };
      const validationResult = { valid: true, errors: [] };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: validationResult
      });

      const result = await client.validateWorkflow(workflow);

      expect(result).toEqual(validationResult);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/workflows/validate',
        { workflow }
      );
    });

    it('should get execution stats', async () => {
      const workflowId = 'wf-123';
      const timeRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31')
      };
      const stats = {
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5
      };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: stats
      });

      const result = await client.getExecutionStats(workflowId, timeRange);

      expect(result).toEqual(stats);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/api/v1/workflows/${workflowId}/stats`,
        {
          params: {
            from: timeRange.from.toISOString(),
            to: timeRange.to.toISOString()
          }
        }
      );
    });

    it('should get health status', async () => {
      const healthStatus = { status: 'healthy', uptime: 12345 };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: healthStatus
      });

      const result = await client.getHealthStatus();

      expect(result).toEqual(healthStatus);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/health');
    });

    it('should get metrics', async () => {
      const metrics = {
        activeExecutions: 5,
        totalWorkflows: 25,
        systemLoad: 0.75
      };
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: metrics
      });

      const result = await client.getMetrics();

      expect(result).toEqual(metrics);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/metrics');
    });
  });

  describe('Tag Management', () => {
    it('should get tags', async () => {
      const tags = ['automation', 'data-processing', 'api'];
      
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: tags }
      });

      const result = await client.getTags();

      expect(result).toEqual(tags);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/tags');
    });

    it('should create tag', async () => {
      const tagName = 'new-tag';
      const createdTag = { id: 'tag-123', name: tagName };
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: createdTag
      });

      const result = await client.createTag(tagName);

      expect(result).toEqual(createdTag);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/tags',
        { name: tagName }
      );
    });

    it('should delete tag', async () => {
      const tagId = 'tag-123';
      
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      await client.deleteTag(tagId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/api/v1/tags/${tagId}`
      );
    });
  });
});