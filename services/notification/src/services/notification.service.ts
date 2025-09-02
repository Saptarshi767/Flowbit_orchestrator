import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import { WebhookService } from './webhook.service'
import { EmailService } from './email.service'
import { SlackService } from './slack.service'
import { TeamsService } from './teams.service'
import {
  NotificationEvent,
  NotificationEventType,
  NotificationChannel,
  NotificationChannelType,
  NotificationRule,
  NotificationTemplate,
  NotificationDelivery,
  NotificationDeliveryStatus,
  WebhookEndpoint
} from '../types/notification.types'

export class NotificationService {
  private webhookService: WebhookService
  private emailService: EmailService
  private slackService: SlackService
  private teamsService: TeamsService

  constructor() {
    this.webhookService = new WebhookService()
    this.emailService = new EmailService()
    this.slackService = new SlackService()
    this.teamsService = new TeamsService()
  }

  async processEvent(event: NotificationEvent): Promise<void> {
    logger.info('Processing notification event', {
      eventId: event.id,
      eventType: event.type,
      source: event.source
    })

    try {
      // Get applicable notification rules
      const rules = await this.getApplicableRules(event)
      
      if (rules.length === 0) {
        logger.debug('No notification rules match this event', { eventId: event.id })
        return
      }

      // Process each rule
      for (const rule of rules) {
        await this.processRule(event, rule)
      }

      // Process webhooks
      await this.processWebhooks(event)

    } catch (error: any) {
      logger.error('Failed to process notification event', {
        eventId: event.id,
        error: error.message
      })
      throw error
    }
  }

  async createEvent(
    type: NotificationEventType,
    source: string,
    data: Record<string, any>,
    userId?: string,
    organizationId?: string
  ): Promise<NotificationEvent> {
    const event: NotificationEvent = {
      id: uuidv4(),
      type,
      source,
      timestamp: new Date(),
      data,
      userId,
      organizationId
    }

    // Store event in database
    await this.storeEvent(event)

    // Process event asynchronously
    setImmediate(() => this.processEvent(event))

    return event
  }

  async createNotificationRule(
    name: string,
    eventTypes: NotificationEventType[],
    channels: string[],
    organizationId?: string,
    userId?: string
  ): Promise<NotificationRule> {
    const rule: NotificationRule = {
      id: uuidv4(),
      name,
      eventTypes,
      channels,
      isActive: true,
      organizationId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await this.storeNotificationRule(rule)
    logger.info('Notification rule created', { ruleId: rule.id, name })
    return rule
  }

  async createNotificationChannel(
    type: NotificationChannelType,
    name: string,
    config: any,
    organizationId?: string,
    userId?: string
  ): Promise<NotificationChannel> {
    // Validate channel configuration
    await this.validateChannelConfig(type, config)

    const channel: NotificationChannel = {
      id: uuidv4(),
      type,
      name,
      config,
      isActive: true,
      organizationId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await this.storeNotificationChannel(channel)
    logger.info('Notification channel created', { channelId: channel.id, type, name })
    return channel
  }

  async testNotificationChannel(channelId: string): Promise<boolean> {
    const channel = await this.getNotificationChannel(channelId)
    if (!channel) {
      throw new Error(`Notification channel not found: ${channelId}`)
    }

    try {
      switch (channel.type) {
        case NotificationChannelType.EMAIL:
          return await this.emailService.testConnection(channel.config.email!)
        
        case NotificationChannelType.SLACK:
          return await this.slackService.testConnection(channel.config.slack!)
        
        case NotificationChannelType.TEAMS:
          return await this.teamsService.testConnection(channel.config.teams!)
        
        case NotificationChannelType.WEBHOOK:
          // For webhooks, we'll just validate the URL format
          return this.validateWebhookUrl(channel.config.webhook!.url)
        
        default:
          throw new Error(`Unsupported channel type: ${channel.type}`)
      }
    } catch (error: any) {
      logger.error('Channel test failed', {
        channelId,
        type: channel.type,
        error: error.message
      })
      return false
    }
  }

  async retryFailedNotifications(): Promise<void> {
    logger.info('Starting retry of failed notifications')
    
    try {
      // Retry webhook deliveries
      await this.webhookService.retryFailedDeliveries()
      
      // Get failed email/slack/teams deliveries and retry them
      const failedDeliveries = await this.getFailedDeliveries()
      
      for (const delivery of failedDeliveries) {
        if (this.shouldRetryDelivery(delivery)) {
          await this.retryDelivery(delivery)
        }
      }
      
      logger.info('Completed retry of failed notifications')
    } catch (error: any) {
      logger.error('Failed to retry notifications', { error: error.message })
    }
  }

  private async processRule(event: NotificationEvent, rule: NotificationRule): Promise<void> {
    logger.debug('Processing notification rule', {
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: event.id
    })

    // Check if rule conditions match
    if (!this.evaluateRuleConditions(event, rule)) {
      logger.debug('Rule conditions not met', { ruleId: rule.id })
      return
    }

    // Get channels for this rule
    const channels = await this.getChannelsByIds(rule.channels)
    
    // Get template for this event type and rule
    const template = await this.getTemplate(event.type, rule.template)

    // Send notifications to each channel
    for (const channel of channels) {
      if (!channel.isActive) {
        logger.debug('Skipping inactive channel', { channelId: channel.id })
        continue
      }

      try {
        await this.sendToChannel(event, channel, template)
      } catch (error: any) {
        logger.error('Failed to send notification to channel', {
          channelId: channel.id,
          channelType: channel.type,
          eventId: event.id,
          error: error.message
        })
      }
    }
  }

  private async processWebhooks(event: NotificationEvent): Promise<void> {
    const webhooks = await this.getWebhooksForEvent(event)
    
    for (const webhook of webhooks) {
      if (!webhook.isActive) {
        continue
      }

      try {
        await this.webhookService.deliverWebhook(webhook, event)
      } catch (error: any) {
        logger.error('Failed to deliver webhook', {
          webhookId: webhook.id,
          eventId: event.id,
          error: error.message
        })
      }
    }
  }

  private async sendToChannel(
    event: NotificationEvent,
    channel: NotificationChannel,
    template?: NotificationTemplate
  ): Promise<void> {
    switch (channel.type) {
      case NotificationChannelType.EMAIL:
        if (channel.config.email && template) {
          const recipients = await this.getEmailRecipients(event, channel)
          await this.emailService.sendNotification(event, template, recipients, channel.config.email)
        }
        break

      case NotificationChannelType.SLACK:
        if (channel.config.slack && template) {
          await this.slackService.sendNotification(event, template, channel.config.slack)
        }
        break

      case NotificationChannelType.TEAMS:
        if (channel.config.teams && template) {
          await this.teamsService.sendNotification(event, template, channel.config.teams)
        }
        break

      case NotificationChannelType.WEBHOOK:
        // Webhooks are handled separately in processWebhooks
        break

      default:
        logger.warn('Unsupported channel type', { channelType: channel.type })
    }
  }

  private evaluateRuleConditions(event: NotificationEvent, rule: NotificationRule): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true
    }

    return rule.conditions.every(condition => {
      const fieldValue = this.getFieldValue(event, condition.field)
      return this.evaluateCondition(fieldValue, condition.operator, condition.value)
    })
  }

  private getFieldValue(event: NotificationEvent, field: string): string {
    const fieldMap: Record<string, any> = {
      'event.type': event.type,
      'event.source': event.source,
      'event.userId': event.userId,
      'event.organizationId': event.organizationId,
      ...Object.keys(event.data).reduce((acc, key) => {
        acc[`data.${key}`] = event.data[key]
        return acc
      }, {} as Record<string, any>)
    }

    return String(fieldMap[field] || '')
  }

  private evaluateCondition(fieldValue: string, operator: string, conditionValue: string): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue
      case 'contains':
        return fieldValue.includes(conditionValue)
      case 'startsWith':
        return fieldValue.startsWith(conditionValue)
      case 'endsWith':
        return fieldValue.endsWith(conditionValue)
      case 'regex':
        return new RegExp(conditionValue).test(fieldValue)
      default:
        return false
    }
  }

  private async validateChannelConfig(type: NotificationChannelType, config: any): Promise<void> {
    switch (type) {
      case NotificationChannelType.EMAIL:
        if (!config.email) throw new Error('Email configuration required')
        break
      case NotificationChannelType.WEBHOOK:
        if (!config.webhook) throw new Error('Webhook configuration required')
        break
      case NotificationChannelType.SLACK:
        if (!config.slack) throw new Error('Slack configuration required')
        break
      case NotificationChannelType.TEAMS:
        if (!config.teams) throw new Error('Teams configuration required')
        break
    }
  }

  private validateWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.protocol === 'https:'
    } catch {
      return false
    }
  }

  private shouldRetryDelivery(delivery: NotificationDelivery): boolean {
    return delivery.status === NotificationDeliveryStatus.FAILED && 
           delivery.attempts < 3 &&
           (!delivery.lastAttemptAt || Date.now() - delivery.lastAttemptAt.getTime() > 60000)
  }

  private async retryDelivery(delivery: NotificationDelivery): Promise<void> {
    // Implementation would retry the specific delivery
    logger.info('Retrying failed delivery', { deliveryId: delivery.id })
  }

  // Database operations (to be implemented with your data layer)
  private async storeEvent(event: NotificationEvent): Promise<void> {
    // Implementation depends on your database layer
  }

  private async storeNotificationRule(rule: NotificationRule): Promise<void> {
    // Implementation depends on your database layer
  }

  private async storeNotificationChannel(channel: NotificationChannel): Promise<void> {
    // Implementation depends on your database layer
  }

  private async getApplicableRules(event: NotificationEvent): Promise<NotificationRule[]> {
    // Implementation depends on your database layer
    return []
  }

  private async getNotificationChannel(channelId: string): Promise<NotificationChannel | null> {
    // Implementation depends on your database layer
    return null
  }

  private async getChannelsByIds(channelIds: string[]): Promise<NotificationChannel[]> {
    // Implementation depends on your database layer
    return []
  }

  private async getTemplate(eventType: NotificationEventType, templateId?: string): Promise<NotificationTemplate | undefined> {
    // Implementation depends on your database layer
    return undefined
  }

  private async getWebhooksForEvent(event: NotificationEvent): Promise<WebhookEndpoint[]> {
    // Implementation depends on your database layer
    return []
  }

  private async getEmailRecipients(event: NotificationEvent, channel: NotificationChannel): Promise<string[]> {
    // Implementation depends on your business logic
    return []
  }

  private async getFailedDeliveries(): Promise<NotificationDelivery[]> {
    // Implementation depends on your database layer
    return []
  }
}