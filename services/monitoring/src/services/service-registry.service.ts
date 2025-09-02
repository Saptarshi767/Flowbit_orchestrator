import { IServiceRegistry, ServiceRegistration } from '../interfaces/monitoring.interface';
import { ServiceDiscovery, ServiceInfo, ServiceInstance, InstanceStatus, HealthStatus } from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import axios from 'axios';

export class ServiceRegistryService implements IServiceRegistry {
  private services: Map<string, ServiceRegistration> = new Map();
  private instances: Map<string, ServiceInstance> = new Map();
  private logger: Logger;
  private heartbeatInterval: number = 30000; // 30 seconds
  private heartbeatTask?: NodeJS.Timeout;

  constructor(logger: Logger) {
    this.logger = logger;
    this.startHeartbeatMonitoring();
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatTask = setInterval(async () => {
      await this.checkServiceHealth();
    }, this.heartbeatInterval);

    this.logger.info('Service registry heartbeat monitoring started');
  }

  private async checkServiceHealth(): Promise<void> {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - this.heartbeatInterval * 2);

    for (const [instanceId, instance] of this.instances.entries()) {
      if (instance.lastSeen < staleThreshold && instance.status === InstanceStatus.ACTIVE) {
        // Mark as inactive if no heartbeat received
        instance.status = InstanceStatus.INACTIVE;
        this.logger.warn(`Service instance marked as inactive: ${instanceId}`);
      }
    }

    // Perform health checks for services with health check URLs
    for (const [serviceId, service] of this.services.entries()) {
      if (service.healthCheckUrl) {
        await this.performHealthCheck(serviceId, service);
      }
    }
  }

  private async performHealthCheck(serviceId: string, service: ServiceRegistration): Promise<void> {
    try {
      const response = await axios.get(service.healthCheckUrl!, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });

      const instance = this.instances.get(serviceId);
      if (instance) {
        instance.status = response.status < 400 ? InstanceStatus.ACTIVE : InstanceStatus.INACTIVE;
        instance.lastSeen = new Date();
        instance.metadata = {
          ...instance.metadata,
          healthCheck: {
            status: response.status,
            lastCheck: new Date(),
            responseTime: Date.now() - new Date().getTime()
          }
        };
      }
    } catch (error) {
      const instance = this.instances.get(serviceId);
      if (instance) {
        instance.status = InstanceStatus.INACTIVE;
        instance.metadata = {
          ...instance.metadata,
          healthCheck: {
            error: error instanceof Error ? error.message : String(error),
            lastCheck: new Date()
          }
        };
      }

      this.logger.warn(`Health check failed for service ${serviceId}:`, error);
    }
  }

  async registerService(service: ServiceRegistration): Promise<void> {
    try {
      this.services.set(service.id, service);

      const instance: ServiceInstance = {
        id: service.id,
        host: service.host,
        port: service.port,
        status: InstanceStatus.ACTIVE,
        metadata: {
          ...service.metadata,
          registeredAt: new Date()
        },
        lastSeen: new Date()
      };

      this.instances.set(service.id, instance);

      this.logger.info(`Registered service: ${service.name} (${service.id}) at ${service.host}:${service.port}`);
    } catch (error) {
      this.logger.error(`Failed to register service ${service.id}:`, error);
      throw error;
    }
  }

  async deregisterService(serviceId: string): Promise<void> {
    try {
      const service = this.services.get(serviceId);
      if (!service) {
        throw new Error(`Service not found: ${serviceId}`);
      }

      this.services.delete(serviceId);
      this.instances.delete(serviceId);

      this.logger.info(`Deregistered service: ${service.name} (${serviceId})`);
    } catch (error) {
      this.logger.error(`Failed to deregister service ${serviceId}:`, error);
      throw error;
    }
  }

  async getServices(): Promise<ServiceDiscovery> {
    try {
      const serviceMap = new Map<string, ServiceInfo>();

      // Group instances by service name
      for (const [serviceId, service] of this.services.entries()) {
        const instance = this.instances.get(serviceId);
        if (!instance) continue;

        if (!serviceMap.has(service.name)) {
          serviceMap.set(service.name, {
            name: service.name,
            version: service.version,
            instances: [],
            healthStatus: HealthStatus.HEALTHY
          });
        }

        const serviceInfo = serviceMap.get(service.name)!;
        serviceInfo.instances.push(instance);

        // Update overall health status
        if (instance.status === InstanceStatus.INACTIVE) {
          if (serviceInfo.healthStatus === HealthStatus.HEALTHY) {
            serviceInfo.healthStatus = HealthStatus.DEGRADED;
          }
        }
      }

      // Check if any service has all instances inactive
      for (const serviceInfo of serviceMap.values()) {
        const activeInstances = serviceInfo.instances.filter(i => i.status === InstanceStatus.ACTIVE);
        if (activeInstances.length === 0 && serviceInfo.instances.length > 0) {
          serviceInfo.healthStatus = HealthStatus.UNHEALTHY;
        }
      }

      return {
        services: Array.from(serviceMap.values()),
        lastUpdated: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async heartbeat(serviceId: string): Promise<void> {
    try {
      const instance = this.instances.get(serviceId);
      if (!instance) {
        throw new Error(`Service instance not found: ${serviceId}`);
      }

      instance.lastSeen = new Date();
      if (instance.status === InstanceStatus.INACTIVE) {
        instance.status = InstanceStatus.ACTIVE;
        this.logger.info(`Service instance reactivated: ${serviceId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process heartbeat for ${serviceId}:`, error);
      throw error;
    }
  }

  // Utility methods
  getServiceById(serviceId: string): ServiceRegistration | undefined {
    return this.services.get(serviceId);
  }

  getInstanceById(instanceId: string): ServiceInstance | undefined {
    return this.instances.get(instanceId);
  }

  getServicesByName(serviceName: string): ServiceRegistration[] {
    return Array.from(this.services.values()).filter(service => service.name === serviceName);
  }

  getActiveInstances(): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(instance => instance.status === InstanceStatus.ACTIVE);
  }

  getServiceStats(): {
    totalServices: number;
    totalInstances: number;
    activeInstances: number;
    inactiveInstances: number;
    drainingInstances: number;
  } {
    const instances = Array.from(this.instances.values());
    
    return {
      totalServices: this.services.size,
      totalInstances: instances.length,
      activeInstances: instances.filter(i => i.status === InstanceStatus.ACTIVE).length,
      inactiveInstances: instances.filter(i => i.status === InstanceStatus.INACTIVE).length,
      drainingInstances: instances.filter(i => i.status === InstanceStatus.DRAINING).length
    };
  }

  // Load balancing helper
  getHealthyInstancesForService(serviceName: string): ServiceInstance[] {
    const services = this.getServicesByName(serviceName);
    const healthyInstances: ServiceInstance[] = [];

    for (const service of services) {
      const instance = this.instances.get(service.id);
      if (instance && instance.status === InstanceStatus.ACTIVE) {
        healthyInstances.push(instance);
      }
    }

    return healthyInstances;
  }

  // Round-robin load balancing
  getNextInstanceForService(serviceName: string): ServiceInstance | null {
    const healthyInstances = this.getHealthyInstancesForService(serviceName);
    if (healthyInstances.length === 0) {
      return null;
    }

    // Simple round-robin (in production, you'd want more sophisticated load balancing)
    const index = Math.floor(Math.random() * healthyInstances.length);
    return healthyInstances[index];
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.heartbeatTask) {
      clearInterval(this.heartbeatTask);
    }
    
    this.services.clear();
    this.instances.clear();
    
    this.logger.info('Service registry cleaned up');
  }
}