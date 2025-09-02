import { IHealthChecker, HealthCheckFunction } from '../interfaces/monitoring.interface';
import { HealthCheck, HealthStatus, HealthCheckResult } from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import axios from 'axios';
import { createClient, RedisClientType } from 'redis';

export class HealthCheckerService implements IHealthChecker {
  private checks: Map<string, HealthCheckFunction> = new Map();
  private logger: Logger;
  private redisClient?: RedisClientType;

  constructor(logger: Logger) {
    this.logger = logger;
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Database connectivity check
    this.registerCheck('database', async () => {
      try {
        // TODO: Replace with actual database connection check
        const start = Date.now();
        // Simulate database ping
        await new Promise(resolve => setTimeout(resolve, 10));
        const duration = Date.now() - start;
        
        return {
          status: 'healthy' as const,
          message: 'Database connection successful',
          metadata: { responseTime: duration }
        };
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: `Database connection failed: ${error}`,
          metadata: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    });

    // Redis connectivity check
    this.registerCheck('redis', async () => {
      try {
        if (!this.redisClient) {
          this.redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
          });
          await this.redisClient.connect();
        }

        const start = Date.now();
        await this.redisClient.ping();
        const duration = Date.now() - start;

        return {
          status: 'healthy' as const,
          message: 'Redis connection successful',
          metadata: { responseTime: duration }
        };
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: `Redis connection failed: ${error}`,
          metadata: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    });

    // Memory usage check
    this.registerCheck('memory', async () => {
      try {
        const memUsage = process.memoryUsage();
        const totalMem = memUsage.heapTotal;
        const usedMem = memUsage.heapUsed;
        const memoryUsagePercent = (usedMem / totalMem) * 100;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        let message = 'Memory usage is normal';

        if (memoryUsagePercent > 90) {
          status = 'unhealthy';
          message = 'Memory usage is critically high';
        } else if (memoryUsagePercent > 75) {
          status = 'degraded';
          message = 'Memory usage is elevated';
        }

        return {
          status,
          message,
          metadata: {
            heapUsed: usedMem,
            heapTotal: totalMem,
            usagePercent: memoryUsagePercent,
            external: memUsage.external,
            rss: memUsage.rss
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: `Memory check failed: ${error}`,
          metadata: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    });

    // CPU usage check
    this.registerCheck('cpu', async () => {
      try {
        const start = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const end = process.cpuUsage(start);
        
        const cpuPercent = ((end.user + end.system) / 100000) * 100;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        let message = 'CPU usage is normal';

        if (cpuPercent > 90) {
          status = 'unhealthy';
          message = 'CPU usage is critically high';
        } else if (cpuPercent > 75) {
          status = 'degraded';
          message = 'CPU usage is elevated';
        }

        return {
          status,
          message,
          metadata: {
            cpuPercent,
            userTime: end.user,
            systemTime: end.system
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: `CPU check failed: ${error}`,
          metadata: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    });

    // Disk space check
    this.registerCheck('disk', async () => {
      try {
        // Note: This is a simplified check. In production, you'd want to check actual disk usage
        const stats = await import('fs').then(fs => fs.promises.stat('.'));
        
        return {
          status: 'healthy' as const,
          message: 'Disk space is adequate',
          metadata: {
            size: stats.size,
            modified: stats.mtime
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy' as const,
          message: `Disk check failed: ${error}`,
          metadata: { error: error instanceof Error ? error.message : String(error) }
        };
      }
    });

    // External service connectivity checks
    this.registerExternalServiceChecks();
  }

  private registerExternalServiceChecks(): void {
    // Langflow service check
    this.registerCheck('langflow', async () => {
      return this.checkExternalService('Langflow', process.env.LANGFLOW_URL || 'http://localhost:7860');
    });

    // N8N service check
    this.registerCheck('n8n', async () => {
      return this.checkExternalService('N8N', process.env.N8N_URL || 'http://localhost:5678');
    });

    // LangSmith service check
    this.registerCheck('langsmith', async () => {
      return this.checkExternalService('LangSmith', process.env.LANGSMITH_URL || 'https://api.smith.langchain.com');
    });
  }

  private async checkExternalService(serviceName: string, url: string): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const start = Date.now();
      const response = await axios.get(`${url}/health`, {
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept 4xx as degraded, not unhealthy
      });
      const duration = Date.now() - start;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `${serviceName} is responding normally`;

      if (response.status >= 400) {
        status = 'degraded';
        message = `${serviceName} returned ${response.status}`;
      }

      return {
        status,
        message,
        metadata: {
          responseTime: duration,
          statusCode: response.status,
          url
        }
      };
    } catch (error) {
      const isTimeout = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
      const isConnectionError = axios.isAxiosError(error) && error.code === 'ECONNREFUSED';

      return {
        status: 'unhealthy',
        message: `${serviceName} is not accessible: ${isTimeout ? 'timeout' : isConnectionError ? 'connection refused' : 'unknown error'}`,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          url,
          timeout: isTimeout,
          connectionRefused: isConnectionError
        }
      };
    }
  }

  registerCheck(name: string, check: HealthCheckFunction): void {
    this.checks.set(name, check);
    this.logger.debug(`Registered health check: ${name}`);
  }

  async runChecks(): Promise<HealthCheck> {
    const timestamp = new Date();
    const results: HealthCheckResult[] = [];
    let overallStatus: HealthStatus = HealthStatus.HEALTHY;

    this.logger.debug(`Running ${this.checks.size} health checks`);

    for (const [name, check] of this.checks.entries()) {
      const start = Date.now();
      
      try {
        const result = await Promise.race([
          check(),
          new Promise<{ status: 'unhealthy'; message: string }>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 10000)
          )
        ]);

        const duration = Date.now() - start;
        
        const checkResult: HealthCheckResult = {
          name,
          status: result.status === 'healthy' ? HealthStatus.HEALTHY :
                  result.status === 'degraded' ? HealthStatus.DEGRADED :
                  HealthStatus.UNHEALTHY,
          message: result.message,
          duration,
          metadata: result.metadata
        };

        results.push(checkResult);

        // Update overall status based on individual check results
        if (checkResult.status === HealthStatus.UNHEALTHY) {
          overallStatus = HealthStatus.UNHEALTHY;
        } else if (checkResult.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.HEALTHY) {
          overallStatus = HealthStatus.DEGRADED;
        }

        this.logger.debug(`Health check ${name}: ${checkResult.status} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - start;
        
        const checkResult: HealthCheckResult = {
          name,
          status: HealthStatus.UNHEALTHY,
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          duration,
          metadata: { error: error instanceof Error ? error.message : String(error) }
        };

        results.push(checkResult);
        overallStatus = HealthStatus.UNHEALTHY;

        this.logger.error(`Health check ${name} failed:`, error);
      }
    }

    const healthCheck: HealthCheck = {
      service: 'monitoring',
      status: overallStatus,
      timestamp,
      checks: results,
      metadata: {
        totalChecks: this.checks.size,
        healthyChecks: results.filter(r => r.status === HealthStatus.HEALTHY).length,
        degradedChecks: results.filter(r => r.status === HealthStatus.DEGRADED).length,
        unhealthyChecks: results.filter(r => r.status === HealthStatus.UNHEALTHY).length
      }
    };

    this.logger.info(`Health check completed: ${overallStatus} (${results.length} checks)`);
    return healthCheck;
  }

  async getHealthStatus(): Promise<HealthCheck> {
    return this.runChecks();
  }

  // Utility methods
  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys());
  }

  removeCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      this.logger.debug(`Removed health check: ${name}`);
    }
    return removed;
  }

  async runSingleCheck(name: string): Promise<HealthCheckResult | null> {
    const check = this.checks.get(name);
    if (!check) {
      return null;
    }

    const start = Date.now();
    try {
      const result = await check();
      const duration = Date.now() - start;

      return {
        name,
        status: result.status === 'healthy' ? HealthStatus.HEALTHY :
                result.status === 'degraded' ? HealthStatus.DEGRADED :
                HealthStatus.UNHEALTHY,
        message: result.message,
        duration,
        metadata: result.metadata
      };
    } catch (error) {
      const duration = Date.now() - start;
      return {
        name,
        status: HealthStatus.UNHEALTHY,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}