# Robust AI Orchestrator API

Enterprise-grade AI orchestration platform supporting multiple workflow engines (Langflow, N8N, LangSmith).

## 🚀 Quick Start

### Authentication

```bash
# Login to get access token
curl -X POST https://api.robust-ai-orchestrator.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "your-password"}'

# Use the access token for subsequent requests
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.robust-ai-orchestrator.com/api/v1/workflows
```

### API Versioning

The API supports multiple versions with backward compatibility:

```bash
# Using Accept header (recommended)
curl -H "Accept: application/vnd.robust-ai-orchestrator.v1.1+json" \
  https://api.robust-ai-orchestrator.com/api/v1/workflows

# Using custom header
curl -H "X-API-Version: 1.1" \
  https://api.robust-ai-orchestrator.com/api/v1/workflows

# Using query parameter
curl "https://api.robust-ai-orchestrator.com/api/v1/workflows?version=1.1"
```

## 📚 Documentation

- **Interactive API Docs**: [https://api.robust-ai-orchestrator.com/api/v1/docs](https://api.robust-ai-orchestrator.com/api/v1/docs)
- **OpenAPI Specification**: [https://api.robust-ai-orchestrator.com/api/v1/docs/openapi.json](https://api.robust-ai-orchestrator.com/api/v1/docs/openapi.json)
- **Examples & Tutorials**: [https://api.robust-ai-orchestrator.com/api/v1/docs/examples](https://api.robust-ai-orchestrator.com/api/v1/docs/examples)

## 🛠 SDKs

### TypeScript/JavaScript

```bash
npm install @robust-ai-orchestrator/sdk
```

```typescript
import { createClient } from '@robust-ai-orchestrator/sdk';

const client = createClient({
  baseUrl: 'https://api.robust-ai-orchestrator.com/api/v1',
  accessToken: 'your-access-token'
});

// Login
const loginResponse = await client.login('user@example.com', 'password');

// Create workflow
const workflow = await client.createWorkflow({
  name: 'My Langflow Workflow',
  engineType: 'langflow',
  definition: { /* workflow definition */ }
});

// Execute workflow
const execution = await client.executeWorkflow({
  workflowId: workflow.id,
  parameters: { input: 'Hello World' }
});
```

### Python

```bash
pip install robust-ai-orchestrator-sdk
```

```python
from robust_ai_orchestrator import create_client

client = create_client(
    base_url='https://api.robust-ai-orchestrator.com/api/v1',
    access_token='your-access-token'
)

# Login
login_response = client.login('user@example.com', 'password')

# Create workflow
workflow = client.create_workflow(
    name='My Langflow Workflow',
    engine_type='langflow',
    definition={} # workflow definition
)

# Execute workflow
execution = client.execute_workflow(
    workflow_id=workflow.id,
    parameters={'input': 'Hello World'}
)
```

## 🔐 Authentication Methods

### 1. JWT Bearer Token (User Authentication)

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.robust-ai-orchestrator.com/api/v1/workflows
```

### 2. API Key (Service-to-Service)

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.robust-ai-orchestrator.com/api/v1/workflows
```

### 3. OAuth 2.0 (Third-party Integrations)

```bash
# Authorization Code Flow
https://api.robust-ai-orchestrator.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&scope=read+write
```

## 📊 Rate Limits

| Plan | Requests per Hour | Burst Limit |
|------|------------------|-------------|
| Free | 100 | 10/minute |
| Pro | 1,000 | 50/minute |
| Enterprise | 10,000 | 200/minute |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per hour
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## 🔄 API Versions

### Current Version: 1.1
- Enhanced pagination format
- Improved error responses
- New authentication methods

### Supported Versions
- **v1.1** (Current) - Full feature support
- **v1.0** (Deprecated) - Supported until 2025-12-31

### Migration Guide

#### v1.0 → v1.1

**Pagination Format Change:**
```json
// v1.0 format
{
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}

// v1.1 format
{
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 🚦 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "correlationId": "req-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.1",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "message": "Invalid email format"
    }
  },
  "meta": {
    "correlationId": "req-123",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.1"
  }
}
```

## 📋 Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## 🔍 Monitoring & Analytics

### Request Tracking
Every request includes a correlation ID for tracking:
```bash
curl -H "X-Correlation-ID: my-custom-id" \
  https://api.robust-ai-orchestrator.com/api/v1/workflows
```

### Usage Analytics
Monitor your API usage:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.robust-ai-orchestrator.com/api/v1/analytics?period=day"
```

## 🌐 Endpoints Overview

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `GET /users` - List users (admin)

### Workflows
- `GET /workflows` - List workflows
- `POST /workflows` - Create workflow
- `GET /workflows/{id}` - Get workflow
- `PUT /workflows/{id}` - Update workflow
- `DELETE /workflows/{id}` - Delete workflow
- `GET /workflows/{id}/versions` - Get workflow versions

### Executions
- `GET /executions` - List executions
- `POST /executions` - Execute workflow
- `GET /executions/{id}` - Get execution
- `DELETE /executions/{id}` - Cancel execution
- `GET /executions/{id}/logs` - Get execution logs

### Monitoring
- `GET /monitoring/metrics` - Get system metrics
- `GET /monitoring/alerts` - List alerts

### Marketplace
- `GET /marketplace/workflows` - Browse marketplace

### System
- `GET /health` - Health check
- `GET /version` - Version info

## 🔧 Development

### Local Setup

```bash
# Clone repository
git clone https://github.com/robust-ai-orchestrator/api

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Environment Variables

```bash
# API Configuration
PORT=3001
NODE_ENV=development
API_VERSION=1.1

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/orchestrator
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=1h

# External Services
LANGFLOW_API_URL=http://localhost:7860
N8N_API_URL=http://localhost:5678
LANGSMITH_API_KEY=your-langsmith-key
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Contract tests
npm run test:contract

# Load tests
npm run test:load
```

## 🤝 Support

- **Documentation**: [https://docs.robust-ai-orchestrator.com](https://docs.robust-ai-orchestrator.com)
- **Community**: [https://community.robust-ai-orchestrator.com](https://community.robust-ai-orchestrator.com)
- **Support**: [support@robust-ai-orchestrator.com](mailto:support@robust-ai-orchestrator.com)
- **Status Page**: [https://status.robust-ai-orchestrator.com](https://status.robust-ai-orchestrator.com)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Need help?** Check out our [interactive API documentation](https://api.robust-ai-orchestrator.com/api/v1/docs) or [contact support](mailto:support@robust-ai-orchestrator.com).