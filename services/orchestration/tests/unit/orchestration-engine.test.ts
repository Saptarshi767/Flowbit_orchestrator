import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  OrchestrationEngine,
  OrchestrationConfig,
  ScheduleResult
} from '../../src/core/orchestration-engine';
import { ExecutionPriority } from '../../src/core/execution-queue';
import { IEngineAdapter } from '../../src/interfaces/engine-adapter.interface';
import {
  WorkflowDefinition,
  WorkflowParameters,
  ExecutionResult,
  ExecutionStatus,
  EngineType,
  ValidationResult
} from '@robust-ai-orchestrator/shared';

// Mock adapter for testing
class MockEngineAdapter implements IEngineAdapter {
  public readonly engineType = EngineType.LANGFLOW;
  
  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    return {
      isValid: true,
      errors: [],
      warnings: []
    };
  }

  async executeWorkflow(workflow: WorkflowDefinition, parameters: WorkflowParameters): Promise<ExecutionResult> {
    return {
      id: 'test-execution-id',
      status: ExecutionStatus.COMPLETED,
      result: { message: 'Mock execution completed' },
      startTime: new Date(),
      endTime: new Date()
    };
  }

  async getExecutionLogs(executionId: string) {
    return [];
  }

  async cancelExecution(executionId: string) {
    return { success: true };
  }

  async getExecutionStatus(executionId: string): Promise<ExecutionResult> {
    return {
      id: executionId,
      status: ExecutionStatus.RUNNING,
      startTime: new Date()
    };
  }

  async convertWorkflow(workflow: WorkflowDefinition, sourceEngine: EngineType): Promise<WorkflowDefinition> {
    return workflow;
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async getCapabilities() {
    return {
      version: '1.0.0',
      supportedFeatures: ['basic'],
      maxConcurrentExecutions: 10
    };
  }
}

describe('OrchestrationEngine', () => {
  let engine: OrchestrationEngine;
  let mockAdapter: MockEngineAdapter;
  let config: OrchestrationConfig;

  beforeEach(() => {
    config = {
      maxConcurrentExecutions: 5,
      defaultTimeout: 30000,
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffFactor: 2
      },
      queueConfig: {
        maxQueueSize: 100,
        processingInterval: 1000
      }
    };

    engine = new OrchestrationEngine(config);
    mockAdapter = new MockEngineAdapter();
    engine.registerAdapter(mockAdapter);
  });

  afterEach(async () => {
    if (engine) {
      await engine.stop();
    }
  });

  describe('Initialization', () => {
    it('should create orchestration engine with config', () => {
      expect(engine).toBeDefined();
      expect(engine.getQueueStats()).toBeDefined();
      expect(engine.getSchedulerStats()).toBeDefined();
    });

    it('should register engine adapters', () => {
      const newAdapter = new MockEngineAdapter();
      engine.registerAdapter(newAdapter);
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Engine Lifecycle', () => {
    it('should start and stop engine', async () => {
      const startPromise = engine.start();
      await expect(startPromise).resolves.toBeUndefined();

      const stopPromise = engine.stop();
      await expect(stopPromise).resolves.toBeUndefined();
    });

    it('should emit started and stopped events', async () => {
      const startedSpy = vi.fn();
      const stoppedSpy = vi.fn();

      engine.on('started', startedSpy);
      engine.on('stopped', stoppedSpy);

      await engine.start();
      expect(startedSpy).toHaveBeenCalled();

      await engine.stop();
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await engine.start();
      await expect(engine.start()).rejects.toThrow('already running');
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should execute workflow successfully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const parameters: WorkflowParameters = { input: 'test' };

      const result = await engine.executeWorkflow(workflow, parameters);
      expect(result).toBeDefined();
      expect(result.status).toBe(ExecutionStatus.COMPLETED);
    });

    it('should execute workflow with priority', async () => {
      const workflow: WorkflowDefinition = {
        name: 'High Priority Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const result = await engine.executeWorkflow(
        workflow,
        {},
        ExecutionPriority.HIGH,
        'user123'
      );

      expect(result).toBeDefined();
    });

    it('should fail execution for invalid workflow', async () => {
      // Mock validation failure
      vi.spyOn(mockAdapter, 'validateWorkflow').mockResolvedValue({
        isValid: false,
        errors: [{ field: 'name', message: 'Name is required', code: 'MISSING_NAME' }],
        warnings: []
      });

      const workflow: WorkflowDefinition = {
        name: '',
        engineType: EngineType.LANGFLOW,
        definition: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('Workflow validation failed');
    });

    it('should fail execution if engine not running', async () => {
      await engine.stop();

      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('not running');
    });

    it('should fail execution for unsupported engine type', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Test Workflow',
        engineType: EngineType.N8N, // Not registered
        definition: {}
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow('No adapter registered');
    });
  });

  describe('Workflow Scheduling', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should schedule workflow successfully', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Scheduled Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const schedule = {
        cronExpression: '0 0 * * *', // Daily at midnight
        timezone: 'UTC'
      };

      const result: ScheduleResult = await engine.scheduleWorkflow(
        workflow,
        schedule,
        {},
        'user123'
      );

      expect(result.success).toBe(true);
      expect(result.scheduleId).toBeDefined();
      expect(result.nextExecution).toBeInstanceOf(Date);
    });

    it('should fail to schedule invalid workflow', async () => {
      // Mock validation failure
      vi.spyOn(mockAdapter, 'validateWorkflow').mockResolvedValue({
        isValid: false,
        errors: [{ field: 'definition', message: 'Invalid definition', code: 'INVALID_DEF' }],
        warnings: []
      });

      const workflow: WorkflowDefinition = {
        name: 'Invalid Workflow',
        engineType: EngineType.LANGFLOW,
        definition: null
      };

      const schedule = {
        cronExpression: '0 0 * * *'
      };

      await expect(engine.scheduleWorkflow(workflow, schedule)).rejects.toThrow('Workflow validation failed');
    });

    it('should unschedule workflow', async () => {
      const workflow: WorkflowDefinition = {
        name: 'Scheduled Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const schedule = {
        cronExpression: '0 0 * * *'
      };

      const scheduleResult = await engine.scheduleWorkflow(workflow, schedule);
      expect(scheduleResult.success).toBe(true);

      const unscheduleResult = await engine.unscheduleWorkflow(scheduleResult.scheduleId);
      expect(unscheduleResult).toBe(true);
    });
  });

  describe('Execution Management', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should cancel execution', async () => {
      // Mock cancel success
      vi.spyOn(mockAdapter, 'cancelExecution').mockResolvedValue({ success: true });

      const result = await engine.cancelExecution('test-execution-id');
      expect(result).toBe(true);
    });

    it('should handle cancel failure', async () => {
      // Mock cancel failure
      vi.spyOn(mockAdapter, 'cancelExecution').mockResolvedValue({ 
        success: false, 
        error: 'Execution not found' 
      });

      const result = await engine.cancelExecution('non-existent-id');
      expect(result).toBe(false);
    });

    it('should get execution status', async () => {
      const status = await engine.getExecutionStatus('test-execution-id');
      expect(status).toBeDefined();
      expect(status?.id).toBe('test-execution-id');
    });

    it('should return null for non-existent execution status', async () => {
      const status = await engine.getExecutionStatus('non-existent-id');
      expect(status).toBeNull();
    });

    it('should get active executions', () => {
      const activeExecutions = engine.getActiveExecutions();
      expect(Array.isArray(activeExecutions)).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should get queue statistics', () => {
      const stats = engine.getQueueStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalQueued).toBe('number');
      expect(typeof stats.totalProcessed).toBe('number');
      expect(typeof stats.currentQueueSize).toBe('number');
    });

    it('should get scheduler statistics', () => {
      const stats = engine.getSchedulerStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalScheduled).toBe('number');
      expect(typeof stats.activeSchedules).toBe('number');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should emit execution events', async () => {
      const executionStartedSpy = vi.fn();
      const executionCompletedSpy = vi.fn();

      engine.on('executionStarted', executionStartedSpy);
      engine.on('executionCompleted', executionCompletedSpy);

      const workflow: WorkflowDefinition = {
        name: 'Event Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      await engine.executeWorkflow(workflow);

      // Give some time for events to be emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executionStartedSpy).toHaveBeenCalled();
      expect(executionCompletedSpy).toHaveBeenCalled();
    });

    it('should emit schedule events', async () => {
      const scheduleErrorSpy = vi.fn();
      engine.on('scheduleError', scheduleErrorSpy);

      // This should not emit error for valid schedule
      const workflow: WorkflowDefinition = {
        name: 'Schedule Event Test',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      const schedule = {
        cronExpression: '0 0 * * *'
      };

      await engine.scheduleWorkflow(workflow, schedule);
      
      // No error should be emitted for valid schedule
      expect(scheduleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should handle adapter execution errors', async () => {
      // Mock execution error
      vi.spyOn(mockAdapter, 'executeWorkflow').mockRejectedValue(new Error('Adapter error'));

      const workflow: WorkflowDefinition = {
        name: 'Error Test Workflow',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow();
    });

    it('should handle adapter validation errors', async () => {
      // Mock validation error
      vi.spyOn(mockAdapter, 'validateWorkflow').mockRejectedValue(new Error('Validation error'));

      const workflow: WorkflowDefinition = {
        name: 'Validation Error Test',
        engineType: EngineType.LANGFLOW,
        definition: { nodes: [], edges: [] }
      };

      await expect(engine.executeWorkflow(workflow)).rejects.toThrow();
    });
  });
});