import nodemailer, { Transporter, SendMailOptions } from 'nodemailer'
import Handlebars from 'handlebars'
import { logger } from '../utils/logger'
import {
  EmailConfig,
  NotificationEvent,
  NotificationTemplate,
  NotificationDelivery,
  NotificationDeliveryStatus
} from '../types/notification.types'

export class EmailService {
  private transporter: Transporter | null = null
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map()

  async initialize(config: EmailConfig): Promise<void> {
    this.transporter = nodemailer.createTransporter({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    })

    // Verify connection
    try {
      await this.transporter.verify()
      logger.info('Email service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize email service', { error })
      throw error
    }
  }

  async sendNotification(
    event: NotificationEvent,
    template: NotificationTemplate,
    recipients: string[],
    config: EmailConfig
  ): Promise<NotificationDelivery[]> {
    if (!this.transporter) {
      throw new Error('Email service not initialized')
    }

    const compiledTemplate = await this.getCompiledTemplate(template)
    const deliveries: NotificationDelivery[] = []

    for (const recipient of recipients) {
      const delivery: NotificationDelivery = {
        id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        eventId: event.id,
        channelId: 'email',
        ruleId: 'email-rule',
        status: NotificationDeliveryStatus.PENDING,
        attempts: 0,
        createdAt: new Date()
      }

      try {
        const emailContent = this.renderTemplate(compiledTemplate, event, template)
        
        const mailOptions: SendMailOptions = {
          from: `${config.fromName} <${config.fromEmail}>`,
          to: recipient,
          subject: emailContent.subject,
          html: emailContent.body,
          text: this.htmlToText(emailContent.body)
        }

        await this.transporter.sendMail(mailOptions)
        
        delivery.status = NotificationDeliveryStatus.DELIVERED
        delivery.deliveredAt = new Date()
        delivery.attempts = 1

        logger.info('Email notification sent successfully', {
          deliveryId: delivery.id,
          recipient,
          eventType: event.type
        })
      } catch (error: any) {
        delivery.status = NotificationDeliveryStatus.FAILED
        delivery.error = error.message
        delivery.attempts = 1

        logger.error('Failed to send email notification', {
          deliveryId: delivery.id,
          recipient,
          error: error.message
        })
      }

      deliveries.push(delivery)
    }

    return deliveries
  }

  async sendDirectEmail(
    to: string | string[],
    subject: string,
    htmlBody: string,
    textBody?: string,
    config?: EmailConfig
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email service not initialized')
    }

    const recipients = Array.isArray(to) ? to : [to]
    
    for (const recipient of recipients) {
      const mailOptions: SendMailOptions = {
        from: config ? `${config.fromName} <${config.fromEmail}>` : undefined,
        to: recipient,
        subject,
        html: htmlBody,
        text: textBody || this.htmlToText(htmlBody)
      }

      try {
        await this.transporter.sendMail(mailOptions)
        logger.info('Direct email sent successfully', { recipient, subject })
      } catch (error: any) {
        logger.error('Failed to send direct email', {
          recipient,
          subject,
          error: error.message
        })
        throw error
      }
    }
  }

  async testConnection(config: EmailConfig): Promise<boolean> {
    try {
      const testTransporter = nodemailer.createTransporter({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword
        }
      })

      await testTransporter.verify()
      return true
    } catch (error) {
      logger.error('Email connection test failed', { error })
      return false
    }
  }

  private async getCompiledTemplate(template: NotificationTemplate): Promise<HandlebarsTemplateDelegate> {
    const cacheKey = `${template.id}-${template.updatedAt.getTime()}`
    
    if (this.templates.has(cacheKey)) {
      return this.templates.get(cacheKey)!
    }

    const compiledTemplate = Handlebars.compile(template.body)
    this.templates.set(cacheKey, compiledTemplate)
    
    // Clean up old templates
    if (this.templates.size > 100) {
      const oldestKey = this.templates.keys().next().value
      this.templates.delete(oldestKey)
    }

    return compiledTemplate
  }

  private renderTemplate(
    compiledTemplate: HandlebarsTemplateDelegate,
    event: NotificationEvent,
    template: NotificationTemplate
  ): { subject: string; body: string } {
    const context = {
      event,
      data: event.data,
      timestamp: event.timestamp,
      eventType: event.type,
      source: event.source,
      userId: event.userId,
      organizationId: event.organizationId
    }

    const body = compiledTemplate(context)
    const subject = template.subject ? Handlebars.compile(template.subject)(context) : this.generateSubject(event)

    return { subject, body }
  }

  private generateSubject(event: NotificationEvent): string {
    const subjectMap: Record<string, string> = {
      'workflow.started': 'Workflow Started: {{data.workflowName}}',
      'workflow.completed': 'Workflow Completed: {{data.workflowName}}',
      'workflow.failed': 'Workflow Failed: {{data.workflowName}}',
      'workflow.cancelled': 'Workflow Cancelled: {{data.workflowName}}',
      'execution.timeout': 'Execution Timeout: {{data.workflowName}}',
      'system.alert': 'System Alert: {{data.alertType}}',
      'user.invited': 'You have been invited to {{data.organizationName}}',
      'workflow.shared': 'Workflow shared with you: {{data.workflowName}}',
      'comment.added': 'New comment on {{data.workflowName}}',
      'marketplace.published': 'Workflow published to marketplace: {{data.workflowName}}'
    }

    const subjectTemplate = subjectMap[event.type] || 'Notification from AI Orchestrator'
    return Handlebars.compile(subjectTemplate)(event)
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  async shutdown(): Promise<void> {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
      logger.info('Email service shut down')
    }
  }
}