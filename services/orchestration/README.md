# Orchestration Service

The orchestration service provides the core engine adapter infrastructure for the Robust AI Orchestrator platform. It implements a unified interface for multiple workflow engines (Langflow, N8N, LangSmith) with advanced error handling, retry mechanisms, and workflow format conversion capabilities.

## Features

### Base Engine Adapter Interface
- **IEngineAdapter**: Unified interface for all workflow engines
- **BaseEngineAdapter**: Abstract base class with shared functionality
- **Engine-specific adapters**: Concrete implementations for each supported engine

### Engine Type Detection
- **Automatic detection**: Identifies workflow engine type from structure
- **Validation**: Ensures workflow compatibility with target engines
- **Support matrix**: Comprehensive engine type support validation

### Workflow Format Conversion
- **Cross-engine conversion**: Convert workflows between different engine formats
- **Bidirectional support**: Full conversion matrix between all supported engines
- **Structure preservation**: Maintains workflow logic during conversion

### Error Handling & Resilience
- **Circuit breaker pattern**: Prevents cascading failures
- **Retry mechanisms**: Configurable retry logic with exponential backoff
- **Error classification**: Intelligent error categorization for retry decisions

### Monitoring & Logging
- **Structured logging**: Consistent logging across all adapters
- **Execution tracking**: Detailed execution metrics and status tracking
- **Performance monitoring**: Circuit breaker metrics and health monitoring

## Architecture

### Core Components

```
orchestration/
├── src/
│   ├── interfaces/
│   │   └── engine-adapter.interface.ts    # Core adapter interface
│   ├── adapters/
│   │   └── base-adapter.ts                # Base adapter implementation
│   ├── utils/
│   │   ├── engine-detection.ts            # Engine type detection
│   │   ├── workflow-converter.ts          # Format conversion
│   │   ├── circuit-breaker.ts             # Circuit breaker implementation
│   │   └── logger.ts                      # Logging utility
│   └── index.ts                           # Main exports
└── tests/
    └── unit/                              # Comprehensive unit tests
```

### Supported Engine Types

- **Langflow**: Visual flow-based AI workflow builder
- **N8N**: Workflow automation platform
- **LangSmith**: LangChain workflow orchestration

## Usage

### Basic Engine Adapter Implementation

```typescript
import { BaseEngineAdapter, EngineType } from '@robust-ai-orchestrator/orchestration';

class MyEngineAdapter extends BaseEngineAdapter {
  constructor(config: EngineAdapterConfig) {
    super(EngineType.LANGFLOW, config);
  }

  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    // Implement engine-specific validation
    const commonValidation = this.validateCommonWorkflowProperties(workflow);
    // Add engine-specific validation logic
    return commonValidation;
  }

  async executeWorkflow(workflow: WorkflowDefinition, parameters: WorkflowParameters): Promise<ExecutionResult> {
    // Implement engine-specific execution
    const executionId = this.generateExecutionId();
    this.logExecutionStart(workflow, parameters);
    
    // Execute with retry and circuit breaker protection
    const result = await this.executeWithRetry(async () => {
      return await this.httpClient.post('/execute', { workflow, parameters });
    }, 'workflow-execution');
    
    this.logExecutionComplete(result);
    return result;
  }

  // Implement other required methods...
}
```

### Engine Type Detection

```typescript
import { EngineDetection } from '@robust-ai-orchestrator/orchestration';

// Detect engine type from workflow structure
const engineType = EngineDetection.detectEngineType(workflowData);

// Validate compatibility
const compatibility = EngineDetection.validateEngineCompatibility(workflow, EngineType.LANGFLOW);
if (!compatibility.isCompatible) {
  console.log('Issues:', compatibility.issues);
  console.log('Suggestions:', compatibility.suggestions);
}
```

### Workflow Format Conversion

```typescript
import { WorkflowConverter } from '@robust-ai-orchestrator/orchestration';

// Convert Langflow workflow to N8N format
const n8nWorkflow = await WorkflowConverter.convertWorkflow(langflowWorkflow, EngineType.N8N);

// Check if conversion is supported
const isSupported = WorkflowConverter.isConversionSupported(EngineType.LANGFLOW, EngineType.N8N);
```

### Circuit Breaker Usage

```typescript
import { CircuitBreaker } from '@robust-ai-orchestrator/orchestration';

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 30000,
  monitoringPeriod: 10000
});

// Execute operation with circuit breaker protection
const result = await circuitBreaker.execute(async () => {
  return await someRiskyOperation();
});
```

## Configuration

### Engine Adapter Configuration

```typescript
interface EngineAdapterConfig {
  baseUrl: string;              // Engine API base URL
  apiKey?: string;              // Authentication API key
  timeout: number;              // Request timeout in milliseconds
  retryConfig: {
    maxAttempts: number;        // Maximum retry attempts
    initialDelay: number;       // Initial delay between retries
    maxDelay: number;           // Maximum delay between retries
    backoffFactor: number;      // Exponential backoff factor
  };
  customHeaders?: Record<string, string>;  // Additional HTTP headers
  customConfig?: Record<string, any>;      // Engine-specific configuration
}
```

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening
  recoveryTimeout: number;      // Time to wait before attempting recovery
  monitoringPeriod: number;     // Monitoring window for failure counting
}
```

## Testing

The service includes comprehensive unit tests covering:

- **Base adapter functionality**: Core adapter methods and error handling
- **Engine detection**: Workflow type detection and validation
- **Format conversion**: Cross-engine workflow conversion
- **Circuit breaker**: Fault tolerance and recovery mechanisms
- **Error handling**: Retry logic and error classification

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Error Handling

### Error Classification

The service classifies errors into categories for appropriate handling:

- **Retryable errors**: Network timeouts, server errors (5xx), rate limits (429)
- **Non-retryable errors**: Client errors (4xx), authentication failures
- **Circuit breaker errors**: When circuit is open due to repeated failures

### Retry Strategy

- **Exponential backoff**: Increasing delays between retry attempts
- **Jitter**: Random variation to prevent thundering herd
- **Maximum attempts**: Configurable limit on retry attempts
- **Timeout handling**: Proper timeout management for long-running operations

## Monitoring

### Metrics Collection

- **Execution metrics**: Duration, success/failure rates, throughput
- **Circuit breaker metrics**: State changes, failure counts, recovery times
- **Error metrics**: Error rates by type, retry attempts, timeout occurrences

### Health Monitoring

- **Connection testing**: Regular health checks to engine endpoints
- **Circuit breaker state**: Real-time monitoring of circuit breaker status
- **Performance tracking**: Response times and resource utilization

## Development

### Adding New Engine Support

1. Create a new adapter class extending `BaseEngineAdapter`
2. Implement all required interface methods
3. Add engine-specific detection patterns to `EngineDetection`
4. Add conversion logic to `WorkflowConverter`
5. Write comprehensive unit tests
6. Update documentation

### Best Practices

- **Error handling**: Always use the provided error handling utilities
- **Logging**: Use structured logging with appropriate context
- **Testing**: Write tests for both success and failure scenarios
- **Configuration**: Make adapters configurable for different environments
- **Performance**: Use circuit breakers for external service calls

## Dependencies

- **axios**: HTTP client for API communication
- **winston**: Structured logging
- **uuid**: Unique identifier generation
- **retry**: Retry logic implementation
- **joi**: Input validation (optional)

## License

This service is part of the Robust AI Orchestrator platform and follows the same licensing terms.