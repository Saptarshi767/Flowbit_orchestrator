# API Authentication Guide

This guide covers all authentication methods supported by the Robust AI Orchestrator API, including setup, usage, and best practices.

## Authentication Methods

### 1. API Key Authentication (Recommended)

API keys provide simple, secure access to the API and are the recommended method for most integrations.

#### Creating API Keys

1. **Via Web Interface**:
   - Go to Settings → API Keys
   - Click "Generate New API Key"
   - Provide a descriptive name
   - Set permissions and expiration
   - Copy the key (shown only once)

2. **Via API**:
```bash
curl -X POST https://api.your-orchestrator.com/v1/auth/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration Key",
    "permissions": ["workflow.read", "workflow.execute"],
    "expiresAt": "2024-12-31T23:59:59Z"
  }'
```

#### Using API Keys

Include the API key in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.your-orchestrator.com/v1/workflows
```

#### API Key Permissions

API keys support granular permissions:
- `workflow.read` - Read workflow definitions
- `workflow.write` - Create and modify workflows
- `workflow.execute` - Execute workflows
- `workflow.delete` - Delete workflows
- `execution.read` - View execution history
- `execution.cancel` - Cancel running executions
- `organization.read` - View organization details
- `organization.write` - Modify organization settings
- `marketplace.read` - Browse marketplace
- `marketplace.publish` - Publish to marketplace

### 2. OAuth 2.0

OAuth 2.0 is ideal for applications that need to act on behalf of users.

#### Supported Flows

**Authorization Code Flow** (Web Applications):
```bash
# Step 1: Redirect user to authorization URL
https://api.your-orchestrator.com/v1/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=workflow.read+workflow.execute&
  state=RANDOM_STATE_STRING
```

```bash
# Step 2: Exchange code for token
curl -X POST https://api.your-orchestrator.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&
      code=AUTHORIZATION_CODE&
      client_id=YOUR_CLIENT_ID&
      client_secret=YOUR_CLIENT_SECRET&
      redirect_uri=YOUR_REDIRECT_URI"
```

**Client Credentials Flow** (Server-to-Server):
```bash
curl -X POST https://api.your-orchestrator.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&
      client_id=YOUR_CLIENT_ID&
      client_secret=YOUR_CLIENT_SECRET&
      scope=workflow.read+workflow.execute"
```

#### Using OAuth Tokens

```bash
curl -H "Authorization: Bearer YOUR_OAUTH_TOKEN" \
     https://api.your-orchestrator.com/v1/workflows
```

#### Token Refresh

```bash
curl -X POST https://api.your-orchestrator.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&
      refresh_token=YOUR_REFRESH_TOKEN&
      client_id=YOUR_CLIENT_ID&
      client_secret=YOUR_CLIENT_SECRET"
```

### 3. Service Account Authentication

Service accounts provide secure authentication for automated systems and CI/CD pipelines.

#### Creating Service Accounts

```bash
curl -X POST https://api.your-orchestrator.com/v1/auth/service-accounts \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "description": "Automated deployment service account",
    "permissions": ["workflow.read", "workflow.execute"],
    "ipWhitelist": ["192.168.1.0/24", "10.0.0.0/8"]
  }'
```

#### Using Service Account Keys

```bash
curl -H "Authorization: ServiceAccount YOUR_SERVICE_ACCOUNT_KEY" \
     https://api.your-orchestrator.com/v1/workflows
```

### 4. JWT Token Authentication

JWT tokens are used for session-based authentication and short-lived access.

#### Obtaining JWT Tokens

```bash
# Login with username/password
curl -X POST https://api.your-orchestrator.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

#### Using JWT Tokens

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.your-orchestrator.com/v1/workflows
```

## Authentication Examples by Language

### JavaScript/Node.js

```javascript
const axios = require('axios');

// API Key Authentication
const apiClient = axios.create({
  baseURL: 'https://api.your-orchestrator.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
    'Content-Type': 'application/json'
  }
});

// OAuth 2.0 Authentication
class OAuthClient {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
  }

  async getAccessToken() {
    if (this.accessToken && !this.isTokenExpired()) {
      return this.accessToken;
    }

    const response = await axios.post(
      'https://api.your-orchestrator.com/v1/oauth/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'workflow.read workflow.execute'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return this.accessToken;
  }

  async makeRequest(method, url, data = null) {
    const token = await this.getAccessToken();
    return axios({
      method,
      url: `https://api.your-orchestrator.com/v1${url}`,
      data,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }
}

// Usage
const client = new OAuthClient('your-client-id', 'your-client-secret');
const workflows = await client.makeRequest('GET', '/workflows');
```

### Python

```python
import requests
import os
from datetime import datetime, timedelta

# API Key Authentication
class APIKeyClient:
    def __init__(self, api_key, base_url='https://api.your-orchestrator.com/v1'):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def get(self, endpoint):
        return self.session.get(f'{self.base_url}{endpoint}')
    
    def post(self, endpoint, data):
        return self.session.post(f'{self.base_url}{endpoint}', json=data)

# OAuth 2.0 Authentication
class OAuthClient:
    def __init__(self, client_id, client_secret, base_url='https://api.your-orchestrator.com/v1'):
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = base_url
        self.access_token = None
        self.token_expiry = None
    
    def get_access_token(self):
        if self.access_token and self.token_expiry > datetime.now():
            return self.access_token
        
        response = requests.post(
            f'{self.base_url}/oauth/token',
            data={
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': 'workflow.read workflow.execute'
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        token_data = response.json()
        self.access_token = token_data['access_token']
        self.token_expiry = datetime.now() + timedelta(seconds=token_data['expires_in'])
        
        return self.access_token
    
    def make_request(self, method, endpoint, data=None):
        token = self.get_access_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        return requests.request(
            method,
            f'{self.base_url}{endpoint}',
            json=data,
            headers=headers
        )

# Usage
client = APIKeyClient(os.getenv('API_KEY'))
workflows = client.get('/workflows')

oauth_client = OAuthClient('your-client-id', 'your-client-secret')
executions = oauth_client.make_request('GET', '/executions')
```

### cURL Examples

```bash
# API Key Authentication
export API_KEY="your-api-key"
curl -H "Authorization: Bearer $API_KEY" \
     https://api.your-orchestrator.com/v1/workflows

# OAuth Client Credentials Flow
export CLIENT_ID="your-client-id"
export CLIENT_SECRET="your-client-secret"

# Get access token
ACCESS_TOKEN=$(curl -s -X POST \
  https://api.your-orchestrator.com/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&scope=workflow.read" \
  | jq -r '.access_token')

# Use access token
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
     https://api.your-orchestrator.com/v1/workflows

# Service Account Authentication
export SERVICE_ACCOUNT_KEY="your-service-account-key"
curl -H "Authorization: ServiceAccount $SERVICE_ACCOUNT_KEY" \
     https://api.your-orchestrator.com/v1/workflows
```

## Security Best Practices

### 1. API Key Management

**Do:**
- Store API keys securely (environment variables, secret managers)
- Use different keys for different environments
- Set appropriate permissions and expiration dates
- Rotate keys regularly
- Monitor key usage

**Don't:**
- Commit keys to version control
- Share keys between applications
- Use overly broad permissions
- Leave keys without expiration
- Ignore suspicious usage patterns

### 2. OAuth Security

**Do:**
- Use HTTPS for all OAuth flows
- Validate redirect URIs
- Use PKCE for public clients
- Implement proper state validation
- Store tokens securely

**Don't:**
- Use implicit flow for new applications
- Store client secrets in public clients
- Skip state parameter validation
- Use long-lived access tokens without refresh
- Log tokens in application logs

### 3. Service Account Security

**Do:**
- Use IP whitelisting when possible
- Implement least privilege access
- Monitor service account usage
- Rotate keys regularly
- Use separate accounts for different services

**Don't:**
- Use service accounts for user actions
- Share service account keys
- Grant excessive permissions
- Skip monitoring and auditing
- Use service accounts in client-side applications

## Error Handling

### Common Authentication Errors

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired authentication credentials",
    "details": {
      "reason": "token_expired",
      "expires_at": "2024-01-20T15:30:00Z"
    }
  }
}
```

**Solutions:**
- Check if token is expired and refresh if needed
- Verify API key is correct and active
- Ensure proper Authorization header format

#### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this operation",
    "details": {
      "required_permission": "workflow.execute",
      "user_permissions": ["workflow.read"]
    }
  }
}
```

**Solutions:**
- Request additional permissions for your API key
- Use a different authentication method with appropriate permissions
- Contact administrator to grant required permissions

#### 429 Rate Limited
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "reset_at": "2024-01-20T16:00:00Z"
    }
  }
}
```

**Solutions:**
- Implement exponential backoff
- Respect rate limit headers
- Upgrade to higher tier for increased limits
- Optimize API usage patterns

## Testing Authentication

### Test API Key
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.your-orchestrator.com/v1/auth/test
```

### Validate Token
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.your-orchestrator.com/v1/auth/validate
```

### Check Permissions
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.your-orchestrator.com/v1/auth/permissions
```

## Monitoring and Auditing

### Authentication Logs
All authentication events are logged and available via:
- **Web Interface**: Settings → Audit Logs
- **API**: `/v1/audit/authentication`
- **Webhooks**: Real-time authentication events

### Metrics to Monitor
- **Failed authentication attempts**: Potential security threats
- **Token usage patterns**: Unusual access patterns
- **Permission violations**: Attempts to access unauthorized resources
- **Rate limit hits**: Applications hitting limits

### Alerting
Set up alerts for:
- Multiple failed authentication attempts
- Unusual access patterns
- Permission violations
- Expired or expiring credentials

## Support

For authentication-related issues:
- **Documentation**: [API Reference](./api-reference.md)
- **Community**: [Discord Server](https://discord.gg/your-server)
- **Support**: [Contact Support](mailto:support@yourcompany.com)
- **Security Issues**: [Security Contact](mailto:security@yourcompany.com)