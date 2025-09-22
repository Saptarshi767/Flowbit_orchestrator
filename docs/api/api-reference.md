# API Reference

The Robust AI Orchestrator provides a comprehensive REST API for programmatic access to all platform features. This reference covers all available endpoints, authentication methods, and usage examples.

## Base URL

```
Production: https://api.your-orchestrator-domain.com/v1
Staging: https://staging-api.your-orchestrator-domain.com/v1
```

## Authentication

All API requests require authentication. The platform supports multiple authentication methods:

### API Key Authentication
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.your-orchestrator-domain.com/v1/workflows
```

### OAuth 2.0
```bash
curl -H "Authorization: Bearer YOUR_OAUTH_TOKEN" \
     -H "Content-Type: application/json" \
     https://api.your-orchestrator-domain.com/v1/workflows
```

### Service Account
```bash
curl -H "Authorization: ServiceAccount YOUR_SERVICE_ACCOUNT_KEY" \
     -H "Content-Type: application/json" \
     https://api.your-orchestrator-domain.com/v1/workflows
```

## Rate Limiting

API requests are rate limited based on your subscription plan:
- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1,000 requests/hour  
- **Enterprise**: 10,000 requests/hour

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Error Handling

The API uses standard HTTP status codes and returns detailed error information:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid workflow definition",
    "details": {
      "field": "engineType",
      "reason": "Must be one of: langflow, n8n, langsmith"
    },
    "requestId": "req_123456789"
  }
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error (server error)

## Workflows API

### List Workflows

Get a list of workflows accessible to the authenticated user.

```http
GET /workflows
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `engineType` (string): Filter by engine type (langflow, n8n, langsmith)
- `tags` (string): Comma-separated list of tags
- `search` (string): Search in workflow names and descriptions

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     "https://api.your-orchestrator-domain.com/v1/workflows?engineType=langflow&limit=10"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "wf_123456789",
      "name": "Customer Support Agent",
      "description": "AI-powered customer support workflow",
      "engineType": "langflow",
      "version": 3,
      "isPublic": false,
      "tags": ["ai", "customer-support"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:45:00Z",
      "createdBy": {
        "id": "user_987654321",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### Create Workflow

Create a new workflow.

```http
POST /workflows
```

**Request Body:**
```json
{
  "name": "My New Workflow",
  "description": "Description of the workflow",
  "engineType": "langflow",
  "definition": {
    "nodes": [...],
    "edges": [...],
    "config": {...}
  },
  "tags": ["ai", "automation"],
  "isPublic": false
}
```

**Example Request:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Document Processor",
       "engineType": "langflow",
       "definition": {...}
     }' \
     https://api.your-orchestrator-domain.com/v1/workflows
```

### Get Workflow

Retrieve a specific workflow by ID.

```http
GET /workflows/{workflowId}
```

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.your-orchestrator-domain.com/v1/workflows/wf_123456789
```

### Update Workflow

Update an existing workflow.

```http
PUT /workflows/{workflowId}
```

**Request Body:**
```json
{
  "name": "Updated Workflow Name",
  "description": "Updated description",
  "definition": {...},
  "tags": ["updated", "tags"]
}
```

### Delete Workflow

Delete a workflow.

```http
DELETE /workflows/{workflowId}
```

## Executions API

### Execute Workflow

Execute a workflow with parameters.

```http
POST /workflows/{workflowId}/execute
```

**Request Body:**
```json
{
  "parameters": {
    "input_text": "Hello, world!",
    "temperature": 0.7
  },
  "async": true,
  "webhookUrl": "https://your-app.com/webhook"
}
```

**Example Request:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "parameters": {"input": "Process this text"},
       "async": true
     }' \
     https://api.your-orchestrator-domain.com/v1/workflows/wf_123456789/execute
```

**Response:**
```json
{
  "executionId": "exec_987654321",
  "status": "running",
  "startTime": "2024-01-20T15:30:00Z",
  "estimatedDuration": 120,
  "webhookUrl": "https://your-app.com/webhook"
}
```

### Get Execution Status

Check the status of a workflow execution.

```http
GET /executions/{executionId}
```

**Example Response:**
```json
{
  "id": "exec_987654321",
  "workflowId": "wf_123456789",
  "status": "completed",
  "startTime": "2024-01-20T15:30:00Z",
  "endTime": "2024-01-20T15:32:15Z",
  "duration": 135,
  "result": {
    "output": "Processed result",
    "metadata": {...}
  },
  "logs": [
    {
      "timestamp": "2024-01-20T15:30:05Z",
      "level": "info",
      "message": "Starting workflow execution"
    }
  ]
}
```

### List Executions

Get execution history.

```http
GET /executions
```

**Query Parameters:**
- `workflowId` (string): Filter by workflow ID
- `status` (string): Filter by status (pending, running, completed, failed, cancelled)
- `startDate` (string): Filter executions after this date (ISO 8601)
- `endDate` (string): Filter executions before this date (ISO 8601)

### Cancel Execution

Cancel a running execution.

```http
POST /executions/{executionId}/cancel
```

## Organizations API

### Get Organization

Get organization details.

```http
GET /organizations/{organizationId}
```

### Update Organization

Update organization settings.

```http
PUT /organizations/{organizationId}
```

### List Members

Get organization members.

```http
GET /organizations/{organizationId}/members
```

### Invite Member

Invite a new member to the organization.

```http
POST /organizations/{organizationId}/members/invite
```

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "developer",
  "permissions": ["workflow.read", "workflow.execute"]
}
```

## Marketplace API

### List Marketplace Workflows

Browse public workflows in the marketplace.

```http
GET /marketplace/workflows
```

**Query Parameters:**
- `category` (string): Filter by category
- `rating` (number): Minimum rating filter
- `featured` (boolean): Show only featured workflows

### Get Marketplace Workflow

Get details of a marketplace workflow.

```http
GET /marketplace/workflows/{workflowId}
```

### Install Marketplace Workflow

Install a workflow from the marketplace.

```http
POST /marketplace/workflows/{workflowId}/install
```

### Publish Workflow

Publish a workflow to the marketplace.

```http
POST /workflows/{workflowId}/publish
```

**Request Body:**
```json
{
  "category": "ai-agents",
  "pricing": {
    "type": "free"
  },
  "documentation": "Detailed usage instructions..."
}
```

## Monitoring API

### Get System Health

Check system health status.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T15:30:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "elasticsearch": "healthy",
    "engines": {
      "langflow": "healthy",
      "n8n": "healthy", 
      "langsmith": "healthy"
    }
  },
  "metrics": {
    "activeExecutions": 15,
    "queuedExecutions": 3,
    "avgResponseTime": 245
  }
}
```

### Get Metrics

Retrieve system and workflow metrics.

```http
GET /metrics
```

**Query Parameters:**
- `timeRange` (string): Time range (1h, 24h, 7d, 30d)
- `workflowId` (string): Filter by specific workflow
- `metrics` (string): Comma-separated list of metrics to include

## Webhooks API

### Create Webhook

Create a new webhook endpoint.

```http
POST /webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["execution.completed", "execution.failed"],
  "secret": "your-webhook-secret",
  "active": true
}
```

### List Webhooks

Get configured webhooks.

```http
GET /webhooks
```

### Update Webhook

Update webhook configuration.

```http
PUT /webhooks/{webhookId}
```

### Delete Webhook

Delete a webhook.

```http
DELETE /webhooks/{webhookId}
```

## SDK Examples

### JavaScript/Node.js

```javascript
const { RobustOrchestrator } = require('@robust-ai/orchestrator-sdk');

const client = new RobustOrchestrator({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.your-orchestrator-domain.com/v1'
});

// Execute a workflow
const execution = await client.workflows.execute('wf_123456789', {
  parameters: { input: 'Hello, world!' },
  async: true
});

console.log('Execution ID:', execution.executionId);

// Monitor execution
const result = await client.executions.waitForCompletion(execution.executionId);
console.log('Result:', result.output);
```

### Python

```python
from robust_orchestrator import RobustOrchestrator

client = RobustOrchestrator(
    api_key='your-api-key',
    base_url='https://api.your-orchestrator-domain.com/v1'
)

# Execute workflow
execution = client.workflows.execute(
    workflow_id='wf_123456789',
    parameters={'input': 'Hello, world!'},
    async_execution=True
)

print(f"Execution ID: {execution.execution_id}")

# Wait for completion
result = client.executions.wait_for_completion(execution.execution_id)
print(f"Result: {result.output}")
```

### cURL Examples

See individual endpoint documentation above for cURL examples.

## Interactive API Explorer

Visit our interactive API explorer at:
`https://api.your-orchestrator-domain.com/docs`

The explorer provides:
- Live API testing
- Request/response examples
- Authentication testing
- Schema validation
- Code generation in multiple languages

## Support

- **API Issues**: [GitHub Issues](https://github.com/your-org/robust-ai-orchestrator/issues)
- **Documentation**: [API Documentation](https://docs.your-orchestrator-domain.com)
- **Community**: [Discord Server](https://discord.gg/your-server)
- **Enterprise Support**: [Contact Support](mailto:support@yourcompany.com)