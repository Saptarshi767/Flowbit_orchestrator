# Authentication Service

Enterprise-grade authentication service for the AI Orchestrator platform, providing secure user authentication, authorization, and session management with support for multiple authentication methods.

## Features

### Core Authentication
- **Local Authentication**: Email/password registration and login with secure password hashing
- **JWT Tokens**: Stateless authentication with access and refresh tokens
- **Session Management**: Redis-based session storage with automatic cleanup
- **Password Security**: Strong password validation, hashing with bcrypt, and reset functionality
- **Email Verification**: Secure email verification workflow

### OAuth Integration
- **Google OAuth 2.0**: Sign in with Google accounts
- **GitHub OAuth**: Sign in with GitHub accounts  
- **Microsoft OAuth**: Sign in with Microsoft/Azure AD accounts
- **Extensible**: Easy to add additional OAuth providers

### Enterprise SSO
- **SAML 2.0**: Full SAML SSO support for enterprise identity providers
- **Metadata Generation**: Automatic SAML metadata generation
- **Attribute Mapping**: Flexible user attribute mapping from SAML assertions

### Security Features
- **Rate Limiting**: Configurable rate limiting for authentication endpoints
- **CORS Protection**: Configurable CORS policies
- **Helmet Security**: Security headers and protection middleware
- **Input Validation**: Comprehensive input validation with Zod schemas
- **Audit Logging**: Detailed logging of authentication events

### Authorization
- **Role-Based Access Control (RBAC)**: Flexible role and permission system
- **Multi-Tenancy**: Organization-based user isolation
- **Permission Management**: Granular permission control

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout current session
- `POST /auth/logout-all` - Logout from all sessions

### Password Management
- `POST /auth/password-reset/request` - Request password reset
- `POST /auth/password-reset/confirm` - Reset password with token

### Email Verification
- `POST /auth/verify-email` - Verify email address

### User Info
- `GET /auth/me` - Get current user information

### OAuth
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/github` - Initiate GitHub OAuth
- `GET /auth/github/callback` - GitHub OAuth callback
- `GET /auth/microsoft` - Initiate Microsoft OAuth
- `GET /auth/microsoft/callback` - Microsoft OAuth callback

### SAML
- `GET /auth/saml` - Initiate SAML authentication
- `POST /auth/saml/callback` - SAML callback
- `GET /auth/saml/metadata` - SAML metadata

### System
- `GET /health` - Health check
- `GET /docs` - API documentation

## Configuration

### Environment Variables

#### Required
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/orchestrator
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-super-secret-session-key
```

#### Optional
```bash
# Service Configuration
AUTH_SERVICE_PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Session Configuration
SESSION_MAX_AGE=86400

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=http://localhost:3001/auth/microsoft/callback

# SAML Configuration
SAML_ENTRY_POINT=https://your-idp.com/saml/sso
SAML_ISSUER=ai-orchestrator
SAML_CERT=-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----
SAML_CALLBACK_URL=http://localhost:3001/auth/saml/callback
```

## Installation

```bash
# Install dependencies
npm install

# Build the service
npm run build

# Run in development mode
npm run dev

# Run in production mode
npm start
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Usage Examples

### Register a New User
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Access Protected Endpoint
```bash
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Refresh Token
```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

## Architecture

### Components
- **AuthService**: Main authentication service class
- **JWTManager**: JWT token generation and validation
- **SessionManager**: Redis-based session management
- **OAuthManager**: OAuth provider integration
- **SAMLManager**: SAML SSO integration
- **Password Utils**: Password hashing and validation
- **Auth Routes**: Express route handlers

### Security Considerations
- Passwords are hashed using bcrypt with 12 salt rounds
- JWT tokens use HS256 algorithm with configurable expiry
- Sessions are stored in Redis with automatic expiry
- Rate limiting prevents brute force attacks
- Input validation prevents injection attacks
- CORS policies restrict cross-origin requests

### Database Schema
The service uses Prisma ORM with PostgreSQL for data persistence:
- Users table with authentication data
- Organizations table for multi-tenancy
- Accounts table for OAuth provider links
- Sessions table for session tracking

### Redis Schema
- `session:{sessionId}` - Session data
- `user_sessions:{userId}` - User's active sessions
- `temp:{key}` - Temporary data (password resets, email verification)

## Development

### Project Structure
```
services/auth/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── strategies/      # Authentication strategies
│   ├── routes/          # Express route handlers
│   ├── auth.service.ts  # Main service class
│   ├── app.ts          # Express application
│   └── index.ts        # Entry point
├── tests/              # Test files
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── vitest.config.ts    # Test configuration
```

### Adding New OAuth Providers
1. Install the passport strategy package
2. Add configuration to `AuthConfig` type
3. Implement strategy in `oauth.strategies.ts`
4. Add routes in `auth.routes.ts`
5. Update environment variable documentation

### Adding New Authentication Methods
1. Create strategy file in `strategies/` directory
2. Implement authentication logic in `AuthService`
3. Add route handlers in `auth.routes.ts`
4. Add tests for new functionality

## Monitoring

### Health Check
The service provides a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "service": "auth-service",
  "version": "1.0.0"
}
```

### Logging
The service logs all authentication events including:
- User registrations and logins
- Failed authentication attempts
- Token generation and validation
- Session creation and destruction
- OAuth and SAML authentication flows

### Metrics
Key metrics to monitor:
- Authentication success/failure rates
- Token generation and validation rates
- Session creation and cleanup rates
- OAuth/SAML authentication flows
- Password reset requests
- Email verification rates

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: ai-orchestrator/auth-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secret
              key: jwt-secret
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.