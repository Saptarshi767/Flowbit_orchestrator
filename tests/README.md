# Comprehensive Testing Suite

This directory contains the complete testing infrastructure for the AI Orchestrator platform, implementing a multi-layered testing strategy that ensures reliability, security, and performance at scale.

## 📋 Testing Overview

Our testing strategy follows the testing pyramid principle with comprehensive coverage across all system layers:

- **Unit Tests (70%)**: Fast, isolated tests for individual components
- **Integration Tests (20%)**: Service interaction and API contract testing  
- **End-to-End Tests (10%)**: Complete user workflow validation
- **Specialized Tests**: Load, security, chaos engineering, and performance testing

## 🏗️ Test Architecture

```
tests/
├── unit/                    # Unit tests for individual components
├── integration/             # Service integration tests
├── e2e/                     # End-to-end user workflow tests
│   ├── pages/              # Page Object Model implementations
│   └── fixtures/           # Test data and utilities
├── load/                    # Load and stress testing
├── security/                # Security vulnerability testing
├── chaos/                   # Chaos engineering experiments
│   └── scripts/            # Chaos experiment scripts
├── performance/             # Performance benchmarking
├── scripts/                 # Test utilities and reporting
└── fixtures/                # Shared test data
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for security/chaos tests
pip install -r tests/security/requirements.txt
pip install -r tests/chaos/requirements.txt

# Install Playwright for E2E tests
npx playwright install --with-deps

# Install k6 for load testing (Linux/macOS)
# See: https://k6.io/docs/getting-started/installation/
```

### Running Tests Locally

```bash
# Run all unit tests
npm run test:unit

# Run integration tests (requires services)
npm run test:integration

# Run E2E tests (requires full application)
npm run test:e2e

# Run load tests
npm run test:load

# Run security tests
npm run test:security

# Run all tests
npm run test:all
```

## 📊 Test Categories

### Unit Tests

Fast, isolated tests that validate individual components without external dependencies.

**Location**: `tests/unit/`
**Framework**: Vitest + Testing Library
**Coverage Target**: 90%

```bash
# Run unit tests with coverage
npm run test:unit -- --coverage

# Run specific service tests
npm run test:unit -- services/orchestration

# Watch mode for development
npm run test:unit -- --watch
```

### Integration Tests

Test service interactions, API contracts, and database operations.

**Location**: `tests/integration/`
**Framework**: Supertest + Vitest
**Dependencies**: PostgreSQL, Redis, Elasticsearch

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration

# Run specific integration test suite
npm run test:integration -- --grep "Workflow Management"
```

### End-to-End Tests

Complete user workflow validation using real browser automation.

**Location**: `tests/e2e/`
**Framework**: Playwright
**Pattern**: Page Object Model

```bash
# Run E2E tests
npm run test:e2e

# Run specific test file
npx playwright test user-workflows.spec.ts

# Run with UI mode for debugging
npx playwright test --ui

# Generate test report
npx playwright show-report
```

**Key E2E Test Scenarios**:
- User authentication and authorization
- Workflow creation across all engines (Langflow, N8N, LangSmith)
- Workflow execution and monitoring
- Collaboration and sharing features
- Marketplace workflow discovery and import

### Load Testing

Validate system performance under realistic load conditions.

**Location**: `tests/load/`
**Tools**: k6, Artillery
**Scenarios**: Authentication, workflow management, execution, monitoring

```bash
# Run k6 load tests
k6 run tests/load/k6-load-tests.js

# Run Artillery performance tests
artillery run tests/load/artillery-config.yml

# Custom load test with specific parameters
k6 run tests/load/k6-load-tests.js \
  --vus 50 \
  --duration 10m \
  --env BASE_URL=https://staging.example.com
```

**Load Test Scenarios**:
- **Browse Workflows** (40%): List, search, and view workflows
- **Execute Workflows** (30%): Trigger and monitor executions
- **Create Workflows** (20%): Create new workflows
- **Monitor System** (10%): View dashboards and metrics

### Security Testing

Comprehensive security vulnerability assessment and penetration testing.

**Location**: `tests/security/`
**Tools**: Custom Python suite, OWASP ZAP
**Coverage**: Authentication, authorization, input validation, data protection

```bash
# Run security test suite
python tests/security/security-test-suite.py

# Run with specific target
python tests/security/security-test-suite.py https://staging.example.com

# Run OWASP ZAP scan
docker run --rm -v $(pwd):/zap/wrk/:rw \
  owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:3000 \
  -J security-report.json
```

**Security Test Categories**:
- **Authentication Security**: SQL injection, brute force protection, JWT validation
- **API Security**: CORS, rate limiting, input validation, authorization
- **Data Security**: Encryption, data leakage, file upload security

### Chaos Engineering

Fault tolerance validation through controlled failure injection.

**Location**: `tests/chaos/`
**Tools**: Chaos Toolkit, custom scripts
**Targets**: Database failures, service crashes, network partitions

```bash
# Run chaos experiments
chaos run tests/chaos/chaos-experiments.yml

# Run specific experiment
chaos run tests/chaos/database-failure.yml

# Validate steady state only
chaos run tests/chaos/chaos-experiments.yml --dry
```

**Chaos Experiments**:
- Database connection pool exhaustion
- Service pod failures and recovery
- Redis cache unavailability
- Network partitions between services
- High CPU load and auto-scaling
- Elasticsearch index corruption

## 🔧 Test Configuration

### Environment Variables

```bash
# Test database configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/test_db
REDIS_URL=redis://localhost:6379
ELASTICSEARCH_URL=http://localhost:9200

# Test application configuration
BASE_URL=http://localhost:3000
JWT_SECRET=test-secret-key
NODE_ENV=test

# Load testing configuration
LOAD_TEST_DURATION=300s
LOAD_TEST_VUS=50
LOAD_TEST_RAMP_UP=60s

# Security testing configuration
SECURITY_SCAN_TIMEOUT=300
OWASP_ZAP_ENABLED=true

# Chaos testing configuration
CHAOS_DURATION=300
KUBERNETES_NAMESPACE=ai-orchestrator
```

### Docker Compose for Testing

```bash
# Start all test services
docker-compose -f docker-compose.test.yml up -d

# Start specific services
docker-compose -f docker-compose.test.yml up -d postgres redis

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Clean up
docker-compose -f docker-compose.test.yml down -v
```

## 📈 Continuous Integration

### GitHub Actions Pipeline

Our CI/CD pipeline runs comprehensive tests on every commit:

1. **Unit Tests**: Parallel execution across all services
2. **Integration Tests**: Full service stack validation
3. **E2E Tests**: Critical user workflow verification
4. **Security Tests**: Vulnerability scanning and penetration testing
5. **Load Tests**: Performance validation (nightly/on-demand)
6. **Chaos Tests**: Fault tolerance validation (nightly/on-demand)

### Test Triggers

- **Pull Requests**: Unit, integration, E2E, security tests
- **Main Branch**: All tests including load and chaos
- **Nightly Schedule**: Full comprehensive test suite
- **Manual Triggers**: Use commit messages with `[load-test]` or `[chaos-test]`

### Quality Gates

Tests must pass these thresholds to proceed:

- **Unit Test Coverage**: ≥90%
- **Integration Test Success**: 100%
- **E2E Test Success**: 100%
- **Security Test Success**: 100%
- **Load Test P95 Response Time**: <2000ms
- **Load Test Error Rate**: <5%

## 📊 Test Reporting

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html

# Upload to Codecov (CI)
codecov --file coverage/lcov.info
```

### Performance Reports

```bash
# Generate k6 HTML report
k6 run --out json=results.json tests/load/k6-load-tests.js
k6-reporter results.json --output report.html

# Generate Artillery report
artillery report performance-results.json --output report.html
```

### Security Reports

Security test results are automatically generated in multiple formats:

- **JSON Report**: `security-test-report.json`
- **OWASP ZAP Report**: `zap-report.html`
- **Vulnerability Summary**: Console output with pass/fail status

## 🛠️ Test Maintenance

### Adding New Tests

1. **Unit Tests**: Add to appropriate service directory
2. **Integration Tests**: Add to `tests/integration/`
3. **E2E Tests**: Add to `tests/e2e/` using Page Object Model
4. **Load Tests**: Extend scenarios in k6 or Artillery configs
5. **Security Tests**: Add to security test suite
6. **Chaos Tests**: Add experiments to chaos configuration

### Test Data Management

```bash
# Seed test database
npm run db:seed:test

# Reset test data
npm run db:reset:test

# Generate test fixtures
npm run fixtures:generate
```

### Debugging Tests

```bash
# Debug unit tests
npm run test:unit -- --inspect-brk

# Debug E2E tests with browser
npx playwright test --debug

# Debug integration tests
npm run test:integration -- --verbose

# View test logs
docker-compose -f docker-compose.test.yml logs test-service
```

## 🚨 Troubleshooting

### Common Issues

**Tests timing out**:
```bash
# Increase timeout for specific tests
test('slow operation', { timeout: 60000 }, async () => {
  // test code
});
```

**Database connection issues**:
```bash
# Check database status
docker-compose -f docker-compose.test.yml ps postgres

# Reset database
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d postgres
```

**E2E tests failing**:
```bash
# Run with headed browser for debugging
npx playwright test --headed

# Take screenshots on failure
npx playwright test --screenshot=only-on-failure
```

**Load tests not running**:
```bash
# Check k6 installation
k6 version

# Verify target application is running
curl http://localhost:3000/health
```

### Performance Optimization

- **Parallel Test Execution**: Use `--parallel` flag for faster runs
- **Test Isolation**: Ensure tests don't interfere with each other
- **Resource Cleanup**: Always clean up test data and connections
- **Selective Testing**: Use test filters for faster development cycles

## 📚 Best Practices

### Test Writing Guidelines

1. **Follow AAA Pattern**: Arrange, Act, Assert
2. **Use Descriptive Names**: Test names should explain what is being tested
3. **Keep Tests Independent**: Each test should be able to run in isolation
4. **Mock External Dependencies**: Use mocks for external services in unit tests
5. **Test Edge Cases**: Include boundary conditions and error scenarios

### Test Organization

1. **Group Related Tests**: Use `describe` blocks to organize tests logically
2. **Use Page Objects**: For E2E tests, implement the Page Object Model
3. **Shared Utilities**: Create reusable test utilities and fixtures
4. **Environment Separation**: Use different configurations for different environments

### Maintenance Schedule

- **Weekly**: Review test failures and flaky tests
- **Monthly**: Update test dependencies and tools
- **Quarterly**: Review test coverage and add missing scenarios
- **Annually**: Evaluate testing strategy and tools

## 🔗 Related Documentation

- [API Documentation](../docs/api.md)
- [Deployment Guide](../docs/deployment.md)
- [Security Guidelines](../docs/security.md)
- [Performance Tuning](../docs/performance.md)
- [Troubleshooting Guide](../docs/troubleshooting.md)

## 🤝 Contributing

When contributing new features:

1. Add appropriate unit tests (minimum 90% coverage)
2. Add integration tests for new APIs
3. Add E2E tests for new user workflows
4. Update load tests if performance characteristics change
5. Add security tests for new authentication/authorization features
6. Update this documentation for new test categories

For questions or support, please refer to our [Contributing Guidelines](../CONTRIBUTING.md) or reach out to the development team.