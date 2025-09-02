# API Gateway Service

The API Gateway service is the central entry point for the Robust AI Orchestrator platform. It provides routing, authentication, rate limiting, logging, and security features for all incoming requests.

## Features

- **Express.js API Gateway**: Central routing and request handling
- **JWT Authentication**: Token-based authentication with role-based access control
- **Rate Limiting**: Redis-backed rate limiting with configurable limits
- **Request/Response Logging**: Comprehensive logging with correlation IDs
- **CORS Support**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js security headers and additional protections
- **Error Handling**: Centralized error handling with structured responses
- **Health Checks**: Built-in health check endpoints
- **API Key Validation**: Service-to-service authentication

## Quick Start

### Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

4. Run tests:
```bash
npm test
```

### Production

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

### Docker

Build and run with Docker:
```bash
docker build -t api-gateway .
docker run -p 3001:3001 api-gateway
```

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key-change-in-production` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 minutes) |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `LOG_LEVEL` | Logging level | `info` |
| `VALID_API_KEYS` | Valid API keys (comma-separated) | - |

## API Endpoints

### Public Endpoints

- `GET /` - API information
- `GET /api/v1/health` - Health check
- `GET /api/v1/version` - Version information

### Protected Endpoints

- `GET /api/v1/protected` - Example protected route (requires JWT)
- `GET /api/v1/admin` - Admin-only route (requires admin role)

### Internal Endpoints

- `GET /api/v1/internal/status` - Internal service status (requires API key)

## Middleware

### Authentication Middleware

- `authenticateToken`: Validates JWT tokens
- `authorizePermission`: Checks role-based permissions

### Security Middleware

- `corsMiddleware`: CORS configuration
- `securityMiddleware`: Helmet.js security headers
- `additionalSecurityMiddleware`: Custom security headers
- `validateApiKey`: API key validation

### Rate Limiting

- `generalRateLimit`: General rate limiting
- `authRateLimit`: Authentication endpoint rate limiting
- `apiRateLimit`: API endpoint rate limiting

### Logging

- `correlationIdMiddleware`: Adds correlation IDs to requests
- `requestLoggingMiddleware`: Logs incoming requests
- `responseLoggingMiddleware`: Logs responses and errors

## Error Handling

The API Gateway provides structured error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details (development only)"
  },
  "meta": {
    "correlationId": "uuid-v4",
    "timestamp": "2025-08-08T18:00:00.000Z",
    "version": "1.0.0"
  }
}
```

## Testing

Run the test suite:
```bash
npm test
```

Tests cover:
- Health check endpoints
- Authentication and authorization
- Rate limiting
- CORS headers
- Security headers
- Error handling
- 404 responses

## Architecture

The API Gateway follows a modular architecture:

```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
│   ├── auth.ts      # Authentication & authorization
│   ├── rateLimiter.ts # Rate limiting with Redis
│   ├── logging.ts   # Request/response logging
│   ├── security.ts  # CORS & security headers
│   └── errorHandler.ts # Error handling
├── routes/          # Route definitions
├── __tests__/       # Test files
├── app.ts          # Express app configuration
└── index.ts        # Server entry point
```

## Dependencies

### Production Dependencies
- `express`: Web framework
- `cors`: CORS middleware
- `helmet`: Security headers
- `express-rate-limit`: Rate limiting
- `jsonwebtoken`: JWT handling
- `winston`: Logging
- `redis`: Redis client
- `compression`: Response compression

### Development Dependencies
- `typescript`: TypeScript compiler
- `jest`: Testing framework
- `supertest`: HTTP testing
- `ts-jest`: TypeScript Jest preset

## Monitoring

The API Gateway provides comprehensive logging and monitoring:

- **Request Logging**: All requests are logged with correlation IDs
- **Error Logging**: Errors are logged with stack traces and context
- **Health Checks**: Built-in health check endpoint
- **Metrics**: Performance and usage metrics
- **Correlation IDs**: Request tracing across services

## Security

Security features implemented:

- **HTTPS Enforcement**: Strict transport security headers
- **CORS Protection**: Configurable origin restrictions
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Security Headers**: XSS, clickjacking, and other protections
- **JWT Validation**: Secure token-based authentication
- **API Key Validation**: Service-to-service authentication
- **Input Validation**: Request validation and sanitization

## Performance

Performance optimizations:

- **Compression**: Response compression with gzip
- **Connection Pooling**: Efficient database connections
- **Caching**: Redis-based caching for rate limiting
- **Async Operations**: Non-blocking I/O operations
- **Error Handling**: Graceful error handling without crashes