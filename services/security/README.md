# Security Service

Advanced security features for the AI Orchestrator platform, implementing enterprise-grade security controls including encryption, audit logging, zero-trust architecture, and vulnerability scanning.

## Features

### 🔐 Data Encryption at Rest
- AES-256-GCM encryption with key rotation
- Automatic sensitive field detection and encryption
- Secure key management with versioning
- Tamper-proof encryption with authentication tags

### 🛡️ API Security & DDoS Protection
- Advanced rate limiting with Redis backend
- DDoS protection with IP blocking
- Request validation and input sanitization
- API key management and validation
- Security headers and CORS configuration

### 📋 Audit Logging
- Tamper-proof audit chain with cryptographic hashing
- Comprehensive event logging for all security events
- Real-time audit event streaming
- Compliance-ready audit trails

### 🎯 Zero-Trust Security
- Dynamic trust scoring based on multiple factors
- Continuous verification and adaptive authentication
- Policy-based access control
- Device fingerprinting and behavioral analysis

### 🔍 Vulnerability Scanning
- Automated dependency scanning
- Container image vulnerability assessment
- Static code analysis integration
- Compliance reporting and recommendations

### 🧪 Security Testing
- Comprehensive penetration testing suite
- Automated security test execution
- Risk assessment and scoring
- Detailed vulnerability reporting

## Installation

```bash
npm install @orchestrator/security
```

## Quick Start

```typescript
import { createSecurityService } from '@orchestrator/security';

const securityService = createSecurityService({
  redis: {
    host: 'localhost',
    port: 6379
  },
  cors: {
    origin: ['https://yourdomain.com'],
    credentials: true
  },
  rateLimit: {
    windowMs: 60000, // 1 minute
    maxRequests: 100
  },
  helmet: {
    contentSecurityPolicy: true,
    hsts: true
  }
});

// Get middleware for Express app
const middleware = securityService.getMiddleware();

app.use(middleware.securityHeaders);
app.use(middleware.cors({ origin: 'https://yourdomain.com', credentials: true }));
app.use(middleware.rateLimit);
app.use(middleware.ddosProtection);
```

## Usage Examples

### Data Encryption

```typescript
import { dataEncryption } from '@orchestrator/security';

// Encrypt sensitive data
const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secretpassword',
  apiKey: 'secret-api-key'
};

const encrypted = await dataEncryption.encryptSensitiveData(userData);
// password and apiKey fields are automatically encrypted

const decrypted = await dataEncryption.decryptSensitiveData(encrypted);
// Returns original data with decrypted sensitive fields
```

### Audit Logging

```typescript
import { auditLogger } from '@orchestrator/security';

// Log authentication event
await auditLogger.logAuthentication('user123', 'success', {
  method: 'password',
  ipAddress: '192.168.1.1'
});

// Log data access
await auditLogger.logDataAccess('user123', 'workflow', 'wf-456', 'read');

// Verify audit chain integrity
const verification = await auditLogger.verifyChainIntegrity();
console.log('Audit chain valid:', verification.isValid);
```

### Zero-Trust Access Control

```typescript
import { zeroTrustEngine, zeroTrustMiddleware } from '@orchestrator/security';

// Apply zero-trust evaluation to routes
app.use('/api/admin/*', zeroTrustMiddleware.evaluate('/admin', 'write'));
app.use('/api/*', zeroTrustMiddleware.continuousVerification());

// Manual access evaluation
const context = {
  userId: 'user123',
  sessionId: 'session456',
  deviceFingerprint: 'device789',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  timestamp: new Date()
};

const decision = await zeroTrustEngine.evaluateAccess('/admin/users', 'delete', context);
console.log('Access allowed:', decision.allowed);
console.log('Trust score:', decision.trustScore.overall);
```

### Vulnerability Scanning

```typescript
import { vulnerabilityScanner } from '@orchestrator/security';

// Scan dependencies
const depReport = await vulnerabilityScanner.scanDependencies('./');
console.log('Vulnerabilities found:', depReport.summary.total);

// Scan container image
const containerReport = await vulnerabilityScanner.scanContainer('myapp:latest');

// Generate compliance report
const compliance = await vulnerabilityScanner.generateComplianceReport();
console.log('Compliance status:', compliance.complianceStatus);
```

## Middleware Usage

### Express.js Integration

```typescript
import express from 'express';
import { 
  SecurityMiddleware, 
  auditMiddleware, 
  zeroTrustMiddleware 
} from '@orchestrator/security';

const app = express();
const redis = new Redis();
const securityMw = new SecurityMiddleware(redis, config);

// Apply security middleware
app.use(securityMw.securityHeaders());
app.use(securityMw.corsMiddleware(corsConfig));
app.use(securityMw.rateLimitMiddleware());
app.use(securityMw.ddosProtectionMiddleware());
app.use(securityMw.requestValidation());
app.use(securityMw.inputSanitization());

// Apply audit logging
app.use(auditMiddleware.requestAudit());

// Apply zero-trust for sensitive routes
app.use('/api/admin/*', zeroTrustMiddleware.evaluate('/admin', 'admin'));
app.use('/api/*', zeroTrustMiddleware.adaptiveAuth());

// Authentication routes
app.use('/auth/*', auditMiddleware.authenticationAudit());

// Sensitive operations
app.use('/api/workflows/:id', auditMiddleware.sensitiveOperationAudit('workflow_access'));
```

## Security Testing

### Running Penetration Tests

```bash
# Run penetration tests against your application
npm run pentest

# Set target URL
TARGET_URL=https://your-app.com npm run pentest

# Run with custom configuration
ts-node scripts/penetration-test.ts
```

### Running Security Scans

```bash
# Run dependency vulnerability scan
npm run security-scan

# Run all security tests
npm test

# Run with coverage
npm run test:coverage
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Security Configuration
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Encryption Configuration
ENCRYPTION_KEY_ROTATION_DAYS=30
AUDIT_CHAIN_VERIFICATION_INTERVAL=3600

# Zero-Trust Configuration
TRUST_SCORE_THRESHOLD=0.6
MFA_REQUIRED_THRESHOLD=0.5
DEVICE_REGISTRATION_REQUIRED=true
```

### Security Policies

Zero-trust policies can be configured programmatically:

```typescript
import { zeroTrustEngine } from '@orchestrator/security';

// Add custom policy
const policy = {
  id: 'custom-policy',
  name: 'Custom Access Policy',
  resource: '/api/sensitive/*',
  action: '*',
  conditions: [
    { type: 'trust_score', operator: 'gt', value: 0.8 },
    { type: 'mfa', operator: 'eq', value: true }
  ],
  effect: 'allow',
  priority: 150
};

zeroTrustEngine.addPolicy(policy);
```

## Monitoring & Alerting

The security service provides comprehensive monitoring capabilities:

- Real-time security event streaming
- Trust score monitoring and alerting
- Vulnerability scan result notifications
- Audit log integrity verification
- Rate limiting and DDoS attack detection

## Compliance

This security service helps meet various compliance requirements:

- **SOC 2**: Comprehensive audit logging and access controls
- **GDPR**: Data encryption and privacy controls
- **HIPAA**: Encryption at rest and in transit
- **PCI DSS**: Secure data handling and access controls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.