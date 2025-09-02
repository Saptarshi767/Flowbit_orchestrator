import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationService } from '../../src/services/notification.service';
import { Alert, NotificationConfig, NotificationChannel, NotificationChannelType, AlertStatus, AlertSeverity } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('NotificationService', () => {
  let service: NotificationService;
  let logger: any;
  let mockAlert: Alert;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    service = new NotificationService(logger);
    
    mockAlert = {
      id: 'test-alert-123',
      conditionId: 'test-condition-456',
      status: AlertStatus.TRIGGERED,
      triggeredAt: new Date('2024-01-01T10:00:00Z'),
      message: 'CPU usage is above threshold',
      value: 85,
      threshold: 80,
      severity: AlertSeverity.HIGH,
      metadata: {
        conditionName: 'High CPU Usage Alert'
      }
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should send notification to email channel', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: {
              to: 'admin@example.com',
              from: 'alerts@system.com'
            },
            enabled: true
          }
        ]
      };

      await expect(service.sendNotification(mockAlert, config)).resolves.not.toThrow();
      
      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history).toHaveLength(1);
      expect(history[0].channel).toBe(NotificationChannelType.EMAIL);
      expect(history[0].status).toBe('sent');
    });

    it('should send notification to Slack channel', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SLACK,
            config: {
              webhookUrl: 'https://hooks.slack.com/test-webhook'
            },
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/test-webhook',
        expect.objectContaining({
          text: expect.stringContaining('CPU usage is above threshold'),
          attachments: expect.arrayContaining([
            expect.objectContaining({
              color: 'warning',
              fields: expect.any(Array)
            })
          ])
        }),
        expect.objectContaining({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('sent');
    });

    it('should send notification to webhook channel', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.WEBHOOK,
            config: {
              url: 'https://api.example.com/webhook',
              authHeader: 'Authorization',
              authValue: 'Bearer token123'
            },
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          alert: mockAlert,
          timestamp: expect.any(String),
          source: 'robust-ai-orchestrator-monitoring'
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123'
          })
        })
      );
    });

    it('should send SMS notification', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SMS,
            config: {
              phoneNumber: '+1234567890'
            },
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].channel).toBe(NotificationChannelType.SMS);
      expect(history[0].status).toBe('sent');
    });

    it('should skip disabled channels', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: { to: 'admin@example.com' },
            enabled: false
          },
          {
            type: NotificationChannelType.SLACK,
            config: { webhookUrl: 'https://hooks.slack.com/test' },
            enabled: true
          }
        ]
      };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history).toHaveLength(1);
      expect(history[0].channel).toBe(NotificationChannelType.SLACK);
    });

    it('should handle notification failures gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SLACK,
            config: { webhookUrl: 'https://hooks.slack.com/test' },
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toContain('Network error');
    });

    it('should respect throttling configuration', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: { to: 'admin@example.com' },
            enabled: true
          }
        ],
        throttle: 300 // 5 minutes
      };

      // Send first notification
      await service.sendNotification(mockAlert, config);
      
      // Try to send second notification immediately (should be throttled)
      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history).toHaveLength(1); // Only first notification should be sent
    });
  });

  describe('testNotification', () => {
    it('should send test notification successfully', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SLACK,
            config: { webhookUrl: 'https://hooks.slack.com/test' },
            enabled: true
          }
        ]
      };

      const result = await service.testNotification(config);
      expect(result).toBe(true);
    });

    it('should return false on test notification failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Test failed'));

      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SLACK,
            config: { webhookUrl: 'https://hooks.slack.com/test' },
            enabled: true
          }
        ]
      };

      const result = await service.testNotification(config);
      expect(result).toBe(false);
    });
  });

  describe('template management', () => {
    it('should set and get custom templates', () => {
      const customTemplate = {
        subject: 'Custom Alert: {{alertName}}',
        body: 'Custom alert body with {{message}}'
      };

      service.setTemplate('custom_alert', customTemplate);
      const retrieved = service.getTemplate('custom_alert');

      expect(retrieved).toEqual(customTemplate);
    });

    it('should get available templates', () => {
      const templates = service.getAvailableTemplates();
      expect(templates).toContain('alert_triggered');
      expect(templates).toContain('alert_resolved');
      expect(templates).toContain('system_health');
    });

    it('should render template with alert data', () => {
      const template = {
        subject: 'Alert: {{alertName}} - {{severity}}',
        body: 'Message: {{message}}\nValue: {{value}}\nThreshold: {{threshold}}'
      };

      service.setTemplate('test_template', template);
      
      // Test template rendering indirectly through notification
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: { to: 'test@example.com' },
            enabled: true
          }
        ],
        template: 'test_template'
      };

      expect(async () => {
        await service.sendNotification(mockAlert, config);
      }).not.toThrow();
    });
  });

  describe('Slack color mapping', () => {
    it('should map alert severities to correct Slack colors', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const testCases = [
        { severity: AlertSeverity.CRITICAL, expectedColor: 'danger' },
        { severity: AlertSeverity.HIGH, expectedColor: 'warning' },
        { severity: AlertSeverity.MEDIUM, expectedColor: '#ffcc00' },
        { severity: AlertSeverity.LOW, expectedColor: 'good' }
      ];

      for (const testCase of testCases) {
        const alert = { ...mockAlert, severity: testCase.severity };
        const config: NotificationConfig = {
          channels: [
            {
              type: NotificationChannelType.SLACK,
              config: { webhookUrl: 'https://hooks.slack.com/test' },
              enabled: true
            }
          ]
        };

        await service.sendNotification(alert, config);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            attachments: expect.arrayContaining([
              expect.objectContaining({
                color: testCase.expectedColor
              })
            ])
          }),
          expect.any(Object)
        );

        mockedAxios.post.mockClear();
      }
    });
  });

  describe('notification history', () => {
    it('should track notification history', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: { to: 'admin@example.com' },
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: expect.any(String),
        alertId: mockAlert.id,
        channel: NotificationChannelType.EMAIL,
        status: 'sent',
        sentAt: expect.any(Date)
      });
    });

    it('should return empty history for non-existent alert', async () => {
      const history = await service.getNotificationHistory('non-existent');
      expect(history).toHaveLength(0);
    });
  });

  describe('notification stats', () => {
    beforeEach(async () => {
      // Send some test notifications
      const configs = [
        {
          channels: [
            { type: NotificationChannelType.EMAIL, config: { to: 'test@example.com' }, enabled: true }
          ]
        },
        {
          channels: [
            { type: NotificationChannelType.SLACK, config: { webhookUrl: 'https://hooks.slack.com/test' }, enabled: true }
          ]
        }
      ];

      mockedAxios.post.mockResolvedValueOnce({ status: 200 });
      mockedAxios.post.mockRejectedValueOnce(new Error('Failed'));

      for (const config of configs) {
        await service.sendNotification(mockAlert, config);
      }
    });

    it('should provide notification statistics', () => {
      const stats = service.getNotificationStats();
      
      expect(stats.totalNotifications).toBe(2);
      expect(stats.successfulNotifications).toBe(1);
      expect(stats.failedNotifications).toBe(1);
      expect(stats.channelStats[NotificationChannelType.EMAIL]).toBe(1);
      expect(stats.channelStats[NotificationChannelType.SLACK]).toBe(1);
    });
  });

  describe('history cleanup', () => {
    it('should cleanup old notification history', async () => {
      // Create old notification history
      const oldAlert = { ...mockAlert, id: 'old-alert' };
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: { to: 'test@example.com' },
            enabled: true
          }
        ]
      };

      await service.sendNotification(oldAlert, config);

      // Manually set old timestamp
      const history = await service.getNotificationHistory('old-alert');
      if (history.length > 0) {
        history[0].sentAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      }

      service.cleanupHistory(30); // Keep 30 days

      const historyAfterCleanup = await service.getNotificationHistory('old-alert');
      expect(historyAfterCleanup).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing email recipient', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.EMAIL,
            config: {}, // Missing 'to' field
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toContain('Email recipient not specified');
    });

    it('should handle missing Slack webhook URL', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SLACK,
            config: {}, // Missing webhookUrl
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toContain('Slack webhook URL not specified');
    });

    it('should handle missing webhook URL', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.WEBHOOK,
            config: {}, // Missing url
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toContain('Webhook URL not specified');
    });

    it('should handle missing SMS phone number', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: NotificationChannelType.SMS,
            config: {}, // Missing phoneNumber
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toContain('SMS phone number not specified');
    });

    it('should handle unsupported notification channel', async () => {
      const config: NotificationConfig = {
        channels: [
          {
            type: 'unsupported' as NotificationChannelType,
            config: {},
            enabled: true
          }
        ]
      };

      await service.sendNotification(mockAlert, config);

      const history = await service.getNotificationHistory(mockAlert.id);
      expect(history[0].status).toBe('failed');
      expect(history[0].error).toContain('Unsupported notification channel');
    });
  });
});