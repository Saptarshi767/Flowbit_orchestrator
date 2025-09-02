# Notification Service

The Notification Service is a comprehensive microservice that handles webhook delivery, email notifications, Slack integration, and Microsoft Teams notifications for the Robust AI Orchestrator platform.

## Features

### 🔗 Webhook Management
- **Endpoint Validation**: Validates webhook URLs for security and connectivity
- **Retry Logic**: Implements exponential backoff for failed deliveries
- **Security**: HTTPS-only webhooks with secret validation
- **Delivery Tracking**: Complete audit trail of webhook deliveries

### 📧 Email Notifications
- **SMTP Integration**: Configurable SMTP settings for email delivery
- **Template Engine**: Handlebars-based email templates
- **HTML/Text Support**: Automatic HTML to text conversion
- **Bulk Sending**: Support for multiple recipients

### 💬 Slack Integration
- **Bot Integration**: Uses Slack Web API for message delivery
- **Rich Formatting**: Supports Slack blocks and attachments
- **Channel Management**: Flexible channel targeting
- **Connection Testing**: Built-in connectivity validation

### 🔔 Microsoft Teams Integration
- **Webhook Support**: Teams incoming webhook integration
- **Adaptive Cards**: Rich message formatting with MessageCard format
- **Action Buttons**: Interactive elements for workflow management
- **Theme Customization**: Event-specific color coding

### 🎯 Event-Driven Architecture
- **Event Processing**: Handles various notification event types
- **Rule Engine**: Configurable notification rules with conditions
- **Multi-Channel**: Single event can trigger multiple notification channels
- **Template System**: Customizable notification templates

## API Endpoints

### Events
- `POST /api/notifications/events` - Create notification event
- `POST /api/notifications/retry` - Retry failed notifications

### Channels
- `POST /api/notifications/channels` - Create notification channel
- `POST /api/notifications/channels/:id/test` - Test channel connectivity

### Rules
- `POST /api/notifications/rules` - Create notification rule

### Webhooks
- `POST /api/notifications/webhooks` - Create webhook
- `PUT /api/notifications/webhooks/:id` - Update webhook
- `DELETE /api/notifications/webhooks/:id` - Delete webhook

### Health
- `GET /api/notifications/health` - Service health check

## Configuration

### Environment Variables

```bash
# Service Configuration
PORT=3006
NODE_ENV=production
LOG_LEVEL=info

# Frontend URL (for Teams action buttons)
FRONTEND_URL=https://app.example.com

# Database Configuration (if using database)
DATABASE_URL=postgresql://user:password@localhost:5432/notifications

# Redis Configuration (for caching and queues)
REDIS_URL=redis://localhost:6379
```

### Email Configuration

```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "smtpSecure": false,
  "smtpUser": "notifications@example.com",
  "smtpPassword": "your-password",
  "fromEmail": "noreply@example.com",
  "fromName": "AI Orchestrator"
}
```

### Slack Configuration

```json
{
  "botToken": "xoxb-your-bot-token",
  "channel": "#notifications",
  "username": "AI Orchestrator",
  "iconEmoji": ":robot_face:"
}
```

### Teams Configuration

```json
{
  "webhookUrl": "https://outlook.office.com/webhook/your-webhook-id",
  "title": "AI Orchestrator",
  "themeColor": "0078D4"
}
```

## Event Types

The service supports the following notification event types:

- `workflow.started` - Workflow execution started
- `workflow.completed` - Workflow execution completed successfully
- `workflow.failed` - Workflow execution failed
- `workflow.cancelled` - Workflow execution was cancelled
- `execution.timeout` - Workflow execution timed out
- `system.alert` - System-level alerts
- `user.invited` - User invitation events
- `workflow.shared` - Workflow sharing events
- `comment.added` - Comment added to workflow
- `marketplace.published` - Workflow published to marketplace

## Usage Examples

### Creating a Notification Event

```javascript
const event = {
  type: 'workflow.completed',
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

const response = await fetch('/api/notifications/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(event)
})
```

### Creating an Email Channel

```javascript
const emailChannel = {
  type: 'email',
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

const response = await fetch('/api/notifications/channels', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(emailChannel)
})
```

### Creating a Webhook

```javascript
const webhook = {
  url: 'https://your-app.com/webhooks/notifications',
  eventTypes: ['workflow.completed', 'workflow.failed'],
  organizationId: 'org-123',
  userId: 'user-123'
}

const response = await fetch('/api/notifications/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(webhook)
})
```

## Development

### Installation

```bash
cd services/notification
npm install
```

### Running the Service

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Building

```bash
npm run build
```

## Security Considerations

### Webhook Security
- All webhook URLs must use HTTPS
- Localhost and private IP addresses are blocked
- Webhook secrets are automatically generated
- Request signatures for webhook validation

### Email Security
- SMTP authentication required
- TLS encryption for email transmission
- Input validation for email addresses

### API Security
- Request validation using Joi schemas
- Rate limiting (implemented at API Gateway level)
- CORS protection
- Helmet security headers

## Monitoring and Observability

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking with stack traces
- Performance metrics logging

### Health Checks
- Service health endpoint
- Database connectivity checks
- External service connectivity validation

### Metrics
- Notification delivery success/failure rates
- Response times for external services
- Queue depth and processing times
- Error rates by notification type

## Retry Logic

### Webhook Retries
- Maximum 5 retry attempts
- Exponential backoff starting at 1 second
- Maximum retry delay of 5 minutes
- Jitter to prevent thundering herd

### Email Retries
- Automatic retry for transient SMTP errors
- Dead letter queue for permanent failures
- Configurable retry intervals

### Scheduled Retries
- Automatic retry process runs every 5 minutes
- Processes failed deliveries across all channels
- Exponential backoff for retry scheduling

## Error Handling

### Error Categories
1. **Validation Errors**: Invalid input data
2. **Network Errors**: Connectivity issues with external services
3. **Authentication Errors**: Invalid credentials or tokens
4. **Rate Limiting**: External service rate limits exceeded
5. **System Errors**: Internal service failures

### Error Recovery
- Graceful degradation for non-critical failures
- Circuit breaker pattern for external services
- Automatic failover for redundant services
- Manual recovery tools for administrators

## Performance Optimization

### Caching
- Template compilation caching
- Client connection pooling
- Configuration caching

### Async Processing
- Non-blocking event processing
- Queue-based delivery system
- Batch processing for bulk operations

### Resource Management
- Connection pooling for SMTP
- Client reuse for Slack/Teams APIs
- Memory-efficient template rendering

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3006
CMD ["node", "dist/index.js"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notification-service
  template:
    metadata:
      labels:
        app: notification-service
    spec:
      containers:
      - name: notification-service
        image: notification-service:latest
        ports:
        - containerPort: 3006
        env:
        - name: PORT
          value: "3006"
        - name: NODE_ENV
          value: "production"
```

## Contributing

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting PRs
5. Follow semantic versioning for releases

## License

This service is part of the Robust AI Orchestrator platform and follows the same licensing terms.