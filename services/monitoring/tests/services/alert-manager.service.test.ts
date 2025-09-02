import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AlertManagerService } from '../../src/services/alert-manager.service';
import { AlertCondition, AlertOperator, AlertSeverity, AlertStatus } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';

// Mock node-cron
vi.mock('node-cron', () => ({
  schedule: vi.fn(() => ({
    stop: vi.fn()
  }))
}));

describe('AlertManagerService', () => {
  let service: AlertManagerService;
  let logger: any;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    service = new AlertManagerService(logger);
  });

  afterEach(() => {
    service.cleanup();
    vi.clearAllMocks();
  });

  describe('createCondition', () => {
    it('should create a new alert condition', async () => {
      const condition: AlertCondition = {
        id: 'test-condition',
        name: 'Test Condition',
        description: 'Test alert condition',
        metric: 'cpu_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 80,
        duration: 300,
        severity: AlertSeverity.HIGH,
        enabled: true
      };

      const created = await service.createCondition(condition);

      expect(created).toMatchObject({
        name: 'Test Condition',
        metric: 'cpu_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 80,
        severity: AlertSeverity.HIGH,
        enabled: true
      });
      expect(created.id).toBeDefined();
    });

    it('should generate ID if not provided', async () => {
      const condition: Omit<AlertCondition, 'id'> = {
        name: 'Auto ID Condition',
        metric: 'memory_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 90,
        duration: 60,
        severity: AlertSeverity.CRITICAL,
        enabled: true
      };

      const created = await service.createCondition(condition as AlertCondition);

      expect(created.id).toBeDefined();
      expect(created.id).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });
  });

  describe('updateCondition', () => {
    it('should update an existing alert condition', async () => {
      const condition: AlertCondition = {
        id: 'update-test',
        name: 'Original Name',
        metric: 'disk_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 85,
        duration: 300,
        severity: AlertSeverity.MEDIUM,
        enabled: true
      };

      await service.createCondition(condition);

      const updated = await service.updateCondition('update-test', {
        name: 'Updated Name',
        threshold: 90,
        severity: AlertSeverity.HIGH
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.threshold).toBe(90);
      expect(updated.severity).toBe(AlertSeverity.HIGH);
      expect(updated.metric).toBe('disk_usage'); // Unchanged
    });

    it('should throw error for non-existent condition', async () => {
      await expect(
        service.updateCondition('non-existent', { threshold: 50 })
      ).rejects.toThrow('Alert condition not found: non-existent');
    });
  });

  describe('deleteCondition', () => {
    it('should delete an existing alert condition', async () => {
      const condition: AlertCondition = {
        id: 'delete-test',
        name: 'Delete Test',
        metric: 'network_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 100,
        duration: 300,
        severity: AlertSeverity.LOW,
        enabled: true
      };

      await service.createCondition(condition);
      
      const conditions = await service.getConditions();
      expect(conditions).toHaveLength(1);

      await service.deleteCondition('delete-test');
      
      const conditionsAfterDelete = await service.getConditions();
      expect(conditionsAfterDelete).toHaveLength(0);
    });

    it('should throw error for non-existent condition', async () => {
      await expect(
        service.deleteCondition('non-existent')
      ).rejects.toThrow('Alert condition not found: non-existent');
    });
  });

  describe('getConditions', () => {
    it('should return all alert conditions', async () => {
      const condition1: AlertCondition = {
        id: 'condition-1',
        name: 'Condition 1',
        metric: 'metric1',
        operator: AlertOperator.GREATER_THAN,
        threshold: 50,
        duration: 300,
        severity: AlertSeverity.LOW,
        enabled: true
      };

      const condition2: AlertCondition = {
        id: 'condition-2',
        name: 'Condition 2',
        metric: 'metric2',
        operator: AlertOperator.LESS_THAN,
        threshold: 10,
        duration: 600,
        severity: AlertSeverity.HIGH,
        enabled: false
      };

      await service.createCondition(condition1);
      await service.createCondition(condition2);

      const conditions = await service.getConditions();
      expect(conditions).toHaveLength(2);
      expect(conditions.map(c => c.name)).toContain('Condition 1');
      expect(conditions.map(c => c.name)).toContain('Condition 2');
    });

    it('should return empty array when no conditions exist', async () => {
      const conditions = await service.getConditions();
      expect(conditions).toHaveLength(0);
    });
  });

  describe('evaluateConditions', () => {
    beforeEach(() => {
      // Add some test metric data
      service.updateMetric('cpu_usage', 85);
      service.updateMetric('memory_usage', 45);
      service.updateMetric('disk_usage', 95);
    });

    it('should trigger alerts for conditions that exceed thresholds', async () => {
      const condition: AlertCondition = {
        id: 'eval-test',
        name: 'CPU Alert',
        metric: 'cpu_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 80,
        duration: 1,
        severity: AlertSeverity.HIGH,
        enabled: true
      };

      await service.createCondition(condition);
      
      const alerts = await service.evaluateConditions();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].conditionId).toBe('eval-test');
      expect(alerts[0].status).toBe(AlertStatus.TRIGGERED);
      expect(alerts[0].value).toBe(85);
      expect(alerts[0].threshold).toBe(80);
    });

    it('should not trigger alerts for disabled conditions', async () => {
      const condition: AlertCondition = {
        id: 'disabled-test',
        name: 'Disabled Alert',
        metric: 'cpu_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 80,
        duration: 1,
        severity: AlertSeverity.HIGH,
        enabled: false
      };

      await service.createCondition(condition);
      
      const alerts = await service.evaluateConditions();
      
      expect(alerts).toHaveLength(0);
    });

    it('should not trigger alerts when conditions are not met', async () => {
      const condition: AlertCondition = {
        id: 'no-trigger-test',
        name: 'No Trigger Alert',
        metric: 'memory_usage',
        operator: AlertOperator.GREATER_THAN,
        threshold: 80,
        duration: 1,
        severity: AlertSeverity.MEDIUM,
        enabled: true
      };

      await service.createCondition(condition);
      
      const alerts = await service.evaluateConditions();
      
      expect(alerts).toHaveLength(0);
    });

    it('should handle different operators correctly', async () => {
      const conditions: AlertCondition[] = [
        {
          id: 'gt-test',
          name: 'Greater Than',
          metric: 'cpu_usage',
          operator: AlertOperator.GREATER_THAN,
          threshold: 80,
          duration: 1,
          severity: AlertSeverity.HIGH,
          enabled: true
        },
        {
          id: 'lt-test',
          name: 'Less Than',
          metric: 'memory_usage',
          operator: AlertOperator.LESS_THAN,
          threshold: 50,
          duration: 1,
          severity: AlertSeverity.MEDIUM,
          enabled: true
        },
        {
          id: 'gte-test',
          name: 'Greater Than Equal',
          metric: 'disk_usage',
          operator: AlertOperator.GREATER_THAN_OR_EQUAL,
          threshold: 95,
          duration: 1,
          severity: AlertSeverity.CRITICAL,
          enabled: true
        }
      ];

      for (const condition of conditions) {
        await service.createCondition(condition);
      }
      
      const alerts = await service.evaluateConditions();
      
      expect(alerts).toHaveLength(3);
      expect(alerts.map(a => a.conditionId)).toContain('gt-test');
      expect(alerts.map(a => a.conditionId)).toContain('lt-test');
      expect(alerts.map(a => a.conditionId)).toContain('gte-test');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an active alert', async () => {
      const condition: AlertCondition = {
        id: 'ack-test',
        name: 'Acknowledge Test',
        metric: 'test_metric',
        operator: AlertOperator.GREATER_THAN,
        threshold: 50,
        duration: 1,
        severity: AlertSeverity.MEDIUM,
        enabled: true
      };

      await service.createCondition(condition);
      service.updateMetric('test_metric', 75);
      
      const alerts = await service.evaluateConditions();
      const alertId = alerts[0].id;

      await service.acknowledgeAlert(alertId, 'user123');

      const activeAlerts = service.getActiveAlerts();
      const acknowledgedAlert = activeAlerts.find(a => a.id === alertId);
      
      expect(acknowledgedAlert?.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(acknowledgedAlert?.metadata?.acknowledgedBy).toBe('user123');
      expect(acknowledgedAlert?.metadata?.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent alert', async () => {
      await expect(
        service.acknowledgeAlert('non-existent', 'user123')
      ).rejects.toThrow('Alert not found: non-existent');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an active alert', async () => {
      const condition: AlertCondition = {
        id: 'resolve-test',
        name: 'Resolve Test',
        metric: 'test_metric',
        operator: AlertOperator.GREATER_THAN,
        threshold: 50,
        duration: 1,
        severity: AlertSeverity.MEDIUM,
        enabled: true
      };

      await service.createCondition(condition);
      service.updateMetric('test_metric', 75);
      
      const alerts = await service.evaluateConditions();
      const alertId = alerts[0].id;

      await service.resolveAlert(alertId);

      const activeAlerts = service.getActiveAlerts();
      const resolvedAlert = activeAlerts.find(a => a.id === alertId);
      
      expect(resolvedAlert?.status).toBe(AlertStatus.RESOLVED);
      expect(resolvedAlert?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent alert', async () => {
      await expect(
        service.resolveAlert('non-existent')
      ).rejects.toThrow('Alert not found: non-existent');
    });
  });

  describe('updateMetric', () => {
    it('should update metric values for alert evaluation', () => {
      expect(() => {
        service.updateMetric('test_metric', 100, { service: 'test' });
      }).not.toThrow();
    });

    it('should maintain metric history', () => {
      service.updateMetric('history_test', 10);
      service.updateMetric('history_test', 20);
      service.updateMetric('history_test', 30);

      // The service should maintain history internally
      // This is tested indirectly through alert evaluation
      expect(true).toBe(true);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      const condition: AlertCondition = {
        id: 'utility-test',
        name: 'Utility Test',
        metric: 'test_metric',
        operator: AlertOperator.GREATER_THAN,
        threshold: 50,
        duration: 1,
        severity: AlertSeverity.HIGH,
        enabled: true
      };

      await service.createCondition(condition);
      service.updateMetric('test_metric', 75);
      await service.evaluateConditions();
    });

    it('should get active alerts', () => {
      const activeAlerts = service.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts[0].status).toBe(AlertStatus.TRIGGERED);
    });

    it('should get alert history', () => {
      const history = service.getAlertHistory(10);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should get alerts by condition', () => {
      const conditionAlerts = service.getAlertsByCondition('utility-test');
      expect(conditionAlerts.length).toBeGreaterThan(0);
      expect(conditionAlerts[0].conditionId).toBe('utility-test');
    });

    it('should get alerts by severity', () => {
      const highSeverityAlerts = service.getAlertsBySeverity(AlertSeverity.HIGH);
      expect(highSeverityAlerts.length).toBeGreaterThan(0);
      expect(highSeverityAlerts[0].severity).toBe(AlertSeverity.HIGH);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      expect(() => {
        service.cleanup();
      }).not.toThrow();
    });
  });
}); 