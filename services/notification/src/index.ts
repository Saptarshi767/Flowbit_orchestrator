import app from './app'
import { logger } from './utils/logger'
import cron from 'node-cron'
import { NotificationService } from './services/notification.service'

const PORT = process.env.PORT || 3006
const notificationService = new NotificationService()

// Schedule retry of failed notifications every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await notificationService.retryFailedNotifications()
  } catch (error: any) {
    logger.error('Scheduled retry failed', { error: error.message })
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

app.listen(PORT, () => {
  logger.info(`Notification service started on port ${PORT}`)
})