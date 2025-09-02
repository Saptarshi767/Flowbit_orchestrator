import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ServiceRegistryService } from '../../src/services/service-registry.service';
import { ServiceRegistration } from '../../src/interfaces/monitoring.interface';
import { InstanceStatus, HealthStatus } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('ServiceRegistryService', () => {
  let service: ServiceRegistryService;
  let logger: any;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    service = new ServiceRegistryService(logger);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await service.cleanup();
    vi.clearAllMocks();
  });

  describe('registerService', () => {
    it('should register a new service successfully', async () => {
      const serviceRegistration: ServiceRegistration = {
        id: 'test-service-1',
        name: 'test-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3000,
        metadata: { environment: 'test' }
      };

      await service.registerService(serviceRegistration);

      const registeredService = service.getServiceById('test-service-1');
      expect(registeredService).toEqual(serviceRegistration);

      const instance = service.getInstanceById('test-service-1');
      expect(instance).toMatchObject({
        id: 'test-service-1',
        host: 'localhost',
        port: 3000,
        status: InstanceStatus.ACTIVE
      });
    });

    it('should register service with health check URL', async () => {
      const serviceRegistration: ServiceRegistration = {
        id: 'health-check-service',
        name: 'health-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3001,
        metadata: { environment: 'test' },
        healthCheckUrl: 'http://localhost:3001/health'
      };

      await service.registerService(serviceRegistration);

      const registeredService = service.getServiceById('health-check-service');
      expect(registeredService?.healthCheckUrl).toBe('http://localhost:3001/health');
    });
  });

  describe('deregisterService', () => {
    beforeEach(async () => {
      const serviceRegistration: ServiceRegistration = {
        id: 'deregister-test',
        name: 'deregister-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3002,
        metadata: {}
      };

      await service.registerService(serviceRegistration);
    });

    it('should deregister an existing service', async () => {
      await service.deregisterService('deregister-test');

      const service1 = service.getServiceById('deregister-test');
      const instance = service.getInstanceById('deregister-test');

      expect(service1).toBeUndefined();
      expect(instance).toBeUndefined();
    });

    it('should throw error when deregistering non-existent service', async () => {
      await expect(
        service.deregisterService('non-existent')
      ).rejects.toThrow('Service not found: non-existent');
    });
  });

  describe('getServices', () => {
    beforeEach(async () => {
      const services: ServiceRegistration[] = [
        {
          id: 'service-1',
          name: 'api-service',
          version: '1.0.0',
          host: 'localhost',
          port: 3000,
          metadata: {}
        },
        {
          id: 'service-2',
          name: 'api-service',
          version: '1.0.0',
          host: 'localhost',
          port: 3001,
          metadata: {}
        },
        {
          id: 'service-3',
          name: 'worker-service',
          version: '2.0.0',
          host: 'localhost',
          port: 3002,
          metadata: {}
        }
      ];

      for (const svc of services) {
        await service.registerService(svc);
      }
    });

    it('should return service discovery information', async () => {
      const discovery = await service.getServices();

      expect(discovery.services).toHaveLength(2); // 2 unique service names
      expect(discovery.lastUpdated).toBeInstanceOf(Date);

      const apiService = discovery.services.find(s => s.name === 'api-service');
      const workerService = discovery.services.find(s => s.name === 'worker-service');

      expect(apiService).toBeDefined();
      expect(apiService?.instances).toHaveLength(2);
      expect(apiService?.version).toBe('1.0.0');
      expect(apiService?.healthStatus).toBe(HealthStatus.HEALTHY);

      expect(workerService).toBeDefined();
      expect(workerService?.instances).toHaveLength(1);
      expect(workerService?.version).toBe('2.0.0');
    });

    it('should set health status to degraded when some instances are inactive', async () => {
      // Mark one instance as inactive
      const instance = service.getInstanceById('service-1');
      if (instance) {
        instance.status = InstanceStatus.INACTIVE;
      }

      const discovery = await service.getServices();
      const apiService = discovery.services.find(s => s.name === 'api-service');

      expect(apiService?.healthStatus).toBe(HealthStatus.DEGRADED);
    });

    it('should set health status to unhealthy when all instances are inactive', async () => {
      // Mark all worker service instances as inactive
      const instance = service.getInstanceById('service-3');
      if (instance) {
        instance.status = InstanceStatus.INACTIVE;
      }

      const discovery = await service.getServices();
      const workerService = discovery.services.find(s => s.name === 'worker-service');

      expect(workerService?.healthStatus).toBe(HealthStatus.UNHEALTHY);
    });
  });

  describe('heartbeat', () => {
    beforeEach(async () => {
      const serviceRegistration: ServiceRegistration = {
        id: 'heartbeat-test',
        name: 'heartbeat-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3003,
        metadata: {}
      };

      await service.registerService(serviceRegistration);
    });

    it('should update last seen timestamp on heartbeat', async () => {
      const instanceBefore = service.getInstanceById('heartbeat-test');
      const lastSeenBefore = instanceBefore?.lastSeen;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.heartbeat('heartbeat-test');

      const instanceAfter = service.getInstanceById('heartbeat-test');
      const lastSeenAfter = instanceAfter?.lastSeen;

      expect(lastSeenAfter).toBeDefined();
      expect(lastSeenAfter!.getTime()).toBeGreaterThan(lastSeenBefore!.getTime());
    });

    it('should reactivate inactive instance on heartbeat', async () => {
      const instance = service.getInstanceById('heartbeat-test');
      if (instance) {
        instance.status = InstanceStatus.INACTIVE;
      }

      await service.heartbeat('heartbeat-test');

      const updatedInstance = service.getInstanceById('heartbeat-test');
      expect(updatedInstance?.status).toBe(InstanceStatus.ACTIVE);
    });

    it('should throw error for non-existent service instance', async () => {
      await expect(
        service.heartbeat('non-existent')
      ).rejects.toThrow('Service instance not found: non-existent');
    });
  });

  describe('health check monitoring', () => {
    beforeEach(async () => {
      const serviceRegistration: ServiceRegistration = {
        id: 'health-monitor-test',
        name: 'monitored-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3004,
        metadata: {},
        healthCheckUrl: 'http://localhost:3004/health'
      };

      await service.registerService(serviceRegistration);
    });

    it('should perform health checks for services with health check URLs', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200 });

      // Trigger health check manually
      await (service as any).performHealthCheck('health-monitor-test', service.getServiceById('health-monitor-test'));

      const instance = service.getInstanceById('health-monitor-test');
      expect(instance?.status).toBe(InstanceStatus.ACTIVE);
      expect(instance?.metadata?.healthCheck).toBeDefined();
      expect(instance?.metadata?.healthCheck?.status).toBe(200);
    });

    it('should mark service as inactive on health check failure', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection refused'));

      await (service as any).performHealthCheck('health-monitor-test', service.getServiceById('health-monitor-test'));

      const instance = service.getInstanceById('health-monitor-test');
      expect(instance?.status).toBe(InstanceStatus.INACTIVE);
      expect(instance?.metadata?.healthCheck?.error).toBeDefined();
    });

    it('should handle health check timeout', async () => {
      const timeoutError = new Error('timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      await (service as any).performHealthCheck('health-monitor-test', service.getServiceById('health-monitor-test'));

      const instance = service.getInstanceById('health-monitor-test');
      expect(instance?.status).toBe(InstanceStatus.INACTIVE);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      const services: ServiceRegistration[] = [
        {
          id: 'util-1',
          name: 'util-service',
          version: '1.0.0',
          host: 'host1',
          port: 3000,
          metadata: {}
        },
        {
          id: 'util-2',
          name: 'util-service',
          version: '1.0.0',
          host: 'host2',
          port: 3000,
          metadata: {}
        },
        {
          id: 'util-3',
          name: 'other-service',
          version: '1.0.0',
          host: 'host3',
          port: 3000,
          metadata: {}
        }
      ];

      for (const svc of services) {
        await service.registerService(svc);
      }
    });

    it('should get services by name', () => {
      const utilServices = service.getServicesByName('util-service');
      expect(utilServices).toHaveLength(2);
      expect(utilServices.every(s => s.name === 'util-service')).toBe(true);
    });

    it('should get active instances', () => {
      const activeInstances = service.getActiveInstances();
      expect(activeInstances).toHaveLength(3);
      expect(activeInstances.every(i => i.status === InstanceStatus.ACTIVE)).toBe(true);
    });

    it('should get service stats', () => {
      const stats = service.getServiceStats();
      expect(stats.totalServices).toBe(3);
      expect(stats.totalInstances).toBe(3);
      expect(stats.activeInstances).toBe(3);
      expect(stats.inactiveInstances).toBe(0);
      expect(stats.drainingInstances).toBe(0);
    });

    it('should get healthy instances for service', () => {
      const healthyInstances = service.getHealthyInstancesForService('util-service');
      expect(healthyInstances).toHaveLength(2);
      expect(healthyInstances.every(i => i.status === InstanceStatus.ACTIVE)).toBe(true);
    });

    it('should get next instance for load balancing', () => {
      const instance = service.getNextInstanceForService('util-service');
      expect(instance).toBeDefined();
      expect(instance?.status).toBe(InstanceStatus.ACTIVE);
    });

    it('should return null when no healthy instances available', () => {
      // Mark all instances as inactive
      const instances = service.getHealthyInstancesForService('util-service');
      instances.forEach(instance => {
        instance.status = InstanceStatus.INACTIVE;
      });

      const nextInstance = service.getNextInstanceForService('util-service');
      expect(nextInstance).toBeNull();
    });
  });

  describe('stale instance detection', () => {
    beforeEach(async () => {
      const serviceRegistration: ServiceRegistration = {
        id: 'stale-test',
        name: 'stale-service',
        version: '1.0.0',
        host: 'localhost',
        port: 3005,
        metadata: {}
      };

      await service.registerService(serviceRegistration);
    });

    it('should mark stale instances as inactive', async () => {
      const instance = service.getInstanceById('stale-test');
      if (instance) {
        // Set last seen to a time in the past (beyond stale threshold)
        instance.lastSeen = new Date(Date.now() - 120000); // 2 minutes ago
      }

      // Trigger health check monitoring
      await (service as any).checkServiceHealth();

      const updatedInstance = service.getInstanceById('stale-test');
      expect(updatedInstance?.status).toBe(InstanceStatus.INACTIVE);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
      
      const stats = service.getServiceStats();
      expect(stats.totalServices).toBe(0);
      expect(stats.totalInstances).toBe(0);
    });
  });
});