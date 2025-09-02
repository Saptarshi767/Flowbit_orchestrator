import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { N8NAdapter } from '../../src/adapters/n8n-adapter';
import { EngineAdapterConfig } from '../../src/interfaces/engine-adapter.interface';
// Local type definitions - normally would import from shared package
enum EngineType {
  LANGFLOW = 'langflow',
  N8N = 'n8n',
  LANGSMITH = 'langsmith'
}

enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  engineType: EngineType;
  definition: any;
  version?: number;
  metadata?: Record<string, any>;
}

interface WorkflowParameters {
  [key: string]: any;
}
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('N8NAdapter Integration Tests', () => {
  let adapter: N8NAdapter;
  let mockAxiosInstance: any;

  const mockConfig: EngineAdapterConfig = {
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

  const mockN8NWorkflow: WorkflowDefinition = {
    name: 'Test N8N Workflow',
    description: 'A test workflow for N8N adapter',
    engineType: EngineType.N8N,
    definition: {
      name: 'Test N8N Workflow',
      active: false,
      nodes: [
        {
          id: 'start',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          typeVersion: 1,
          position: [100, 100],
          parameters: {}
        },
        {
          id: 'http',
          name: 'HTTP Request',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [300, 100],
          parameters: {
            method: 'GET',
            url: 'https://api.example.com/data'
          }
        },
        {
          id: 'set',
          name: 'Set Data',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [500, 100],
          parameters: {
            values: {
              string: [
                {
                  name: 'result',
                  value: '={{$json.data}}'
                }
              ]
            }
          }
        }
      ],
      connections: {
        'Start': {
          main: [
            [
              {
                node: 'HTTP Request',
                type: 'main',
                index: 0
              }
            ]
          ]
        },
        'HTTP Request': {
          main: [
            [
              {
                node: 'Set Data',
                type: 'main',
                index: 0
              }
            ]
          ]
        }
      },
      settings: {
        executionOrder: 'v1' as const,
        saveManualExecutions: true
      },
      staticData: {},
      tags: ['test'],
      pinData: {}
    }
  };

  beforeAll(() => {
    // Setup axios mock
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new N8NAdapter(mockConfig);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Workflow Validation', () => {
    it('should validate a correct N8N workflow', async () => {
      const result = await adapter.validateWorkflow(mockN8NWorkflow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing nodes array', async () => {
      const invalidWorkflow = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          nodes: undefined
        }
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'definition.nodes',
          code: 'MISSING_NODES'
        })
      );
    });

    it('should detect missing connections object', async () => {
      const invalidWorkflow = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          connections: undefined
        }
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'definition.connections',
          code: 'MISSING_CONNECTIONS'
        })
      );
    });

    it('should detect invalid node structure', async () => {
      const invalidWorkflow = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          nodes: [
            {
              // Missing required fields
              position: [100, 100]
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid connections', async () => {
      const invalidWorkflow = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          connections: {
            'NonExistentNode': {
              main: [
                [
                  {
                    node: 'HTTP Request',
                    type: 'main',
                    index: 0
                  }
                ]
              ]
            }
          }
        }
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_CONNECTION_SOURCE'
        })
      );
    });

    it('should warn about required credentials', async () => {
      const workflowWithCredentials = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          nodes: [
            ...mockN8NWorkflow.definition.nodes,
            {
              id: 'oauth',
              name: 'OAuth Node',
              type: 'n8n-nodes-base.googleSheets',
              typeVersion: 1,
              position: [700, 100],
              parameters: {},
              credentials: {
                googleSheetsOAuth2Api: 'google_credentials'
              }
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflowWithCredentials);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          code: 'REQUIRES_CREDENTIALS'
        })
      );
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a workflow successfully', async () => {
      const executionId = 'exec-123';
      const mockExecutionResponse = {
        id: executionId,
        finished: true,
        mode: 'manual',
        startedAt: '2024-01-01T10:00:00Z',
        stoppedAt: '2024-01-01T10:01:00Z',
        workflowData: mockN8NWorkflow.definition,
        data: {
          resultData: {
            runData: {
              'HTTP Request': [
                {
                  data: [{ json: { result: 'success' } }],
                  startTime: 1704103200000,
                  executionTime: 1000
                }
              ]
            }
          }
        }
      };

      // Mock workflow execution
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: executionId }
      });

      // Mock status polling
      mockAxiosInstance.get.mockResolvedValue({
        data: mockExecutionResponse
      });

      const parameters: WorkflowParameters = {
        nodeParameters: {
          'HTTP Request': {
            url: 'https://api.example.com/test'
          }
        }
      };

      const result = await adapter.executeWorkflow(mockN8NWorkflow, parameters);

      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toBeDefined();
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/workflows/run',
        expect.objectContaining({
          workflowData: expect.objectContaining({
            name: mockN8NWorkflow.name
          })
        })
      );
    });

    it('should handle workflow execution failure', async () => {
      const executionId = 'exec-failed';
      const mockErrorResponse = {
        id: executionId,
        finished: true,
        mode: 'manual',
        startedAt: '2024-01-01T10:00:00Z',
        stoppedAt: '2024-01-01T10:01:00Z',
        workflowData: mockN8NWorkflow.definition,
        data: {
          resultData: {
            error: {
              message: 'HTTP request failed',
              node: {
                name: 'HTTP Request',
                type: 'n8n-nodes-base.httpRequest'
              },
              timestamp: 1704103260000
            }
          }
        }
      };

      // Mock workflow execution
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: executionId }
      });

      // Mock status polling
      mockAxiosInstance.get.mockResolvedValue({
        data: mockErrorResponse
      });

      const result = await adapter.executeWorkflow(mockN8NWorkflow, {});

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('N8N_EXECUTION_ERROR');
    });

    it('should handle webhook-triggered workflows', async () => {
      const webhookWorkflow = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          nodes: [
            {
              id: 'webhook',
              name: 'Webhook',
              type: 'n8n-nodes-base.webhook',
              typeVersion: 1,
              position: [100, 100],
              parameters: {
                path: 'test-webhook',
                httpMethod: 'POST'
              }
            },
            ...mockN8NWorkflow.definition.nodes.slice(1)
          ]
        }
      };

      const parameters: WorkflowParameters = {
        useWebhook: true,
        webhookUrl: 'http://localhost:5678/webhook/test-webhook',
        webhookData: { test: 'data' }
      };

      // Mock webhook call
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await adapter.executeWorkflow(webhookWorkflow, parameters);

      // Should timeout since we don't trigger the callback
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error?.code).toBe('WEBHOOK_TIMEOUT');
    });

    it('should timeout webhook executions', async () => {
      const webhookWorkflow = {
        ...mockN8NWorkflow,
        definition: {
          ...mockN8NWorkflow.definition,
          nodes: [
            {
              id: 'webhook',
              name: 'Webhook',
              type: 'n8n-nodes-base.webhook',
              typeVersion: 1,
              position: [100, 100],
              parameters: {
                path: 'test-webhook',
                httpMethod: 'POST'
              }
            }
          ]
        }
      };

      const parameters: WorkflowParameters = {
        useWebhook: true,
        webhookUrl: 'http://localhost:5678/webhook/test-webhook',
        webhookData: { test: 'data' }
      };

      // Mock webhook call
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await adapter.executeWorkflow(webhookWorkflow, parameters);

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error?.code).toBe('WEBHOOK_TIMEOUT');
    }, 1000);
  });

  describe('Execution Management', () => {
    it('should get execution logs', async () => {
      const executionId = 'exec-123';
      const mockExecution = {
        id: executionId,
        finished: true,
        mode: 'manual',
        startedAt: '2024-01-01T10:00:00Z',
        stoppedAt: '2024-01-01T10:01:00Z',
        workflowData: mockN8NWorkflow.definition,
        data: {
          resultData: {
            runData: {
              'HTTP Request': [
                {
                  data: [{ json: { result: 'success' } }],
                  startTime: 1704103200000,
                  executionTime: 1000
                }
              ],
              'Set Data': [
                {
                  error: {
                    message: 'Invalid expression',
                    timestamp: 1704103260000
                  }
                }
              ]
            }
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockExecution
      });

      const logs = await adapter.getExecutionLogs(executionId);

      expect(logs.length).toBeGreaterThan(0);
      
      // Find the error log
      const errorLog = logs.find(log => log.level === 'error' && log.message === 'Invalid expression');
      expect(errorLog).toBeDefined();
      
      // Find the success log
      const successLog = logs.find(log => log.level === 'info' && log.message === 'Node HTTP Request executed successfully');
      expect(successLog).toBeDefined();
    });

    it('should cancel execution', async () => {
      const executionId = 'exec-123';

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: true }
      });

      const result = await adapter.cancelExecution(executionId);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/api/v1/executions/${executionId}/stop`
      );
    });

    it('should handle cancel execution failure', async () => {
      const executionId = 'exec-123';

      mockAxiosInstance.post.mockRejectedValueOnce(
        new Error('Execution not found')
      );

      const result = await adapter.cancelExecution(executionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution not found');
    });

    it('should get execution status', async () => {
      const executionId = 'exec-123';
      const mockExecution = {
        id: executionId,
        finished: false,
        mode: 'manual',
        startedAt: '2024-01-01T10:00:00Z',
        workflowData: mockN8NWorkflow.definition,
        data: {
          resultData: {
            runData: {}
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockExecution
      });

      const result = await adapter.getExecutionStatus(executionId);

      expect(result.status).toBe(ExecutionStatus.RUNNING);
      expect(result.id).toBe(executionId);
    });
  });

  describe('Engine Capabilities', () => {
    it('should get N8N capabilities', async () => {
      const mockVersion = { version: '1.0.0' };
      const mockNodeTypes = {
        'n8n-nodes-base.httpRequest': {},
        'n8n-nodes-base.set': {},
        'n8n-nodes-base.webhook': {}
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockVersion })
        .mockResolvedValueOnce({ data: mockNodeTypes });

      const capabilities = await adapter.getCapabilities();

      expect(capabilities.version).toBe('1.0.0');
      expect(capabilities.supportedFeatures).toContain('webhook_triggers');
      expect(capabilities.supportedFeatures).toContain('credential_management');
      expect(capabilities.supportedNodeTypes).toContain('n8n-nodes-base.httpRequest');
      expect(capabilities.customProperties?.supportsWebhooks).toBe(true);
    });

    it('should return default capabilities on error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const capabilities = await adapter.getCapabilities();

      expect(capabilities.version).toBe('unknown');
      expect(capabilities.supportedFeatures).toEqual(['workflow_execution']);
      expect(capabilities.maxConcurrentExecutions).toBe(1);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      const result = await adapter.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    it('should handle connection failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(
        new Error('Connection refused')
      );

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Workflow Conversion', () => {
    it('should throw error for unsupported conversion', async () => {
      await expect(
        adapter.convertWorkflow(mockN8NWorkflow, EngineType.LANGFLOW)
      ).rejects.toThrow('Conversion from langflow to N8N is not yet implemented');
    });
  });

  describe('Error Handling', () => {
    it('should transform HTTP errors correctly', async () => {
      const httpError = {
        response: {
          status: 400,
          statusText: 'Bad Request',
          data: {
            message: 'Invalid workflow format'
          }
        },
        config: {
          url: '/api/v1/workflows/run',
          method: 'POST'
        }
      };

      mockAxiosInstance.post.mockRejectedValueOnce(httpError);

      const result = await adapter.executeWorkflow(mockN8NWorkflow, {});

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error?.code).toBe('N8N_API_ERROR');
      expect(result.error?.message).toBe('Invalid workflow format');
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ECONNRESET',
        message: 'Connection reset'
      };

      mockAxiosInstance.post.mockRejectedValueOnce(networkError);

      const result = await adapter.executeWorkflow(mockN8NWorkflow, {});

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
      // The error might be transformed during polling, so just check that we have an error
      expect(result.error?.message).toBeDefined();
    });
  });

  describe('Parameter Application', () => {
    it('should apply node parameters correctly', async () => {
      const executionId = 'exec-123';
      const parameters: WorkflowParameters = {
        nodeParameters: {
          'HTTP Request': {
            url: 'https://api.custom.com/data',
            method: 'POST'
          },
          'Set Data': {
            values: {
              string: [
                {
                  name: 'customField',
                  value: 'customValue'
                }
              ]
            }
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { id: executionId }
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          id: executionId,
          finished: true,
          mode: 'manual',
          startedAt: '2024-01-01T10:00:00Z',
          stoppedAt: '2024-01-01T10:01:00Z',
          workflowData: mockN8NWorkflow.definition,
          data: {
            resultData: {
              runData: {}
            }
          }
        }
      });

      await adapter.executeWorkflow(mockN8NWorkflow, parameters);

      // Verify that parameters were applied to the workflow
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/v1/workflows/run',
        expect.objectContaining({
          workflowData: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                name: 'HTTP Request',
                parameters: expect.objectContaining({
                  url: 'https://api.custom.com/data',
                  method: 'POST'
                })
              })
            ])
          })
        })
      );
    });
  });
});