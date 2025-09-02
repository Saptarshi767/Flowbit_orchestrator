import { LangSmithAdapter } from '../../src/adapters/langsmith-adapter';
import { EngineAdapterConfig } from '../../src/interfaces/engine-adapter.interface';
import {
  WorkflowDefinition,
  WorkflowParameters,
  EngineType,
  ExecutionStatus
} from '@robust-ai-orchestrator/shared';
import nock from 'nock';

describe('LangSmithAdapter Integration Tests', () => {
  let adapter: LangSmithAdapter;
  let config: EngineAdapterConfig;
  const baseUrl = 'https://api.langsmith.test';

  beforeEach(() => {
    config = {
      baseUrl,
      apiKey: 'test-api-key',
      timeout: 30000,
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffFactor: 2
      },
      customConfig: {
        tracing: {
          enabled: true
        },
        evaluation: {
          enabled: true,
          evaluators: ['accuracy', 'relevance']
        }
      }
    };

    adapter = new LangSmithAdapter(config);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('validateWorkflow', () => {
    it('should validate a valid LangSmith workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test LangSmith Workflow',
        description: 'A test workflow for LangSmith',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Test LangSmith Workflow',
          chain: [
            {
              id: 'prompt_step',
              type: 'prompt',
              name: 'Create Prompt',
              parameters: {
                template: 'Hello {name}, how are you?',
                input_variables: ['name']
              }
            },
            {
              id: 'llm_step',
              type: 'llm',
              name: 'Generate Response',
              parameters: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7,
                max_tokens: 100
              },
              dependencies: ['prompt_step']
            }
          ],
          metadata: {
            tags: ['test', 'demo'],
            version: '1.0.0'
          },
          config: {
            tracing: true,
            evaluation: false
          }
        }
      };

      // Mock API validation call
      nock(baseUrl)
        .post('/api/v1/validate')
        .reply(200, { valid: true });

      const result = await adapter.validateWorkflow(workflow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect validation errors in invalid workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Invalid Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Invalid Workflow',
          chain: [
            {
              // Missing id
              type: 'llm',
              name: 'LLM Step',
              parameters: {
                // Missing model
                temperature: 0.7
              }
            },
            {
              id: 'step2',
              type: 'invalid_type', // Invalid type
              name: 'Invalid Step',
              parameters: {},
              dependencies: ['nonexistent_step'] // Invalid dependency
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check for specific error types
      const errorCodes = result.errors.map(e => e.code);
      expect(errorCodes).toContain('MISSING_STEP_ID');
      expect(errorCodes).toContain('MISSING_LLM_MODEL');
      expect(errorCodes).toContain('INVALID_STEP_TYPE');
      expect(errorCodes).toContain('INVALID_DEPENDENCY');
    });

    it('should detect circular dependencies', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Circular Dependency Workflow',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Circular Dependency Workflow',
          chain: [
            {
              id: 'step1',
              type: 'prompt',
              name: 'Step 1',
              parameters: { template: 'test' },
              dependencies: ['step2']
            },
            {
              id: 'step2',
              type: 'llm',
              name: 'Step 2',
              parameters: { model: 'gpt-3.5-turbo' },
              dependencies: ['step1']
            }
          ]
        }
      };

      const result = await adapter.validateWorkflow(workflow);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'CIRCULAR_DEPENDENCIES')).toBe(true);
    });
  });

  describe('executeWorkflow', () => {
    it('should execute a workflow successfully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Execution',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Test Execution',
          chain: [
            {
              id: 'llm_step',
              type: 'llm',
              name: 'Generate Text',
              parameters: {
                model: 'gpt-3.5-turbo',
                temperature: 0.7
              }
            }
          ]
        }
      };

      const parameters: WorkflowParameters = {
        inputs: { prompt: 'Hello world' },
        run_name: 'Test Run',
        tags: ['test']
      };

      const runId = 'test-run-123';
      const executionResponse = {
        run_id: runId,
        status: 'success',
        outputs: { response: 'Hello! How can I help you today?' },
        trace: {
          run_id: runId,
          project_name: 'Test Execution',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T10:00:05Z',
          inputs: { prompt: 'Hello world' },
          outputs: { response: 'Hello! How can I help you today?' },
          events: []
        },
        metrics: {
          total_tokens: 25,
          prompt_tokens: 10,
          completion_tokens: 15,
          latency_ms: 5000
        }
      };

      // Mock execution start
      nock(baseUrl)
        .post('/api/v1/runs')
        .reply(200, executionResponse);

      // Mock evaluation call
      nock(baseUrl)
        .post(`/api/v1/runs/${runId}/evaluate`)
        .reply(200, {
          run_id: runId,
          evaluations: [
            { key: 'accuracy', score: 0.95 },
            { key: 'relevance', score: 0.88 }
          ]
        });

      const result = await adapter.executeWorkflow(workflow, parameters);

      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toEqual({ response: 'Hello! How can I help you today?' });
      expect(result.metrics?.total_tokens).toBe(25);
      expect(result.metrics?.traceId).toBe(runId);
      expect(result.metrics?.evaluation).toBeDefined();
    });

    it('should handle execution with polling', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Polling Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Polling Test',
          chain: [
            {
              id: 'llm_step',
              type: 'llm',
              name: 'Generate Text',
              parameters: { model: 'gpt-3.5-turbo' }
            }
          ]
        }
      };

      const runId = 'polling-run-123';

      // Mock execution start (returns pending)
      nock(baseUrl)
        .post('/api/v1/runs')
        .reply(200, {
          run_id: runId,
          status: 'pending'
        });

      // Mock status polling - first call returns running
      nock(baseUrl)
        .get(`/api/v1/runs/${runId}`)
        .reply(200, {
          run_id: runId,
          status: 'running',
          trace: {
            run_id: runId,
            start_time: '2024-01-01T10:00:00Z'
          }
        });

      // Mock status polling - second call returns success
      nock(baseUrl)
        .get(`/api/v1/runs/${runId}`)
        .reply(200, {
          run_id: runId,
          status: 'success',
          outputs: { result: 'Completed successfully' },
          trace: {
            run_id: runId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T10:00:10Z'
          }
        });

      // Mock logs retrieval
      nock(baseUrl)
        .get(`/api/v1/runs/${runId}/logs`)
        .reply(200, {
          trace: {
            run_id: runId,
            start_time: '2024-01-01T10:00:00Z',
            end_time: '2024-01-01T10:00:10Z',
            events: [
              {
                event_id: 'event-1',
                name: 'llm_step',
                type: 'llm',
                start_time: '2024-01-01T10:00:01Z',
                end_time: '2024-01-01T10:00:09Z',
                inputs: { prompt: 'test' },
                outputs: { response: 'test response' }
              }
            ]
          }
        });

      const result = await adapter.executeWorkflow(workflow, {});

      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toEqual({ result: 'Completed successfully' });
      expect(result.logs).toBeDefined();
      expect(result.logs!.length).toBeGreaterThan(0);
    });

    it('should handle execution errors', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Error Test',
        engineType: EngineType.LANGSMITH,
        definition: {
          name: 'Error Test',
          chain: [
            {
              id: 'failing_step',
              type: 'llm',
              name: 'Failing Step',
              parameters: { model: 'invalid-model' }
            }
          ]
        }
      };

      // Mock execution failure
      nock(baseUrl)
        .post('/api/v1/runs')
        .reply(400, {
          message: 'Invalid model specified',
          error: 'MODEL_NOT_FOUND'
        });

      const result = await adapter.executeWorkflow(workflow, {});

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('LANGSMITH_API_ERROR');
      expect(result.error!.message).toContain('Invalid model specified');
    });
  });

  describe('getExecutionLogs', () => {
    it('should retrieve execution logs', async () => {
      const executionId = 'test-execution-123';
      
      const mockLogsResponse = {
        trace: {
          run_id: executionId,
          project_name: 'Test Project',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T10:00:10Z',
          inputs: { prompt: 'test input' },
          outputs: { response: 'test output' },
          events: [
            {
              event_id: 'event-1',
              name: 'prompt_step',
              type: 'prompt',
              start_time: '2024-01-01T10:00:01Z',
              end_time: '2024-01-01T10:00:02Z',
              inputs: { template: 'Hello {name}' },
              outputs: { formatted_prompt: 'Hello World' }
            },
            {
              event_id: 'event-2',
              parent_id: 'event-1',
              name: 'llm_step',
              type: 'llm',
              start_time: '2024-01-01T10:00:03Z',
              end_time: '2024-01-01T10:00:08Z',
              inputs: { prompt: 'Hello World' },
              outputs: { response: 'Hi there!' }
            }
          ]
        }
      };

      nock(baseUrl)
        .get(`/api/v1/runs/${executionId}/logs`)
        .reply(200, mockLogsResponse);

      const logs = await adapter.getExecutionLogs(executionId);

      expect(logs).toHaveLength(5); // 2 start events + 2 end events + 2 execution-level events
      
      // Check log structure
      const startLog = logs.find(log => log.message.includes('Started prompt: prompt_step'));
      expect(startLog).toBeDefined();
      expect(startLog!.level).toBe('info');
      expect(startLog!.context?.eventId).toBe('event-1');

      const endLog = logs.find(log => log.message.includes('Completed llm: llm_step'));
      expect(endLog).toBeDefined();
      expect(endLog!.level).toBe('info');
      expect(endLog!.context?.duration).toBe(5000);
    });

    it('should handle logs retrieval errors gracefully', async () => {
      const executionId = 'nonexistent-execution';

      nock(baseUrl)
        .get(`/api/v1/runs/${executionId}/logs`)
        .reply(404, { message: 'Execution not found' });

      const logs = await adapter.getExecutionLogs(executionId);

      expect(logs).toEqual([]);
    });
  });

  describe('cancelExecution', () => {
    it('should cancel execution successfully', async () => {
      const executionId = 'test-execution-123';

      nock(baseUrl)
        .post(`/api/v1/runs/${executionId}/cancel`)
        .reply(200, { message: 'Execution cancelled' });

      const result = await adapter.cancelExecution(executionId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Execution cancelled successfully');
    });

    it('should handle cancellation errors', async () => {
      const executionId = 'nonexistent-execution';

      nock(baseUrl)
        .post(`/api/v1/runs/${executionId}/cancel`)
        .reply(404, { message: 'Execution not found' });

      const result = await adapter.cancelExecution(executionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution not found');
    });
  });

  describe('getExecutionStatus', () => {
    it('should get execution status', async () => {
      const executionId = 'test-execution-123';
      
      const mockStatusResponse = {
        run_id: executionId,
        status: 'success',
        outputs: { result: 'Success!' },
        trace: {
          run_id: executionId,
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T10:00:05Z'
        }
      };

      nock(baseUrl)
        .get(`/api/v1/runs/${executionId}`)
        .reply(200, mockStatusResponse);

      const result = await adapter.getExecutionStatus(executionId);

      expect(result.id).toBe(executionId);
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toEqual({ result: 'Success!' });
      expect(result.startTime).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(result.endTime).toEqual(new Date('2024-01-01T10:00:05Z'));
    });

    it('should handle status retrieval errors', async () => {
      const executionId = 'nonexistent-execution';

      nock(baseUrl)
        .get(`/api/v1/runs/${executionId}`)
        .reply(404, { message: 'Execution not found' });

      const result = await adapter.getExecutionStatus(executionId);

      expect(result.status).toBe(ExecutionStatus.FAILED);
      expect(result.error).toBeDefined();
    });
  });

  describe('getCapabilities', () => {
    it('should get engine capabilities', async () => {
      const mockInfoResponse = {
        version: '1.2.3',
        sdk_version: '0.1.0',
        features: ['tracing', 'evaluation', 'monitoring']
      };

      nock(baseUrl)
        .get('/api/v1/info')
        .reply(200, mockInfoResponse);

      const capabilities = await adapter.getCapabilities();

      expect(capabilities.version).toBe('1.2.3');
      expect(capabilities.supportedFeatures).toContain('chain_execution');
      expect(capabilities.supportedFeatures).toContain('tracing');
      expect(capabilities.supportedFeatures).toContain('evaluation');
      expect(capabilities.maxConcurrentExecutions).toBe(50);
      expect(capabilities.supportedNodeTypes).toContain('llm');
      expect(capabilities.supportedNodeTypes).toContain('prompt');
      expect(capabilities.customProperties?.tracingEnabled).toBe(true);
      expect(capabilities.customProperties?.evaluationEnabled).toBe(true);
      expect(capabilities.customProperties?.sdkVersion).toBe('0.1.0');
    });

    it('should return default capabilities on error', async () => {
      nock(baseUrl)
        .get('/api/v1/info')
        .reply(500, { message: 'Internal server error' });

      const capabilities = await adapter.getCapabilities();

      expect(capabilities.version).toBe('unknown');
      expect(capabilities.supportedFeatures).toEqual(['chain_execution']);
      expect(capabilities.maxConcurrentExecutions).toBe(1);
      expect(capabilities.supportedNodeTypes).toEqual(['llm', 'prompt', 'chain']);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      nock(baseUrl)
        .get('/health')
        .reply(200, { status: 'healthy' });

      const result = await adapter.testConnection();

      expect(result).toBe(true);
    });

    it('should handle connection test failure', async () => {
      nock(baseUrl)
        .get('/health')
        .reply(500, { status: 'unhealthy' });

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('convertWorkflow', () => {
    it('should throw error for unsupported conversion', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {}
      };

      await expect(adapter.convertWorkflow(workflow, EngineType.LANGFLOW))
        .rejects.toThrow('Conversion from langflow to LangSmith is not yet implemented');
    });
  });
});