import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionResult,
  ExecutionStatus,
  ExecutionError,
  ExecutionMetrics,
  EngineType,
  CancellationResult
} from '@robust-ai-orchestrator/shared';
import { ExecutionQueue, ExecutionRequest, ExecutionPriority } from '../core/execution-queue';
import { ExecutionContext } from '../core/execution-context';
import { IEngineAdapter } from '../interfaces/engine-adapter.interface';
import { Logger } from '../utils/logger';
import { CircuitBreaker } from '../utils/circuit-breaker';

export interface WorkerConfig {
  id: string;
  capacity: number;
  engineTypes: EngineType[];
  healthCheckInterval: number;
  maxIdleTime: number;
}

export interface ExecutionWorker {
  id: string;
  config: WorkerConfig;
  status: WorkerStatus;
  currentLoad: number;
  lastHeartbeat: Date;
  activeExecutions: Set<string>;
  totalExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
}

export enum WorkerStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  OVERLOADED = 'overloaded',
  UNHEALTHY = 'unhealthy',
  OFFLINE = 'offline'
}

export interface ScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  targetUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  workerStartupTime: number;
}

export interface ExecutionServiceConfig {
  scaling: ScalingConfig;
  faultTolerance: {
    maxRetries: number;
    retryDelay: number;
    backoffFactor: number;
    circuitBreakerConfig: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    };
  };
  storage: {
    resultRetentionDays: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
  };
  metrics: {
    collectionInterval: number;
    aggregationWindow: number;
    retentionPeriod: number;
  };
}

export interface ExecutionDemand {
  queueSize: number;
  averageWaitTime: number;
  executionRate: number;
  engineTypeDistribution: Record<EngineType, number>;
}

export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'no_action';
  targetWorkerCount: number;
  reason: string;
  confidence: number;
}

export interface ExecutionServiceMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  currentQueueSize: number;
  activeWorkers: number;
  totalWorkers: number;
  systemUtilization: number;
  throughput: number;
  errorRate: number;
}

/**
 * Distributed execution service with auto-scaling and fault tolerance
 */
export class ExecutionService extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: ExecutionServiceConfig;
  private readonly workers: Map<string, ExecutionWorker> = new Map();
  private readonly adapters: Map<EngineType, IEngineAdapter> = new Map();
  private readonly executionResults: Map<string, ExecutionResult> = new Map();
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly executionQueue: ExecutionQueue;
  
  private isRunning: boolean = false;
  private lastScalingAction: Date = new Date(0);
  private metricsCollectionInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private scalingInterval?: NodeJS.Timeout;
  
  private metrics: ExecutionServiceMetrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    currentQueueSize: 0,
    activeWorkers: 0,
    totalWorkers: 0,
    systemUtilization: 0,
    throughput: 0,
    errorRate: 0
  };

  constructor(config: ExecutionServiceConfig) {
    super();
    this.config = config;
    this.logger = new Logger('execution-service');
    
    this.executionQueue = new ExecutionQueue({
      maxSize: 10000,
      processingInterval: 1000,
      maxConcurrentExecutions: config.scaling.maxWorkers * 10
    });
    
    this.setupEventHandlers();
  }

  /**
   * Starts the execution service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Execution service is already running');
    }

    this.logger.info('Starting execution service');
    
    // Initialize minimum workers
    await this.initializeWorkers();
    
    // Start background processes
    this.startMetricsCollection();
    this.startHealthChecks();
    this.startAutoScaling();
    
    this.isRunning = true;
    this.emit('started');
    
    this.logger.info('Execution service started successfully');
  }

  /**
   * Stops the execution service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping execution service');
    
    // Stop background processes
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.scalingInterval) {
      clearInterval(this.scalingInterval);
    }
    
    // Gracefully shutdown workers
    await this.shutdownWorkers();
    
    this.isRunning = false;
    this.emit('stopped');
    
    this.logger.info('Execution service stopped');
  }

  /**
   * Registers an engine adapter
   */
  registerAdapter(engineType: EngineType, adapter: IEngineAdapter): void {
    this.adapters.set(engineType, adapter);
    this.logger.info(`Registered adapter for engine type: ${engineType}`);
  }

  /**
   * Submits a workflow execution request
   */
  async submitExecution(request: ExecutionRequest): Promise<string> {
    const executionId = await this.executionQueue.enqueue(request);
    
    this.logger.info(`Execution submitted: ${executionId}`, {
      workflowId: request.workflowId,
      engineType: request.engineType,
      priority: request.priority
    });
    
    // Update metrics
    this.metrics.totalExecutions++;
    this.updateQueueMetrics();
    
    return executionId;
  }

  /**
   * Gets execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus> {
    const result = this.executionResults.get(executionId);
    if (result) {
      return result.status;
    }
    
    // Check if execution is in queue
    const queuedExecution = await this.executionQueue.getExecution(executionId);
    if (queuedExecution) {
      return ExecutionStatus.PENDING;
    }
    
    throw new Error(`Execution not found: ${executionId}`);
  }

  /**
   * Gets execution result
   */
  async getExecutionResult(executionId: string): Promise<ExecutionResult> {
    const result = this.executionResults.get(executionId);
    if (!result) {
      throw new Error(`Execution result not found: ${executionId}`);
    }
    return result;
  }

  /**
   * Cancels an execution
   */
  async cancelExecution(executionId: string): Promise<CancellationResult> {
    try {
      // Try to cancel from queue first
      const cancelled = await this.executionQueue.cancel(executionId);
      if (cancelled) {
        return { success: true, message: 'Execution cancelled from queue' };
      }
      
      // Find worker executing this request
      for (const worker of this.workers.values()) {
        if (worker.activeExecutions.has(executionId)) {
          await this.cancelWorkerExecution(worker.id, executionId);
          return { success: true, message: 'Execution cancelled from worker' };
        }
      }
      
      return { success: false, error: 'Execution not found or already completed' };
    } catch (error) {
      this.logger.error('Failed to cancel execution', { executionId, error });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Scales executors based on demand
   */
  async scaleExecutors(demand: ExecutionDemand): Promise<ScalingDecision> {
    const decision = this.calculateScalingDecision(demand);
    
    if (decision.action !== 'no_action') {
      await this.executeScalingDecision(decision);
    }
    
    this.logger.info('Scaling decision made', decision);
    return decision;
  }

  /**
   * Handles executor failure
   */
  async handleExecutorFailure(executorId: string): Promise<void> {
    const worker = this.workers.get(executorId);
    if (!worker) {
      return;
    }

    this.logger.warn(`Handling worker failure: ${executorId}`);
    
    // Mark worker as unhealthy
    worker.status = WorkerStatus.UNHEALTHY;
    
    // Reschedule active executions
    for (const executionId of worker.activeExecutions) {
      await this.rescheduleExecution(executionId);
    }
    
    // Remove failed worker
    this.workers.delete(executorId);
    
    // Start replacement worker if needed
    if (this.workers.size < this.config.scaling.minWorkers) {
      await this.startWorker();
    }
    
    this.emit('worker_failed', { workerId: executorId });
  }

  /**
   * Gets current execution metrics
   */
  getExecutionMetrics(): ExecutionServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Gets current workers status
   */
  getWorkersStatus(): ExecutionWorker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Private methods
   */

  private setupEventHandlers(): void {
    this.executionQueue.on('execution_ready', this.handleExecutionReady.bind(this));
    this.executionQueue.on('execution_completed', this.handleExecutionCompleted.bind(this));
    this.executionQueue.on('execution_failed', this.handleExecutionFailed.bind(this));
  }

  private async initializeWorkers(): Promise<void> {
    const minWorkers = this.config.scaling.minWorkers;
    
    for (let i = 0; i < minWorkers; i++) {
      await this.startWorker();
    }
    
    this.logger.info(`Initialized ${minWorkers} workers`);
  }

  private async startWorker(): Promise<ExecutionWorker> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const worker: ExecutionWorker = {
      id: workerId,
      config: {
        id: workerId,
        capacity: 10, // Default capacity
        engineTypes: [EngineType.LANGFLOW, EngineType.N8N, EngineType.LANGSMITH],
        healthCheckInterval: 30000,
        maxIdleTime: 300000
      },
      status: WorkerStatus.IDLE,
      currentLoad: 0,
      lastHeartbeat: new Date(),
      activeExecutions: new Set(),
      totalExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0
    };
    
    this.workers.set(workerId, worker);
    this.updateWorkerMetrics();
    
    this.logger.info(`Started worker: ${workerId}`);
    this.emit('worker_started', { workerId });
    
    return worker;
  }

  private async shutdownWorkers(): Promise<void> {
    const shutdownPromises = Array.from(this.workers.keys()).map(workerId => 
      this.shutdownWorker(workerId)
    );
    
    await Promise.all(shutdownPromises);
    this.workers.clear();
  }

  private async shutdownWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return;
    }

    this.logger.info(`Shutting down worker: ${workerId}`);
    
    // Wait for active executions to complete or timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (worker.activeExecutions.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Force cancel remaining executions
    for (const executionId of worker.activeExecutions) {
      await this.cancelWorkerExecution(workerId, executionId);
    }
    
    worker.status = WorkerStatus.OFFLINE;
    this.emit('worker_stopped', { workerId });
  }

  private async handleExecutionReady(executionId: string, request: ExecutionRequest): Promise<void> {
    const worker = this.findAvailableWorker(request.engineType);
    
    if (!worker) {
      // No available worker, execution will remain in queue
      this.logger.warn(`No available worker for execution: ${executionId}`);
      return;
    }
    
    await this.assignExecutionToWorker(executionId, request, worker);
  }

  private findAvailableWorker(engineType: EngineType): ExecutionWorker | null {
    const availableWorkers = Array.from(this.workers.values())
      .filter(worker => 
        worker.status === WorkerStatus.IDLE &&
        worker.config.engineTypes.includes(engineType) &&
        worker.currentLoad < worker.config.capacity
      )
      .sort((a, b) => a.currentLoad - b.currentLoad);
    
    return availableWorkers[0] || null;
  }

  private async assignExecutionToWorker(
    executionId: string, 
    request: ExecutionRequest, 
    worker: ExecutionWorker
  ): Promise<void> {
    try {
      worker.activeExecutions.add(executionId);
      worker.currentLoad++;
      worker.status = worker.currentLoad >= worker.config.capacity ? 
        WorkerStatus.OVERLOADED : WorkerStatus.BUSY;
      
      this.logger.info(`Assigned execution ${executionId} to worker ${worker.id}`);
      
      // Execute workflow
      const startTime = Date.now();
      const adapter = this.adapters.get(request.engineType);
      
      if (!adapter) {
        throw new Error(`No adapter found for engine type: ${request.engineType}`);
      }
      
      const result = await this.executeWithRetry(adapter, request);
      const endTime = Date.now();
      
      // Update worker metrics
      worker.totalExecutions++;
      worker.averageExecutionTime = 
        (worker.averageExecutionTime * (worker.totalExecutions - 1) + (endTime - startTime)) / 
        worker.totalExecutions;
      
      // Store result
      this.executionResults.set(executionId, result);
      
      this.emit('execution_completed', { executionId, result });
      
    } catch (error) {
      worker.failedExecutions++;
      
      const errorResult: ExecutionResult = {
        id: executionId,
        status: ExecutionStatus.FAILED,
        error: {
          code: 'EXECUTION_ERROR',
          message: (error as Error).message,
          stack: (error as Error).stack
        },
        startTime: new Date(),
        endTime: new Date()
      };
      
      this.executionResults.set(executionId, errorResult);
      this.emit('execution_failed', { executionId, error });
      
    } finally {
      // Clean up worker state
      worker.activeExecutions.delete(executionId);
      worker.currentLoad--;
      worker.status = worker.currentLoad === 0 ? WorkerStatus.IDLE : WorkerStatus.BUSY;
      worker.lastHeartbeat = new Date();
    }
  }

  private async executeWithRetry(
    adapter: IEngineAdapter, 
    request: ExecutionRequest
  ): Promise<ExecutionResult> {
    const { maxRetries, retryDelay, backoffFactor } = this.config.faultTolerance;
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await adapter.executeWorkflow(
          request.workflow, 
          request.parameters || {}
        );
        
        if (attempt > 0) {
          this.logger.info(`Execution succeeded on retry ${attempt}`);
        }
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(backoffFactor, attempt);
          this.logger.warn(`Execution failed, retrying in ${delay}ms`, { 
            attempt, 
            error: lastError.message 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  private async cancelWorkerExecution(workerId: string, executionId: string): Promise<void> {
    // Implementation would depend on the specific worker communication mechanism
    // For now, we'll just remove it from the worker's active executions
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.activeExecutions.delete(executionId);
      worker.currentLoad = Math.max(0, worker.currentLoad - 1);
    }
  }

  private async rescheduleExecution(executionId: string): Promise<void> {
    // Re-add execution to queue for retry
    this.logger.info(`Rescheduling execution: ${executionId}`);
    // Implementation would re-queue the execution
  }

  private calculateScalingDecision(demand: ExecutionDemand): ScalingDecision {
    const currentWorkers = this.workers.size;
    const { minWorkers, maxWorkers, targetUtilization, scaleUpThreshold, scaleDownThreshold } = this.config.scaling;
    
    // Calculate current utilization
    const totalCapacity = Array.from(this.workers.values())
      .reduce((sum, worker) => sum + worker.config.capacity, 0);
    const currentUtilization = totalCapacity > 0 ? 
      (demand.queueSize + this.getActiveExecutions()) / totalCapacity : 0;
    
    // Check cooldown period
    const timeSinceLastScaling = Date.now() - this.lastScalingAction.getTime();
    const cooldownPeriod = currentUtilization > targetUtilization ? 
      this.config.scaling.scaleUpCooldown : this.config.scaling.scaleDownCooldown;
    
    if (timeSinceLastScaling < cooldownPeriod) {
      return {
        action: 'no_action',
        targetWorkerCount: currentWorkers,
        reason: 'Cooldown period active',
        confidence: 0
      };
    }
    
    // Scale up decision
    if (currentUtilization > scaleUpThreshold && currentWorkers < maxWorkers) {
      const targetWorkers = Math.min(
        maxWorkers,
        Math.ceil(currentWorkers * 1.5) // Scale up by 50%
      );
      
      return {
        action: 'scale_up',
        targetWorkerCount: targetWorkers,
        reason: `High utilization: ${(currentUtilization * 100).toFixed(1)}%`,
        confidence: Math.min(1, (currentUtilization - scaleUpThreshold) / 0.2)
      };
    }
    
    // Scale down decision
    if (currentUtilization < scaleDownThreshold && currentWorkers > minWorkers) {
      const targetWorkers = Math.max(
        minWorkers,
        Math.floor(currentWorkers * 0.8) // Scale down by 20%
      );
      
      return {
        action: 'scale_down',
        targetWorkerCount: targetWorkers,
        reason: `Low utilization: ${(currentUtilization * 100).toFixed(1)}%`,
        confidence: Math.min(1, (scaleDownThreshold - currentUtilization) / 0.2)
      };
    }
    
    return {
      action: 'no_action',
      targetWorkerCount: currentWorkers,
      reason: `Utilization within target range: ${(currentUtilization * 100).toFixed(1)}%`,
      confidence: 1
    };
  }

  private async executeScalingDecision(decision: ScalingDecision): Promise<void> {
    const currentWorkers = this.workers.size;
    const targetWorkers = decision.targetWorkerCount;
    
    if (decision.action === 'scale_up') {
      const workersToAdd = targetWorkers - currentWorkers;
      
      for (let i = 0; i < workersToAdd; i++) {
        await this.startWorker();
      }
      
      this.logger.info(`Scaled up: added ${workersToAdd} workers`);
      
    } else if (decision.action === 'scale_down') {
      const workersToRemove = currentWorkers - targetWorkers;
      const idleWorkers = Array.from(this.workers.values())
        .filter(worker => worker.status === WorkerStatus.IDLE)
        .slice(0, workersToRemove);
      
      for (const worker of idleWorkers) {
        await this.shutdownWorker(worker.id);
        this.workers.delete(worker.id);
      }
      
      this.logger.info(`Scaled down: removed ${idleWorkers.length} workers`);
    }
    
    this.lastScalingAction = new Date();
    this.updateWorkerMetrics();
    
    this.emit('scaling_completed', decision);
  }

  private getActiveExecutions(): number {
    return Array.from(this.workers.values())
      .reduce((sum, worker) => sum + worker.activeExecutions.size, 0);
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metrics.collectionInterval);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }

  private startAutoScaling(): void {
    this.scalingInterval = setInterval(async () => {
      const demand = this.calculateExecutionDemand();
      await this.scaleExecutors(demand);
    }, 60000); // Every minute
  }

  private collectMetrics(): void {
    const activeExecutions = this.getActiveExecutions();
    const totalWorkers = this.workers.size;
    const activeWorkers = Array.from(this.workers.values())
      .filter(worker => worker.status !== WorkerStatus.OFFLINE).length;
    
    this.metrics.currentQueueSize = this.executionQueue.size();
    this.metrics.activeWorkers = activeWorkers;
    this.metrics.totalWorkers = totalWorkers;
    this.metrics.systemUtilization = totalWorkers > 0 ? activeExecutions / (totalWorkers * 10) : 0;
    
    // Calculate throughput (executions per minute)
    const completedExecutions = this.metrics.successfulExecutions + this.metrics.failedExecutions;
    this.metrics.throughput = completedExecutions; // Simplified calculation
    
    // Calculate error rate
    this.metrics.errorRate = this.metrics.totalExecutions > 0 ? 
      this.metrics.failedExecutions / this.metrics.totalExecutions : 0;
    
    this.emit('metrics_updated', this.metrics);
  }

  private performHealthChecks(): void {
    const now = new Date();
    const unhealthyWorkers: string[] = [];
    
    for (const [workerId, worker] of this.workers) {
      const timeSinceHeartbeat = now.getTime() - worker.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > worker.config.healthCheckInterval * 2) {
        worker.status = WorkerStatus.UNHEALTHY;
        unhealthyWorkers.push(workerId);
      }
    }
    
    // Handle unhealthy workers
    for (const workerId of unhealthyWorkers) {
      this.handleExecutorFailure(workerId);
    }
  }

  private calculateExecutionDemand(): ExecutionDemand {
    const queueSize = this.executionQueue.size();
    const averageWaitTime = 0; // Would be calculated from queue metrics
    const executionRate = this.metrics.throughput;
    
    // Calculate engine type distribution
    const engineTypeDistribution: Record<EngineType, number> = {
      [EngineType.LANGFLOW]: 0,
      [EngineType.N8N]: 0,
      [EngineType.LANGSMITH]: 0
    };
    
    return {
      queueSize,
      averageWaitTime,
      executionRate,
      engineTypeDistribution
    };
  }

  private updateQueueMetrics(): void {
    this.metrics.currentQueueSize = this.executionQueue.size();
  }

  private updateWorkerMetrics(): void {
    this.metrics.totalWorkers = this.workers.size;
    this.metrics.activeWorkers = Array.from(this.workers.values())
      .filter(worker => worker.status !== WorkerStatus.OFFLINE).length;
  }

  private async handleExecutionCompleted(executionId: string, result: ExecutionResult): Promise<void> {
    this.metrics.successfulExecutions++;
    this.logger.info(`Execution completed: ${executionId}`);
  }

  private async handleExecutionFailed(executionId: string, error: Error): Promise<void> {
    this.metrics.failedExecutions++;
    this.logger.error(`Execution failed: ${executionId}`, { error: error.message });
  }
}