import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SlackService } from '../../src/services/slack.service'
import {
  SlackConfig,
  NotificationEvent,
  NotificationEventType,
  NotificationTemplate,
  NotificationChannelType,
  NotificationDeliveryStatus
} from '../../src/types/notification.types'

// Mock @slack/web-api
const mockChatPostMessage = vi.fn()
const mockAuthTest = vi.fn()

vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn(() => ({
    chat: {
      postMessage: mockChatPostMessage
    },
    auth: {
      test: mockAuthTest
    }
  }))
}))

describe('SlackService Integration Tests', () => {
  let slackService: SlackService
  let slackConfig: SlackConfig

  beforeEach(() => {
    slackService = new SlackService()
    slackConfig = {
      botToken: 'xoxb-test-token',
      channel: '#notifications',
      username: 'AI Orchestrator',
      iconEmoji: ':robot_face:'
    }

    // Reset mocks
    mockChatPostMessage.mockReset()
    mockAuthTest.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Slack Notification Sending', () => {
    it('should send Slack notification successfully', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Data Processing Pipeline',
          executionId: 'execution-123',
          status: 'completed',
          duration: '3m 45s'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Completed',
        type: NotificationChannelType.SLACK,
        eventType: NotificationEventType.WORKFLOW_COMPLETED,
        body: '✅ Workflow {{data.workflowName}} completed successfully in {{data.duration}}',
        variables: ['data.workflowName', 'data.duration'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockChatPostMessage.mockResolvedValue({
        ok: true,
        ts: '1234567890.123456',
        channel: 'C1234567890'
      })

      const delivery = await slackService.sendNotification(event, template, slackConfig)

      expect(delivery.status).toBe(NotificationDeliveryStatus.DELIVERED)
      expect(delivery.deliveredAt).toBeDefined()
      expect(mockChatPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: '#notifications',
          username: 'AI Orchestrator',
          icon_emoji: ':robot_face:',
          text: expect.stringContaining('Data Processing Pipeline'),
          blocks: expect.any(Array)
        })
      )
    })

    it('should handle Slack API failure', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowName: 'Test Workflow',
          error: 'Connection timeout'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Failed',
        type: NotificationChannelType.SLACK,
        eventType: NotificationEventType.WORKFLOW_FAILED,
        body: '❌ Workflow {{data.workflowName}} failed: {{data.error}}',
        variables: ['data.workflowName', 'data.error'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockChatPostMessage.mockResolvedValue({
        ok: false,
        error: 'channel_not_found'
      })

      const delivery = await slackService.sendNotification(event, template, slackConfig)

      expect(delivery.status).toBe(NotificationDeliveryStatus.FAILED)
      expect(delivery.error).toBe('channel_not_found')
      expect(delivery.deliveredAt).toBeUndefined()
    })

    it('should handle network errors', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.SYSTEM_ALERT,
        source: 'monitoring-service',
        timestamp: new Date(),
        data: {
          alertType: 'High CPU Usage',
          severity: 'warning'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'System Alert',
        type: NotificationChannelType.SLACK,
        eventType: NotificationEventType.SYSTEM_ALERT,
        body: '🚨 System Alert: {{data.alertType}}',
        variables: ['data.alertType'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockChatPostMessage.mockRejectedValue(new Error('Network error'))

      const delivery = await slackService.sendNotification(event, template, slackConfig)

      expect(delivery.status).toBe(NotificationDeliveryStatus.FAILED)
      expect(delivery.error).toBe('Network error')
    })
  })

  describe('Direct Message Sending', () => {
    it('should send direct Slack message successfully', async () => {
      mockChatPostMessage.mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      })

      await slackService.sendDirectMessage(
        'xoxb-test-token',
        '#general',
        'Test message',
        [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'This is a test message'
            }
          }
        ]
      )

      expect(mockChatPostMessage).toHaveBeenCalledWith({
        channel: '#general',
        text: 'Test message',
        blocks: expect.any(Array),
        attachments: undefined
      })
    })

    it('should handle direct message failure', async () => {
      mockChatPostMessage.mockResolvedValue({
        ok: false,
        error: 'invalid_auth'
      })

      await expect(
        slackService.sendDirectMessage(
          'invalid-token',
          '#general',
          'Test message'
        )
      ).rejects.toThrow('invalid_auth')
    })
  })

  describe('Connection Testing', () => {
    it('should test Slack connection successfully', async () => {
      mockAuthTest.mockResolvedValue({
        ok: true,
        team_id: 'T1234567890',
        user_id: 'U1234567890'
      })

      const result = await slackService.testConnection(slackConfig)

      expect(result).toBe(true)
      expect(mockAuthTest).toHaveBeenCalledOnce()
    })

    it('should handle connection test failure', async () => {
      mockAuthTest.mockResolvedValue({
        ok: false,
        error: 'invalid_auth'
      })

      const result = await slackService.testConnection(slackConfig)

      expect(result).toBe(false)
    })

    it('should handle network error during connection test', async () => {
      mockAuthTest.mockRejectedValue(new Error('Network error'))

      const result = await slackService.testConnection(slackConfig)

      expect(result).toBe(false)
    })
  })

  describe('Message Formatting', () => {
    it('should generate rich blocks for workflow events', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'ML Training Pipeline',
          executionId: 'execution-456',
          status: 'completed',
          duration: '45m 12s'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Completed',
        type: NotificationChannelType.SLACK,
        eventType: NotificationEventType.WORKFLOW_COMPLETED,
        body: 'Custom template message',
        variables: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockChatPostMessage.mockResolvedValue({ ok: true, ts: '123' })

      await slackService.sendNotification(event, template, slackConfig)

      const callArgs = mockChatPostMessage.mock.calls[0][0]
      expect(callArgs.blocks).toBeDefined()
      expect(callArgs.blocks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: expect.objectContaining({
              text: '✅ Workflow Completed'
            })
          }),
          expect.objectContaining({
            type: 'section',
            fields: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('workflow.completed')
              }),
              expect.objectContaining({
                text: expect.stringContaining('orchestration-service')
              })
            ])
          })
        ])
      )
    })

    it('should include error information for failed workflows', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowName: 'Test Workflow',
          executionId: 'execution-123',
          error: 'Database connection timeout after 30 seconds'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Failed',
        type: NotificationChannelType.SLACK,
        eventType: NotificationEventType.WORKFLOW_FAILED,
        body: 'Workflow failed',
        variables: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockChatPostMessage.mockResolvedValue({ ok: true, ts: '123' })

      await slackService.sendNotification(event, template, slackConfig)

      const callArgs = mockChatPostMessage.mock.calls[0][0]
      const errorBlock = callArgs.blocks.find((block: any) => 
        block.text && block.text.text && block.text.text.includes('Database connection timeout')
      )
      expect(errorBlock).toBeDefined()
    })

    it('should generate default message when no template provided', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.USER_INVITED,
        source: 'user-management-service',
        timestamp: new Date(),
        data: {
          organizationName: 'Acme Corp',
          invitedUserEmail: 'newuser@example.com'
        }
      }

      mockChatPostMessage.mockResolvedValue({ ok: true, ts: '123' })

      await slackService.sendNotification(event, {} as NotificationTemplate, slackConfig)

      const callArgs = mockChatPostMessage.mock.calls[0][0]
      expect(callArgs.text).toContain('👋 New user invited to Acme Corp')
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
          workflowName: 'Customer Onboarding Flow',
          executionId: 'exec-789'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Started',
        type: NotificationChannelType.SLACK,
        eventType: NotificationEventType.WORKFLOW_STARTED,
        body: 'Started: {{data.workflowName}} (ID: {{data.executionId}})',
        variables: ['data.workflowName', 'data.executionId'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockChatPostMessage.mockResolvedValue({ ok: true, ts: '123' })

      await slackService.sendNotification(event, template, slackConfig)

      const callArgs = mockChatPostMessage.mock.calls[0][0]
      expect(callArgs.text).toBe('Started: Customer Onboarding Flow (ID: exec-789)')
    })
  })
})