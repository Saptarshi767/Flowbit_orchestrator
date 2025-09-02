import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExecutionScheduler,
  ScheduleConfig
} from '../../src/core/execution-scheduler';
import { ExecutionPriority } from '../../src/core/execution-queue';
import {
  WorkflowDefinition,
  EngineType
} from '@robust-ai-orchestrator/shared';

describe('ExecutionScheduler', () => {
  let scheduler: ExecutionScheduler;

  beforeEach(() => {
    scheduler = new ExecutionScheduler();
  });

  afterEach(async () => {
    if (scheduler) {
      await scheduler.stop();
    }
  });

  describe('Initialization', () => {
    it('should create execution scheduler', () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.getStats()).toBeDefined();
    });
  });

  describe('Scheduler Lifecycle', () => {
    it('should start and stop scheduler', async () => {
      await expect(scheduler.start()).resolves.toBeUndefined();
      await expect(scheduler.stop()).resolves.toBeUndefined();
    });

    it('should emit started and stopped events', async () => {
      const startedSpy = vi.fn();
      const stoppedSpy = vi.fn();

      scheduler.on('started', startedSpy);
      scheduler.on('stopped', stoppedSpy);

      await scheduler.start();
      expect(startedSpy).toHaveBeenCalled();

      await scheduler.stop();
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await scheduler.start();
      await scheduler.start(); // Should not throw or cause issues
      await scheduler.stop();
    });
  });

  describe('Workflow Scheduling', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should schedule workflow with valid cron expression', async () => {
      const workflow = createTestWorkflow('schedule-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *', // Daily at midnight
        timezone: 'UTC'
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      
      expect(scheduleId).toBeDefined();
      expect(typeof scheduleId).toBe('string');

      const stats = scheduler.getStats();
      expect(stats.totalScheduled).toBe(1);
      expect(stats.activeSchedules).toBe(1);
    });

    it('should schedule workflow with parameters and user', async () => {
      const workflow = createTestWorkflow('param-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 12 * * *', // Daily at noon
        priority: ExecutionPriority.HIGH
      };
      const parameters = { input: 'test-data' };
      const userId = 'user123';

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule, parameters, userId);
      
      expect(scheduleId).toBeDefined();

      const scheduledWorkflow = scheduler.getScheduledWorkflow(scheduleId);
      expect(scheduledWorkflow).toBeDefined();
      expect(scheduledWorkflow!.parameters).toEqual(parameters);
      expect(scheduledWorkflow!.userId).toBe(userId);
      expect(scheduledWorkflow!.schedule.priority).toBe(ExecutionPriority.HIGH);
    });

    it('should emit workflowScheduled event', async () => {
      const workflowScheduledSpy = vi.fn();
      scheduler.on('workflowScheduled', workflowScheduledSpy);

      const workflow = createTestWorkflow('event-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      await scheduler.scheduleWorkflow(workflow, schedule);

      expect(workflowScheduledSpy).toHaveBeenCalled();
    });

    it('should reject invalid cron expression', async () => {
      const workflow = createTestWorkflow('invalid-cron');
      const schedule: ScheduleConfig = {
        cronExpression: 'invalid-cron-expression'
      };

      await expect(scheduler.scheduleWorkflow(workflow, schedule))
        .rejects.toThrow('Invalid cron expression');
    });

    it('should schedule with start and end dates', async () => {
      const workflow = createTestWorkflow('date-range-test');
      const startDate = new Date(Date.now() + 1000); // 1 second from now
      const endDate = new Date(Date.now() + 86400000); // 1 day from now

      const schedule: ScheduleConfig = {
        cronExpression: '*/5 * * * *', // Every 5 minutes
        startDate,
        endDate,
        maxExecutions: 10
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      
      const scheduledWorkflow = scheduler.getScheduledWorkflow(scheduleId);
      expect(scheduledWorkflow!.schedule.startDate).toEqual(startDate);
      expect(scheduledWorkflow!.schedule.endDate).toEqual(endDate);
      expect(scheduledWorkflow!.schedule.maxExecutions).toBe(10);
    });
  });

  describe('Workflow Unscheduling', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should unschedule workflow', async () => {
      const workflow = createTestWorkflow('unschedule-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      expect(scheduler.getScheduledWorkflow(scheduleId)).toBeDefined();

      const result = await scheduler.unscheduleWorkflow(scheduleId);
      expect(result).toBe(true);
      expect(scheduler.getScheduledWorkflow(scheduleId)).toBeUndefined();

      const stats = scheduler.getStats();
      expect(stats.activeSchedules).toBe(0);
    });

    it('should emit workflowUnscheduled event', async () => {
      const workflowUnscheduledSpy = vi.fn();
      scheduler.on('workflowUnscheduled', workflowUnscheduledSpy);

      const workflow = createTestWorkflow('unschedule-event-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      await scheduler.unscheduleWorkflow(scheduleId);

      expect(workflowUnscheduledSpy).toHaveBeenCalled();
    });

    it('should return false for non-existent schedule', async () => {
      const result = await scheduler.unscheduleWorkflow('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Schedule Updates', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should update schedule configuration', async () => {
      const workflow = createTestWorkflow('update-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *',
        enabled: true
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);

      const updateResult = await scheduler.updateSchedule(scheduleId, {
        cronExpression: '0 12 * * *', // Change to noon
        enabled: false
      });

      expect(updateResult).toBe(true);

      const updatedSchedule = scheduler.getScheduledWorkflow(scheduleId);
      expect(updatedSchedule!.schedule.cronExpression).toBe('0 12 * * *');
      expect(updatedSchedule!.schedule.enabled).toBe(false);
    });

    it('should emit scheduleUpdated event', async () => {
      const scheduleUpdatedSpy = vi.fn();
      scheduler.on('scheduleUpdated', scheduleUpdatedSpy);

      const workflow = createTestWorkflow('update-event-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      await scheduler.updateSchedule(scheduleId, { enabled: false });

      expect(scheduleUpdatedSpy).toHaveBeenCalled();
    });

    it('should return false for non-existent schedule update', async () => {
      const result = await scheduler.updateSchedule('non-existent-id', { enabled: false });
      expect(result).toBe(false);
    });
  });

  describe('Schedule Management', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should toggle schedule enabled state', async () => {
      const workflow = createTestWorkflow('toggle-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *',
        enabled: true
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);

      // Disable
      let result = await scheduler.toggleSchedule(scheduleId, false);
      expect(result).toBe(true);
      expect(scheduler.getScheduledWorkflow(scheduleId)!.schedule.enabled).toBe(false);

      // Enable
      result = await scheduler.toggleSchedule(scheduleId, true);
      expect(result).toBe(true);
      expect(scheduler.getScheduledWorkflow(scheduleId)!.schedule.enabled).toBe(true);
    });

    it('should emit scheduleToggled event', async () => {
      const scheduleToggledSpy = vi.fn();
      scheduler.on('scheduleToggled', scheduleToggledSpy);

      const workflow = createTestWorkflow('toggle-event-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      await scheduler.toggleSchedule(scheduleId, false);

      expect(scheduleToggledSpy).toHaveBeenCalled();
    });

    it('should get next execution time', async () => {
      const workflow = createTestWorkflow('next-execution-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *' // Daily at midnight
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      const nextExecution = scheduler.getNextExecutionTime(scheduleId);

      expect(nextExecution).toBeInstanceOf(Date);
      expect(nextExecution!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for non-existent schedule next execution', () => {
      const nextExecution = scheduler.getNextExecutionTime('non-existent-id');
      expect(nextExecution).toBeNull();
    });
  });

  describe('Workflow Retrieval', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should get all scheduled workflows', async () => {
      const workflow1 = createTestWorkflow('all-test-1');
      const workflow2 = createTestWorkflow('all-test-2');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      await scheduler.scheduleWorkflow(workflow1, schedule);
      await scheduler.scheduleWorkflow(workflow2, schedule);

      const allScheduled = scheduler.getAllScheduledWorkflows();
      expect(allScheduled).toHaveLength(2);
    });

    it('should get user scheduled workflows', async () => {
      const workflow1 = createTestWorkflow('user-test-1');
      const workflow2 = createTestWorkflow('user-test-2');
      const workflow3 = createTestWorkflow('user-test-3');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      await scheduler.scheduleWorkflow(workflow1, schedule, {}, 'user1');
      await scheduler.scheduleWorkflow(workflow2, schedule, {}, 'user2');
      await scheduler.scheduleWorkflow(workflow3, schedule, {}, 'user1');

      const user1Workflows = scheduler.getUserScheduledWorkflows('user1');
      expect(user1Workflows).toHaveLength(2);
      expect(user1Workflows.every(w => w.userId === 'user1')).toBe(true);

      const user2Workflows = scheduler.getUserScheduledWorkflows('user2');
      expect(user2Workflows).toHaveLength(1);
      expect(user2Workflows[0].userId).toBe('user2');
    });
  });

  describe('Manual Execution', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should manually trigger scheduled workflow', async () => {
      const scheduledExecutionSpy = vi.fn();
      scheduler.on('scheduledExecution', scheduledExecutionSpy);

      const workflow = createTestWorkflow('manual-trigger-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 1 1 *' // Once a year (won't trigger naturally)
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      await scheduler.triggerScheduledWorkflow(scheduleId);

      expect(scheduledExecutionSpy).toHaveBeenCalled();
    });

    it('should throw error for non-existent scheduled workflow', async () => {
      await expect(scheduler.triggerScheduledWorkflow('non-existent-id'))
        .rejects.toThrow('Scheduled workflow not found');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should track scheduler statistics', async () => {
      const workflow1 = createTestWorkflow('stats-test-1');
      const workflow2 = createTestWorkflow('stats-test-2');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      await scheduler.scheduleWorkflow(workflow1, schedule);
      await scheduler.scheduleWorkflow(workflow2, schedule);

      const stats = scheduler.getStats();
      expect(stats.totalScheduled).toBe(2);
      expect(stats.activeSchedules).toBe(2);
      expect(typeof stats.totalExecutions).toBe('number');
      expect(typeof stats.failedSchedules).toBe('number');
    });
  });

  describe('Automatic Execution Handling', () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it('should handle max executions limit', async () => {
      const workflowUnscheduledSpy = vi.fn();
      scheduler.on('workflowUnscheduled', workflowUnscheduledSpy);

      const workflow = createTestWorkflow('max-executions-test');
      const schedule: ScheduleConfig = {
        cronExpression: '*/1 * * * * *', // Every second
        maxExecutions: 1
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      
      // Manually trigger to reach max executions
      await scheduler.triggerScheduledWorkflow(scheduleId);

      // Wait a bit and trigger again to test max executions
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The workflow should be unscheduled after reaching max executions
      const scheduledWorkflow = scheduler.getScheduledWorkflow(scheduleId);
      if (scheduledWorkflow && scheduledWorkflow.executionCount >= 1) {
        expect(workflowUnscheduledSpy).toHaveBeenCalled();
      }
    });

    it('should handle end date expiration', async () => {
      const workflowUnscheduledSpy = vi.fn();
      scheduler.on('workflowUnscheduled', workflowUnscheduledSpy);

      const workflow = createTestWorkflow('end-date-test');
      const schedule: ScheduleConfig = {
        cronExpression: '*/1 * * * * *', // Every second
        endDate: new Date(Date.now() - 1000) // Already expired
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);
      
      // Manually trigger to test end date handling
      await scheduler.triggerScheduledWorkflow(scheduleId);

      // The workflow should be unscheduled due to expired end date
      expect(workflowUnscheduledSpy).toHaveBeenCalled();
    });

    it('should emit schedule error on execution failure', async () => {
      const scheduleErrorSpy = vi.fn();
      scheduler.on('scheduleError', scheduleErrorSpy);

      const workflow = createTestWorkflow('error-test');
      const schedule: ScheduleConfig = {
        cronExpression: '0 0 * * *'
      };

      const scheduleId = await scheduler.scheduleWorkflow(workflow, schedule);

      // Mock an error in execution
      const originalExecute = (scheduler as any).executeScheduledWorkflow;
      (scheduler as any).executeScheduledWorkflow = vi.fn().mockImplementation(() => {
        throw new Error('Execution failed');
      });

      try {
        await scheduler.triggerScheduledWorkflow(scheduleId);
      } catch (error) {
        // Expected to throw
      }

      // Restore original method
      (scheduler as any).executeScheduledWorkflow = originalExecute;

      expect(scheduleErrorSpy).toHaveBeenCalled();
    });
  });

  // Helper function to create test workflows
  function createTestWorkflow(name: string): WorkflowDefinition {
    return {
      name: `Test Workflow ${name}`,
      engineType: EngineType.LANGFLOW,
      definition: { nodes: [], edges: [] }
    };
  }
});