import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionResult,
  ExecutionStatus,
  EngineType,
  ExecutionError
} from '@robust-ai-orchestrator/shared';
import { IEngineAdapter } from '../interfaces/engine-adapter.interface';
import { ExecutionQueue, ExecutionRequest, ExecutionPriority } from './execution-queue';
import { ExecutionScheduler, ScheduleConfig } from './execution-scheduler';
import { ExecutionContext } from './execution-context';
import { Logger } from '../utils/logger';

export interface OrchestrationConfig {
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  retryConfig: {
    maxAttempts: number;
    initialDelay: number;
    backoffFactor: number;
  };
  queueConfig: {
    maxQueueSize: number;
    processingInterval: number;
  };
}

export interface ScheduleResult {
  scheduleId: string;
  nextExecution: Date;
  success: boolean;
  error?: string;
}

/**
 * Core orchestration engine that manages workflow execution across multiple engines
 */
export class OrchestrationEngine extends EventEmitter {
  private readonly logger: Logger;
  private readonly adapters: Map<EngineType, IEngineAdapter>;
  private readonly executionQueue: ExecutionQueue;
  private readonly scheduler: ExecutionScheduler;
  private readonly activeExecutions: Map<string, ExecutionContext>;
  private readonly config: OrchestrationConfig;
  private isRunning: boolean = false;

  constructor(config: OrchestrationConfig) {
    super();
    this.config = config;
    this.logger = new Logger('orchestration-engine');
    this.adapters = new Map();
    this.activeExecutions = new Map();
    
    this.executionQueue = new ExecutionQueue({
      maxSize: config.queueConfig.maxQueueSize,
      processingInterval: config.queueConfig.processingInterval
    });
    
    this.scheduler = new ExecutionScheduler();
    
    this.setupEventHandlers();
  }

  /**
   * Registers an engine adapter
   */
  registerAdapter(adapter: IEngineAdapter): void {
    this.adapters.set(adapter.engineType, adapter);
    this.logger.info(`Registered adapter for engine: ${adapter.engineType}`);
  }

  /**
   * Starts the orchestration engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestration engine is already running');
    }

    this.logger.info('Starting orchestration engine');
    
    // Start the execution queue processor
    await this.executionQueue.start();
    
    // Start the scheduler
    await this.scheduler.start();
    
    this.isRunning = true;
    this.emit('started');
    
    this.logger.info('Orchestration engine started successfully');
  }

  /**
   * Stops the orchestration engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping orchestration engine');
    
    // Stop accepting new executions
    this.isRunning = false;
    
    // Cancel all active executions
    await this.cancelAllActiveExecutions();
    
    // Stop the scheduler
    await this.scheduler.stop();
    
    // Stop the execution queue
    await this.executionQueue.stop();
    
    this.emit('stopped');
    this.logger.info('Orchestration engine stopped');
  }

  /**
   * Executes a workflow immediately
   */
  async executeWorkflow(
    workflow: WorkflowDefinition,
    parameters: WorkflowParameters = {},
    priority: ExecutionPriority = ExecutionPriority.NORMAL,
    userId?: string
  ): Promise<ExecutionResult> {
    if (!this.isRunning) {
      throw new Error('Orchestration engine is not running');
    }

    const adapter = this.getAdapter(workflow.engineType);
    
    // Validate workflow
    const validation = await adapter.validateWorkflow(workflow);
    if (!validation.isValid) {
      throw new Error(`Workflow validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create execution request
    const executionRequest: ExecutionRequest = {
      id: this.generateExecutionId(),
      workflow,
      parameters,
      priority,
      userId,
      createdAt: new Date(),
      timeout: this.config.defaultTimeout
    };

    // Add to queue for immediate processing
    return this.executionQueue.enqueue(executionRequest);
  }

  /**
   * Schedules a workflow for recurring execution
   */
  async scheduleWorkflow(
    workflow: WorkflowDefinition,
    schedule: ScheduleConfig,
    parameters: WorkflowParameters = {},
    userId?: string
  ): Promise<ScheduleResult> {
    if (!this.isRunning) {
      throw new Error('Orchestration engine is not running');
    }

    const adapter = this.getAdapter(workflow.engineType);
    
    // Validate workflow
    const validation = await adapter.validateWorkflow(workflow);
    if (!validation.isValid) {
      throw new Error(`Workflow validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    try {
      const scheduleId = await this.scheduler.scheduleWorkflow(
        workflow,
        schedule,
        parameters,
        userId
      );

      const nextExecution = this.scheduler.getNextExecutionTime(scheduleId);

      this.logger.info('Workflow scheduled successfully', {
        scheduleId,
        workflowName: workflow.name,
        nextExecution
      });

      return {
        scheduleId,
        nextExecution: nextExecution!,
        success: true
      };
    } catch (error) {
      this.logger.error('Failed to schedule workflow', { error, workflow: workflow.name });
      return {
        scheduleId: '',
        nextExecution: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancels a running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      this.logger.warn('Attempted to cancel non-existent execution', { executionId });
      return false;
    }

    try {
      // Cancel the execution in the engine
      const adapter = this.getAdapter(context.workflow.engineType);
      const result = await adapter.cancelExecution(executionId);
      
      if (result.success) {
        // Update context status
        context.status = ExecutionStatus.CANCELLED;
        context.endTime = new Date();
        
        // Remove from active executions
        this.activeExecutions.delete(executionId);
        
        this.logger.info('Execution cancelled successfully', { executionId });
        this.emit('executionCancelled', { executionId, context });
        
        return true;
      } else {
        this.logger.error('Failed to cancel execution', { executionId, error: result.error });
        return false;
      }
    } catch (error) {
      this.logger.error('Error cancelling execution', { executionId, error });
      return false;
    }
  }

  /**
   * Gets the status of an execution
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionResult | null> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      return null;
    }

    try {
      const adapter = this.getAdapter(context.workflow.engineType);
      return await adapter.getExecutionStatus(executionId);
    } catch (error) {
      this.logger.error('Error getting execution status', { executionId, error });
      return null;
    }
  }

  /**
   * Gets all active executions
   */
  getActiveExecutions(): ExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Gets execution queue statistics
   */
  getQueueStats() {
    return this.executionQueue.getStats();
  }

  /**
   * Gets scheduler statistics
   */
  getSchedulerStats() {
    return this.scheduler.getStats();
  }

  /**
   * Removes a scheduled workflow
   */
  async unscheduleWorkflow(scheduleId: string): Promise<boolean> {
    return this.scheduler.unscheduleWorkflow(scheduleId);
  }

  private setupEventHandlers(): void {
    // Handle execution queue events
    this.executionQueue.on('executionStarted', (request: ExecutionRequest) => {
      this.handleExecutionStart(request);
    });

    this.executionQueue.on('executionCompleted', (result: ExecutionResult) => {
      this.handleExecutionComplete(result);
    });

    this.executionQueue.on('executionFailed', (result: ExecutionResult) => {
      this.handleExecutionFailed(result);
    });

    // Handle scheduler events
    this.scheduler.on('scheduledExecution', (request: ExecutionRequest) => {
      this.executionQueue.enqueue(request);
    });

    this.scheduler.on('scheduleError', (error: any) => {
      this.logger.error('Scheduler error', { error });
      this.emit('scheduleError', error);
    });
  }

  private async handleExecutionStart(request: ExecutionRequest): Promise<void> {
    const context = new ExecutionContext(
      request.id,
      request.workflow,
      request.parameters,
      request.userId
    );

    this.activeExecutions.set(request.id, context);
    
    this.logger.info('Execution started', {
      executionId: request.id,
      workflowName: request.workflow.name,
      engineType: request.workflow.engineType
    });

    this.emit('executionStarted', { request, context });
  }

  private async handleExecutionComplete(result: ExecutionResult): Promise<void> {
    const context = this.activeExecutions.get(result.id);
    if (context) {
      context.status = result.status;
      context.endTime = result.endTime || new Date();
      context.result = result.result;
      
      this.activeExecutions.delete(result.id);
    }

    this.logger.info('Execution completed', {
      executionId: result.id,
      status: result.status,
      duration: result.endTime && result.startTime 
        ? result.endTime.getTime() - result.startTime.getTime() 
        : undefined
    });

    this.emit('executionCompleted', { result, context });
  }

  private async handleExecutionFailed(result: ExecutionResult): Promise<void> {
    const context = this.activeExecutions.get(result.id);
    if (context) {
      context.status = result.status;
      context.endTime = result.endTime || new Date();
      context.error = result.error;
      
      this.activeExecutions.delete(result.id);
    }

    this.logger.error('Execution failed', {
      executionId: result.id,
      error: result.error?.message,
      errorCode: result.error?.code
    });

    this.emit('executionFailed', { result, context });
  }

  private async cancelAllActiveExecutions(): Promise<void> {
    const cancellationPromises = Array.from(this.activeExecutions.keys()).map(
      executionId => this.cancelExecution(executionId)
    );

    await Promise.allSettled(cancellationPromises);
  }

  private getAdapter(engineType: EngineType): IEngineAdapter {
    const adapter = this.adapters.get(engineType);
    if (!adapter) {
      throw new Error(`No adapter registered for engine type: ${engineType}`);
    }
    return adapter;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}