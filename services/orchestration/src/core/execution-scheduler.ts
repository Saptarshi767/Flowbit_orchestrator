import { EventEmitter } from 'events';
import { CronJob } from 'cron';
import {
  WorkflowDefinition,
  WorkflowParameters
} from '@robust-ai-orchestrator/shared';
import { ExecutionRequest, ExecutionPriority } from './execution-queue';
import { Logger } from '../utils/logger';

export interface ScheduleConfig {
  cronExpression: string;
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
  maxExecutions?: number;
  priority?: ExecutionPriority;
  enabled?: boolean;
}

export interface ScheduledWorkflow {
  id: string;
  workflow: WorkflowDefinition;
  schedule: ScheduleConfig;
  parameters: WorkflowParameters;
  userId?: string;
  createdAt: Date;
  lastExecution?: Date;
  nextExecution?: Date;
  executionCount: number;
  job: CronJob;
}

export interface SchedulerStats {
  totalScheduled: number;
  activeSchedules: number;
  totalExecutions: number;
  failedSchedules: number;
}

/**
 * Execution scheduler with cron job support
 */
export class ExecutionScheduler extends EventEmitter {
  private readonly logger: Logger;
  private readonly scheduledWorkflows: Map<string, ScheduledWorkflow> = new Map();
  private isRunning: boolean = false;
  private stats: SchedulerStats = {
    totalScheduled: 0,
    activeSchedules: 0,
    totalExecutions: 0,
    failedSchedules: 0
  };

  constructor() {
    super();
    this.logger = new Logger('execution-scheduler');
  }

  /**
   * Starts the scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.logger.info('Starting execution scheduler');
    this.isRunning = true;

    // Start all existing scheduled jobs
    for (const scheduled of this.scheduledWorkflows.values()) {
      if (scheduled.schedule.enabled !== false) {
        scheduled.job.start();
      }
    }

    this.emit('started');
  }

  /**
   * Stops the scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping execution scheduler');
    this.isRunning = false;

    // Stop all scheduled jobs
    for (const scheduled of this.scheduledWorkflows.values()) {
      scheduled.job.stop();
    }

    this.emit('stopped');
  }

  /**
   * Schedules a workflow for recurring execution
   */
  async scheduleWorkflow(
    workflow: WorkflowDefinition,
    schedule: ScheduleConfig,
    parameters: WorkflowParameters = {},
    userId?: string
  ): Promise<string> {
    const scheduleId = this.generateScheduleId();

    try {
      // Validate cron expression
      this.validateCronExpression(schedule.cronExpression);

      // Create cron job
      const job = new CronJob(
        schedule.cronExpression,
        () => this.executeScheduledWorkflow(scheduleId),
        null, // onComplete callback
        false, // start immediately
        schedule.timezone || 'UTC'
      );

      const scheduledWorkflow: ScheduledWorkflow = {
        id: scheduleId,
        workflow,
        schedule,
        parameters,
        userId,
        createdAt: new Date(),
        executionCount: 0,
        job
      };

      // Calculate next execution time
      scheduledWorkflow.nextExecution = job.nextDate().toDate();

      this.scheduledWorkflows.set(scheduleId, scheduledWorkflow);
      this.stats.totalScheduled++;
      this.stats.activeSchedules++;

      // Start the job if scheduler is running and schedule is enabled
      if (this.isRunning && schedule.enabled !== false) {
        job.start();
      }

      this.logger.info('Workflow scheduled successfully', {
        scheduleId,
        workflowName: workflow.name,
        cronExpression: schedule.cronExpression,
        nextExecution: scheduledWorkflow.nextExecution
      });

      this.emit('workflowScheduled', scheduledWorkflow);

      return scheduleId;
    } catch (error) {
      this.logger.error('Failed to schedule workflow', {
        workflowName: workflow.name,
        cronExpression: schedule.cronExpression,
        error
      });
      throw error;
    }
  }

  /**
   * Unschedules a workflow
   */
  async unscheduleWorkflow(scheduleId: string): Promise<boolean> {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      this.logger.warn('Attempted to unschedule non-existent workflow', { scheduleId });
      return false;
    }

    try {
      // Stop the cron job
      scheduled.job.stop();
      scheduled.job.destroy();

      // Remove from scheduled workflows
      this.scheduledWorkflows.delete(scheduleId);
      this.stats.activeSchedules--;

      this.logger.info('Workflow unscheduled successfully', {
        scheduleId,
        workflowName: scheduled.workflow.name
      });

      this.emit('workflowUnscheduled', scheduled);

      return true;
    } catch (error) {
      this.logger.error('Failed to unschedule workflow', { scheduleId, error });
      return false;
    }
  }

  /**
   * Updates a scheduled workflow
   */
  async updateSchedule(
    scheduleId: string,
    newSchedule: Partial<ScheduleConfig>
  ): Promise<boolean> {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      this.logger.warn('Attempted to update non-existent schedule', { scheduleId });
      return false;
    }

    try {
      // Stop the current job
      scheduled.job.stop();

      // Update schedule config
      const updatedSchedule = { ...scheduled.schedule, ...newSchedule };

      // Create new cron job if cron expression changed
      if (newSchedule.cronExpression && newSchedule.cronExpression !== scheduled.schedule.cronExpression) {
        this.validateCronExpression(newSchedule.cronExpression);
        
        scheduled.job.destroy();
        scheduled.job = new CronJob(
          newSchedule.cronExpression,
          () => this.executeScheduledWorkflow(scheduleId),
          null,
          false,
          updatedSchedule.timezone || 'UTC'
        );
      }

      scheduled.schedule = updatedSchedule;
      scheduled.nextExecution = scheduled.job.nextDate().toDate();

      // Start the job if enabled and scheduler is running
      if (this.isRunning && updatedSchedule.enabled !== false) {
        scheduled.job.start();
      }

      this.logger.info('Schedule updated successfully', {
        scheduleId,
        workflowName: scheduled.workflow.name,
        nextExecution: scheduled.nextExecution
      });

      this.emit('scheduleUpdated', scheduled);

      return true;
    } catch (error) {
      this.logger.error('Failed to update schedule', { scheduleId, error });
      return false;
    }
  }

  /**
   * Gets a scheduled workflow by ID
   */
  getScheduledWorkflow(scheduleId: string): ScheduledWorkflow | undefined {
    return this.scheduledWorkflows.get(scheduleId);
  }

  /**
   * Gets all scheduled workflows
   */
  getAllScheduledWorkflows(): ScheduledWorkflow[] {
    return Array.from(this.scheduledWorkflows.values());
  }

  /**
   * Gets scheduled workflows for a specific user
   */
  getUserScheduledWorkflows(userId: string): ScheduledWorkflow[] {
    return Array.from(this.scheduledWorkflows.values())
      .filter(scheduled => scheduled.userId === userId);
  }

  /**
   * Gets the next execution time for a schedule
   */
  getNextExecutionTime(scheduleId: string): Date | null {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      return null;
    }

    try {
      return scheduled.job.nextDate().toDate();
    } catch (error) {
      this.logger.error('Failed to get next execution time', { scheduleId, error });
      return null;
    }
  }

  /**
   * Enables or disables a schedule
   */
  async toggleSchedule(scheduleId: string, enabled: boolean): Promise<boolean> {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      return false;
    }

    try {
      scheduled.schedule.enabled = enabled;

      if (enabled && this.isRunning) {
        scheduled.job.start();
        scheduled.nextExecution = scheduled.job.nextDate().toDate();
      } else {
        scheduled.job.stop();
        scheduled.nextExecution = undefined;
      }

      this.logger.info('Schedule toggled', {
        scheduleId,
        enabled,
        workflowName: scheduled.workflow.name
      });

      this.emit('scheduleToggled', { scheduled, enabled });

      return true;
    } catch (error) {
      this.logger.error('Failed to toggle schedule', { scheduleId, enabled, error });
      return false;
    }
  }

  /**
   * Gets scheduler statistics
   */
  getStats(): SchedulerStats {
    return {
      ...this.stats,
      activeSchedules: this.scheduledWorkflows.size
    };
  }

  /**
   * Manually triggers a scheduled workflow
   */
  async triggerScheduledWorkflow(scheduleId: string): Promise<void> {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      throw new Error(`Scheduled workflow not found: ${scheduleId}`);
    }

    this.logger.info('Manually triggering scheduled workflow', {
      scheduleId,
      workflowName: scheduled.workflow.name
    });

    await this.executeScheduledWorkflow(scheduleId);
  }

  private async executeScheduledWorkflow(scheduleId: string): Promise<void> {
    const scheduled = this.scheduledWorkflows.get(scheduleId);
    if (!scheduled) {
      this.logger.error('Attempted to execute non-existent scheduled workflow', { scheduleId });
      return;
    }

    try {
      // Check if we've reached max executions
      if (scheduled.schedule.maxExecutions && 
          scheduled.executionCount >= scheduled.schedule.maxExecutions) {
        this.logger.info('Max executions reached, unscheduling workflow', {
          scheduleId,
          maxExecutions: scheduled.schedule.maxExecutions
        });
        await this.unscheduleWorkflow(scheduleId);
        return;
      }

      // Check if we've passed the end date
      if (scheduled.schedule.endDate && new Date() > scheduled.schedule.endDate) {
        this.logger.info('End date reached, unscheduling workflow', {
          scheduleId,
          endDate: scheduled.schedule.endDate
        });
        await this.unscheduleWorkflow(scheduleId);
        return;
      }

      // Create execution request
      const executionRequest: ExecutionRequest = {
        id: this.generateExecutionId(),
        workflow: scheduled.workflow,
        parameters: scheduled.parameters,
        priority: scheduled.schedule.priority || ExecutionPriority.NORMAL,
        userId: scheduled.userId,
        createdAt: new Date(),
        timeout: 300000 // 5 minutes default timeout
      };

      // Update scheduled workflow stats
      scheduled.lastExecution = new Date();
      scheduled.executionCount++;
      scheduled.nextExecution = scheduled.job.nextDate().toDate();

      this.stats.totalExecutions++;

      this.logger.info('Executing scheduled workflow', {
        scheduleId,
        executionId: executionRequest.id,
        workflowName: scheduled.workflow.name,
        executionCount: scheduled.executionCount
      });

      this.emit('scheduledExecution', executionRequest);
    } catch (error) {
      this.stats.failedSchedules++;
      
      this.logger.error('Failed to execute scheduled workflow', {
        scheduleId,
        workflowName: scheduled.workflow.name,
        error
      });

      this.emit('scheduleError', {
        scheduleId,
        scheduled,
        error
      });
    }
  }

  private validateCronExpression(cronExpression: string): void {
    try {
      // Basic validation - try to create a CronJob
      const testJob = new CronJob(cronExpression, () => {}, null, false);
      testJob.destroy();
    } catch (error) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}