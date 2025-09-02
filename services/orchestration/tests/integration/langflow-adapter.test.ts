import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import { Server } from 'http';
import {
  WorkflowDefinition,
  WorkflowParameters,
  EngineType,
  ExecutionStatus
} from '@robust-ai-orchestrator/shared';
import { LangflowAdapter } from '../../src/adapters/langflow-adapter';
import { EngineAdapterConfig } from '../../src/interfaces/engine-adapter.interface';

describe('LangflowAdapter Integration Tests', () => {
  let mockServer: Server;
  let adapter: LangflowAdapter;
  let mockPort: number;
  let mockBaseUrl: string;

  // Mock Langflow server responses
  const mockFlowData = {
    id: 'test-flow-123',
    name: 'Test Flow',
    description: 'A test flow for integration testing',
    data: {
      nodes: [
        {
          id: 'node-1',
          type: 'ChatInput',
          position: { x: 100, y: 100 },
          data: {
            type: 'ChatInput',
            node: {
              template: {
                input_value: {
                  type: 'str',
                  required: true,
                  placeholder: 'Enter your message',
                  list: false,
                  show: true,
                  multiline: false
                }
              },
              description: 'Chat input component',
              base_classes: ['Message'],
              name: 'ChatInput',
              display_name: 'Chat Input'
            }
          }
        },
        {
          id: 'node-2',
          type: 'ChatOutput',
          position: { x: 400, y: 100 },
          data: {
            type: 'ChatOutput',
            node: {
              template: {
                input_value: {
                  type: 'str',
                  required: true,
                  placeholder: '',
                  list: false,
                  show: true,
                  multiline: false
                }
              },
              description: 'Chat output component',
              base_classes: ['Message'],
              name: 'ChatOutput',
              display_name: 'Chat Output'
            }
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input'
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    },
    tweaks: {}
  };

  const mockExecutionResponse = {
    session_id: 'exec-123',
    outputs: [
      {
        inputs: { input_value: 'Hello' },
        outputs: [
          {
            results: { message: 'Hello, World!' },
            artifacts: {},
            outputs: { output: 'Hello, World!' },
            logs: [
              {
                message: 'Processing input',
                type: 'info',
                timestamp: new Date().toISOString()
              }
            ]
          }
        ]
      }
    ]
  };

  beforeAll(async () => {
    // Find available port
    mockPort = 3001;
    mockBaseUrl = `http://localhost:${mockPort}`;

    // Create mock Langflow server
    const app = express();
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    // Version endpoint
    app.get('/api/v1/version', (req, res) => {
      res.json({ version: '1.0.0', build: 'test' });
    });

    // Validate endpoint
    app.post('/api/v1/validate', (req, res) => {
      const { flow } = req.body;
      if (!flow || !flow.data || !flow.data.nodes) {
        return res.status(400).json({ error: 'Invalid flow structure' });
      }
      res.json({ valid: true, message: 'Flow is valid' });
    });

    // Run flow endpoint
    app.post('/api/v1/run/:flowId', (req, res) => {
      const { flowId } = req.params;
      const { session_id } = req.body;
      
      if (flowId === 'test-flow-123' || flowId === 'Test Flow') {
        res.json({
          ...mockExecutionResponse,
          session_id: session_id || 'exec-123'
        });
      } else {
        res.status(404).json({ error: 'Flow not found' });
      }
    });

    // Status endpoint
    app.get('/api/v1/status/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      
      if (sessionId === 'exec-123') {
        res.json({
          status: 'completed',
          result: { message: 'Hello, World!' }
        });
      } else if (sessionId === 'exec-running') {
        res.json({
          status: 'running'
        });
      } else if (sessionId === 'exec-failed') {
        res.json({
          status: 'error',
          error: 'Execution failed'
        });
      } else {
        res.status(404).json({ error: 'Execution not found' });
      }
    });

    // Logs endpoint
    app.get('/api/v1/logs/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      
      if (sessionId === 'exec-123') {
        res.json({
          logs: [
            {
              message: 'Starting execution',
              level: 'info',
              timestamp: new Date().toISOString(),
              node_id: 'node-1'
            },
            {
              message: 'Processing complete',
              level: 'info',
              timestamp: new Date().toISOString(),
              node_id: 'node-2'
            }
          ]
        });
      } else {
        res.json({ logs: [] });
      }
    });

    // Cancel endpoint
    app.post('/api/v1/cancel/:sessionId', (req, res) => {
      res.json({ message: 'Execution cancelled' });
    });

    // Components endpoint
    app.get('/api/v1/all', (req, res) => {
      res.json({
        ChatInput: {
          name: 'ChatInput',
          display_name: 'Chat Input',
          description: 'Chat input component',
          base_classes: ['Message'],
          template: {}
        },
        ChatOutput: {
          name: 'ChatOutput',
          display_name: 'Chat Output',
          description: 'Chat output component',
          base_classes: ['Message'],
          template: {}
        }
      });
    });

    // Error simulation endpoints
    app.post('/api/v1/run/error-flow', (req, res) => {
      res.status(500).json({ error: 'Internal server error' });
    });

    app.get('/api/v1/status/timeout-exec', (req, res) => {
      // Simulate timeout by not responding
      setTimeout(() => {
        res.json({ status: 'running' });
      }, 5000);
    });

    // Start mock server
    mockServer = app.listen(mockPort);
    
    // Wait for server to start
    await new Promise<void>((resolve) => {
      mockServer.on('listening', resolve);
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Create adapter instance for each test
    const config: EngineAdapterConfig = {
      baseUrl: mockBaseUrl,
      apiKey: 'test-api-key',
      timeout: 5000,
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2
      }
    };

    adapter = new LangflowAdapter(config);
  });

  describe('Connection and Health', () => {
    it('should successfully test connection', async () => {
      const isConnected = await adapter.testConnection();
      expect(isConnected).toBe(true);
    });

    it('should get engine capabilities', async () => {
      const capabilities = await adapter.getCapabilities();
      
      expect(capabilities).toMatchObject({
        version: '1.0.0',
        supportedFeatures: expect.arrayContaining(['workflow_execution']),
        maxConcurrentExecutions: expect.any(Number),
        supportedNodeTypes: expect.arrayContaining(['ChatInput', 'ChatOutput'])
      });
    });
  });

  describe('Workflow Validation', () => {
    it('should validate a correct Langflow workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        description: 'Test workflow for validation',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const result = await adapter.validateWorkflow(workflow);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject workflow with missing required fields', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: '',
        engineType: EngineType.LANGFLOW,
        definition: {
          data: {
            nodes: [],
            edges: []
          }
        }
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should reject workflow with invalid engine type', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N, // Wrong engine type
        definition: mockFlowData
      };

      const result = await adapter.validateWorkflow(invalidWorkflow);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INVALID_ENGINE_TYPE')).toBe(true);
    });

    it('should validate workflow structure', async () => {
      const workflowWithInvalidStructure: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {
          // Missing required data field
          name: 'Test'
        }
      };

      const result = await adapter.validateWorkflow(workflowWithInvalidStructure);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MISSING_DATA')).toBe(true);
    });
  });

  describe('Workflow Execution', () => {
    it('should execute a workflow successfully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const parameters: WorkflowParameters = {
        input_value: 'Hello',
        input_type: 'chat',
        tweaks: {}
      };

      const result = await adapter.executeWorkflow(workflow, parameters);
      
      expect(result.id).toBeDefined();
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toBeDefined();
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
    });

    it('should handle workflow execution errors', async () => {
      const workflow: WorkflowDefinition = {
        name: 'error-flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const parameters: WorkflowParameters = {};

      const result = await adapter.executeWorkflow(workflow, parameters);
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBeDefined();
    });

    it('should handle long-running executions with polling', async () => {
      // Mock a workflow that takes time to complete
      const workflow: WorkflowDefinition = {
        name: 'Test Flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const parameters: WorkflowParameters = {
        input_value: 'Hello'
      };

      // Mock the status endpoint to return running first, then completed
      let callCount = 0;
      const originalGet = adapter['httpClient'].get;
      adapter['httpClient'].get = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/status/')) {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              data: { status: 'running' }
            });
          } else {
            return Promise.resolve({
              data: { 
                status: 'completed',
                result: { message: 'Hello, World!' }
              }
            });
          }
        }
        return originalGet.call(adapter['httpClient'], url);
      });

      const result = await adapter.executeWorkflow(workflow, parameters);
      
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(callCount).toBeGreaterThan(1);
    });
  });

  describe('Execution Management', () => {
    it('should get execution status', async () => {
      const result = await adapter.getExecutionStatus('exec-123');
      
      expect(result.id).toBe('exec-123');
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toBeDefined();
    });

    it('should get execution logs', async () => {
      const logs = await adapter.getExecutionLogs('exec-123');
      
      expect(logs).toHaveLength(2);
      expect(logs[0]).toMatchObject({
        timestamp: expect.any(Date),
        level: 'info',
        message: 'Starting execution',
        context: expect.objectContaining({
          sessionId: 'exec-123',
          nodeId: 'node-1'
        })
      });
    });

    it('should cancel execution', async () => {
      const result = await adapter.cancelExecution('exec-123');
      
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should handle failed execution status', async () => {
      const result = await adapter.getExecutionStatus('exec-failed');
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
    });

    it('should handle non-existent execution', async () => {
      const result = await adapter.getExecutionStatus('non-existent');
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle network timeouts', async () => {
      const shortTimeoutConfig: EngineAdapterConfig = {
        baseUrl: mockBaseUrl,
        timeout: 100, // Very short timeout
        retryConfig: {
          maxAttempts: 1,
          initialDelay: 50,
          maxDelay: 100,
          backoffFactor: 1
        }
      };

      const timeoutAdapter = new LangflowAdapter(shortTimeoutConfig);
      
      const result = await timeoutAdapter.getExecutionStatus('timeout-exec');
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error?.code).toBeDefined();
    });

    it('should retry on retryable errors', async () => {
      let attemptCount = 0;
      const originalPost = adapter['httpClient'].post;
      
      adapter['httpClient'].post = vi.fn().mockImplementation((url: string, data: any) => {
        attemptCount++;
        if (attemptCount < 3) {
          // Simulate retryable error
          const error = new Error('Network error');
          (error as any).code = 'ECONNRESET';
          throw error;
        }
        return originalPost.call(adapter['httpClient'], url, data);
      });

      const workflow: WorkflowDefinition = {
        name: 'Test Flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const result = await adapter.executeWorkflow(workflow, {});
      
      expect(attemptCount).toBe(3);
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
    });

    it('should handle API errors gracefully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'error-flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const result = await adapter.executeWorkflow(workflow, {});
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
    });
  });

  describe('Workflow Conversion', () => {
    it('should throw error for unsupported conversion', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N,
        definition: {}
      };

      await expect(
        adapter.convertWorkflow(workflow, EngineType.N8N)
      ).rejects.toThrow('Conversion from n8n to Langflow is not yet implemented');
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle multiple concurrent executions', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const parameters: WorkflowParameters = {
        input_value: 'Hello'
      };

      // Execute multiple workflows concurrently
      const promises = Array.from({ length: 5 }, () => 
        adapter.executeWorkflow(workflow, parameters)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.status).toBe(ExecutionStatus.COMPLETED);
        expect(result.id).toBeDefined();
      });
    });

    it('should handle execution timeout gracefully', async () => {
      // Override polling configuration for faster test
      const fastAdapter = new LangflowAdapter({
        baseUrl: mockBaseUrl,
        apiKey: 'test-key',
        timeout: 5000,
        retryConfig: {
          maxAttempts: 1,
          initialDelay: 100,
          maxDelay: 100,
          backoffFactor: 1
        }
      });

      // Override polling settings
      (fastAdapter as any).pollInterval = 100;
      (fastAdapter as any).maxPollAttempts = 2;

      // Mock status to always return running
      const originalGet = fastAdapter['httpClient'].get;
      fastAdapter['httpClient'].get = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/status/')) {
          return Promise.resolve({
            data: { status: 'running' }
          });
        }
        return originalGet.call(fastAdapter['httpClient'], url);
      });

      const workflow: WorkflowDefinition = {
        name: 'Test Flow',
        engineType: EngineType.LANGFLOW,
        definition: mockFlowData
      };

      const result = await fastAdapter.executeWorkflow(workflow, {});
      
      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error?.code).toBe('EXECUTION_TIMEOUT');
    });
  });
});