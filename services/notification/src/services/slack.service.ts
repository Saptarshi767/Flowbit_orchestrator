import { WebClient, ChatPostMessageArguments } from '@slack/web-api'
import { logger } from '../utils/logger'
import {
  SlackConfig,
  NotificationEvent,
  NotificationTemplate,
  NotificationDelivery,
  NotificationDeliveryStatus
} from '../types/notification.types'

export class SlackService {
  private clients: Map<string, WebClient> = new Map()

  async sendNotification(
    event: NotificationEvent,
    template: NotificationTemplate,
    config: SlackConfig
  ): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: `slack-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventId: event.id,
      channelId: 'slack',
      ruleId: 'slack-rule',
      status: NotificationDeliveryStatus.PENDING,
      attempts: 0,
      createdAt: new Date()
    }

    try {
      const client = this.getClient(config.botToken)
      const message = this.formatSlackMessage(event, template, config)

      const result = await client.chat.postMessage(message)
      
      if (result.ok) {
        delivery.status = NotificationDeliveryStatus.DELIVERED
        delivery.deliveredAt = new Date()
        delivery.attempts = 1

        logger.info('Slack notification sent successfully', {
          deliveryId: delivery.id,
          channel: config.channel,
          eventType: event.type,
          messageTs: result.ts
        })
      } else {
        throw new Error(result.error || 'Unknown Slack API error')
      }
    } catch (error: any) {
      delivery.status = NotificationDeliveryStatus.FAILED
      delivery.error = error.message
      delivery.attempts = 1

      logger.error('Failed to send Slack notification', {
        deliveryId: delivery.id,
        channel: config.channel,
        error: error.message
      })
    }

    return delivery
  }

  async sendDirectMessage(
    botToken: string,
    channel: string,
    text: string,
    blocks?: any[],
    attachments?: any[]
  ): Promise<void> {
    const client = this.getClient(botToken)

    try {
      const result = await client.chat.postMessage({
        channel,
        text,
        blocks,
        attachments
      })

      if (!result.ok) {
        throw new Error(result.error || 'Unknown Slack API error')
      }

      logger.info('Slack direct message sent successfully', { channel })
    } catch (error: any) {
      logger.error('Failed to send Slack direct message', {
        channel,
        error: error.message
      })
      throw error
    }
  }

  async testConnection(config: SlackConfig): Promise<boolean> {
    try {
      const client = this.getClient(config.botToken)
      const result = await client.auth.test()
      
      if (result.ok) {
        logger.info('Slack connection test successful', {
          teamId: result.team_id,
          userId: result.user_id
        })
        return true
      } else {
        logger.error('Slack connection test failed', { error: result.error })
        return false
      }
    } catch (error: any) {
      logger.error('Slack connection test failed', { error: error.message })
      return false
    }
  }

  private getClient(botToken: string): WebClient {
    if (!this.clients.has(botToken)) {
      this.clients.set(botToken, new WebClient(botToken))
    }
    return this.clients.get(botToken)!
  }

  private formatSlackMessage(
    event: NotificationEvent,
    template: NotificationTemplate,
    config: SlackConfig
  ): ChatPostMessageArguments {
    const baseMessage: ChatPostMessageArguments = {
      channel: config.channel,
      username: config.username || 'AI Orchestrator',
      icon_emoji: config.iconEmoji || ':robot_face:'
    }

    // Use template if provided, otherwise generate default message
    if (template && template.body) {
      return {
        ...baseMessage,
        text: this.renderTemplate(template.body, event),
        blocks: this.generateSlackBlocks(event, template)
      }
    }

    return {
      ...baseMessage,
      text: this.generateDefaultMessage(event),
      blocks: this.generateDefaultBlocks(event)
    }
  }

  private renderTemplate(templateBody: string, event: NotificationEvent): string {
    // Simple template rendering - in production, you might want to use Handlebars
    let rendered = templateBody
    
    const replacements: Record<string, string> = {
      '{{event.type}}': event.type,
      '{{event.source}}': event.source,
      '{{event.timestamp}}': event.timestamp.toISOString(),
      '{{data.workflowName}}': event.data.workflowName || 'Unknown Workflow',
      '{{data.executionId}}': event.data.executionId || 'Unknown Execution',
      '{{data.status}}': event.data.status || 'Unknown Status',
      '{{data.error}}': event.data.error || '',
      '{{data.duration}}': event.data.duration || 'Unknown Duration'
    }

    for (const [placeholder, value] of Object.entries(replacements)) {
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value)
    }

    return rendered
  }

  private generateDefaultMessage(event: NotificationEvent): string {
    const messageMap: Record<string, string> = {
      'workflow.started': `🚀 Workflow "${event.data.workflowName}" has started`,
      'workflow.completed': `✅ Workflow "${event.data.workflowName}" completed successfully`,
      'workflow.failed': `❌ Workflow "${event.data.workflowName}" failed`,
      'workflow.cancelled': `⏹️ Workflow "${event.data.workflowName}" was cancelled`,
      'execution.timeout': `⏰ Workflow "${event.data.workflowName}" timed out`,
      'system.alert': `🚨 System Alert: ${event.data.alertType}`,
      'user.invited': `👋 New user invited to ${event.data.organizationName}`,
      'workflow.shared': `📤 Workflow "${event.data.workflowName}" was shared`,
      'comment.added': `💬 New comment on "${event.data.workflowName}"`,
      'marketplace.published': `🏪 Workflow "${event.data.workflowName}" published to marketplace`
    }

    return messageMap[event.type] || `📢 Notification: ${event.type}`
  }

  private generateSlackBlocks(event: NotificationEvent, template: NotificationTemplate): any[] {
    // Generate rich Slack blocks based on event type
    const blocks: any[] = []

    // Header block
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: this.getEventTitle(event)
      }
    })

    // Context block with event details
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Event Type:*\n${event.type}`
        },
        {
          type: 'mrkdwn',
          text: `*Source:*\n${event.source}`
        },
        {
          type: 'mrkdwn',
          text: `*Timestamp:*\n${event.timestamp.toLocaleString()}`
        }
      ]
    })

    // Add workflow-specific information
    if (event.data.workflowName) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Workflow:* ${event.data.workflowName}`
        }
      })
    }

    // Add error information for failed events
    if (event.type.includes('failed') && event.data.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error:* \`${event.data.error}\``
        }
      })
    }

    // Add execution details
    if (event.data.executionId) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Execution ID:* ${event.data.executionId}`
        }
      })
    }

    return blocks
  }

  private generateDefaultBlocks(event: NotificationEvent): any[] {
    return this.generateSlackBlocks(event, {} as NotificationTemplate)
  }

  private getEventTitle(event: NotificationEvent): string {
    const titleMap: Record<string, string> = {
      'workflow.started': '🚀 Workflow Started',
      'workflow.completed': '✅ Workflow Completed',
      'workflow.failed': '❌ Workflow Failed',
      'workflow.cancelled': '⏹️ Workflow Cancelled',
      'execution.timeout': '⏰ Execution Timeout',
      'system.alert': '🚨 System Alert',
      'user.invited': '👋 User Invited',
      'workflow.shared': '📤 Workflow Shared',
      'comment.added': '💬 New Comment',
      'marketplace.published': '🏪 Marketplace Publication'
    }

    return titleMap[event.type] || '📢 Notification'
  }
}