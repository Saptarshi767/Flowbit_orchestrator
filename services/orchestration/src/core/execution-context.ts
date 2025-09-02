import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionStatus,
  ExecutionError,
  ExecutionLog,
  ExecutionMetrics
} from '@robust-ai-orchestrator/shared';

/**
 * Execution context that manages the state and lifecycle of a workflow execution
 */
export class ExecutionContext {
  public readonly id: string;
  public readonly workflow: WorkflowDefinition;
  public readonly parameters: WorkflowParameters;
  public readonly userId?: string;
  public readonly createdAt: Date;
  
  public status: ExecutionStatus;
  public startTime?: Date;
  public endTime?: Date;
  public result?: any;
  public error?: ExecutionError;
  public logs: ExecutionLog[] = [];
  public metrics: ExecutionMetrics = {};
  
  private readonly contextData: Map<string, any> = new Map();
  private readonly stepResults: Map<string, any> = new Map();
  private currentStep?: string;
  private readonly timeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    id: string,
    workflow: WorkflowDefinition,
    parameters: WorkflowParameters,
    userId?: string
  ) {
    this.id = id;
    this.workflow = workflow;
    this.parameters = parameters;
    this.userId = userId;
    this.createdAt = new Date();
    this.status = ExecutionStatus.PENDING;
  }

  /**
   * Starts the execution
   */
  start(): void {
    this.status = ExecutionStatus.RUNNING;
    this.startTime = new Date();
    this.addLog('info', 'Execution started', {
      workflowName: this.workflow.name,
      engineType: this.workflow.engineType
    });
  }

  /**
   * Completes the execution successfully
   */
  complete(result?: any): void {
    this.status = ExecutionStatus.COMPLETED;
    this.endTime = new Date();
    this.result = result;
    this.clearTimeouts();
    
    this.calculateMetrics();
    this.addLog('info', 'Execution completed successfully', {
      duration: this.getDuration(),
      resultSize: result ? JSON.stringify(result).length : 0
    });
  }

  /**
   * Fails the execution with an error
   */
  fail(error: ExecutionError): void {
    this.status = ExecutionStatus.FAILED;
    this.endTime = new Date();
    this.error = error;
    this.clearTimeouts();
    
    this.calculateMetrics();
    this.addLog('error', 'Execution failed', {
      errorCode: error.code,
      errorMessage: error.message,
      duration: this.getDuration()
    });
  }

  /**
   * Cancels the execution
   */
  cancel(): void {
    this.status = ExecutionStatus.CANCELLED;
    this.endTime = new Date();
    this.clearTimeouts();
    
    this.calculateMetrics();
    this.addLog('info', 'Execution cancelled', {
      duration: this.getDuration()
    });
  }

  /**
   * Adds a log entry
   */
  addLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, any>): void {
    const logEntry: ExecutionLog = {
      timestamp: new Date(),
      level,
      message,
      context: {
        executionId: this.id,
        step: this.currentStep,
        ...context
      }
    };
    
    this.logs.push(logEntry);
    
    // Keep only the last 1000 log entries to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs.shift();
    }
  }

  /**
   * Sets context data
   */
  setContextData(key: string, value: any): void {
    this.contextData.set(key, value);
  }

  /**
   * Gets context data
   */
  getContextData(key: string): any {
    return this.contextData.get(key);
  }

  /**
   * Gets all context data
   */
  getAllContextData(): Record<string, any> {
    return Object.fromEntries(this.contextData);
  }

  /**
   * Sets the result of a workflow step
   */
  setStepResult(stepId: string, result: any): void {
    this.stepResults.set(stepId, result);
    this.addLog('debug', `Step result set: ${stepId}`, {
      stepId,
      resultSize: JSON.stringify(result).length
    });
  }

  /**
   * Gets the result of a workflow step
   */
  getStepResult(stepId: string): any {
    return this.stepResults.get(stepId);
  }

  /**
   * Gets all step results
   */
  getAllStepResults(): Record<string, any> {
    return Object.fromEntries(this.stepResults);
  }

  /**
   * Sets the current step being executed
   */
  setCurrentStep(stepId: string): void {
    this.currentStep = stepId;
    this.addLog('debug', `Executing step: ${stepId}`, { stepId });
  }

  /**
   * Gets the current step being executed
   */
  getCurrentStep(): string | undefined {
    return this.currentStep;
  }

  /**
   * Sets a timeout for the execution or a specific step
   */
  setTimeout(key: string, callback: () => void, delay: number): void {
    // Clear existing timeout if any
    this.clearTimeout(key);
    
    const timeout = setTimeout(() => {
      this.timeouts.delete(key);
      callback();
    }, delay);
    
    this.timeouts.set(key, timeout);
  }

  /**
   * Clears a specific timeout
   */
  clearTimeout(key: string): void {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  /**
   * Clears all timeouts
   */
  clearTimeouts(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }

  /**
   * Gets the execution duration in milliseconds
   */
  getDuration(): number | undefined {
    if (!this.startTime) {
      return undefined;
    }
    
    const endTime = this.endTime || new Date();
    return endTime.getTime() - this.startTime.getTime();
  }

  /**
   * Checks if the execution is in a terminal state
   */
  isTerminal(): boolean {
    return [
      ExecutionStatus.COMPLETED,
      ExecutionStatus.FAILED,
      ExecutionStatus.CANCELLED
    ].includes(this.status);
  }

  /**
   * Checks if the execution is active (running or pending)
   */
  isActive(): boolean {
    return [
      ExecutionStatus.PENDING,
      ExecutionStatus.RUNNING
    ].includes(this.status);
  }

  /**
   * Gets a summary of the execution context
   */
  getSummary(): ExecutionContextSummary {
    return {
      id: this.id,
      workflowName: this.workflow.name,
      engineType: this.workflow.engineType,
      status: this.status,
      userId: this.userId,
      createdAt: this.createdAt,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.getDuration(),
      currentStep: this.currentStep,
      logCount: this.logs.length,
      stepCount: this.stepResults.size,
      hasError: !!this.error,
      hasResult: !!this.result
    };
  }

  /**
   * Serializes the execution context to JSON
   */
  toJSON(): ExecutionContextData {
    return {
      id: this.id,
      workflow: this.workflow,
      parameters: this.parameters,
      userId: this.userId,
      createdAt: this.createdAt,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      result: this.result,
      error: this.error,
      logs: this.logs,
      metrics: this.metrics,
      contextData: this.getAllContextData(),
      stepResults: this.getAllStepResults(),
      currentStep: this.currentStep
    };
  }

  /**
   * Creates an execution context from JSON data
   */
  static fromJSON(data: ExecutionContextData): ExecutionContext {
    const context = new ExecutionContext(
      data.id,
      data.workflow,
      data.parameters,
      data.userId
    );

    context.status = data.status;
    context.startTime = data.startTime;
    context.endTime = data.endTime;
    context.result = data.result;
    context.error = data.error;
    context.logs = data.logs || [];
    context.metrics = data.metrics || {};
    context.currentStep = data.currentStep;

    // Restore context data
    if (data.contextData) {
      for (const [key, value] of Object.entries(data.contextData)) {
        context.setContextData(key, value);
      }
    }

    // Restore step results
    if (data.stepResults) {
      for (const [stepId, result] of Object.entries(data.stepResults)) {
        context.setStepResult(stepId, result);
      }
    }

    return context;
  }

  private calculateMetrics(): void {
    const duration = this.getDuration();
    if (duration !== undefined) {
      this.metrics.duration = duration;
    }

    // Calculate memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = memUsage.heapUsed;
    }

    // Add custom metrics
    this.metrics.logCount = this.logs.length;
    this.metrics.stepCount = this.stepResults.size;
    this.metrics.contextDataSize = this.contextData.size;
  }
}

export interface ExecutionContextSummary {
  id: string;
  workflowName: string;
  engineType: string;
  status: ExecutionStatus;
  userId?: string;
  createdAt: Date;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  currentStep?: string;
  logCount: number;
  stepCount: number;
  hasError: boolean;
  hasResult: boolean;
}

export interface ExecutionContextData {
  id: string;
  workflow: WorkflowDefinition;
  parameters: WorkflowParameters;
  userId?: string;
  createdAt: Date;
  status: ExecutionStatus;
  startTime?: Date;
  endTime?: Date;
  result?: any;
  error?: ExecutionError;
  logs: ExecutionLog[];
  metrics: ExecutionMetrics;
  contextData?: Record<string, any>;
  stepResults?: Record<string, any>;
  currentStep?: string;
}