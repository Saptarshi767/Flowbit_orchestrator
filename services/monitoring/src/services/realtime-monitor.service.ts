import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { IRealtimeMonitor } from '../interfaces/monitoring.interface';
import { Metrics, Alert } from '@robust-ai-orchestrator/shared';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';

interface Subscription {
  id: string;
  type: 'executions' | 'metrics' | 'alerts';
  callback: (data: any) => void;
  socket?: Socket;
  userId?: string;
  organizationId?: string;
}

export class RealtimeMonitorService implements IRealtimeMonitor {
  private io: SocketIOServer;
  private subscriptions: Map<string, Subscription> = new Map();
  private logger: Logger;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(httpServer: HttpServer, logger: Logger) {
    this.logger = logger;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Handle authentication
      socket.on('authenticate', (token: string) => {
        this.authenticateSocket(socket, token);
      });

      // Handle subscription requests
      socket.on('subscribe:executions', (data: any) => {
        this.handleExecutionSubscription(socket, data);
      });

      socket.on('subscribe:metrics', (data: any) => {
        this.handleMetricsSubscription(socket, data);
      });

      socket.on('subscribe:alerts', (data: any) => {
        this.handleAlertsSubscription(socket, data);
      });

      // Handle unsubscription
      socket.on('unsubscribe', (subscriptionId: string) => {
        this.handleUnsubscribe(socket, subscriptionId);
      });

      // Handle disconnection
      socket.on('disconnect', (reason: string) => {
        this.logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
        this.handleDisconnection(socket);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        this.logger.error(`Socket error for client ${socket.id}:`, error);
      });
    });
  }

  private async authenticateSocket(socket: Socket, token: string): Promise<void> {
    try {
      // TODO: Implement JWT token validation
      // For now, we'll accept any token and extract user info
      const decoded = this.decodeToken(token);
      
      socket.data.userId = decoded.userId;
      socket.data.organizationId = decoded.organizationId;
      socket.data.authenticated = true;

      socket.emit('authenticated', { success: true });
      this.logger.info(`Socket authenticated for user: ${decoded.userId}`);
    } catch (error) {
      this.logger.error(`Authentication failed for socket ${socket.id}:`, error);
      socket.emit('authenticated', { success: false, error: 'Invalid token' });
      socket.disconnect();
    }
  }

  private decodeToken(token: string): any {
    // Placeholder token decoding - should use proper JWT validation
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload;
    } catch {
      throw new Error('Invalid token format');
    }
  }

  private handleExecutionSubscription(socket: Socket, data: any): void {
    if (!socket.data.authenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      type: 'executions',
      callback: (execution: any) => {
        socket.emit('execution:update', execution);
      },
      socket,
      userId: socket.data.userId,
      organizationId: socket.data.organizationId
    };

    this.subscriptions.set(subscriptionId, subscription);
    socket.emit('subscribed', { 
      subscriptionId, 
      type: 'executions',
      filters: data.filters 
    });

    this.logger.debug(`Client ${socket.id} subscribed to executions with ID: ${subscriptionId}`);
  }

  private handleMetricsSubscription(socket: Socket, data: any): void {
    if (!socket.data.authenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      type: 'metrics',
      callback: (metrics: Metrics) => {
        socket.emit('metrics:update', metrics);
      },
      socket,
      userId: socket.data.userId,
      organizationId: socket.data.organizationId
    };

    this.subscriptions.set(subscriptionId, subscription);
    socket.emit('subscribed', { 
      subscriptionId, 
      type: 'metrics',
      interval: data.interval || 5000 
    });

    this.logger.debug(`Client ${socket.id} subscribed to metrics with ID: ${subscriptionId}`);
  }

  private handleAlertsSubscription(socket: Socket, data: any): void {
    if (!socket.data.authenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      type: 'alerts',
      callback: (alert: Alert) => {
        socket.emit('alert:triggered', alert);
      },
      socket,
      userId: socket.data.userId,
      organizationId: socket.data.organizationId
    };

    this.subscriptions.set(subscriptionId, subscription);
    socket.emit('subscribed', { 
      subscriptionId, 
      type: 'alerts',
      severity: data.severity 
    });

    this.logger.debug(`Client ${socket.id} subscribed to alerts with ID: ${subscriptionId}`);
  }

  private handleUnsubscribe(socket: Socket, subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription && subscription.socket?.id === socket.id) {
      this.subscriptions.delete(subscriptionId);
      socket.emit('unsubscribed', { subscriptionId });
      this.logger.debug(`Client ${socket.id} unsubscribed from: ${subscriptionId}`);
    }
  }

  private handleDisconnection(socket: Socket): void {
    this.connectedClients.delete(socket.id);
    
    // Remove all subscriptions for this socket
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.socket?.id === socket.id) {
        this.subscriptions.delete(id);
      }
    }
  }

  // Public interface methods
  subscribeToExecutions(callback: (execution: any) => void): string {
    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      type: 'executions',
      callback
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }

  subscribeToMetrics(callback: (metrics: Metrics) => void): string {
    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      type: 'metrics',
      callback
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }

  subscribeToAlerts(callback: (alert: Alert) => void): string {
    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      type: 'alerts',
      callback
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      this.subscriptions.delete(subscriptionId);
      
      if (subscription.socket) {
        subscription.socket.emit('unsubscribed', { subscriptionId });
      }
      
      this.logger.debug(`Unsubscribed: ${subscriptionId}`);
    }
  }

  broadcastExecutionUpdate(executionId: string, update: any): void {
    const message = {
      executionId,
      update,
      timestamp: new Date()
    };

    // Broadcast to all execution subscribers
    for (const subscription of this.subscriptions.values()) {
      if (subscription.type === 'executions') {
        try {
          subscription.callback(message);
        } catch (error) {
          this.logger.error(`Failed to broadcast execution update to subscription ${subscription.id}:`, error);
        }
      }
    }

    // Also broadcast via socket.io rooms
    this.io.to('executions').emit('execution:update', message);
    this.logger.debug(`Broadcasted execution update for: ${executionId}`);
  }

  broadcastMetricsUpdate(metrics: Metrics): void {
    // Broadcast to all metrics subscribers
    for (const subscription of this.subscriptions.values()) {
      if (subscription.type === 'metrics') {
        try {
          subscription.callback(metrics);
        } catch (error) {
          this.logger.error(`Failed to broadcast metrics update to subscription ${subscription.id}:`, error);
        }
      }
    }

    // Also broadcast via socket.io rooms
    this.io.to('metrics').emit('metrics:update', metrics);
    this.logger.debug('Broadcasted metrics update');
  }

  broadcastAlert(alert: Alert): void {
    // Broadcast to all alert subscribers
    for (const subscription of this.subscriptions.values()) {
      if (subscription.type === 'alerts') {
        try {
          subscription.callback(alert);
        } catch (error) {
          this.logger.error(`Failed to broadcast alert to subscription ${subscription.id}:`, error);
        }
      }
    }

    // Also broadcast via socket.io rooms
    this.io.to('alerts').emit('alert:triggered', alert);
    this.logger.info(`Broadcasted alert: ${alert.id} (${alert.severity})`);
  }

  // Utility methods
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  getSubscriptionsCount(): number {
    return this.subscriptions.size;
  }

  getSubscriptionsByType(type: 'executions' | 'metrics' | 'alerts'): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.type === type);
  }

  // Room management for socket.io
  joinRoom(socketId: string, room: string): void {
    const socket = this.connectedClients.get(socketId);
    if (socket) {
      socket.join(room);
      this.logger.debug(`Socket ${socketId} joined room: ${room}`);
    }
  }

  leaveRoom(socketId: string, room: string): void {
    const socket = this.connectedClients.get(socketId);
    if (socket) {
      socket.leave(room);
      this.logger.debug(`Socket ${socketId} left room: ${room}`);
    }
  }
}