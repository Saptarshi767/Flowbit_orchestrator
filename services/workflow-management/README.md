# Workflow Management Service

This service provides comprehensive workflow management capabilities for the AI orchestrator platform, supporting multiple workflow engines (Langflow, N8N, LangSmith) with advanced versioning, collaboration, and validation features.

## Features

- **Multi-Engine Support**: Native support for Langflow, N8N, and LangSmith workflow engines
- **Workflow Versioning**: Automatic and manual versioning with change tracking and comparison
- **Collaboration**: Role-based workflow sharing with granular permissions
- **Validation**: Engine-specific workflow definition validation
- **Search & Discovery**: Advanced search and filtering capabilities
- **Statistics**: Comprehensive workflow and execution analytics

## Architecture

The service follows a layered architecture:

```
┌─────────────────────────────────────┐
│           Service Layer             │
│        (WorkflowService)            │
├─────────────────────────────────────┤
│         Repository Layer            │
│  (Workflow, Version, Collaborator)  │
├─────────────────────────────────────┤
│          Database Layer             │
│         (Prisma ORM)                │
└─────────────────────────────────────┘
```

## Core Components

### Types
- **Workflow Types**: Complete TypeScript definitions for workflows, versions, and executions
- **Engine Types**: Support for Langflow, N8N, and LangSmith engine types
- **Validation Types**: Comprehensive validation result types

### Repositories
- **WorkflowRepository**: CRUD operations, search, and access control
- **WorkflowVersionRepository**: Version management and comparison
- **WorkflowCollaboratorRepository**: Collaboration and permission management
- **ExecutionRepository**: Execution tracking and statistics

### Services
- **WorkflowService**: High-level business logic with validation and authorization

### Utilities
- **Validation Utils**: Engine-specific workflow definition validation

## Usage

### Basic Usage

```typescript
import { createWorkflowService } from '@flowbit/workflow-management'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const workflowService = createWorkflowService(prisma)

// Create a workflow
const workflow = await workflowService.createWorkflow({
  name: 'My Workflow',
  engineType: EngineType.LANGFLOW,
  definition: {
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: { value: 'Hello World' }
      }
    ],
    edges: []
  }
}, userId, organizationId)
```

### Advanced Features

```typescript
// Share workflow with collaborator
await workflowService.shareWorkflow(workflowId, {
  userId: collaboratorId,
  role: CollaboratorRole.EDITOR
}, ownerId)

// Create new version
await workflowService.createWorkflowVersion(workflowId, {
  definition: updatedDefinition,
  changeLog: 'Added new processing node'
}, userId)

// Search workflows
const results = await workflowService.searchWorkflows({
  query: 'data processing',
  engineType: EngineType.LANGFLOW,
  tags: ['automation'],
  limit: 10
})

// Validate workflow definition
const validation = workflowService.validateWorkflowDefinition(
  definition,
  EngineType.LANGFLOW
)
```

## Engine-Specific Features

### Langflow Support
- Node and edge validation
- Circular dependency detection
- Disconnected node warnings
- Position and data validation

### N8N Support
- Node type and parameter validation
- Trigger node detection
- Credential requirement warnings
- Connection validation

### LangSmith Support
- LLM model configuration validation
- Chain reference validation
- Step sequence validation
- Type-specific node validation

## Testing

The service includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- validation.utils.test.ts
npm test -- workflow.repository.test.ts
npm test -- workflow.service.test.ts
```

### Test Categories

- **Unit Tests**: Individual component testing with mocks
- **Integration Tests**: End-to-end workflow lifecycle testing
- **Validation Tests**: Engine-specific validation testing

## Database Schema

The service uses the following main database tables:

- `workflows`: Main workflow definitions
- `workflow_versions`: Version history and change tracking
- `workflow_collaborators`: Sharing and permission management
- `executions`: Execution tracking and results

## Error Handling

The service provides comprehensive error handling:

- **Validation Errors**: Detailed validation messages with error codes
- **Permission Errors**: Clear authorization failure messages
- **Not Found Errors**: Specific resource not found messages
- **Business Logic Errors**: Domain-specific error handling

## Performance Considerations

- **Database Indexing**: Optimized indexes for search and filtering
- **Pagination**: Built-in pagination for large result sets
- **Caching**: Repository-level caching for frequently accessed data
- **Lazy Loading**: Efficient loading of related data

## Security

- **Access Control**: Role-based permissions for all operations
- **Input Validation**: Comprehensive input sanitization and validation
- **SQL Injection Prevention**: Parameterized queries via Prisma
- **Authorization Checks**: Consistent permission verification

## Development

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Code Quality

- **TypeScript**: Full type safety with strict mode
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Vitest**: Modern testing framework

## Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all validation rules are properly tested
5. Follow the repository pattern for data access

## API Reference

### WorkflowService Methods

#### Workflow Management
- `createWorkflow(request, userId, organizationId)`: Create new workflow
- `getWorkflow(id, userId)`: Get workflow by ID
- `updateWorkflow(id, request, userId)`: Update workflow
- `deleteWorkflow(id, userId)`: Delete workflow
- `searchWorkflows(options)`: Search workflows

#### Version Management
- `createWorkflowVersion(workflowId, request, userId)`: Create new version
- `getWorkflowVersions(workflowId, userId)`: Get all versions
- `getWorkflowVersion(workflowId, version, userId)`: Get specific version
- `compareWorkflowVersions(workflowId, v1, v2, userId)`: Compare versions

#### Collaboration
- `shareWorkflow(workflowId, request, userId)`: Share workflow
- `removeCollaborator(workflowId, collaboratorId, userId)`: Remove collaborator
- `updateCollaboratorRole(workflowId, collaboratorId, role, userId)`: Update role
- `getWorkflowCollaborators(workflowId, userId)`: Get collaborators

#### Statistics
- `getWorkflowStats(organizationId?)`: Get workflow statistics
- `getWorkflowsByOrganization(organizationId, limit?, offset?)`: Get org workflows
- `getWorkflowsByUser(userId, limit?, offset?)`: Get user workflows

#### Validation
- `validateWorkflowDefinition(definition, engineType)`: Validate workflow