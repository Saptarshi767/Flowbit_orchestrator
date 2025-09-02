import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EmailService } from '../../src/services/email.service'
import { 
  EmailConfig, 
  NotificationEvent, 
  NotificationEventType, 
  NotificationTemplate,
  NotificationChannelType,
  NotificationDeliveryStatus
} from '../../src/types/notification.types'

// Mock nodemailer
const mockSendMail = vi.fn()
const mockVerify = vi.fn()
const mockClose = vi.fn()

vi.mock('nodemailer', () => ({
  default: {
    createTransporter: vi.fn(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
      close: mockClose
    }))
  }
}))

describe('EmailService Integration Tests', () => {
  let emailService: EmailService
  let emailConfig: EmailConfig

  beforeEach(() => {
    emailService = new EmailService()
    emailConfig = {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: 'test@example.com',
      smtpPassword: 'password',
      fromEmail: 'noreply@example.com',
      fromName: 'AI Orchestrator'
    }

    // Reset mocks
    mockSendMail.mockReset()
    mockVerify.mockReset()
    mockClose.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Email Service Initialization', () => {
    it('should initialize email service successfully', async () => {
      mockVerify.mockResolvedValue(true)

      await expect(emailService.initialize(emailConfig)).resolves.toBeUndefined()
      expect(mockVerify).toHaveBeenCalledOnce()
    })

    it('should fail initialization with invalid config', async () => {
      mockVerify.mockRejectedValue(new Error('Authentication failed'))

      await expect(emailService.initialize(emailConfig)).rejects.toThrow('Authentication failed')
    })
  })

  describe('Email Notification Sending', () => {
    beforeEach(async () => {
      mockVerify.mockResolvedValue(true)
      await emailService.initialize(emailConfig)
    })

    it('should send email notification successfully', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Test Workflow',
          executionId: 'execution-123',
          status: 'completed',
          duration: '2m 30s'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Completed',
        type: NotificationChannelType.EMAIL,
        eventType: NotificationEventType.WORKFLOW_COMPLETED,
        subject: 'Workflow Completed: {{data.workflowName}}',
        body: `
          <h2>Workflow Completed Successfully</h2>
          <p>Your workflow <strong>{{data.workflowName}}</strong> has completed successfully.</p>
          <ul>
            <li><strong>Execution ID:</strong> {{data.executionId}}</li>
            <li><strong>Duration:</strong> {{data.duration}}</li>
            <li><strong>Completed At:</strong> {{event.timestamp}}</li>
          </ul>
        `,
        variables: ['data.workflowName', 'data.executionId', 'data.duration', 'event.timestamp'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const recipients = ['user@example.com']

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      const deliveries = await emailService.sendNotification(event, template, recipients, emailConfig)

      expect(deliveries).toHaveLength(1)
      expect(deliveries[0].status).toBe(NotificationDeliveryStatus.DELIVERED)
      expect(deliveries[0].deliveredAt).toBeDefined()
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'AI Orchestrator <noreply@example.com>',
          to: 'user@example.com',
          subject: 'Workflow Completed: Test Workflow',
          html: expect.stringContaining('Test Workflow'),
          text: expect.any(String)
        })
      )
    })

    it('should handle email sending failure', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_FAILED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: {
          workflowId: 'workflow-123',
          workflowName: 'Test Workflow',
          error: 'Connection timeout'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Failed',
        type: NotificationChannelType.EMAIL,
        eventType: NotificationEventType.WORKFLOW_FAILED,
        subject: 'Workflow Failed: {{data.workflowName}}',
        body: 'Workflow failed with error: {{data.error}}',
        variables: ['data.workflowName', 'data.error'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const recipients = ['user@example.com']

      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'))

      const deliveries = await emailService.sendNotification(event, template, recipients, emailConfig)

      expect(deliveries).toHaveLength(1)
      expect(deliveries[0].status).toBe(NotificationDeliveryStatus.FAILED)
      expect(deliveries[0].error).toBe('SMTP connection failed')
      expect(deliveries[0].deliveredAt).toBeUndefined()
    })

    it('should send to multiple recipients', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_STARTED,
        source: 'orchestration-service',
        timestamp: new Date(),
        data: { workflowName: 'Test Workflow' }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Started',
        type: NotificationChannelType.EMAIL,
        eventType: NotificationEventType.WORKFLOW_STARTED,
        body: 'Workflow started: {{data.workflowName}}',
        variables: ['data.workflowName'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com']

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      const deliveries = await emailService.sendNotification(event, template, recipients, emailConfig)

      expect(deliveries).toHaveLength(3)
      expect(mockSendMail).toHaveBeenCalledTimes(3)
      deliveries.forEach(delivery => {
        expect(delivery.status).toBe(NotificationDeliveryStatus.DELIVERED)
      })
    })
  })

  describe('Direct Email Sending', () => {
    beforeEach(async () => {
      mockVerify.mockResolvedValue(true)
      await emailService.initialize(emailConfig)
    })

    it('should send direct email successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      await emailService.sendDirectEmail(
        'user@example.com',
        'Test Subject',
        '<h1>Test HTML Body</h1>',
        'Test Text Body',
        emailConfig
      )

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'AI Orchestrator <noreply@example.com>',
          to: 'user@example.com',
          subject: 'Test Subject',
          html: '<h1>Test HTML Body</h1>',
          text: 'Test Text Body'
        })
      )
    })

    it('should send to multiple recipients in direct email', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      const recipients = ['user1@example.com', 'user2@example.com']

      await emailService.sendDirectEmail(
        recipients,
        'Test Subject',
        '<p>Test Body</p>'
      )

      expect(mockSendMail).toHaveBeenCalledTimes(2)
    })

    it('should handle direct email failure', async () => {
      mockSendMail.mockRejectedValue(new Error('Send failed'))

      await expect(
        emailService.sendDirectEmail(
          'user@example.com',
          'Test Subject',
          '<p>Test Body</p>'
        )
      ).rejects.toThrow('Send failed')
    })
  })

  describe('Email Connection Testing', () => {
    it('should test email connection successfully', async () => {
      mockVerify.mockResolvedValue(true)

      const result = await emailService.testConnection(emailConfig)

      expect(result).toBe(true)
      expect(mockVerify).toHaveBeenCalledOnce()
    })

    it('should handle connection test failure', async () => {
      mockVerify.mockRejectedValue(new Error('Connection failed'))

      const result = await emailService.testConnection(emailConfig)

      expect(result).toBe(false)
    })
  })

  describe('Template Rendering', () => {
    beforeEach(async () => {
      mockVerify.mockResolvedValue(true)
      await emailService.initialize(emailConfig)
    })

    it('should render template with event data', async () => {
      const event: NotificationEvent = {
        id: 'event-123',
        type: NotificationEventType.WORKFLOW_COMPLETED,
        source: 'orchestration-service',
        timestamp: new Date('2023-01-01T12:00:00Z'),
        data: {
          workflowName: 'Data Processing Pipeline',
          executionId: 'exec-456',
          duration: '5m 23s'
        }
      }

      const template: NotificationTemplate = {
        id: 'template-123',
        name: 'Workflow Completed',
        type: NotificationChannelType.EMAIL,
        eventType: NotificationEventType.WORKFLOW_COMPLETED,
        subject: 'Success: {{data.workflowName}}',
        body: `
          <h2>Workflow Completed</h2>
          <p>{{data.workflowName}} finished in {{data.duration}}</p>
          <p>Execution ID: {{data.executionId}}</p>
          <p>Completed at: {{event.timestamp}}</p>
        `,
        variables: ['data.workflowName', 'data.executionId', 'data.duration', 'event.timestamp'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      await emailService.sendNotification(event, template, ['user@example.com'], emailConfig)

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Success: Data Processing Pipeline',
          html: expect.stringContaining('Data Processing Pipeline finished in 5m 23s')
        })
      )
    })
  })

  describe('HTML to Text Conversion', () => {
    beforeEach(async () => {
      mockVerify.mockResolvedValue(true)
      await emailService.initialize(emailConfig)
    })

    it('should convert HTML to plain text', async () => {
      const htmlBody = `
        <h1>Title</h1>
        <p>This is a paragraph.</p>
        <br>
        <p>Another paragraph with <strong>bold</strong> text.</p>
      `

      mockSendMail.mockResolvedValue({ messageId: 'test-message-id' })

      await emailService.sendDirectEmail(
        'user@example.com',
        'Test Subject',
        htmlBody
      )

      const callArgs = mockSendMail.mock.calls[0][0]
      expect(callArgs.text).toContain('Title')
      expect(callArgs.text).toContain('This is a paragraph.')
      expect(callArgs.text).toContain('Another paragraph with bold text.')
      expect(callArgs.text).not.toContain('<h1>')
      expect(callArgs.text).not.toContain('<p>')
      expect(callArgs.text).not.toContain('<strong>')
    })
  })

  describe('Service Shutdown', () => {
    it('should shutdown email service gracefully', async () => {
      mockVerify.mockResolvedValue(true)
      await emailService.initialize(emailConfig)

      await emailService.shutdown()

      expect(mockClose).toHaveBeenCalledOnce()
    })
  })
})