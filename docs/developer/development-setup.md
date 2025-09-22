# Development Setup Guide

This guide will help you set up a local development environment for the Robust AI Orchestrator platform.

## Prerequisites

### Required Software
- **Node.js** (v18 or higher)
- **Docker** (v20 or higher) and Docker Compose
- **Git** (v2.30 or higher)
- **PostgreSQL** (v14 or higher) - for local development
- **Redis** (v6 or higher) - for caching and sessions

### Recommended Tools
- **VS Code** with recommended extensions
- **Postman** or **Insomnia** for API testing
- **pgAdmin** or **DBeaver** for database management
- **Redis Commander** for Redis management

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/robust-ai-orchestrator.git
cd robust-ai-orchestrator
```

### 2. Environment Setup

Copy the environment template and configure your local settings:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/orchestrator_dev"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-jwt-secret-key"
OAUTH_GOOGLE_CLIENT_ID="your-google-client-id"
OAUTH_GOOGLE_CLIENT_SECRET="your-google-client-secret"

# External Services
LANGFLOW_API_URL="http://localhost:7860"
N8N_API_URL="http://localhost:5678"
LANGSMITH_API_KEY="your-langsmith-api-key"

# Development Settings
NODE_ENV="development"
LOG_LEVEL="debug"
```

### 3. Install Dependencies

```bash
# Install root dependencies
npm install

# Install service dependencies
npm run install:all
```

### 4. Start Development Environment

Using Docker Compose (Recommended):

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

Or start services individually:

```bash
# Start database and Redis
docker-compose -f docker-compose.dev.yml up -d postgres redis elasticsearch

# Start the application
npm run dev
```

### 5. Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

### 6. Verify Setup

Visit the following URLs to verify your setup:
- **Web Application**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/health

## Project Structure

```
robust-ai-orchestrator/
├── apps/
│   ├── web/                 # Next.js web application
│   └── api/                 # API Gateway service
├── services/
│   ├── auth/               # Authentication service
│   ├── orchestration/      # Core orchestration engine
│   ├── workflow-management/ # Workflow CRUD operations
│   ├── execution/          # Execution service
│   ├── monitoring/         # Monitoring and analytics
│   ├── marketplace/        # Workflow marketplace
│   └── notification/       # Notification service
├── packages/
│   ├── shared/             # Shared utilities and types
│   ├── database/           # Database schemas and migrations
│   └── sdk/                # Client SDK
├── infrastructure/
│   ├── docker/             # Docker configurations
│   ├── kubernetes/         # K8s manifests
│   └── terraform/          # Infrastructure as code
├── docs/                   # Documentation
└── tests/                  # Test suites
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature-name
```

### 2. Running Tests

```bash
# Run all tests
npm test

# Run specific service tests
npm run test:auth
npm run test:orchestration

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### 3. Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check

# Security audit
npm audit
```

## Service Development

### Creating a New Service

1. **Generate Service Structure**:
```bash
npm run create:service my-new-service
```

2. **Service Template**:
```typescript
// services/my-new-service/src/app.ts
import express from 'express';
import { createServer } from './server';
import { config } from './config';

const app = express();
const server = createServer(app);

server.listen(config.port, () => {
  console.log(`Service running on port ${config.port}`);
});
```

3. **Add Service Configuration**:
```typescript
// services/my-new-service/src/config.ts
export const config = {
  port: process.env.PORT || 3001,
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
};
```

### Database Migrations

```bash
# Create new migration
npm run db:migration:create add_new_table

# Run migrations
npm run db:migrate

# Rollback migration
npm run db:migrate:rollback

# Reset database
npm run db:reset
```

### API Development

1. **Define Routes**:
```typescript
// services/my-service/src/routes/index.ts
import { Router } from 'express';
import { authenticate } from '@shared/middleware';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

router.use(authenticate);

router.get('/protected', (req, res) => {
  res.json({ message: 'Protected route' });
});

export { router };
```

2. **Add Validation**:
```typescript
import { body, validationResult } from 'express-validator';

const validateCreateRequest = [
  body('name').isString().isLength({ min: 1 }),
  body('email').isEmail(),
];

router.post('/create', validateCreateRequest, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Handle request
});
```

## Frontend Development

### Next.js Application

The web application is built with Next.js and includes:
- **App Router**: Modern Next.js routing
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling
- **Shadcn/ui**: Component library
- **React Query**: Data fetching and caching

### Component Development

```typescript
// components/WorkflowCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Workflow } from '@/types/workflow';

interface WorkflowCardProps {
  workflow: Workflow;
  onExecute: (id: string) => void;
}

export function WorkflowCard({ workflow, onExecute }: WorkflowCardProps) {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {workflow.name}
          <Badge variant="secondary">{workflow.engineType}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {workflow.description}
        </p>
        <button
          onClick={() => onExecute(workflow.id)}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 rounded-md"
        >
          Execute Workflow
        </button>
      </CardContent>
    </Card>
  );
}
```

### State Management

```typescript
// hooks/useWorkflows.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '@/lib/api';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: workflowApi.getAll,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: workflowApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}
```

## Testing

### Unit Tests

```typescript
// services/auth/src/auth.service.test.ts
import { AuthService } from './auth.service';
import { mockUserRepository } from '../__mocks__/user.repository';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockUserRepository);
  });

  it('should authenticate valid user', async () => {
    const result = await authService.authenticate('user@example.com', 'password');
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const result = await authService.authenticate('user@example.com', 'wrong');
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

```typescript
// tests/integration/workflow.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { setupTestDb, cleanupTestDb } from '../utils/test-db';

describe('Workflow API', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it('should create workflow', async () => {
    const response = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer test-token')
      .send({
        name: 'Test Workflow',
        engineType: 'langflow',
        definition: { nodes: [], edges: [] }
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Workflow');
  });
});
```

### E2E Tests

```typescript
// tests/e2e/workflow-creation.spec.ts
import { test, expect } from '@playwright/test';

test('create and execute workflow', async ({ page }) => {
  await page.goto('/workflows');
  
  // Create workflow
  await page.click('[data-testid="create-workflow"]');
  await page.fill('[data-testid="workflow-name"]', 'E2E Test Workflow');
  await page.selectOption('[data-testid="engine-type"]', 'langflow');
  await page.click('[data-testid="save-workflow"]');
  
  // Execute workflow
  await page.click('[data-testid="execute-workflow"]');
  await page.waitForSelector('[data-testid="execution-success"]');
  
  expect(await page.textContent('[data-testid="execution-status"]')).toBe('Completed');
});
```

## Debugging

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/api/src/index.ts",
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "sourceMaps": true
    }
  ]
}
```

### Logging

```typescript
// utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

## Performance Monitoring

### Local Monitoring Setup

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

### Application Metrics

```typescript
// utils/metrics.ts
import client from 'prom-client';

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

export const workflowExecutions = new client.Counter({
  name: 'workflow_executions_total',
  help: 'Total number of workflow executions',
  labelNames: ['engine_type', 'status']
});
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
```bash
# Check port usage
lsof -i :3000

# Kill process
kill -9 <PID>
```

2. **Database Connection Issues**:
```bash
# Check PostgreSQL status
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

3. **Node Modules Issues**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

- **Internal Documentation**: Check `/docs` folder
- **Team Chat**: Use internal Slack/Discord channels
- **Code Reviews**: Create PR for feedback
- **Architecture Questions**: Consult with senior developers

## Contributing

See our [Contributing Guide](./contributing.md) for detailed information about:
- Code style guidelines
- Pull request process
- Issue reporting
- Documentation standards

## Next Steps

1. **Complete Setup**: Ensure all services are running
2. **Run Tests**: Verify everything works correctly
3. **Explore Codebase**: Familiarize yourself with the architecture
4. **Pick First Issue**: Start with "good first issue" labels
5. **Join Team**: Introduce yourself to the development team