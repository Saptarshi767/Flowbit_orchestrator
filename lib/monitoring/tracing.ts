import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  jaegerEndpoint?: string;
  prometheusPort?: number;
  environment?: string;
}

export class TracingService {
  private sdk: NodeSDK;
  private tracer: any;

  constructor(config: TracingConfig) {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || 'development',
    });

    // Jaeger exporter for traces
    const jaegerExporter = new JaegerExporter({
      endpoint: config.jaegerEndpoint || 'http://jaeger-collector:14268/api/traces',
    });

    // Prometheus exporter for metrics
    const prometheusExporter = new PrometheusExporter({
      port: config.prometheusPort || 9464,
    });

    this.sdk = new NodeSDK({
      resource,
      traceExporter: jaegerExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: prometheusExporter,
        exportIntervalMillis: 5000,
      }),
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable file system instrumentation to reduce noise
        },
      })],
    });

    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  }

  public initialize(): void {
    this.sdk.start();
    console.log(`Tracing initialized for service: ${this.sdk['_resource'].attributes['service.name']}`);
  }

  public shutdown(): Promise<void> {
    return this.sdk.shutdown();
  }

  public createSpan(name: string, options?: any) {
    return this.tracer.startSpan(name, options);
  }

  public async traceFunction<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes,
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  public traceWorkflowExecution(workflowId: string, executionId: string) {
    return this.tracer.startSpan('workflow.execution', {
      kind: SpanKind.SERVER,
      attributes: {
        'workflow.id': workflowId,
        'execution.id': executionId,
        'workflow.type': 'ai_orchestration',
      },
    });
  }

  public traceEngineCall(engineType: string, operation: string) {
    return this.tracer.startSpan(`engine.${engineType}.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'engine.type': engineType,
        'engine.operation': operation,
      },
    });
  }

  public traceApiRequest(method: string, path: string, userId?: string) {
    return this.tracer.startSpan(`http.${method.toLowerCase()}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.route': path,
        'user.id': userId,
      },
    });
  }

  public addSpanEvent(span: any, name: string, attributes?: Record<string, any>) {
    span.addEvent(name, attributes);
  }

  public setSpanAttribute(span: any, key: string, value: string | number | boolean) {
    span.setAttribute(key, value);
  }
}

// Middleware for Express.js to automatically trace HTTP requests
export function createTracingMiddleware(tracingService: TracingService) {
  return (req: any, res: any, next: any) => {
    const span = tracingService.traceApiRequest(
      req.method,
      req.route?.path || req.path,
      req.user?.id
    );

    // Add request details
    span.setAttributes({
      'http.url': req.url,
      'http.user_agent': req.get('User-Agent'),
      'http.request_content_length': req.get('Content-Length'),
    });

    // Trace response
    const originalSend = res.send;
    res.send = function(body: any) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_content_length': body ? body.length : 0,
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalSend.call(this, body);
    };

    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}

// Decorator for tracing class methods
export function Trace(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const traceName = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('default');
      const span = tracer.startSpan(traceName);

      try {
        const result = await originalMethod.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}