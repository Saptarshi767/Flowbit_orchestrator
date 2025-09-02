import { INotificationService, NotificationHistory } from '../interfaces/monitoring.interface';
import { Alert, NotificationConfig, NotificationChannel, NotificationChannelType } from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface NotificationTemplate {
  subject: string;
  body: string;
}

export class NotificationService implements INotificationService {
  private notificationHistory: Map<string, NotificationHistory[]> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private logger: Logger;
  private throttleMap: Map<string, Date> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Default alert templates
    this.templates.set('alert_triggered', {
      subject: '🚨 Alert Triggered: {{alertName}}',
      body: `
Alert: {{alertName}}
Severity: {{severity}}
Message: {{message}}
Value: {{value}} (threshold: {{threshold}})
Triggered at: {{triggeredAt}}

Alert ID: {{alertId}}
Condition ID: {{conditionId}}
      `.trim()
    });

    this.templates.set('alert_resolved', {
      subject: '✅ Alert Resolved: {{alertName}}',
      body: `
Alert: {{alertName}}
Status: Resolved
Resolved at: {{resolvedAt}}
Duration: {{duration}}

Alert ID: {{alertId}}
      `.trim()
    });

    this.templates.set('system_health', {
      subject: '⚠️ System Health Alert',
      body: `
System health status has changed.

Service: {{service}}
Status: {{status}}
Message: {{message}}
Timestamp: {{timestamp}}
      `.trim()
    });
  }

  async sendNotification(alert: Alert, config: NotificationConfig): Promise<void> {
    try {
      // Check throttling
      if (this.isThrottled(alert, config)) {
        this.logger.debug(`Notification throttled for alert ${alert.id}`);
        return;
      }

      // Send to each enabled channel
      const promises = config.channels
        .filter(channel => channel.enabled)
        .map(channel => this.sendToChannel(alert, channel, config.template));

      await Promise.allSettled(promises);

      // Update throttle map
      if (config.throttle) {
        const throttleKey = this.getThrottleKey(alert, config);
        this.throttleMap.set(throttleKey, new Date());
      }

      this.logger.info(`Sent notifications for alert ${alert.id} to ${config.channels.length} channels`);
    } catch (error) {
      this.logger.error(`Failed to send notification for alert ${alert.id}:`, error);
      throw error;
    }
  }

  private isThrottled(alert: Alert, config: NotificationConfig): boolean {
    if (!config.throttle) return false;

    const throttleKey = this.getThrottleKey(alert, config);
    const lastSent = this.throttleMap.get(throttleKey);
    
    if (!lastSent) return false;

    const throttleExpiry = new Date(lastSent.getTime() + config.throttle * 1000);
    return new Date() < throttleExpiry;
  }

  private getThrottleKey(alert: Alert, config: NotificationConfig): string {
    return `${alert.conditionId}_${config.channels.map(c => c.type).join('_')}`;
  }

  private async sendToChannel(alert: Alert, channel: NotificationChannel, templateName?: string): Promise<void> {
    const historyEntry: NotificationHistory = {
      id: uuidv4(),
      alertId: alert.id,
      channel: channel.type,
      status: 'pending',
      sentAt: new Date()
    };

    try {
      switch (channel.type) {
        case NotificationChannelType.EMAIL:
          await this.sendEmail(alert, channel, templateName);
          break;
        case NotificationChannelType.SLACK:
          await this.sendSlack(alert, channel, templateName);
          break;
        case NotificationChannelType.WEBHOOK:
          await this.sendWebhook(alert, channel, templateName);
          break;
        case NotificationChannelType.SMS:
          await this.sendSMS(alert, channel, templateName);
          break;
        default:
          throw new Error(`Unsupported notification channel: ${channel.type}`);
      }

      historyEntry.status = 'sent';
      this.logger.debug(`Notification sent via ${channel.type} for alert ${alert.id}`);
    } catch (error) {
      historyEntry.status = 'failed';
      historyEntry.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send notification via ${channel.type} for alert ${alert.id}:`, error);
    }

    // Store notification history
    if (!this.notificationHistory.has(alert.id)) {
      this.notificationHistory.set(alert.id, []);
    }
    this.notificationHistory.get(alert.id)!.push(historyEntry);
  }

  private async sendEmail(alert: Alert, channel: NotificationChannel, templateName?: string): Promise<void> {
    const template = this.getTemplate(templateName || 'alert_triggered');
    const content = this.renderTemplate(template, alert);

    // In a real implementation, you would integrate with an email service like SendGrid, SES, etc.
    const emailConfig = channel.config;
    
    if (!emailConfig.to) {
      throw new Error('Email recipient not specified');
    }

    // Simulate email sending
    this.logger.info(`[EMAIL] To: ${emailConfig.to}, Subject: ${content.subject}`);
    this.logger.debug(`[EMAIL] Body: ${content.body}`);

    // In production, replace with actual email service call:
    // await emailService.send({
    //   to: emailConfig.to,
    //   subject: content.subject,
    //   body: content.body,
    //   from: emailConfig.from || 'alerts@robust-ai-orchestrator.com'
    // });
  }

  private async sendSlack(alert: Alert, channel: NotificationChannel, templateName?: string): Promise<void> {
    const slackConfig = channel.config;
    
    if (!slackConfig.webhookUrl) {
      throw new Error('Slack webhook URL not specified');
    }

    const message = {
      text: `Alert: ${alert.message}`,
      attachments: [
        {
          color: this.getSlackColor(alert.severity),
          fields: [
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            },
            {
              title: 'Value',
              value: `${alert.value} (threshold: ${alert.threshold})`,
              short: true
            },
            {
              title: 'Triggered At',
              value: alert.triggeredAt.toISOString(),
              short: true
            },
            {
              title: 'Alert ID',
              value: alert.id,
              short: true
            }
          ]
        }
      ]
    };

    await axios.post(slackConfig.webhookUrl, message, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private getSlackColor(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return '#ffcc00';
      case 'low': return 'good';
      default: return '#cccccc';
    }
  }

  private async sendWebhook(alert: Alert, channel: NotificationChannel, templateName?: string): Promise<void> {
    const webhookConfig = channel.config;
    
    if (!webhookConfig.url) {
      throw new Error('Webhook URL not specified');
    }

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      source: 'robust-ai-orchestrator-monitoring'
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RobustAI-Orchestrator-Monitor/1.0'
    };

    // Add authentication headers if specified
    if (webhookConfig.authHeader && webhookConfig.authValue) {
      headers[webhookConfig.authHeader] = webhookConfig.authValue;
    }

    await axios.post(webhookConfig.url, payload, {
      timeout: 10000,
      headers
    });
  }

  private async sendSMS(alert: Alert, channel: NotificationChannel, templateName?: string): Promise<void> {
    const smsConfig = channel.config;
    
    if (!smsConfig.phoneNumber) {
      throw new Error('SMS phone number not specified');
    }

    const message = `Alert: ${alert.message}. Severity: ${alert.severity}. Value: ${alert.value}`;

    // In a real implementation, you would integrate with an SMS service like Twilio
    this.logger.info(`[SMS] To: ${smsConfig.phoneNumber}, Message: ${message}`);

    // Simulate SMS sending
    // await smsService.send({
    //   to: smsConfig.phoneNumber,
    //   message: message.substring(0, 160) // SMS character limit
    // });
  }

  private getTemplate(templateName: string): NotificationTemplate {
    const template = this.templates.get(templateName);
    if (!template) {
      return this.templates.get('alert_triggered')!;
    }
    return template;
  }

  private renderTemplate(template: NotificationTemplate, alert: Alert): { subject: string; body: string } {
    const variables = {
      alertId: alert.id,
      alertName: alert.metadata?.conditionName || 'Unknown Alert',
      severity: alert.severity,
      message: alert.message,
      value: alert.value,
      threshold: alert.threshold,
      triggeredAt: alert.triggeredAt.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString() || 'Not resolved',
      conditionId: alert.conditionId,
      duration: alert.resolvedAt 
        ? `${Math.round((alert.resolvedAt.getTime() - alert.triggeredAt.getTime()) / 1000)}s`
        : 'Ongoing'
    };

    let subject = template.subject;
    let body = template.body;

    // Replace template variables
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return { subject, body };
  }

  async testNotification(config: NotificationConfig): Promise<boolean> {
    try {
      // Create a test alert
      const testAlert: Alert = {
        id: 'test_alert',
        conditionId: 'test_condition',
        status: 'triggered' as any,
        triggeredAt: new Date(),
        message: 'This is a test alert to verify notification configuration',
        value: 100,
        threshold: 50,
        severity: 'medium' as any,
        metadata: {
          conditionName: 'Test Alert Condition',
          test: true
        }
      };

      await this.sendNotification(testAlert, config);
      return true;
    } catch (error) {
      this.logger.error('Notification test failed:', error);
      return false;
    }
  }

  async getNotificationHistory(alertId: string): Promise<NotificationHistory[]> {
    return this.notificationHistory.get(alertId) || [];
  }

  // Template management
  setTemplate(name: string, template: NotificationTemplate): void {
    this.templates.set(name, template);
    this.logger.debug(`Set notification template: ${name}`);
  }

  getTemplate(name: string): NotificationTemplate | undefined {
    return this.templates.get(name);
  }

  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  // Utility methods
  getNotificationStats(): {
    totalNotifications: number;
    successfulNotifications: number;
    failedNotifications: number;
    channelStats: Record<string, number>;
  } {
    let total = 0;
    let successful = 0;
    let failed = 0;
    const channelStats: Record<string, number> = {};

    for (const history of this.notificationHistory.values()) {
      for (const entry of history) {
        total++;
        
        if (entry.status === 'sent') {
          successful++;
        } else if (entry.status === 'failed') {
          failed++;
        }

        channelStats[entry.channel] = (channelStats[entry.channel] || 0) + 1;
      }
    }

    return {
      totalNotifications: total,
      successfulNotifications: successful,
      failedNotifications: failed,
      channelStats
    };
  }

  // Cleanup old notification history
  cleanupHistory(retentionDays: number = 30): void {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [alertId, history] of this.notificationHistory.entries()) {
      const filteredHistory = history.filter(entry => entry.sentAt >= cutoffDate);
      
      if (filteredHistory.length !== history.length) {
        removedCount += history.length - filteredHistory.length;
        
        if (filteredHistory.length === 0) {
          this.notificationHistory.delete(alertId);
        } else {
          this.notificationHistory.set(alertId, filteredHistory);
        }
      }
    }

    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} old notification history entries`);
    }
  }
}