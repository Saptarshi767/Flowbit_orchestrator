import axios, { AxiosResponse } from 'axios'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../utils/logger'
import {
  WebhookEndpoint,
  WebhookDelivery,
  WebhookDeliveryStatus,
  NotificationEvent,
  NotificationEventType
} from '../types/notification.types'

export class WebhookService {
  private readonly maxRetryAttempts = 5
  private readonly baseRetryDelay = 1000 // 1 second
  private readonly maxRetryDelay = 300000 // 5 minutes
  private readonly requestTimeout = 30000 // 30 seconds

  async createWebhook(data: {
    url: string
    eventTypes: NotificationEventType[]
    organizationId: string
    userId: string
  }): Promise<WebhookEndpoint> {
    // Validate URL
    await this.validateWebhookUrl(data.url)

    const webhook: WebhookEndpoint = {
      id: uuidv4(),
      url: data.url,
      secret: this.generateWebhookSecret(),
      eventTypes: data.eventTypes,
      isActive: true,
      organizationId: data.organizationId,
      userId: data.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Store webhook in database (implementation depends on your data layer)
    await this.storeWebhook(webhook)

    logger.info('Webhook created', { webhookId: webhook.id, url: webhook.url })
    return webhook
  }

  async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<WebhookEndpoint, 'url' | 'eventTypes' | 'isActive'>>
  ): Promise<WebhookEndpoint> {
    if (updates.url) {
      await this.validateWebhookUrl(updates.url)
    }

    const webhook = await this.getWebhook(webhookId)
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`)
    }

    const updatedWebhook = {
      ...webhook,
      ...updates,
      updatedAt: new Date()
    }

    await this.storeWebhook(updatedWebhook)
    logger.info('Webhook updated', { webhookId, updates })
    return updatedWebhook
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.removeWebhook(webhookId)
    logger.info('Webhook deleted', { webhookId })
  }

  async deliverWebhook(
    webhook: WebhookEndpoint,
    event: NotificationEvent
  ): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: uuidv4(),
      webhookId: webhook.id,
      eventId: event.id,
      url: webhook.url,
      requestHeaders: this.buildRequestHeaders(webhook.secret),
      requestBody: JSON.stringify(event),
      attempts: 0,
      status: WebhookDeliveryStatus.PENDING,
      createdAt: new Date()
    }

    await this.storeWebhookDelivery(delivery)
    await this.attemptDelivery(delivery)
    return delivery
  }

  async retryFailedDeliveries(): Promise<void> {
    const failedDeliveries = await this.getFailedDeliveries()
    
    for (const delivery of failedDeliveries) {
      if (this.shouldRetry(delivery)) {
        await this.attemptDelivery(delivery)
      }
    }
  }

  private async attemptDelivery(delivery: WebhookDelivery): Promise<void> {
    const startTime = Date.now()
    delivery.attempts += 1

    try {
      const response: AxiosResponse = await axios({
        method: 'POST',
        url: delivery.url,
        headers: delivery.requestHeaders,
        data: delivery.requestBody,
        timeout: this.requestTimeout,
        validateStatus: (status) => status >= 200 && status < 300
      })

      delivery.httpStatus = response.status
      delivery.responseHeaders = response.headers as Record<string, string>
      delivery.responseBody = JSON.stringify(response.data)
      delivery.duration = Date.now() - startTime
      delivery.status = WebhookDeliveryStatus.DELIVERED
      delivery.deliveredAt = new Date()

      logger.info('Webhook delivered successfully', {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        httpStatus: delivery.httpStatus,
        duration: delivery.duration
      })
    } catch (error: any) {
      delivery.httpStatus = error.response?.status
      delivery.responseHeaders = error.response?.headers
      delivery.responseBody = error.response?.data ? JSON.stringify(error.response.data) : undefined
      delivery.duration = Date.now() - startTime
      delivery.error = error.message

      if (delivery.attempts >= this.maxRetryAttempts) {
        delivery.status = WebhookDeliveryStatus.FAILED
        logger.error('Webhook delivery failed permanently', {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId,
          attempts: delivery.attempts,
          error: error.message
        })
      } else {
        delivery.status = WebhookDeliveryStatus.RETRYING
        delivery.nextRetryAt = this.calculateNextRetry(delivery.attempts)
        logger.warn('Webhook delivery failed, will retry', {
          deliveryId: delivery.id,
          webhookId: delivery.webhookId,
          attempts: delivery.attempts,
          nextRetryAt: delivery.nextRetryAt,
          error: error.message
        })
      }
    }

    await this.updateWebhookDelivery(delivery)
  }

  private async validateWebhookUrl(url: string): Promise<void> {
    try {
      const parsedUrl = new URL(url)
      
      // Security checks
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS')
      }
      
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        throw new Error('Webhook URL cannot point to localhost')
      }

      // Test connectivity with a ping
      await axios.head(url, { timeout: 5000 })
    } catch (error: any) {
      throw new Error(`Invalid webhook URL: ${error.message}`)
    }
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  private buildRequestHeaders(secret: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Robust-AI-Orchestrator-Webhook/1.0',
      'X-Webhook-Secret': secret,
      'X-Webhook-Timestamp': Date.now().toString()
    }
  }

  private calculateNextRetry(attempts: number): Date {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, attempts - 1),
      this.maxRetryDelay
    )
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay
    return new Date(Date.now() + delay + jitter)
  }

  private shouldRetry(delivery: WebhookDelivery): boolean {
    if (delivery.status !== WebhookDeliveryStatus.RETRYING) {
      return false
    }
    
    if (delivery.attempts >= this.maxRetryAttempts) {
      return false
    }
    
    if (!delivery.nextRetryAt || delivery.nextRetryAt > new Date()) {
      return false
    }
    
    return true
  }

  // Database operations (to be implemented with your data layer)
  private async storeWebhook(webhook: WebhookEndpoint): Promise<void> {
    // Implementation depends on your database layer
    // This would typically use Prisma or another ORM
  }

  private async getWebhook(webhookId: string): Promise<WebhookEndpoint | null> {
    // Implementation depends on your database layer
    return null
  }

  private async removeWebhook(webhookId: string): Promise<void> {
    // Implementation depends on your database layer
  }

  private async storeWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    // Implementation depends on your database layer
  }

  private async updateWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    // Implementation depends on your database layer
  }

  private async getFailedDeliveries(): Promise<WebhookDelivery[]> {
    // Implementation depends on your database layer
    return []
  }
}