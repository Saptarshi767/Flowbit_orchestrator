import { IAlertManager } from '../interfaces/monitoring.interface';
import { 
  AlertCondition, 
  Alert, 
  AlertStatus, 
  AlertOperator, 
  AlertSeverity 
} from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';

interface AlertConditionWithState extends AlertCondition {
  lastEvaluated?: Date;
  consecutiveFailures: number;
  isTriggered: boolean;
}

interface MetricValue {
  timestamp: Date;
  value: number;
  labels: Record<string, string>;
}

export class AlertManagerService implements IAlertManager {
  private conditions: Map<string, AlertConditionWithState> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metricHistory: Map<string, MetricValue[]> = new Map();
  private logger: Logger;
  private evaluationTask?: cron.ScheduledTask;
  private evaluationInterval: number = 30; // seconds

  constructor(logger: Logger) {
    this.logger = logger;
    this.startEvaluationLoop();
  }

  private startEvaluationLoop(): void {
    // Run alert evaluation every 30 seconds
    this.evaluationTask = cron.schedule('*/30 * * * * *', async () => {
      try {
        await this.evaluateConditions();
      } catch (error) {
        this.logger.error('Error during alert evaluation:', error);
      }
    });

    this.logger.info(`Alert evaluation started with ${this.evaluationInterval}s interval`);
  }

  async createCondition(condition: AlertCondition): Promise<AlertCondition> {
    try {
      const conditionWithState: AlertConditionWithState = {
        ...condition,
        id: condition.id || uuidv4(),
        consecutiveFailures: 0,
        isTriggered: false
      };

      this.conditions.set(conditionWithState.id, conditionWithState);
      this.logger.info(`Created alert condition: ${conditionWithState.name} (${conditionWithState.id})`);
      
      return conditionWithState;
    } catch (error) {
      this.logger.error('Failed to create alert condition:', error);
      throw error;
    }
  }

  async updateCondition(id: string, updates: Partial<AlertCondition>): Promise<AlertCondition> {
    try {
      const condition = this.conditions.get(id);
      if (!condition) {
        throw new Error(`Alert condition not found: ${id}`);
      }

      const updatedCondition: AlertConditionWithState = {
        ...condition,
        ...updates,
        id // Ensure ID cannot be changed
      };

      this.conditions.set(id, updatedCondition);
      this.logger.info(`Updated alert condition: ${updatedCondition.name} (${id})`);
      
      return updatedCondition;
    } catch (error) {
      this.logger.error(`Failed to update alert condition ${id}:`, error);
      throw error;
    }
  }

  async deleteCondition(id: string): Promise<void> {
    try {
      const condition = this.conditions.get(id);
      if (!condition) {
        throw new Error(`Alert condition not found: ${id}`);
      }

      this.conditions.delete(id);
      
      // Resolve any active alerts for this condition
      for (const [alertId, alert] of this.activeAlerts.entries()) {
        if (alert.conditionId === id) {
          await this.resolveAlert(alertId);
        }
      }

      this.logger.info(`Deleted alert condition: ${condition.name} (${id})`);
    } catch (error) {
      this.logger.error(`Failed to delete alert condition ${id}:`, error);
      throw error;
    }
  }

  async getConditions(): Promise<AlertCondition[]> {
    return Array.from(this.conditions.values());
  }

  async evaluateConditions(): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];
    const now = new Date();

    for (const condition of this.conditions.values()) {
      if (!condition.enabled) {
        continue;
      }

      try {
        const shouldTrigger = await this.evaluateCondition(condition, now);
        
        if (shouldTrigger && !condition.isTriggered) {
          // Condition just became true
          const alert = await this.triggerAlert(condition, now);
          triggeredAlerts.push(alert);
          condition.isTriggered = true;
          condition.consecutiveFailures++;
        } else if (!shouldTrigger && condition.isTriggered) {
          // Condition resolved
          await this.resolveAlertsForCondition(condition.id);
          condition.isTriggered = false;
          condition.consecutiveFailures = 0;
        } else if (shouldTrigger) {
          // Condition still true
          condition.consecutiveFailures++;
        } else {
          // Condition still false
          condition.consecutiveFailures = 0;
        }

        condition.lastEvaluated = now;
      } catch (error) {
        this.logger.error(`Failed to evaluate condition ${condition.id}:`, error);
      }
    }

    if (triggeredAlerts.length > 0) {
      this.logger.info(`Triggered ${triggeredAlerts.length} alerts`);
    }

    return triggeredAlerts;
  }

  private async evaluateCondition(condition: AlertConditionWithState, timestamp: Date): Promise<boolean> {
    // Get recent metric values for the condition
    const metricValues = this.getRecentMetricValues(condition.metric, condition.duration);
    
    if (metricValues.length === 0) {
      this.logger.debug(`No metric values found for ${condition.metric}`);
      return false;
    }

    // Get the latest value
    const latestValue = metricValues[metricValues.length - 1];
    
    // Evaluate the condition
    return this.evaluateThreshold(latestValue.value, condition.operator, condition.threshold);
  }

  private evaluateThreshold(value: number, operator: AlertOperator, threshold: number): boolean {
    switch (operator) {
      case AlertOperator.GREATER_THAN:
        return value > threshold;
      case AlertOperator.LESS_THAN:
        return value < threshold;
      case AlertOperator.EQUALS:
        return value === threshold;
      case AlertOperator.NOT_EQUALS:
        return value !== threshold;
      case AlertOperator.GREATER_THAN_OR_EQUAL:
        return value >= threshold;
      case AlertOperator.LESS_THAN_OR_EQUAL:
        return value <= threshold;
      default:
        this.logger.warn(`Unknown alert operator: ${operator}`);
        return false;
    }
  }

  private getRecentMetricValues(metricName: string, durationSeconds: number): MetricValue[] {
    const values = this.metricHistory.get(metricName) || [];
    const cutoffTime = new Date(Date.now() - durationSeconds * 1000);
    
    return values.filter(value => value.timestamp >= cutoffTime);
  }

  private async triggerAlert(condition: AlertConditionWithState, timestamp: Date): Promise<Alert> {
    const alertId = uuidv4();
    const metricValues = this.getRecentMetricValues(condition.metric, condition.duration);
    const currentValue = metricValues.length > 0 ? metricValues[metricValues.length - 1].value : 0;

    const alert: Alert = {
      id: alertId,
      conditionId: condition.id,
      status: AlertStatus.TRIGGERED,
      triggeredAt: timestamp,
      message: this.generateAlertMessage(condition, currentValue),
      value: currentValue,
      threshold: condition.threshold,
      severity: condition.severity,
      metadata: {
        metric: condition.metric,
        operator: condition.operator,
        duration: condition.duration,
        consecutiveFailures: condition.consecutiveFailures
      }
    };

    this.activeAlerts.set(alertId, alert);
    this.logger.warn(`Alert triggered: ${condition.name} - ${alert.message}`);
    
    return alert;
  }

  private generateAlertMessage(condition: AlertCondition, currentValue: number): string {
    const operatorText = this.getOperatorText(condition.operator);
    return `${condition.name}: ${condition.metric} is ${currentValue} (${operatorText} ${condition.threshold})`;
  }

  private getOperatorText(operator: AlertOperator): string {
    switch (operator) {
      case AlertOperator.GREATER_THAN: return 'greater than';
      case AlertOperator.LESS_THAN: return 'less than';
      case AlertOperator.EQUALS: return 'equal to';
      case AlertOperator.NOT_EQUALS: return 'not equal to';
      case AlertOperator.GREATER_THAN_OR_EQUAL: return 'greater than or equal to';
      case AlertOperator.LESS_THAN_OR_EQUAL: return 'less than or equal to';
      default: return 'compared to';
    }
  }

  private async resolveAlertsForCondition(conditionId: string): Promise<void> {
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.conditionId === conditionId && alert.status === AlertStatus.TRIGGERED) {
        await this.resolveAlert(alertId);
      }
    }
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.metadata = {
        ...alert.metadata,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      };

      this.logger.info(`Alert acknowledged: ${alertId} by user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert ${alertId}:`, error);
      throw error;
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();

      this.logger.info(`Alert resolved: ${alertId}`);
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}:`, error);
      throw error;
    }
  }

  // Method to receive metric updates
  updateMetric(metricName: string, value: number, labels: Record<string, string> = {}): void {
    const metricValue: MetricValue = {
      timestamp: new Date(),
      value,
      labels
    };

    if (!this.metricHistory.has(metricName)) {
      this.metricHistory.set(metricName, []);
    }

    const history = this.metricHistory.get(metricName)!;
    history.push(metricValue);

    // Keep only recent values (last hour)
    const cutoffTime = new Date(Date.now() - 3600 * 1000);
    const recentValues = history.filter(v => v.timestamp >= cutoffTime);
    this.metricHistory.set(metricName, recentValues);
  }

  // Utility methods
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => alert.status === AlertStatus.TRIGGERED
    );
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
      .slice(0, limit);
  }

  getAlertsByCondition(conditionId: string): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => alert.conditionId === conditionId
    );
  }

  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      alert => alert.severity === severity && alert.status === AlertStatus.TRIGGERED
    );
  }

  // Cleanup method
  cleanup(): void {
    if (this.evaluationTask) {
      this.evaluationTask.stop();
    }
    this.conditions.clear();
    this.activeAlerts.clear();
    this.metricHistory.clear();
    this.logger.info('Alert manager cleaned up');
  }
}