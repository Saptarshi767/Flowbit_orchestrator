import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import * as retry from 'retry';
import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionResult,
  ValidationResult,
  CancellationResult,
  ExecutionLog,
  EngineType,
  ExecutionStatus,
  ExecutionError
} from '@robust-ai-orchestrator/shared';
import { IEngineAdapter, EngineAdapterConfig, EngineCapabilities } from '../interfaces/engine-adapter.interface';
import { Logger } from '../utils/logger';
import { CircuitBreaker } from '../utils/circuit-breaker';

/**
 * Base adapter class providing common functionality for all engine adapters
 */
export abstract class BaseEngineAdapter implements IEngineAdapter {
  protected readonly logger: Logger;
  protected readonly httpClient: AxiosInstance;
  protected readonly circuitBreaker: CircuitBreaker;
  protected readonly config: EngineAdapterConfig;

  constructor(
    public readonly engineType: EngineType,
    config: EngineAdapterConfig
  ) {
    this.config = config;
    this.logger = new Logger(`${engineType}-adapter`);
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
        'User-Agent': 'RobustAI-Orchestrator/1.0',
        ...config.customHeaders
      }
    });

    // Add request interceptor for authentication
    this.httpClient.interceptors.request.use((requestConfig) => {
      if (config.apiKey) {
        requestConfig.headers.Authorization = `Bearer ${config.apiKey}`;
      }
      return requestConfig;
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.logger.error('HTTP request failed', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(this.transformHttpError(error));
      }
    );
  }

  // Abstract methods that must be implemented by concrete adapters
  abstract validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult>;
  abstract executeWorkflow(workflow: WorkflowDefinition, parameters: WorkflowParameters): Promise<ExecutionResult>;
  abstract getExecutionLogs(executionId: string): Promise<ExecutionLog[]>;
  abstract cancelExecution(executionId: string): Promise<CancellationResult>;
  abstract getExecutionStatus(executionId: string): Promise<ExecutionResult>;
  abstract convertWorkflow(workflow: WorkflowDefinition, sourceEngine: EngineType): Promise<WorkflowDefinition>;
  abstract getCapabilities(): Promise<EngineCapabilities>;

  /**
   * Tests the connection to the engine
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.circuitBreaker.execute(async () => {
        const response = await this.httpClient.get('/health');
        return response.status === 200;
      });
      return true;
    } catch (error) {
      this.logger.error('Connection test failed', { error });
      return false;
    }
  }

  /**
   * Executes an HTTP request with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    const operation_with_retry = retry.operation({
      retries: this.config.retryConfig.maxAttempts - 1,
      factor: this.config.retryConfig.backoffFactor,
      minTimeout: this.config.retryConfig.initialDelay,
      maxTimeout: this.config.retryConfig.maxDelay,
      randomize: true
    });

    return new Promise((resolve, reject) => {
      operation_with_retry.attempt(async (currentAttempt) => {
        try {
          this.logger.debug(`Executing ${context} (attempt ${currentAttempt})`);
          const result = await this.circuitBreaker.execute(operation);
          resolve(result);
        } catch (error) {
          this.logger.warn(`${context} failed on attempt ${currentAttempt}`, { error });
          
          if (this.isRetryableError(error) && operation_with_retry.retry(error as Error)) {
            return;
          }
          
          reject(operation_with_retry.mainError() || error);
        }
      });
    });
  }

  /**
   * Determines if an error is retryable
   */
  protected isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP status codes that are retryable
    if (error.response?.status) {
      const status = error.response.status;
      return status >= 500 || status === 429 || status === 408;
    }

    // Circuit breaker errors
    if (error.message?.includes('Circuit breaker is open')) {
      return true;
    }

    return false;
  }

  /**
   * Transforms HTTP errors into standardized execution errors
   */
  protected transformHttpError(error: AxiosError): ExecutionError {
    const executionError: ExecutionError = {
      code: error.code || 'HTTP_ERROR',
      message: error.message,
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method
      }
    };

    if (error.response?.data) {
      executionError.engineError = error.response.data;
    }

    if (error.stack) {
      executionError.stack = error.stack;
    }

    return executionError;
  }

  /**
   * Generates a unique execution ID
   */
  protected generateExecutionId(): string {
    return uuidv4();
  }

  /**
   * Creates a standardized execution result
   */
  protected createExecutionResult(
    id: string,
    status: ExecutionStatus,
    result?: any,
    error?: ExecutionError,
    startTime?: Date,
    endTime?: Date
  ): ExecutionResult {
    return {
      id,
      status,
      result,
      error,
      startTime: startTime || new Date(),
      endTime,
      logs: [],
      metrics: {}
    };
  }

  /**
   * Validates common workflow properties
   */
  protected validateCommonWorkflowProperties(workflow: WorkflowDefinition): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!workflow.name || workflow.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Workflow name is required',
        code: 'MISSING_NAME'
      });
    }

    if (workflow.engineType !== this.engineType) {
      errors.push({
        field: 'engineType',
        message: `Expected engine type ${this.engineType}, got ${workflow.engineType}`,
        code: 'INVALID_ENGINE_TYPE'
      });
    }

    if (!workflow.definition) {
      errors.push({
        field: 'definition',
        message: 'Workflow definition is required',
        code: 'MISSING_DEFINITION'
      });
    }

    if (workflow.name && workflow.name.length > 255) {
      warnings.push({
        field: 'name',
        message: 'Workflow name is very long and may be truncated',
        code: 'LONG_NAME'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Logs execution start
   */
  protected logExecutionStart(workflow: WorkflowDefinition, parameters: WorkflowParameters): void {
    this.logger.info('Starting workflow execution', {
      workflowName: workflow.name,
      engineType: this.engineType,
      parametersCount: Object.keys(parameters).length
    });
  }

  /**
   * Logs execution completion
   */
  protected logExecutionComplete(result: ExecutionResult): void {
    this.logger.info('Workflow execution completed', {
      executionId: result.id,
      status: result.status,
      duration: result.endTime && result.startTime 
        ? result.endTime.getTime() - result.startTime.getTime() 
        : undefined
    });
  }

  /**
   * Logs execution error
   */
  protected logExecutionError(executionId: string, error: ExecutionError): void {
    this.logger.error('Workflow execution failed', {
      executionId,
      errorCode: error.code,
      errorMessage: error.message,
      engineError: error.engineError
    });
  }
}