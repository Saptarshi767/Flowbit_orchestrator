import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import nock from 'nock'
import { WebhookService } from '../../src/services/webhook.service'
import { NotificationEvent, NotificationEventType, WebhookDeliveryStatus } from '../../src/types/notification.types'

describe('WebhookService Integration Tests', () => {
  let webhookService: WebhookService
  let mockWebhookEndpoint: string

  beforeEach(() => {
    webhookService = new WebhookService()
    mockWebhookEndpoint = 'https://example.com/webhook'
    
    // Mock database operations
    vi.spyOn(webhookService as any, 'storeWebhook').mockResolvedValue(undefined)
    vi.spyOn(webhookService as any, 'storeWebhookDelivery').mockResolvedValue(undefined)
    vi.spyOn(webhookService as any, 'updateWebhookDelivery').mockResolvedValue(undefined)
  })

  afterEach(() => {
    nock.cleanAll()
    vi.restoreAllMocks()
  })

  describe('Webhook Creation', () => {
    it('should create webhook with valid URL', async () => {
      // Mock URL validation
      nock('https://example.com')
        .head('/webhook')
        .reply(200)

      const webhook = await webhookService.createWebhook({
        url: mockWebhookEndpoint,
        eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
        organizationId: 'org-123',
        userId: 'user-123'
      })

      expect(webhook.url).toBe(mockWebhookEndpoint)
      expect(webhook.eventTypes).toContain(NotificationEventType.WORKFLOW_COMPLETED)
      expect(webhook.secret).toBeDefined()
      expect(webhook.isActive).toBe(true)
    })

    it('should reject non-HTTPS URLs', async () => {
      await expect(
        webhookService.createWebhook({
          url: 'http://example.com/webhook',
          eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
          organizationId: 'org-123',
          userId: 'user-123'
        })
      ).rejects.toThrow('Webhook URL must use HTTPS')
    })

    it('should reject localhost URLs', async () => {
      await expect(
        webhookService.createWebhook({
          url: 'https://localhost/webhook',
          eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
          organizationId: 'org-123',
          userId: 'user-123'
        })
      ).rejects.toThrow('Webhook URL cannot point to localhost')
    })
  })

  describe('Webhook Delivery', () => {
    it('should deliver webhook successfully', async () => {
      const webhook = {
        id: 'webhook-123',
        url: mockWebhookEndpoint,
        secret: 'test-secret',
        eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
        isActive: true,
        organizationId: 'org-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Test Workflow',
          executionId: 'execution-123',
          status: 'completed'
        }
      }

      // Mock successful webhook delivery
      nock('https://example.com')
        .post('/webhook')
        .reply(200, { received: true })

      const delivery = await webhookService.deliverWebhook(webhook, event)

      expect(delivery.status).toBe(WebhookDeliveryStatus.DELIVERED)
      expect(delivery.httpStatus).toBe(200)
      expect(delivery.deliveredAt).toBeDefined()
    })

    it('should handle webhook delivery failure with retry', async () => {
      const webhook = {
        id: 'webhook-123',
        url: mockWebhookEndpoint,
        secret: 'test-secret',
        eventTypes: [NotificationEventType.WORKFLOW_FAILED],
        isActive: true,
        organizationId: 'org-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Test Workflow',
          executionId: 'execution-123',
          error: 'Test error'
        }
      }

      // Mock failed webhook delivery
      nock('https://example.com')
        .post('/webhook')
        .reply(500, { error: 'Internal server error' })

      const delivery = await webhookService.deliverWebhook(webhook, event)

      expect(delivery.status).toBe(WebhookDeliveryStatus.RETRYING)
      expect(delivery.httpStatus).toBe(500)
      expect(delivery.nextRetryAt).toBeDefined()
      expect(delivery.attempts).toBe(1)
    })

    it('should include correct headers in webhook request', async () => {
      const webhook = {
        id: 'webhook-123',
        url: mockWebhookEndpoint,
        secret: 'test-secret',
        eventTypes: [NotificationEventType.WORKFLOW_STARTED],
        isActive: true,
        organizationId: 'org-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_STARTED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: { workflowId: 'workflow-123' }
      }

      // Mock webhook with header validation
      const scope = nock('https://example.com')
        .post('/webhook')
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('User-Agent', 'Robust-AI-Orchestrator-Webhook/1.0')
        .matchHeader('X-Webhook-Secret', 'test-secret')
        .matchHeader('X-Webhook-Timestamp', /^\d+$/)
        .reply(200)

      await webhookService.deliverWebhook(webhook, event)

      expect(scope.isDone()).toBe(true)
    })
  })

  describe('Webhook Retry Logic', () => {
    it('should implement exponential backoff for retries', async () => {
      const webhook = {
        id: 'webhook-123',
        url: mockWebhookEndpoint,
        secret: 'test-secret',
        eventTypes: [NotificationEventType.WORKFLOW_FAILED],
        isActive: true,
        organizationId: 'org-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: { workflowId: 'workflow-123' }
      }

      // Mock multiple failed attempts
      nock('https://example.com')
        .post('/webhook')
        .times(3)
        .reply(500)

      // First attempt
      const delivery1 = await webhookService.deliverWebhook(webhook, event)
      expect(delivery1.attempts).toBe(1)
      expect(delivery1.status).toBe(WebhookDeliveryStatus.RETRYING)

      // Mock retry attempts
      vi.spyOn(webhookService as any, 'getFailedDeliveries').mockResolvedValue([delivery1])

      // Simulate retry
      await webhookService.retryFailedDeliveries()

      // Verify exponential backoff timing
      const firstRetryDelay = delivery1.nextRetryAt!.getTime() - delivery1.createdAt.getTime()
      expect(firstRetryDelay).toBeGreaterThanOrEqual(1000) // At least 1 second
      expect(firstRetryDelay).toBeLessThan(2000) // Less than 2 seconds for first retry
    })

    it('should stop retrying after max attempts', async () => {
      const delivery = {
        id: 'delivery-123',
        webhookId: 'webhook-123',
        eventId: 'event-123',
        url: mockWebhookEndpoint,
        requestHeaders: {},
        requestBody: '{}',
        attempts: 5, // Max attempts reached
        status: WebhookDeliveryStatus.RETRYING,
        nextRetryAt: new Date(Date.now() - 1000), // Past retry time
        createdAt: new Date()
      }

      vi.spyOn(webhookService as any, 'getFailedDeliveries').mockResolvedValue([delivery])
      vi.spyOn(webhookService as any, 'shouldRetry').mockReturnValue(false)

      await webhookService.retryFailedDeliveries()

      // Verify no HTTP request was made
      expect(nock.pendingMocks()).toHaveLength(0)
    })
  })

  describe('Webhook URL Validation', () => {
    it('should validate webhook URL connectivity', async () => {
      // Mock successful HEAD request
      nock('https://example.com')
        .head('/webhook')
        .reply(200)

      await expect(
        webhookService.createWebhook({
          url: mockWebhookEndpoint,
          eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
          organizationId: 'org-123',
          userId: 'user-123'
        })
      ).resolves.toBeDefined()
    })

    it('should reject unreachable webhook URLs', async () => {
      // Mock failed HEAD request
      nock('https://example.com')
        .head('/webhook')
        .replyWithError('ECONNREFUSED')

      await expect(
        webhookService.createWebhook({
          url: mockWebhookEndpoint,
          eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
          organizationId: 'org-123',
          userId: 'user-123'
        })
      ).rejects.toThrow('Invalid webhook URL')
    })
  })
})