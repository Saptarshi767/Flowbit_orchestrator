import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import nock from 'nock'
import { TeamsService } from '../../src/services/teams.service'
import {
  TeamsConfig,
  NotificationEvent,
  NotificationEventType,
  NotificationTemplate,
  NotificationChannelType,
  NotificationDeliveryStatus
} from '../../src/types/notification.types'

describe('TeamsService Integration Tests', () => {
  let teamsService: TeamsService
  let teamsConfig: TeamsConfig
  let mockWebhookUrl: string

  beforeEach(() => {
    teamsService = new TeamsService()
    mockWebhookUrl = 'https://outlook.office.com/webhook/test-webhook-id'
    teamsConfig = {
      webhookUrl: mockWebhookUrl,
      title: 'AI Orchestrator',
      themeColor: '0078D4'
    }
  })

  afterEach(() => {
    nock.cleanAll()
    vi.clearAllMocks()
  })

  describe('Teams Notification Sending', () => {
    it('should send Teams notification successfully', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Data Processing Pipeline',
          executionId: 'execution-123',
          status: 'completed',
          duration: '5m 30s'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Completed',
        type: NotificationChannelType.TEAMS,
        eventType: NotificationEventType.WORKFLOW_COMPLETED,
        body: 'Workflow **{{data.workflowName}}** completed successfully in {{data.duration}}',
        variables: ['data.workflowName', 'data.duration'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock successful Teams webhook
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(200, '1')

      const delivery = await teamsService.sendNotification(event, template, teamsConfig)

      expect(delivery.status).toBe(NotificationDeliveryStatus.DELIVERED)
      expect(delivery.deliveredAt).toBeDefined()
      expect(scope.isDone()).toBe(true)
    })

    it('should handle Teams webhook failure', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowName: 'Test Workflow',
          error: 'Database connection failed'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Failed',
        type: NotificationChannelType.TEAMS,
        eventType: NotificationEventType.WORKFLOW_FAILED,
        body: 'Workflow failed: {{data.error}}',
        variables: ['data.error'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock failed Teams webhook
      nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(400, 'Bad Request')

      const delivery = await teamsService.sendNotification(event, template, teamsConfig)

      expect(delivery.status).toBe(NotificationDeliveryStatus.FAILED)
      expect(delivery.error).toContain('400')
      expect(delivery.deliveredAt).toBeUndefined()
    })

    it('should handle network errors', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.SYSTEM_ALERT,
        source: 'monitoring-service',
        timestamp: new Date(),
        data: {
          alertType: 'High Memory Usage',
          severity: 'critical'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'System Alert',
        type: NotificationChannelType.TEAMS,
        eventType: NotificationEventType.SYSTEM_ALERT,
        body: 'System Alert: {{data.alertType}}',
        variables: ['data.alertType'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Mock network error
      nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .replyWithError('ECONNREFUSED')

      const delivery = await teamsService.sendNotification(event, template, teamsConfig)

      expect(delivery.status).toBe(NotificationDeliveryStatus.FAILED)
      expect(delivery.error).toContain('ECONNREFUSED')
    })
  })

  describe('Direct Message Sending', () => {
    it('should send direct Teams message successfully', async () => {
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(200, '1')

      await teamsService.sendDirectMessage(
        mockWebhookUrl,
        'Test Notification',
        'This is a test message from the AI Orchestrator',
        '00FF00',
        [
          { name: 'Status', value: 'Success' },
          { name: 'Timestamp', value: new Date().toISOString() }
        ]
      )

      expect(scope.isDone()).toBe(true)
    })

    it('should handle direct message failure', async () => {
      nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(500, 'Internal Server Error')

      await expect(
        teamsService.sendDirectMessage(
          mockWebhookUrl,
          'Test Notification',
          'This is a test message'
        )
      ).rejects.toThrow('Request failed with status code 500')
    })
  })

  describe('Connection Testing', () => {
    it('should test Teams connection successfully', async () => {
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(200, '1')

      const result = await teamsService.testConnection(teamsConfig)

      expect(result).toBe(true)
      expect(scope.isDone()).toBe(true)
    })

    it('should handle connection test failure', async () => {
      nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(404, 'Not Found')

      const result = await teamsService.testConnection(teamsConfig)

      expect(result).toBe(false)
    })

    it('should handle network error during connection test', async () => {
      nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .replyWithError('ENOTFOUND')

      const result = await teamsService.testConnection(teamsConfig)

      expect(result).toBe(false)
    })
  })

  describe('Teams Card Formatting', () => {
    it('should generate proper MessageCard format', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'ML Training Pipeline',
          executionId: 'execution-456',
          duration: '2h 15m'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Completed',
        type: NotificationChannelType.TEAMS,
        eventType: NotificationEventType.WORKFLOW_COMPLETED,
        body: 'Pipeline **{{data.workflowName}}** completed in {{data.duration}}',
        variables: ['data.workflowName', 'data.duration'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let capturedCard: any
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(function(uri, requestBody) {
          capturedCard = requestBody
          return [200, '1']
        })

      await teamsService.sendNotification(event, template, teamsConfig)

      expect(scope.isDone()).toBe(true)
      expect(capturedCard).toMatchObject({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '0078D4',
        summary: expect.stringContaining('ML Training Pipeline'),
        sections: expect.arrayContaining([
          expect.objectContaining({
            activityTitle: 'AI Orchestrator',
            text: expect.stringContaining('Pipeline **ML Training Pipeline** completed in 2h 15m'),
            markdown: true
          })
        ])
      })
    })

    it('should generate default card when no template provided', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.USER_INVITED,
        source: 'user-management-service',
        timestamp: new Date(),
        data: {
          organizationName: 'Tech Corp',
          invitedUserEmail: 'newuser@example.com'
        }
      }

      let capturedCard: any
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(function(uri, requestBody) {
          capturedCard = requestBody
          return [200, '1']
        })

      await teamsService.sendNotification(event, {} as NotificationTemplate, teamsConfig)

      expect(scope.isDone()).toBe(true)
      expect(capturedCard.sections[0]).toMatchObject({
        activityTitle: '👋 User Invited',
        activitySubtitle: 'Source: user-management-service',
        facts: expect.arrayContaining([
          { name: 'Event Type', value: 'user.invited' },
          { name: 'Timestamp', value: expect.any(String) }
        ])
      })
    })

    it('should include error details for failed workflows', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowName: 'Data Import Job',
          executionId: 'exec-789',
          error: 'Failed to connect to external API: timeout after 30 seconds'
        }
      }

      let capturedCard: any
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(function(uri, requestBody) {
          capturedCard = requestBody
          return [200, '1']
        })

      await teamsService.sendNotification(event, {} as NotificationTemplate, teamsConfig)

      expect(scope.isDone()).toBe(true)
      
      // Should have error section
      const errorSection = capturedCard.sections.find((section: any) => 
        section.activityTitle === '❌ Error Details'
      )
      expect(errorSection).toBeDefined()
      expect(errorSection.text).toContain('Failed to connect to external API')
    })

    it('should include workflow actions for workflow events', async () => {
      // Set environment variable for frontend URL
      process.env.FRONTEND_URL = 'https://app.example.com'

      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowId: 'workflow-456',
          workflowName: 'Report Generation',
          executionId: 'execution-789'
        }
      }

      let capturedCard: any
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(function(uri, requestBody) {
          capturedCard = requestBody
          return [200, '1']
        })

      await teamsService.sendNotification(event, {} as NotificationTemplate, teamsConfig)

      expect(scope.isDone()).toBe(true)
      expect(capturedCard.potentialAction).toBeDefined()
      expect(capturedCard.potentialAction).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            '@type': 'OpenUri',
            name: 'View Workflow',
            targets: [
              {
                os: 'default',
                uri: 'https://app.example.com/workflows/workflow-456'
              }
            ]
          }),
          expect.objectContaining({
            '@type': 'OpenUri',
            name: 'View Execution',
            targets: [
              {
                os: 'default',
                uri: 'https://app.example.com/executions/execution-789'
              }
            ]
          })
        ])
      )

      // Clean up
      delete process.env.FRONTEND_URL
    })
  })

  describe('Theme Colors', () => {
    it('should use appropriate theme colors for different event types', async () => {
      const testCases = [
        { eventType: NotificationEventType.WORKFLOW_COMPLETED, expectedColor: '107C10' },
        { eventType: NotificationEventType.WORKFLOW_FAILED, expectedColor: 'D13438' },
        { eventType: NotificationEventType.WORKFLOW_STARTED, expectedColor: '0078D4' },
        { eventType: NotificationEventType.SYSTEM_ALERT, expectedColor: 'D13438' }
      ]

      for (const testCase of testCases) {
        const event: NotificationEvent = {
          id: 'event-123',
          type: testCase.eventType,
          source: 'test-service',
          timestamp: new Date(),
          data: { workflowName: 'Test Workflow' }
        }

        let capturedCard: any
        const scope = nock('https://outlook.office.com')
          .post('/webhook/test-webhook-id')
          .reply(function(uri, requestBody) {
            capturedCard = requestBody
            return [200, '1']
          })

        await teamsService.sendNotification(event, {} as NotificationTemplate, {
          webhookUrl: mockWebhookUrl
        })

        expect(scope.isDone()).toBe(true)
        expect(capturedCard.themeColor).toBe(testCase.expectedColor)
      }
    })

    it('should use custom theme color when provided in config', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'test-service',
        timestamp: new Date(),
        data: { workflowName: 'Test Workflow' }
      }

      const customConfig: TeamsConfig = {
        webhookUrl: mockWebhookUrl,
        themeColor: 'FF5733'
      }

      let capturedCard: any
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(function(uri, requestBody) {
          capturedCard = requestBody
          return [200, '1']
        })

      await teamsService.sendNotification(event, {} as NotificationTemplate, customConfig)

      expect(scope.isDone()).toBe(true)
      expect(capturedCard.themeColor).toBe('FF5733')
    })
  })

  describe('Template Rendering', () => {
    it('should render template variables correctly', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_STARTED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowName: 'Customer Analytics Pipeline',
          executionId: 'exec-456'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Started',
        type: NotificationChannelType.TEAMS,
        eventType: NotificationEventType.WORKFLOW_STARTED,
        body: 'Starting workflow: **{{data.workflowName}}** (Execution: {{data.executionId}})',
        variables: ['data.workflowName', 'data.executionId'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      let capturedCard: any
      const scope = nock('https://outlook.office.com')
        .post('/webhook/test-webhook-id')
        .reply(function(uri, requestBody) {
          capturedCard = requestBody
          return [200, '1']
        })

      await teamsService.sendNotification(event, template, teamsConfig)

      expect(scope.isDone()).toBe(true)
      expect(capturedCard.sections[0].text).toBe(
        'Starting workflow: **Customer Analytics Pipeline** (Execution: exec-456)'
      )
    })
  })
})