import { Router, Request, Response } from 'express'
import Joi from 'joi'
import { NotificationService } from '../services/notification.service'
import { WebhookService } from '../services/webhook.service'
import { 
  NotificationEventType, 
  NotificationChannelType,
  NotificationEvent,
  NotificationChannel,
  NotificationRule,
  WebhookEndpoint
} from '../types/notification.types'
import { logger } from '../utils/logger'

const router = Router()
const notificationService = new NotificationService()
const webhookService = new WebhookService()

// Validation schemas
const createEventSchema = Joi.object({
  type: Joi.string().valid(...Object.values(NotificationEventType)).required(),
  source: Joi.string().required(),
  data: Joi.object().required(),
  userId: Joi.string().optional(),
  organizationId: Joi.string().optional()
})

const createChannelSchema = Joi.object({
  type: Joi.string().valid(...Object.values(NotificationChannelType)).required(),
  name: Joi.string().required(),
  config: Joi.object().required(),
  organizationId: Joi.string().optional(),
  userId: Joi.string().optional()
})

const createRuleSchema = Joi.object({
  name: Joi.string().required(),
  eventTypes: Joi.array().items(Joi.string().valid(...Object.values(NotificationEventType))).required(),
  channels: Joi.array().items(Joi.string()).required(),
  conditions: Joi.array().items(Joi.object({
    field: Joi.string().required(),
    operator: Joi.string().valid('equals', 'contains', 'startsWith', 'endsWith', 'regex').required(),
    value: Joi.string().required()
  })).optional(),
  template: Joi.string().optional(),
  organizationId: Joi.string().optional(),
  userId: Joi.string().optional()
})

const createWebhookSchema = Joi.object({
  url: Joi.string().uri({ scheme: ['https'] }).required(),
  eventTypes: Joi.array().items(Joi.string().valid(...Object.values(NotificationEventType))).required(),
  organizationId: Joi.string().required(),
  userId: Joi.string().required()
})

// Events endpoints
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { error, value } = createEventSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const event = await notificationService.createEvent(
      value.type,
      value.source,
      value.data,
      value.userId,
      value.organizationId
    )

    res.status(201).json(event)
  } catch (error: any) {
    logger.error('Failed to create notification event', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Channels endpoints
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const { error, value } = createChannelSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const channel = await notificationService.createNotificationChannel(
      value.type,
      value.name,
      value.config,
      value.organizationId,
      value.userId
    )

    res.status(201).json(channel)
  } catch (error: any) {
    logger.error('Failed to create notification channel', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/channels/:channelId/test', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params
    const isValid = await notificationService.testNotificationChannel(channelId)
    
    res.json({ valid: isValid })
  } catch (error: any) {
    logger.error('Failed to test notification channel', { 
      channelId: req.params.channelId,
      error: error.message 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Rules endpoints
router.post('/rules', async (req: Request, res: Response) => {
  try {
    const { error, value } = createRuleSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const rule = await notificationService.createNotificationRule(
      value.name,
      value.eventTypes,
      value.channels,
      value.organizationId,
      value.userId
    )

    res.status(201).json(rule)
  } catch (error: any) {
    logger.error('Failed to create notification rule', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Webhooks endpoints
router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const { error, value } = createWebhookSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    const webhook = await webhookService.createWebhook({
      url: value.url,
      eventTypes: value.eventTypes,
      organizationId: value.organizationId,
      userId: value.userId
    })

    res.status(201).json(webhook)
  } catch (error: any) {
    logger.error('Failed to create webhook', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params
    const updates = req.body

    const webhook = await webhookService.updateWebhook(webhookId, updates)
    res.json(webhook)
  } catch (error: any) {
    logger.error('Failed to update webhook', { 
      webhookId: req.params.webhookId,
      error: error.message 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/webhooks/:webhookId', async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params
    await webhookService.deleteWebhook(webhookId)
    res.status(204).send()
  } catch (error: any) {
    logger.error('Failed to delete webhook', { 
      webhookId: req.params.webhookId,
      error: error.message 
    })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Retry failed notifications
router.post('/retry', async (req: Request, res: Response) => {
  try {
    await notificationService.retryFailedNotifications()
    res.json({ message: 'Retry process initiated' })
  } catch (error: any) {
    logger.error('Failed to retry notifications', { error: error.message })
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString()
  })
})

export default router