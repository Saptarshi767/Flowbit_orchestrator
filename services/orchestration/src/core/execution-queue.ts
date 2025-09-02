import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionResult,
  ExecutionStatus,
  ExecutionError,
  EngineType
} from '@robust-ai-orchestrator/shared';
import { Logger } from '../utils/logger';

export enum ExecutionPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface ExecutionRequest {
  id: string;
  workflowId: string;
  workflow: WorkflowDefinition;
  engineType: EngineType;
  parameters?: WorkflowParameters;
  priority: ExecutionPriority;
  userId?: string;
  createdAt: Date;
  timeout: number;
  retryCount?: number;
  maxRetries?: number;
}

export interface QueueConfig {
  maxSize: number;
  processingInterval: number;
  maxConcurrentExecutions?: number;
  retryConfig?: {
    maxAttempts: number;
    initialDelay: number;
    backoffFactor: number;
  };
}

export interface QueueStats {
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  currentQueueSize: number;
  activeExecutions: number;
  averageProcessingTime: number;
}

/**
 * Priority-based execution queue for workflow executions
 */
export class ExecutionQueue extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: QueueConfig;
  private readonly queue: ExecutionRequest[] = [];
  private readonly activeExecutions: Map<string, ExecutionRequest> = new Map();
  private readonly processingTimes: number[] = [];
  private isProcessing: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private stats: QueueStats = {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    currentQueueSize: 0,
    activeExecutions: 0,
    averageProcessingTime: 0
  };

  constructor(config: QueueConfig) {
    super();
    this.config = {
      maxConcurrentExecutions: 10,
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffFactor: 2
      },
      ...config
    };
    this.logger = new Logger('execution-queue');
  }

  /**
   * Starts the queue processor
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.logger.info('Starting execution queue processor');
    this.isProcessing = true;
    
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.config.processingInterval);

    this.emit('started');
  }

  /**
   * Stops the queue processor
   */
  async stop(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.logger.info('Stopping execution queue processor');
    this.isProcessing = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for active executions to complete or timeout
    await this.waitForActiveExecutions();

    this.emit('stopped');
  }

  /**
   * Enqueues an execution request
   */
  async enqueue(request: ExecutionRequest): Promise<string> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error('Execution queue is full');
    }

    // Insert request in priority order
    this.insertByPriority(request);
    this.stats.totalQueued++;
    this.stats.currentQueueSize = this.queue.length;

    this.logger.debug('Execution request enqueued', {
      executionId: request.id,
      priority: request.priority,
      queueSize: this.queue.length
    });

    this.emit('enqueued', request);
    this.emit('execution_ready', request.id, request);

    return request.id;
  }

  /**
   * Enqueues an execution request and returns a promise for the result
   */
  async enqueueAndWait(request: ExecutionRequest): Promise<ExecutionResult> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error('Execution queue is full');
    }

    // Insert request in priority order
    this.insertByPriority(request);
    this.stats.totalQueued++;
    this.stats.currentQueueSize = this.queue.length;

    this.logger.debug('Execution request enqueued', {
      executionId: request.id,
      priority: request.priority,
      queueSize: this.queue.length
    });

    this.emit('enqueued', request);

    // Return a promise that resolves when execution completes
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Execution timeout after ${request.timeout}ms`));
      }, request.timeout);

      const onComplete = (result: ExecutionResult) => {
        if (result.id === request.id) {
          clearTimeout(timeout);
          this.removeListener('executionCompleted', onComplete);
          this.removeListener('executionFailed', onFailed);
          resolve(result);
        }
      };

      const onFailed = (result: ExecutionResult) => {
        if (result.id === request.id) {
          clearTimeout(timeout);
          this.removeListener('executionCompleted', onComplete);
          this.removeListener('executionFailed', onFailed);
          reject(new Error(result.error?.message || 'Execution failed'));
        }
      };

      this.on('executionCompleted', onComplete);
      this.on('executionFailed', onFailed);
    });
  }

  /**
   * Removes a request from the queue
   */
  dequeue(executionId: string): boolean {
    const index = this.queue.findIndex(req => req.id === executionId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.stats.currentQueueSize = this.queue.length;
      this.logger.debug('Execution request dequeued', { executionId });
      return true;
    }
    return false;
  }

  /**
   * Gets the current queue statistics
   */
  getStats(): QueueStats {
    return {
      ...this.stats,
      currentQueueSize: this.queue.length,
      activeExecutions: this.activeExecutions.size,
      averageProcessingTime: this.calculateAverageProcessingTime()
    };
  }

  /**
   * Gets all pending requests
   */
  getPendingRequests(): ExecutionRequest[] {
    return [...this.queue];
  }

  /**
   * Gets all active executions
   */
  getActiveExecutions(): ExecutionRequest[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Clears the queue
   */
  clear(): void {
    this.queue.length = 0;
    this.stats.currentQueueSize = 0;
    this.logger.info('Execution queue cleared');
    this.emit('cleared');
  }

  /**
   * Gets the current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Gets an execution by ID
   */
  async getExecution(executionId: string): Promise<ExecutionRequest | null> {
    // Check in queue
    const queuedExecution = this.queue.find(req => req.id === executionId);
    if (queuedExecution) {
      return queuedExecution;
    }

    // Check in active executions
    const activeExecution = this.activeExecutions.get(executionId);
    if (activeExecution) {
      return activeExecution;
    }

    return null;
  }

  /**
   * Cancels an execution
   */
  async cancel(executionId: string): Promise<boolean> {
    // Try to remove from queue
    const queueIndex = this.queue.findIndex(req => req.id === executionId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      this.stats.currentQueueSize = this.queue.length;
      this.logger.info('Execution cancelled from queue', { executionId });
      this.emit('executionCancelled', executionId);
      return true;
    }

    // Check if it's in active executions
    if (this.activeExecutions.has(executionId)) {
      // For active executions, we'll emit a cancellation event
      // The actual cancellation logic would be handled by the execution service
      this.emit('executionCancellationRequested', executionId);
      return true;
    }

    return false;
  }

  private async processQueue(): Promise<void> {
    if (!this.isProcessing || this.queue.length === 0) {
      return;
    }

    const maxConcurrent = this.config.maxConcurrentExecutions!;
    const availableSlots = maxConcurrent - this.activeExecutions.size;

    if (availableSlots <= 0) {
      return;
    }

    // Process up to available slots
    const requestsToProcess = this.queue.splice(0, Math.min(availableSlots, this.queue.length));
    this.stats.currentQueueSize = this.queue.length;

    for (const request of requestsToProcess) {
      this.processRequest(request);
    }
  }

  private async processRequest(request: ExecutionRequest): Promise<void> {
    const startTime = Date.now();
    this.activeExecutions.set(request.id, request);

    this.logger.info('Processing execution request', {
      executionId: request.id,
      workflowName: request.workflow.name,
      priority: request.priority
    });

    this.emit('executionStarted', request);

    try {
      // Simulate execution processing
      // In real implementation, this would delegate to the appropriate engine adapter
      const result = await this.executeRequest(request);
      
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      
      this.activeExecutions.delete(request.id);
      this.stats.totalProcessed++;

      this.logger.info('Execution completed successfully', {
        executionId: request.id,
        processingTime
      });

      this.emit('executionCompleted', result);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.recordProcessingTime(processingTime);
      
      this.activeExecutions.delete(request.id);
      this.stats.totalFailed++;

      const executionError: ExecutionError = {
        code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error
      };

      const result: ExecutionResult = {
        id: request.id,
        status: ExecutionStatus.FAILED,
        error: executionError,
        startTime: new Date(startTime),
        endTime: new Date()
      };

      this.logger.error('Execution failed', {
        executionId: request.id,
        error: executionError.message,
        processingTime
      });

      // Check if we should retry
      if (this.shouldRetry(request, error)) {
        await this.retryRequest(request);
      } else {
        this.emit('executionFailed', result);
      }
    }
  }

  private async executeRequest(request: ExecutionRequest): Promise<ExecutionResult> {
    // This is a placeholder implementation
    // In the real implementation, this would use the orchestration engine
    // to delegate to the appropriate engine adapter
    
    return new Promise((resolve, reject) => {
      // Simulate async execution
      setTimeout(() => {
        const result: ExecutionResult = {
          id: request.id,
          status: ExecutionStatus.COMPLETED,
          result: { message: 'Execution completed successfully' },
          startTime: new Date(),
          endTime: new Date()
        };
        resolve(result);
      }, Math.random() * 1000 + 500); // Random delay between 500-1500ms
    });
  }

  private shouldRetry(request: ExecutionRequest, error: any): boolean {
    const retryCount = request.retryCount || 0;
    const maxRetries = request.maxRetries || this.config.retryConfig!.maxAttempts;
    
    if (retryCount >= maxRetries) {
      return false;
    }

    // Check if error is retryable
    if (error instanceof Error) {
      const retryableErrors = ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'];
      return retryableErrors.some(code => error.message.includes(code));
    }

    return true;
  }

  private async retryRequest(request: ExecutionRequest): Promise<void> {
    const retryCount = (request.retryCount || 0) + 1;
    const delay = this.config.retryConfig!.initialDelay * 
                  Math.pow(this.config.retryConfig!.backoffFactor, retryCount - 1);

    this.logger.info('Retrying execution request', {
      executionId: request.id,
      retryCount,
      delay
    });

    setTimeout(() => {
      const retryRequest: ExecutionRequest = {
        ...request,
        retryCount,
        createdAt: new Date()
      };
      
      this.insertByPriority(retryRequest);
      this.emit('retryScheduled', retryRequest);
    }, delay);
  }

  private insertByPriority(request: ExecutionRequest): void {
    // Insert request in priority order (higher priority first)
    let insertIndex = 0;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < request.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only the last 100 processing times for average calculation
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }
  }

  private calculateAverageProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0;
    }
    
    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.processingTimes.length);
  }

  private async waitForActiveExecutions(): Promise<void> {
    const timeout = 30000; // 30 seconds timeout
    const startTime = Date.now();

    while (this.activeExecutions.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeExecutions.size > 0) {
      this.logger.warn('Some executions did not complete before shutdown', {
        remainingExecutions: this.activeExecutions.size
      });
    }
  }
}