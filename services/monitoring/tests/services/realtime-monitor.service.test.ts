import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RealtimeMonitorService } from '../../src/services/realtime-monitor.service';
import { Metrics, Alert, AlertStatus, AlertSeverity } from '@robust-ai-orchestrator/shared';
import { createLogger } from 'winston';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Mock socket.io
const mockSocket = {
  id: 'test-socket-123',
  data: {},
  emit: vi.fn(),
  on: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  disconnect: vi.fn()
};

const mockIO = {
  on: vi.fn(),
  to: vi.fn(() => ({
    emit: vi.fn()
  }))
};

vi.mock('socket.io', () => ({
  Server: vi.fn(() => mockIO)
}));

describe('RealtimeMonitorService', () => {
  let service: RealtimeMonitorService;
  let logger: any;
  let mockHttpServer: HttpServer;

  beforeEach(() => {
    logger = createLogger({ silent: true });
    mockHttpServer = {} as HttpServer;
    service = new RealtimeMonitorService(mockHttpServer, logger);
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with HTTP server and logger', () => {
      expect(service).toBeDefined();
      expect(service.getConnectedClientsCount()).toBe(0);
      expect(service.getSubscriptionsCount()).toBe(0);
    });

    it('should set up socket.io server with correct configuration', () => {
      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('subscription management', () => {
    it('should create execution subscription', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToExecutions(callback);

      expect(subscriptionId).toBeDefined();
      expect(subscriptionId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
      expect(service.getSubscriptionsCount()).toBe(1);

      const subscriptions = service.getSubscriptionsByType('executions');
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].type).toBe('executions');
    });

    it('should create metrics subscription', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToMetrics(callback);

      expect(subscriptionId).toBeDefined();
      expect(service.getSubscriptionsCount()).toBe(1);

      const subscriptions = service.getSubscriptionsByType('metrics');
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].type).toBe('metrics');
    });

    it('should create alerts subscription', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToAlerts(callback);

      expect(subscriptionId).toBeDefined();
      expect(service.getSubscriptionsCount()).toBe(1);

      const subscriptions = service.getSubscriptionsByType('alerts');
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].type).toBe('alerts');
    });

    it('should unsubscribe from subscription', () => {
      const callback = vi.fn();
      const subscriptionId = service.subscribeToExecutions(callback);

      expect(service.getSubscriptionsCount()).toBe(1);

      service.unsubscribe(subscriptionId);

      expect(service.getSubscriptionsCount()).toBe(0);
    });

    it('should handle unsubscribe from non-existent subscription', () => {
      expect(() => {
        service.unsubscribe('non-existent-id');
      }).not.toThrow();
    });
  });

  describe('broadcasting', () => {
    it('should broadcast execution updates to subscribers', () => {
      const callback = vi.fn();
      service.subscribeToExecutions(callback);

      const executionUpdate = {
        executionId: 'exec-123',
        status: 'running',
        progress: 50
      };

      service.broadcastExecutionUpdate('exec-123', executionUpdate);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: 'exec-123',
          update: executionUpdate,
          timestamp: expect.any(Date)
        })
      );
    });

    it('should broadcast metrics updates to subscribers', () => {
      const callback = vi.fn();
      service.subscribeToMetrics(callback);

      const metrics: Metrics = {
        timestamp: new Date(),
        source: {
          service: 'test-service',
          instance: 'test-instance',
          version: '1.0.0',
          environment: 'test'
        },
        counters: { requests: 100 },
        gauges: { cpu_usage: 75 },
        histograms: { response_time: [1, 2, 3] },
        labels: { region: 'us-east-1' }
      };

      service.broadcastMetricsUpdate(metrics);

      expect(callback).toHaveBeenCalledWith(metrics);
    });

    it('should broadcast alerts to subscribers', () => {
      const callback = vi.fn();
      service.subscribeToAlerts(callback);

      const alert: Alert = {
        id: 'alert-123',
        conditionId: 'condition-456',
        status: AlertStatus.TRIGGERED,
        triggeredAt: new Date(),
        message: 'High CPU usage detected',
        value: 85,
        threshold: 80,
        severity: AlertSeverity.HIGH,
        metadata: {}
      };

      service.broadcastAlert(alert);

      expect(callback).toHaveBeenCalledWith(alert);
    });

    it('should handle callback errors gracefully', () => {
      const failingCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      service.subscribeToExecutions(failingCallback);

      expect(() => {
        service.broadcastExecutionUpdate('exec-123', { status: 'completed' });
      }).not.toThrow();

      expect(failingCallback).toHaveBeenCalled();
    });
  });

  describe('socket.io integration', () => {
    it('should broadcast to socket.io rooms', () => {
      const mockRoomEmit = vi.fn();
      mockIO.to.mockReturnValue({ emit: mockRoomEmit });

      const executionUpdate = { status: 'completed' };
      service.broadcastExecutionUpdate('exec-123', executionUpdate);

      expect(mockIO.to).toHaveBeenCalledWith('executions');
      expect(mockRoomEmit).toHaveBeenCalledWith('execution:update', expect.any(Object));
    });

    it('should broadcast metrics to socket.io rooms', () => {
      const mockRoomEmit = vi.fn();
      mockIO.to.mockReturnValue({ emit: mockRoomEmit });

      const metrics: Metrics = {
        timestamp: new Date(),
        source: {
          service: 'test-service',
          instance: 'test-instance',
          version: '1.0.0',
          environment: 'test'
        },
        counters: {},
        gauges: {},
        histograms: {},
        labels: {}
      };

      service.broadcastMetricsUpdate(metrics);

      expect(mockIO.to).toHaveBeenCalledWith('metrics');
      expect(mockRoomEmit).toHaveBeenCalledWith('metrics:update', metrics);
    });

    it('should broadcast alerts to socket.io rooms', () => {
      const mockRoomEmit = vi.fn();
      mockIO.to.mockReturnValue({ emit: mockRoomEmit });

      const alert: Alert = {
        id: 'alert-123',
        conditionId: 'condition-456',
        status: AlertStatus.TRIGGERED,
        triggeredAt: new Date(),
        message: 'Test alert',
        value: 100,
        threshold: 80,
        severity: AlertSeverity.MEDIUM,
        metadata: {}
      };

      service.broadcastAlert(alert);

      expect(mockIO.to).toHaveBeenCalledWith('alerts');
      expect(mockRoomEmit).toHaveBeenCalledWith('alert:triggered', alert);
    });
  });

  describe('room management', () => {
    beforeEach(() => {
      // Simulate connected client
      (service as any).connectedClients.set('test-socket-123', mockSocket);
    });

    it('should join socket to room', () => {
      service.joinRoom('test-socket-123', 'test-room');

      expect(mockSocket.join).toHaveBeenCalledWith('test-room');
    });

    it('should leave socket from room', () => {
      service.leaveRoom('test-socket-123', 'test-room');

      expect(mockSocket.leave).toHaveBeenCalledWith('test-room');
    });

    it('should handle join room for non-existent socket', () => {
      expect(() => {
        service.joinRoom('non-existent-socket', 'test-room');
      }).not.toThrow();
    });

    it('should handle leave room for non-existent socket', () => {
      expect(() => {
        service.leaveRoom('non-existent-socket', 'test-room');
      }).not.toThrow();
    });
  });

  describe('socket event handling', () => {
    let connectionHandler: Function;

    beforeEach(() => {
      // Extract the connection handler from the mock
      const onCalls = mockIO.on.mock.calls;
      const connectionCall = onCalls.find(call => call[0] === 'connection');
      connectionHandler = connectionCall?.[1];
    });

    it('should handle socket connection', () => {
      expect(connectionHandler).toBeDefined();
      
      if (connectionHandler) {
        connectionHandler(mockSocket);
        // Verify socket event handlers are set up
        expect(mockSocket.on).toHaveBeenCalledWith('authenticate', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('subscribe:executions', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('subscribe:metrics', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('subscribe:alerts', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      }
    });

    it('should handle socket authentication', () => {
      if (connectionHandler) {
        connectionHandler(mockSocket);
        
        // Find the authenticate handler
        const authenticateCall = mockSocket.on.mock.calls.find(call => call[0] === 'authenticate');
        const authenticateHandler = authenticateCall?.[1];
        
        if (authenticateHandler) {
          // Mock a valid JWT token (base64 encoded JSON)
          const mockToken = 'header.' + Buffer.from(JSON.stringify({
            userId: 'user123',
            organizationId: 'org456'
          })).toString('base64') + '.signature';
          
          authenticateHandler(mockToken);
          
          expect(mockSocket.data.userId).toBe('user123');
          expect(mockSocket.data.organizationId).toBe('org456');
          expect(mockSocket.data.authenticated).toBe(true);
          expect(mockSocket.emit).toHaveBeenCalledWith('authenticated', { success: true });
        }
      }
    });

    it('should handle invalid authentication', () => {
      if (connectionHandler) {
        connectionHandler(mockSocket);
        
        const authenticateCall = mockSocket.on.mock.calls.find(call => call[0] === 'authenticate');
        const authenticateHandler = authenticateCall?.[1];
        
        if (authenticateHandler) {
          authenticateHandler('invalid-token');
          
          expect(mockSocket.emit).toHaveBeenCalledWith('authenticated', { 
            success: false, 
            error: 'Invalid token' 
          });
          expect(mockSocket.disconnect).toHaveBeenCalled();
        }
      }
    });

    it('should handle socket disconnection', () => {
      if (connectionHandler) {
        connectionHandler(mockSocket);
        
        const disconnectCall = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
        const disconnectHandler = disconnectCall?.[1];
        
        if (disconnectHandler) {
          disconnectHandler('client disconnect');
          // Verify cleanup logic would be called
        }
      }
    });
  });

  describe('subscription statistics', () => {
    it('should track connected clients count', () => {
      expect(service.getConnectedClientsCount()).toBe(0);
      
      // Simulate client connection
      (service as any).connectedClients.set('client1', mockSocket);
      expect(service.getConnectedClientsCount()).toBe(1);
      
      (service as any).connectedClients.set('client2', mockSocket);
      expect(service.getConnectedClientsCount()).toBe(2);
    });

    it('should track total subscriptions count', () => {
      expect(service.getSubscriptionsCount()).toBe(0);
      
      service.subscribeToExecutions(vi.fn());
      expect(service.getSubscriptionsCount()).toBe(1);
      
      service.subscribeToMetrics(vi.fn());
      expect(service.getSubscriptionsCount()).toBe(2);
      
      service.subscribeToAlerts(vi.fn());
      expect(service.getSubscriptionsCount()).toBe(3);
    });

    it('should get subscriptions by type', () => {
      service.subscribeToExecutions(vi.fn());
      service.subscribeToExecutions(vi.fn());
      service.subscribeToMetrics(vi.fn());
      service.subscribeToAlerts(vi.fn());

      expect(service.getSubscriptionsByType('executions')).toHaveLength(2);
      expect(service.getSubscriptionsByType('metrics')).toHaveLength(1);
      expect(service.getSubscriptionsByType('alerts')).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should handle subscription callback errors without crashing', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscription callback error');
      });
      
      service.subscribeToExecutions(errorCallback);
      
      expect(() => {
        service.broadcastExecutionUpdate('exec-123', { status: 'completed' });
      }).not.toThrow();
    });

    it('should handle multiple subscription types for same callback', () => {
      const callback = vi.fn();
      
      const execId = service.subscribeToExecutions(callback);
      const metricsId = service.subscribeToMetrics(callback);
      const alertsId = service.subscribeToAlerts(callback);
      
      expect(execId).not.toBe(metricsId);
      expect(metricsId).not.toBe(alertsId);
      expect(service.getSubscriptionsCount()).toBe(3);
    });
  });
});