import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../../src/app'
import {
  NotificationEventType,
  NotificationChannelType,
  NotificationEvent,
  NotificationChannel,
  NotificationRule
} from '../../src/types/notification.types'

// Mock the services
vi.mock('../../src/services/notification.service', () => ({
  NotificationService: vi.fn()
}))
vi.mock('../../src/services/webhook.service', () => ({
  WebhookService: vi.fn()
}))

describe('Notification Service Integration Tests', () => {
  let mockNotificationService: any
  let mockWebhookService: any

  beforeEach(async () => {
    mockNotificationService = {
      createEvent: vi.fn(),
      createNotificationChannel: vi.fn(),
      createNotificationRule: vi.fn(),
      testNotificationChannel: vi.fn(),
      retryFailedNotifications: vi.fn(),
      processEvent: vi.fn()
    }

    mockWebhookService = {
      createWebhook: vi.fn(),
      updateWebhook: vi.fn(),
      deleteWebhook: vi.fn(),
      deliverWebhook: vi.fn(),
      retryFailedDeliveries: vi.fn()
    }

    const { NotificationService } = await import('../../src/services/notification.service')
    const { WebhookService } = await import('../../src/services/webhook.service')
    vi.mocked(NotificationService).mockImplementation(() => mockNotificationService)
    vi.mocked(WebhookService).mockImplementation(() => mockWebhookService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Event Creation API', () => {
    it('should create notification event successfully', async () => {
      const eventData = {
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Test Workflow',
          executionId: 'execution-456',
          status: 'completed'
        },
        userId: 'user-123',
        organizationId: 'org-123'
      }

      const mockEvent: NotificationEvent = {
        id: 'event-123',
        ...eventData,
        timestamp: new Date()
      }

      mockNotificationService.createEvent.mockResolvedValue(mockEvent)

      const response = await request(app)
        .post('/api/notifications/events')
        .send(eventData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service'
      })

      expect(mockNotificationService.createEvent).toHaveBeenCalledWith(
        eventData.type,
        eventData.source,
        eventData.data,
        eventData.userId,
        eventData.organizationId
      )
    })

    it('should validate event data', async () => {
      const invalidEventData = {
        type: 'invalid-type',
        source: 'test-source',
        data: {}
      }

      const response = await request(app)
        .post('/api/notifications/events')
        .send(invalidEventData)
        .expect(400)

      expect(response.body.error).toContain('type')
      expect(mockNotificationService.createEvent).not.toHaveBeenCalled()
    })

    it('should handle service errors', async () => {
      const eventData = {
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        data: { workflowId: 'workflow-123' }
      }

      mockNotificationService.createEvent.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/api/notifications/events')
        .send(eventData)
        .expect(500)

      expect(response.body.error).toBe('Internal server error')
    })
  })

  describe('Channel Management API', () => {
    it('should create email notification channel', async () => {
      const channelData = {
        type: NotificationChannelType.EMAIL,
        name: 'Production Alerts',
        config: {
          email: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            smtpSecure: false,
            smtpUser: 'alerts@example.com',
            smtpPassword: 'password',
            fromEmail: 'noreply@example.com',
            fromName: 'AI Orchestrator'
          }
        },
        organizationId: 'org-123'
      }

      const mockChannel: NotificationChannel = {
        id: 'channel-123',
        ...channelData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockNotificationService.createNotificationChannel.mockResolvedValue(mockChannel)

      const response = await request(app)
        .post('/api/notifications/channels')
        .send(channelData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'channel-123',
        type: NotificationChannelType.EMAIL,
        name: 'Production Alerts'
      })
    })

    it('should create Slack notification channel', async () => {
      const channelData = {
        type: NotificationChannelType.SLACK,
        name: 'Dev Team Notifications',
        config: {
          slack: {
            botToken: 'xoxb-test-token',
            channel: '#dev-alerts',
            username: 'AI Orchestrator'
          }
        },
        organizationId: 'org-123'
      }

      const mockChannel: NotificationChannel = {
        id: 'channel-456',
        ...channelData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockNotificationService.createNotificationChannel.mockResolvedValue(mockChannel)

      const response = await request(app)
        .post('/api/notifications/channels')
        .send(channelData)
        .expect(201)

      expect(response.body.type).toBe(NotificationChannelType.SLACK)
    })

    it('should test notification channel', async () => {
      mockNotificationService.testNotificationChannel.mockResolvedValue(true)

      const response = await request(app)
        .post('/api/notifications/channels/channel-123/test')
        .expect(200)

      expect(response.body.valid).toBe(true)
      expect(mockNotificationService.testNotificationChannel).toHaveBeenCalledWith('channel-123')
    })

    it('should handle channel test failure', async () => {
      mockNotificationService.testNotificationChannel.mockResolvedValue(false)

      const response = await request(app)
        .post('/api/notifications/channels/channel-123/test')
        .expect(200)

      expect(response.body.valid).toBe(false)
    })
  })

  describe('Notification Rules API', () => {
    it('should create notification rule', async () => {
      const ruleData = {
        name: 'Workflow Failures',
        eventTypes: [NotificationEventType.WORKFLOW_FAILED, NotificationEventType.EXECUTION_TIMEOUT],
        channels: ['channel-123', 'channel-456'],
        conditions: [
          {
            field: 'data.severity',
            operator: 'equals',
            value: 'critical'
          }
        ],
        organizationId: 'org-123'
      }

      const mockRule: NotificationRule = {
        id: 'rule-123',
        ...ruleData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockNotificationService.createNotificationRule.mockResolvedValue(mockRule)

      const response = await request(app)
        .post('/api/notifications/rules')
        .send(ruleData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'rule-123',
        name: 'Workflow Failures',
        eventTypes: [NotificationEventType.WORKFLOW_FAILED, NotificationEventType.EXECUTION_TIMEOUT]
      })
    })

    it('should validate rule data', async () => {
      const invalidRuleData = {
        name: 'Test Rule',
        eventTypes: ['invalid-event-type'],
        channels: []
      }

      const response = await request(app)
        .post('/api/notifications/rules')
        .send(invalidRuleData)
        .expect(400)

      expect(response.body.error).toBeDefined()
    })
  })

  describe('Webhook Management API', () => {
    it('should create webhook', async () => {
      const webhookData = {
        url: 'https://example.com/webhook',
        eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
        organizationId: 'org-123',
        userId: 'user-123'
      }

      const mockWebhook = {
        id: 'webhook-123',
        ...webhookData,
        secret: 'webhook-secret',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockWebhookService.createWebhook.mockResolvedValue(mockWebhook)

      const response = await request(app)
        .post('/api/notifications/webhooks')
        .send(webhookData)
        .expect(201)

      expect(response.body).toMatchObject({
        id: 'webhook-123',
        url: 'https://example.com/webhook'
      })
    })

    it('should update webhook', async () => {
      const updateData = {
        eventTypes: [NotificationEventType.WORKFLOW_COMPLETED, NotificationEventType.WORKFLOW_FAILED],
        isActive: false
      }

      const mockUpdatedWebhook = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        ...updateData,
        secret: 'webhook-secret',
        organizationId: 'org-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockWebhookService.updateWebhook.mockResolvedValue(mockUpdatedWebhook)

      const response = await request(app)
        .put('/api/notifications/webhooks/webhook-123')
        .send(updateData)
        .expect(200)

      expect(response.body.isActive).toBe(false)
      expect(mockWebhookService.updateWebhook).toHaveBeenCalledWith('webhook-123', updateData)
    })

    it('should delete webhook', async () => {
      mockWebhookService.deleteWebhook.mockResolvedValue(undefined)

      await request(app)
        .delete('/api/notifications/webhooks/webhook-123')
        .expect(204)

      expect(mockWebhookService.deleteWebhook).toHaveBeenCalledWith('webhook-123')
    })

    it('should validate webhook URL', async () => {
      const invalidWebhookData = {
        url: 'http://insecure.com/webhook', // HTTP instead of HTTPS
        eventTypes: [NotificationEventType.WORKFLOW_COMPLETED],
        organizationId: 'org-123',
        userId: 'user-123'
      }

      const response = await request(app)
        .post('/api/notifications/webhooks')
        .send(invalidWebhookData)
        .expect(400)

      expect(response.body.error).toContain('https')
    })
  })

  describe('Retry Mechanism API', () => {
    it('should trigger retry of failed notifications', async () => {
      mockNotificationService.retryFailedNotifications.mockResolvedValue(undefined)

      const response = await request(app)
        .post('/api/notifications/retry')
        .expect(200)

      expect(response.body.message).toBe('Retry process initiated')
      expect(mockNotificationService.retryFailedNotifications).toHaveBeenCalledOnce()
    })

    it('should handle retry errors', async () => {
      mockNotificationService.retryFailedNotifications.mockRejectedValue(new Error('Retry failed'))

      const response = await request(app)
        .post('/api/notifications/retry')
        .expect(500)

      expect(response.body.error).toBe('Internal server error')
    })
  })

  describe('Health Check API', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/notifications/health')
        .expect(200)

      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'notification-service',
        timestamp: expect.any(String)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/notifications/unknown-route')
        .expect(404)

      expect(response.body.error).toBe('Route not found')
    })

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/notifications/events')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400)
    })
  })

  describe('End-to-End Notification Flow', () => {
    it('should process complete notification workflow', async () => {
      // Create event
      const eventData = {
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Data Processing Pipeline',
          executionId: 'execution-456',
          status: 'completed',
          duration: '5m 30s'
        },
        organizationId: 'org-123'
      }

      const mockEvent: NotificationEvent = {
        id: 'event-123',
        ...eventData,
        timestamp: new Date()
      }

      mockNotificationService.createEvent.mockResolvedValue(mockEvent)

      // Create event
      const eventResponse = await request(app)
        .post('/api/notifications/events')
        .send(eventData)
        .expect(201)

      expect(eventResponse.body.id).toBe('event-123')

      // Verify that processEvent would be called asynchronously
      expect(mockNotificationService.createEvent).toHaveBeenCalledWith(
        eventData.type,
        eventData.source,
        eventData.data,
        undefined, // userId not provided
        eventData.organizationId
      )
    })
  })

  describe('Input Validation', () => {
    it('should validate required fields for events', async () => {
      const incompleteEventData = {
        type: NotificationEventType.WORKFLOW_STARTED,
        // Missing source and data
      }

      const response = await request(app)
        .post('/api/notifications/events')
        .send(incompleteEventData)
        .expect(400)

      expect(response.body.error).toContain('source')
    })

    it('should validate channel configuration', async () => {
      const invalidChannelData = {
        type: NotificationChannelType.EMAIL,
        name: 'Test Channel',
        // Missing config
      }

      const response = await request(app)
        .post('/api/notifications/channels')
        .send(invalidChannelData)
        .expect(400)

      expect(response.body.error).toContain('config')
    })

    it('should validate notification rule structure', async () => {
      const invalidRuleData = {
        name: 'Test Rule',
        eventTypes: [], // Empty array not allowed
        channels: ['channel-123']
      }

      const response = await request(app)
        .post('/api/notifications/rules')
        .send(invalidRuleData)
        .expect(400)

      expect(response.body.error).toBeDefined()
    })
  })
})