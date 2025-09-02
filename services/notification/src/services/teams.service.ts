import axios from 'axios'
import { logger } from '../utils/logger'
import {
  TeamsConfig,
  NotificationEvent,
  NotificationTemplate,
  NotificationDelivery,
  NotificationDeliveryStatus
} from '../types/notification.types'

interface TeamsCard {
  '@type': string
  '@context': string
  themeColor?: string
  summary: string
  sections: TeamsSection[]
  potentialAction?: TeamsAction[]
}

interface TeamsSection {
  activityTitle?: string
  activitySubtitle?: string
  activityImage?: string
  facts?: TeamsFact[]
  markdown?: boolean
  text?: string
}

interface TeamsFact {
  name: string
  value: string
}

interface TeamsAction {
  '@type': string
  name: string
  targets: Array<{
    os: string
    uri: string
  }>
}

export class TeamsService {
  async sendNotification(
    event: NotificationEvent,
    template: NotificationTemplate,
    config: TeamsConfig
  ): Promise<NotificationDelivery> {
    const delivery: NotificationDelivery = {
      id: `teams-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventId: event.id,
      channelId: 'teams',
      ruleId: 'teams-rule',
      status: NotificationDeliveryStatus.PENDING,
      attempts: 0,
      createdAt: new Date()
    }

    try {
      const card = this.formatTeamsCard(event, template, config)
      
      const response = await axios.post(config.webhookUrl, card, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      })

      if (response.status >= 200 && response.status < 300) {
        delivery.status = NotificationDeliveryStatus.DELIVERED
        delivery.deliveredAt = new Date()
        delivery.attempts = 1

        logger.info('Teams notification sent successfully', {
          deliveryId: delivery.id,
          eventType: event.type,
          responseStatus: response.status
        })
      } else {
        throw new Error(`Teams webhook returned status ${response.status}`)
      }
    } catch (error: any) {
      delivery.status = NotificationDeliveryStatus.FAILED
      delivery.error = error.message
      delivery.attempts = 1

      logger.error('Failed to send Teams notification', {
        deliveryId: delivery.id,
        error: error.message
      })
    }

    return delivery
  }

  async sendDirectMessage(
    webhookUrl: string,
    title: string,
    text: string,
    themeColor?: string,
    facts?: TeamsFact[],
    actions?: TeamsAction[]
  ): Promise<void> {
    const card: TeamsCard = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: themeColor || '0076D7',
      summary: title,
      sections: [
        {
          activityTitle: title,
          text,
          facts,
          markdown: true
        }
      ],
      potentialAction: actions
    }

    try {
      const response = await axios.post(webhookUrl, card, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      })

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Teams webhook returned status ${response.status}`)
      }

      logger.info('Teams direct message sent successfully')
    } catch (error: any) {
      logger.error('Failed to send Teams direct message', {
        error: error.message
      })
      throw error
    }
  }

  async testConnection(config: TeamsConfig): Promise<boolean> {
    try {
      const testCard: TeamsCard = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '00FF00',
        summary: 'Connection Test',
        sections: [
          {
            activityTitle: '✅ Connection Test',
            text: 'This is a test message from AI Orchestrator to verify the Teams webhook connection.',
            markdown: true
          }
        ]
      }

      const response = await axios.post(config.webhookUrl, testCard, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })

      if (response.status >= 200 && response.status < 300) {
        logger.info('Teams connection test successful')
        return true
      } else {
        logger.error('Teams connection test failed', { status: response.status })
        return false
      }
    } catch (error: any) {
      logger.error('Teams connection test failed', { error: error.message })
      return false
    }
  }

  private formatTeamsCard(
    event: NotificationEvent,
    template: NotificationTemplate,
    config: TeamsConfig
  ): TeamsCard {
    const card: TeamsCard = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: config.themeColor || this.getEventThemeColor(event.type),
      summary: this.getEventSummary(event)
    }

    // Use template if provided, otherwise generate default card
    if (template && template.body) {
      card.sections = [
        {
          activityTitle: config.title || this.getEventTitle(event),
          text: this.renderTemplate(template.body, event),
          markdown: true
        }
      ]
    } else {
      card.sections = this.generateDefaultSections(event)
    }

    // Add potential actions for workflow-related events
    if (event.type.startsWith('workflow.') && event.data.workflowId) {
      card.potentialAction = this.generateWorkflowActions(event)
    }

    return card
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

  private generateDefaultSections(event: NotificationEvent): TeamsSection[] {
    const sections: TeamsSection[] = []

    // Main section with event details
    const mainSection: TeamsSection = {
      activityTitle: this.getEventTitle(event),
      activitySubtitle: `Source: ${event.source}`,
      facts: [
        {
          name: 'Event Type',
          value: event.type
        },
        {
          name: 'Timestamp',
          value: event.timestamp.toLocaleString()
        }
      ],
      markdown: true
    }

    // Add workflow-specific facts
    if (event.data.workflowName) {
      mainSection.facts!.push({
        name: 'Workflow',
        value: event.data.workflowName
      })
    }

    if (event.data.executionId) {
      mainSection.facts!.push({
        name: 'Execution ID',
        value: event.data.executionId
      })
    }

    if (event.data.duration) {
      mainSection.facts!.push({
        name: 'Duration',
        value: event.data.duration
      })
    }

    sections.push(mainSection)

    // Add error section for failed events
    if (event.type.includes('failed') && event.data.error) {
      sections.push({
        activityTitle: '❌ Error Details',
        text: `\`\`\`\n${event.data.error}\n\`\`\``,
        markdown: true
      })
    }

    return sections
  }

  private generateWorkflowActions(event: NotificationEvent): TeamsAction[] {
    const actions: TeamsAction[] = []

    // Add view workflow action
    if (event.data.workflowId) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Workflow',
        targets: [
          {
            os: 'default',
            uri: `${process.env.FRONTEND_URL}/workflows/${event.data.workflowId}`
          }
        ]
      })
    }

    // Add view execution action for execution events
    if (event.data.executionId && event.type.startsWith('workflow.')) {
      actions.push({
        '@type': 'OpenUri',
        name: 'View Execution',
        targets: [
          {
            os: 'default',
            uri: `${process.env.FRONTEND_URL}/executions/${event.data.executionId}`
          }
        ]
      })
    }

    return actions
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

  private getEventSummary(event: NotificationEvent): string {
    const summaryMap: Record<string, string> = {
      'workflow.started': `Workflow "${event.data.workflowName}" has started`,
      'workflow.completed': `Workflow "${event.data.workflowName}" completed successfully`,
      'workflow.failed': `Workflow "${event.data.workflowName}" failed`,
      'workflow.cancelled': `Workflow "${event.data.workflowName}" was cancelled`,
      'execution.timeout': `Workflow "${event.data.workflowName}" timed out`,
      'system.alert': `System Alert: ${event.data.alertType}`,
      'user.invited': `New user invited to ${event.data.organizationName}`,
      'workflow.shared': `Workflow "${event.data.workflowName}" was shared`,
      'comment.added': `New comment on "${event.data.workflowName}"`,
      'marketplace.published': `Workflow "${event.data.workflowName}" published to marketplace`
    }

    return summaryMap[event.type] || `Notification: ${event.type}`
  }

  private getEventThemeColor(eventType: string): string {
    const colorMap: Record<string, string> = {
      'workflow.started': '0078D4', // Blue
      'workflow.completed': '107C10', // Green
      'workflow.failed': 'D13438', // Red
      'workflow.cancelled': 'FF8C00', // Orange
      'execution.timeout': 'FF8C00', // Orange
      'system.alert': 'D13438', // Red
      'user.invited': '0078D4', // Blue
      'workflow.shared': '5C2D91', // Purple
      'comment.added': '0078D4', // Blue
      'marketplace.published': '107C10' // Green
    }

    return colorMap[eventType] || '0078D4' // Default blue
  }
}