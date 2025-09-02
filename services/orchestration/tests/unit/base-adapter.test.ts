import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { BaseEngineAdapter } from '../../src/adapters/base-adapter';
import { 
  EngineType, 
  WorkflowDefinition, 
  WorkflowParameters, 
  ExecutionResult,
  ValidationResult,
  CancellationResult,
  ExecutionLog,
  ExecutionStatus
} from './test-types';
import { EngineAdapterConfig, EngineCapabilities } from '../../src/interfaces/engine-adapter.interface';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Concrete implementation for testing
class TestEngineAdapter extends BaseEngineAdapter {
  constructor(config: EngineAdapterConfig) {
    super(EngineType.LANGFLOW, config);
  }

  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    const commonValidation = this.validateCommonWorkflowProperties(workflow);
    return commonValidation;
  }

  async executeWorkflow(workflow: WorkflowDefinition, parameters: WorkflowParameters): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    this.logExecutionStart(workflow, parameters);
    
    const result = this.createExecutionResult(
      executionId,
      ExecutionStatus.COMPLETED,
      { message: 'Test execution completed' }
    );
    
    this.logExecutionComplete(result);
    return result;
  }

  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
    return [
      {
        timestamp: new Date(),
        level: 'info',
        message: `Logs for execution ${executionId}`,
        context: { executionId }
      }
    ];
  }

  async cancelExecution(executionId: string): Promise<CancellationResult> {
    return {
      success: true,
      message: `Execution ${executionId} cancelled successfully`
    };
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionResult> {
    return this.createExecutionResult(
      executionId,
      ExecutionStatus.RUNNING
    );
  }

  async convertWorkflow(workflow: WorkflowDefinition, sourceEngine: EngineType): Promise<WorkflowDefinition> {
    return {
      ...workflow,
      engineType: this.engineType
    };
  }

  async getCapabilities(): Promise<EngineCapabilities> {
    return {
      version: '1.0.0',
      supportedFeatures: ['basic_execution', 'validation'],
      maxConcurrentExecutions: 10
    };
  }
}

describe('BaseEngineAdapter', () => {
  let adapter: TestEngineAdapter;
  let config: EngineAdapterConfig;
  let mockAxiosInstance: any;

  beforeEach(() => {
    config = {
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-api-key',
      timeout: 5000,
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffFactor: 2
      }
    };

    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    adapter = new TestEngineAdapter(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct engine type', () => {
      expect(adapter.engineType).toBe(EngineType.LANGFLOW);
    });

    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RobustAI-Orchestrator/1.0'
        }
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return true when health check succeeds', async () => {
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });

      const result = await adapter.testConnection();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });

    it('should return false when health check fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('validateCommonWorkflowProperties', () => {
    it('should validate workflow with all required properties', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const result = adapter['validateCommonWorkflowProperties'](workflow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error for missing name', () => {
      const workflow: WorkflowDefinition = {
        name: '',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const result = adapter['validateCommonWorkflowProperties'](workflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Workflow name is required',
        code: 'MISSING_NAME'
      });
    });

    it('should return error for wrong engine type', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N,
        definition: { nodes: [], edges: [] }
      };

      const result = adapter['validateCommonWorkflowProperties'](workflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'engineType',
        message: `Expected engine type ${EngineType.LANGFLOW}, got ${EngineType.N8N}`,
        code: 'INVALID_ENGINE_TYPE'
      });
    });

    it('should return error for missing definition', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: null as any
      };

      const result = adapter['validateCommonWorkflowProperties'](workflow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'definition',
        message: 'Workflow definition is required',
        code: 'MISSING_DEFINITION'
      });
    });

    it('should return warning for long name', () => {
      const longName = 'a'.repeat(300);
      const workflow: WorkflowDefinition = {
        name: longName,
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const result = adapter['validateCommonWorkflowProperties'](workflow);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContainEqual({
        field: 'name',
        message: 'Workflow name is very long and may be truncated',
        code: 'LONG_NAME'
      });
    });
  });

  describe('generateExecutionId', () => {
    it('should generate unique execution IDs', () => {
      const id1 = adapter['generateExecutionId']();
      const id2 = adapter['generateExecutionId']();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });
  });

  describe('createExecutionResult', () => {
    it('should create execution result with all parameters', () => {
      const id = 'test-execution-id';
      const status = ExecutionStatus.COMPLETED;
      const result = { message: 'Success' };
      const startTime = new Date();
      const endTime = new Date();

      const executionResult = adapter['createExecutionResult'](
        id, status, result, undefined, startTime, endTime
      );

      expect(executionResult).toEqual({
        id,
        status,
        result,
        error: undefined,
        startTime,
        endTime,
        logs: [],
        metrics: {}
      });
    });

    it('should create execution result with minimal parameters', () => {
      const id = 'test-execution-id';
      const status = ExecutionStatus.PENDING;

      const executionResult = adapter['createExecutionResult'](id, status);

      expect(executionResult.id).toBe(id);
      expect(executionResult.status).toBe(status);
      expect(executionResult.startTime).toBeInstanceOf(Date);
      expect(executionResult.logs).toEqual([]);
      expect(executionResult.metrics).toEqual({});
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkErrors = [
        { code: 'ECONNRESET' },
        { code: 'ETIMEDOUT' },
        { code: 'ENOTFOUND' }
      ];

      networkErrors.forEach(error => {
        expect(adapter['isRetryableError'](error)).toBe(true);
      });
    });

    it('should identify retryable HTTP status codes', () => {
      const retryableStatuses = [500, 502, 503, 504, 429, 408];

      retryableStatuses.forEach(status => {
        const error = { response: { status } };
        expect(adapter['isRetryableError'](error)).toBe(true);
      });
    });

    it('should not retry client errors', () => {
      const clientErrors = [400, 401, 403, 404];

      clientErrors.forEach(status => {
        const error = { response: { status } };
        expect(adapter['isRetryableError'](error)).toBe(false);
      });
    });

    it('should identify circuit breaker errors as retryable', () => {
      const error = { message: 'Circuit breaker is open' };
      expect(adapter['isRetryableError'](error)).toBe(true);
    });
  });

  describe('transformHttpError', () => {
    it('should transform axios error to execution error', () => {
      const axiosError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { error: 'Server error' }
        },
        config: {
          url: '/test',
          method: 'GET'
        },
        stack: 'Error stack trace'
      } as any;

      const executionError = adapter['transformHttpError'](axiosError);

      expect(executionError).toEqual({
        code: 'ECONNRESET',
        message: 'Connection reset',
        details: {
          status: 500,
          statusText: 'Internal Server Error',
          url: '/test',
          method: 'GET'
        },
        engineError: { error: 'Server error' },
        stack: 'Error stack trace'
      });
    });

    it('should handle axios error without response', () => {
      const axiosError = {
        code: 'ECONNRESET',
        message: 'Connection reset',
        config: {
          url: '/test',
          method: 'GET'
        }
      } as any;

      const executionError = adapter['transformHttpError'](axiosError);

      expect(executionError.code).toBe('ECONNRESET');
      expect(executionError.message).toBe('Connection reset');
      expect(executionError.details.status).toBeUndefined();
      expect(executionError.engineError).toBeUndefined();
    });
  });

  describe('concrete implementation methods', () => {
    it('should validate workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const result = await adapter.validateWorkflow(workflow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should execute workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };
      const parameters: WorkflowParameters = { input: 'test' };

      const result = await adapter.executeWorkflow(workflow, parameters);

      expect(result.id).toBeDefined();
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
      expect(result.result).toEqual({ message: 'Test execution completed' });
    });

    it('should get execution logs', async () => {
      const executionId = 'test-execution-id';

      const logs = await adapter.getExecutionLogs(executionId);

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe(`Logs for execution ${executionId}`);
      expect(logs[0].level).toBe('info');
    });

    it('should cancel execution', async () => {
      const executionId = 'test-execution-id';

      const result = await adapter.cancelExecution(executionId);

      expect(result.success).toBe(true);
      expect(result.message).toBe(`Execution ${executionId} cancelled successfully`);
    });

    it('should get execution status', async () => {
      const executionId = 'test-execution-id';

      const result = await adapter.getExecutionStatus(executionId);

      expect(result.id).toBe(executionId);
      expect(result.status).toBe(ExecutionStatus.RUNNING);
    });

    it('should convert workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N,
        definition: { nodes: [], edges: [] }
      };

      const result = await adapter.convertWorkflow(workflow, EngineType.N8N);

      expect(result.engineType).toBe(EngineType.LANGFLOW);
      expect(result.name).toBe(workflow.name);
    });

    it('should get capabilities', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.version).toBe('1.0.0');
      expect(capabilities.supportedFeatures).toContain('basic_execution');
      expect(capabilities.maxConcurrentExecutions).toBe(10);
    });
  });
});