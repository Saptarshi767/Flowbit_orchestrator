import { BaseEngineAdapter } from './base-adapter';
import { EngineAdapterConfig, EngineCapabilities } from '../interfaces/engine-adapter.interface';
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

/**
 * LangSmith-specific workflow definition structure
 */
interface LangSmithWorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  chain: LangSmithChainStep[];
  metadata?: {
    tags?: string[];
    version?: string;
    author?: string;
    [key: string]: any;
  };
  config?: {
    tracing?: boolean;
    evaluation?: boolean;
    monitoring?: boolean;
    [key: string]: any;
  };
}

interface LangSmithChainStep {
  id: string;
  type: 'llm' | 'prompt' | 'chain' | 'retriever' | 'memory' | 'parser' | 'tool' | 'custom';
  name: string;
  parameters: Record<string, any>;
  inputs?: string[];
  outputs?: string[];
  dependencies?: string[];
}

/**
 * LangSmith execution request structure
 */
interface LangSmithExecutionRequest {
  chain: LangSmithChainStep[];
  inputs: Record<string, any>;
  config?: {
    session_id?: string;
    run_name?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    callbacks?: any[];
  };
  tracing?: {
    enabled: boolean;
    project_name?: string;
    run_id?: string;
  };
}

/**
 * LangSmith execution response structure
 */
interface LangSmithExecutionResponse {
  run_id: string;
  status: 'pending' | 'running' | 'success' | 'error';
  outputs?: Record<string, any>;
  error?: {
    type: string;
    message: string;
    traceback?: string;
  };
  trace?: {
    run_id: string;
    project_name: string;
    start_time: string;
    end_time?: string;
    inputs: Record<string, any>;
    outputs?: Record<string, any>;
    events: LangSmithTraceEvent[];
  };
  metrics?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    latency_ms?: number;
    cost_usd?: number;
  };
}

interface LangSmithTraceEvent {
  event_id: string;
  parent_id?: string;
  name: string;
  type: string;
  start_time: string;
  end_time?: string;
  inputs: Record<string, any>;
  outputs?: Record<string, any>;
  error?: any;
  metadata?: Record<string, any>;
}

/**
 * LangSmith evaluation result structure
 */
interface LangSmithEvaluationResult {
  run_id: string;
  evaluations: Array<{
    key: string;
    score: number;
    value?: any;
    comment?: string;
    correction?: any;
    evaluator_info?: Record<string, any>;
  }>;
  feedback?: Array<{
    key: string;
    score: number;
    value?: any;
    comment?: string;
  }>;
}

/**
 * LangSmith adapter for executing workflows on LangSmith instances
 */
export class LangSmithAdapter extends BaseEngineAdapter {
  private readonly pollInterval: number = 1000; // 1 second
  private readonly maxPollAttempts: number = 600; // 10 minutes max
  private readonly tracingEnabled: boolean;
  private readonly evaluationEnabled: boolean;

  constructor(config: EngineAdapterConfig) {
    super(EngineType.LANGSMITH, config);
    this.tracingEnabled = config.customConfig?.tracing?.enabled ?? true;
    this.evaluationEnabled = config.customConfig?.evaluation?.enabled ?? false;
  }

  /**
   * Validates a LangSmith workflow definition
   */
  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    const baseValidation = this.validateCommonWorkflowProperties(workflow);
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: any[] = [];
    const warnings: any[] = [];

    try {
      const langsmithDef = workflow.definition as LangSmithWorkflowDefinition;

      // Validate LangSmith-specific structure
      if (!Array.isArray(langsmithDef.chain)) {
        errors.push({
          field: 'definition.chain',
          message: 'LangSmith workflow must have a chain array',
          code: 'MISSING_CHAIN'
        });
      } else if (langsmithDef.chain.length === 0) {
        warnings.push({
          field: 'definition.chain',
          message: 'Workflow has no chain steps',
          code: 'EMPTY_CHAIN'
        });
      }

      // Validate chain steps
      if (langsmithDef.chain) {
        const stepIds = new Set<string>();
        
        langsmithDef.chain.forEach((step, index) => {
          // Validate required fields
          if (!step.id) {
            errors.push({
              field: `definition.chain[${index}].id`,
              message: 'Chain step must have an id',
              code: 'MISSING_STEP_ID'
            });
          } else if (stepIds.has(step.id)) {
            errors.push({
              field: `definition.chain[${index}].id`,
              message: `Duplicate step id: ${step.id}`,
              code: 'DUPLICATE_STEP_ID'
            });
          } else {
            stepIds.add(step.id);
          }

          if (!step.name) {
            errors.push({
              field: `definition.chain[${index}].name`,
              message: 'Chain step must have a name',
              code: 'MISSING_STEP_NAME'
            });
          }

          if (!step.type) {
            errors.push({
              field: `definition.chain[${index}].type`,
              message: 'Chain step must have a type',
              code: 'MISSING_STEP_TYPE'
            });
          } else if (!this.isValidStepType(step.type)) {
            errors.push({
              field: `definition.chain[${index}].type`,
              message: `Invalid step type: ${step.type}`,
              code: 'INVALID_STEP_TYPE'
            });
          }

          if (!step.parameters || typeof step.parameters !== 'object') {
            errors.push({
              field: `definition.chain[${index}].parameters`,
              message: 'Chain step must have parameters object',
              code: 'MISSING_STEP_PARAMETERS'
            });
          }

          // Validate dependencies reference existing steps
          if (step.dependencies) {
            step.dependencies.forEach(depId => {
              if (!stepIds.has(depId)) {
                const existingSteps = langsmithDef.chain.slice(0, index);
                if (!existingSteps.some(s => s.id === depId)) {
                  errors.push({
                    field: `definition.chain[${index}].dependencies`,
                    message: `Dependency references non-existent or future step: ${depId}`,
                    code: 'INVALID_DEPENDENCY'
                  });
                }
              }
            });
          }

          // Validate step-specific parameters
          this.validateStepParameters(step, index, errors, warnings);
        });

        // Check for circular dependencies
        if (this.hasCircularDependencies(langsmithDef.chain)) {
          errors.push({
            field: 'definition.chain',
            message: 'Chain has circular dependencies',
            code: 'CIRCULAR_DEPENDENCIES'
          });
        }
      }

      // Validate against LangSmith API if possible
      if (errors.length === 0) {
        try {
          await this.executeWithRetry(async () => {
            const response = await this.httpClient.post('/api/v1/validate', {
              chain: langsmithDef.chain
            });
            return response.data;
          }, 'workflow validation');
        } catch (error) {
          warnings.push({
            field: 'definition',
            message: 'Could not validate against LangSmith API',
            code: 'API_VALIDATION_FAILED'
          });
        }
      }

    } catch (error) {
      errors.push({
        field: 'definition',
        message: 'Invalid LangSmith workflow structure',
        code: 'INVALID_STRUCTURE'
      });
    }

    return {
      isValid: errors.length === 0,
      errors: [...baseValidation.errors, ...errors],
      warnings: [...baseValidation.warnings, ...warnings]
    };
  }

  /**
   * Executes a LangSmith workflow
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    parameters: WorkflowParameters
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();
    this.logExecutionStart(workflow, parameters);

    try {
      const langsmithDef = workflow.definition as LangSmithWorkflowDefinition;
      
      // Prepare execution request
      const executionRequest: LangSmithExecutionRequest = {
        chain: this.applyParametersToChain(langsmithDef.chain, parameters),
        inputs: parameters.inputs || {},
        config: {
          session_id: executionId,
          run_name: parameters.run_name || workflow.name,
          tags: [
            ...(langsmithDef.metadata?.tags || []),
            ...(parameters.tags || [])
          ],
          metadata: {
            ...langsmithDef.metadata,
            ...parameters.metadata,
            orchestrator: 'robust-ai-orchestrator',
            workflow_id: workflow.id,
            workflow_version: workflow.version
          },
          callbacks: parameters.callbacks || []
        },
        tracing: {
          enabled: this.tracingEnabled && (parameters.tracing?.enabled !== false),
          project_name: parameters.tracing?.project_name || workflow.name,
          run_id: executionId
        }
      };

      // Start execution
      const executionResult = await this.executeWithRetry(async () => {
        const response = await this.httpClient.post('/api/v1/runs', executionRequest);
        return response.data as LangSmithExecutionResponse;
      }, 'workflow execution');

      // Create initial result
      const result = this.createExecutionResult(
        executionId,
        this.mapExecutionStatus(executionResult.status),
        undefined,
        undefined,
        new Date()
      );

      // Poll for completion if not immediately completed
      let finalResult: ExecutionResult;
      if (executionResult.status === 'pending' || executionResult.status === 'running') {
        finalResult = await this.pollForCompletion(executionResult.run_id, result);
      } else {
        finalResult = this.createExecutionResult(
          executionId,
          this.mapExecutionStatus(executionResult.status),
          executionResult.outputs,
          executionResult.error ? {
            code: 'LANGSMITH_EXECUTION_ERROR',
            message: executionResult.error.message,
            details: executionResult.error,
            engineError: executionResult.error
          } : undefined,
          new Date(),
          new Date()
        );
      }

      // Add tracing and metrics information
      if (executionResult.trace) {
        finalResult.metrics = {
          ...finalResult.metrics,
          ...executionResult.metrics,
          traceId: executionResult.trace.run_id,
          projectName: executionResult.trace.project_name
        };
      }

      // Run evaluation if enabled
      if (this.evaluationEnabled && finalResult.status === ExecutionStatus.COMPLETED) {
        try {
          const evaluationResult = await this.runEvaluation(executionResult.run_id, finalResult);
          finalResult.metrics = {
            ...finalResult.metrics,
            evaluation: evaluationResult
          };
        } catch (error) {
          this.logger.warn('Evaluation failed', { executionId, error });
        }
      }

      this.logExecutionComplete(finalResult);
      return finalResult;

    } catch (error) {
      const executionError = this.transformError(error);
      const result = this.createExecutionResult(
        executionId,
        ExecutionStatus.FAILED,
        undefined,
        executionError,
        new Date(),
        new Date()
      );
      
      this.logExecutionError(executionId, executionError);
      return result;
    }
  }

  /**
   * Gets execution logs for a specific execution
   */
  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.get(`/api/v1/runs/${executionId}/logs`);
      }, 'get execution logs');

      const traceData = response.data;
      const logs: ExecutionLog[] = [];

      // Extract logs from trace events
      if (traceData.trace?.events) {
        traceData.trace.events.forEach((event: LangSmithTraceEvent) => {
          // Add start event
          logs.push({
            timestamp: new Date(event.start_time),
            level: 'info',
            message: `Started ${event.type}: ${event.name}`,
            context: {
              executionId,
              eventId: event.event_id,
              parentId: event.parent_id,
              type: event.type,
              inputs: event.inputs
            }
          });

          // Add end event if completed
          if (event.end_time) {
            const duration = new Date(event.end_time).getTime() - new Date(event.start_time).getTime();
            logs.push({
              timestamp: new Date(event.end_time),
              level: event.error ? 'error' : 'info',
              message: event.error 
                ? `Failed ${event.type}: ${event.name} - ${event.error.message || 'Unknown error'}`
                : `Completed ${event.type}: ${event.name} (${duration}ms)`,
              context: {
                executionId,
                eventId: event.event_id,
                parentId: event.parent_id,
                type: event.type,
                outputs: event.outputs,
                error: event.error,
                duration
              }
            });
          }
        });
      }

      // Add execution-level logs
      if (traceData.trace) {
        logs.push({
          timestamp: new Date(traceData.trace.start_time),
          level: 'info',
          message: 'LangSmith execution started',
          context: {
            executionId,
            projectName: traceData.trace.project_name,
            inputs: traceData.trace.inputs
          }
        });

        if (traceData.trace.end_time) {
          const duration = new Date(traceData.trace.end_time).getTime() - new Date(traceData.trace.start_time).getTime();
          logs.push({
            timestamp: new Date(traceData.trace.end_time),
            level: 'info',
            message: `LangSmith execution completed (${duration}ms)`,
            context: {
              executionId,
              duration,
              outputs: traceData.trace.outputs
            }
          });
        }
      }

      return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    } catch (error) {
      this.logger.error('Failed to get execution logs', { executionId, error });
      return [];
    }
  }

  /**
   * Cancels a running execution
   */
  async cancelExecution(executionId: string): Promise<CancellationResult> {
    try {
      await this.executeWithRetry(async () => {
        return await this.httpClient.post(`/api/v1/runs/${executionId}/cancel`);
      }, 'cancel execution');

      return {
        success: true,
        message: 'Execution cancelled successfully'
      };

    } catch (error) {
      this.logger.error('Failed to cancel execution', { executionId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets the current status of an execution
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionResult> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.get(`/api/v1/runs/${executionId}`);
      }, 'get execution status');

      const executionData = response.data as LangSmithExecutionResponse;
      
      return this.createExecutionResult(
        executionId,
        this.mapExecutionStatus(executionData.status),
        executionData.outputs,
        executionData.error ? {
          code: 'LANGSMITH_EXECUTION_ERROR',
          message: executionData.error.message,
          details: executionData.error,
          engineError: executionData.error
        } : undefined,
        executionData.trace?.start_time ? new Date(executionData.trace.start_time) : undefined,
        executionData.trace?.end_time ? new Date(executionData.trace.end_time) : undefined
      );

    } catch (error) {
      return this.createExecutionResult(
        executionId,
        ExecutionStatus.FAILED,
        undefined,
        this.transformError(error),
        undefined,
        new Date()
      );
    }
  }

  /**
   * Converts workflow from another engine format to LangSmith format
   */
  async convertWorkflow(
    workflow: WorkflowDefinition,
    sourceEngine: EngineType
  ): Promise<WorkflowDefinition> {
    // This is a complex operation that would require understanding
    // the source engine format and mapping it to LangSmith format
    // For now, we'll throw an error indicating it's not implemented
    throw new Error(`Conversion from ${sourceEngine} to LangSmith is not yet implemented`);
  }

  /**
   * Gets LangSmith engine capabilities
   */
  async getCapabilities(): Promise<EngineCapabilities> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.get('/api/v1/info');
      }, 'get capabilities');

      const infoData = response.data;
      
      return {
        version: infoData.version || '1.0.0',
        supportedFeatures: [
          'chain_execution',
          'tracing',
          'evaluation',
          'monitoring',
          'session_management',
          'custom_chains',
          'llm_integration',
          'retrieval_augmented_generation',
          'memory_management'
        ],
        maxConcurrentExecutions: 50, // LangSmith typically supports high concurrency
        supportedNodeTypes: [
          'llm',
          'prompt',
          'chain',
          'retriever',
          'memory',
          'parser',
          'tool',
          'custom'
        ],
        customProperties: {
          supportsTracing: true,
          supportsEvaluation: true,
          supportsMonitoring: true,
          supportsCustomChains: true,
          apiVersion: 'v1',
          sdkVersion: infoData.sdk_version,
          tracingEnabled: this.tracingEnabled,
          evaluationEnabled: this.evaluationEnabled
        }
      };

    } catch (error) {
      this.logger.error('Failed to get capabilities', { error });
      
      // Return default capabilities
      return {
        version: 'unknown',
        supportedFeatures: ['chain_execution'],
        maxConcurrentExecutions: 1,
        supportedNodeTypes: ['llm', 'prompt', 'chain'],
        customProperties: {
          tracingEnabled: this.tracingEnabled,
          evaluationEnabled: this.evaluationEnabled
        }
      };
    }
  }

  // Private helper methods

  private isValidStepType(type: string): boolean {
    const validTypes = ['llm', 'prompt', 'chain', 'retriever', 'memory', 'parser', 'tool', 'custom'];
    return validTypes.includes(type);
  }

  private validateStepParameters(
    step: LangSmithChainStep, 
    index: number, 
    errors: any[], 
    warnings: any[]
  ): void {
    switch (step.type) {
      case 'llm':
        if (!step.parameters.model) {
          errors.push({
            field: `definition.chain[${index}].parameters.model`,
            message: 'LLM step must specify a model',
            code: 'MISSING_LLM_MODEL'
          });
        }
        break;
      
      case 'prompt':
        if (!step.parameters.template && !step.parameters.messages) {
          errors.push({
            field: `definition.chain[${index}].parameters`,
            message: 'Prompt step must have template or messages',
            code: 'MISSING_PROMPT_TEMPLATE'
          });
        }
        break;
      
      case 'retriever':
        if (!step.parameters.index && !step.parameters.vectorstore) {
          warnings.push({
            field: `definition.chain[${index}].parameters`,
            message: 'Retriever step should specify index or vectorstore',
            code: 'MISSING_RETRIEVER_CONFIG'
          });
        }
        break;
    }
  }

  private hasCircularDependencies(chain: LangSmithChainStep[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true;
      }
      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = chain.find(s => s.id === stepId);
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of chain) {
      if (hasCycle(step.id)) {
        return true;
      }
    }

    return false;
  }

  private applyParametersToChain(
    chain: LangSmithChainStep[], 
    parameters: WorkflowParameters
  ): LangSmithChainStep[] {
    if (!parameters.stepParameters) {
      return chain;
    }

    return chain.map(step => {
      const stepParams = parameters.stepParameters[step.id];
      if (stepParams) {
        return {
          ...step,
          parameters: {
            ...step.parameters,
            ...stepParams
          }
        };
      }
      return step;
    });
  }

  private async pollForCompletion(
    runId: string,
    initialResult: ExecutionResult
  ): Promise<ExecutionResult> {
    let attempts = 0;
    
    while (attempts < this.maxPollAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        
        const status = await this.getExecutionStatus(runId);
        
        if (status.status === ExecutionStatus.COMPLETED || 
            status.status === ExecutionStatus.FAILED ||
            status.status === ExecutionStatus.CANCELLED) {
          
          // Get final logs
          const logs = await this.getExecutionLogs(runId);
          status.logs = logs;
          
          return status;
        }
        
        attempts++;
        
      } catch (error) {
        this.logger.warn('Error during status polling', { 
          runId, 
          attempt: attempts, 
          error 
        });
        attempts++;
      }
    }

    // Timeout reached
    return this.createExecutionResult(
      initialResult.id,
      ExecutionStatus.FAILED,
      undefined,
      {
        code: 'EXECUTION_TIMEOUT',
        message: 'Execution timed out while polling for completion'
      },
      initialResult.startTime,
      new Date()
    );
  }

  private mapExecutionStatus(langsmithStatus: string): ExecutionStatus {
    switch (langsmithStatus) {
      case 'pending':
        return ExecutionStatus.PENDING;
      case 'running':
        return ExecutionStatus.RUNNING;
      case 'success':
        return ExecutionStatus.COMPLETED;
      case 'error':
        return ExecutionStatus.FAILED;
      default:
        return ExecutionStatus.PENDING;
    }
  }

  private async runEvaluation(runId: string, result: ExecutionResult): Promise<LangSmithEvaluationResult> {
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.httpClient.post(`/api/v1/runs/${runId}/evaluate`, {
          evaluators: this.config.customConfig?.evaluation?.evaluators || ['default'],
          config: this.config.customConfig?.evaluation?.config || {}
        });
      }, 'run evaluation');

      return response.data as LangSmithEvaluationResult;

    } catch (error) {
      this.logger.error('Failed to run evaluation', { runId, error });
      throw error;
    }
  }

  private transformError(error: any): ExecutionError {
    // Handle HTTP errors from axios
    if (error.response?.data) {
      return {
        code: 'LANGSMITH_API_ERROR',
        message: error.response.data.message || error.message || 'LangSmith API error',
        details: error.response.data,
        engineError: error.response.data
      };
    }

    // Handle network errors with specific codes
    if (error.code && typeof error.code === 'string') {
      return {
        code: error.code,
        message: error.message || 'Network error',
        details: error.details,
        stack: error.stack
      };
    }

    // Handle generic errors
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      stack: error.stack
    };
  }
}