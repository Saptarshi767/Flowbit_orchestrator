import { Server as SocketIOServer, Socket } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'
import {
  CollaborationSession,
  CollaborativeOperation,
  OperationType,
  CursorPosition,
  SelectionRange,
  WebSocketEvent,
  UserJoinedEvent,
  UserLeftEvent,
  CursorUpdateEvent,
  OperationEvent
} from '../types/workflow.types'

export class CollaborationService {
  private sessions: Map<string, CollaborationSession> = new Map()
  private workflowSessions: Map<string, Set<string>> = new Map()
  private operationQueue: Map<string, CollaborativeOperation[]> = new Map()

  constructor(private io: SocketIOServer) {
    this.setupSocketHandlers()
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`)

      socket.on('join-workflow', (data: { workflowId: string; userId: string; userName: string }) => {
        this.handleJoinWorkflow(socket, data)
      })

      socket.on('leave-workflow', (data: { workflowId: string; userId: string }) => {
        this.handleLeaveWorkflow(socket, data)
      })

      socket.on('cursor-update', (data: { workflowId: string; userId: string; cursor: CursorPosition }) => {
        this.handleCursorUpdate(socket, data)
      })

      socket.on('selection-update', (data: { workflowId: string; userId: string; selection: SelectionRange }) => {
        this.handleSelectionUpdate(socket, data)
      })

      socket.on('operation', (data: { workflowId: string; operation: CollaborativeOperation }) => {
        this.handleOperation(socket, data)
      })

      socket.on('disconnect', () => {
        this.handleDisconnect(socket)
      })
    })
  }

  private handleJoinWorkflow(socket: Socket, data: { workflowId: string; userId: string; userName: string }): void {
    const { workflowId, userId, userName } = data

    // Join the workflow room
    socket.join(`workflow:${workflowId}`)

    // Create collaboration session
    const session: CollaborationSession = {
      id: uuidv4(),
      workflowId,
      userId,
      socketId: socket.id,
      lastActivity: new Date()
    }

    this.sessions.set(socket.id, session)

    // Track workflow sessions
    if (!this.workflowSessions.has(workflowId)) {
      this.workflowSessions.set(workflowId, new Set())
    }
    this.workflowSessions.get(workflowId)!.add(socket.id)

    // Notify other users
    const joinEvent: UserJoinedEvent = {
      type: 'USER_JOINED',
      data: {
        userId,
        userName
      },
      userId,
      timestamp: new Date()
    }

    socket.to(`workflow:${workflowId}`).emit('user-joined', joinEvent)

    // Send current active users to the new user
    const activeUsers = this.getActiveUsers(workflowId)
    socket.emit('active-users', activeUsers)

    console.log(`User ${userId} joined workflow ${workflowId}`)
  }

  private handleLeaveWorkflow(socket: Socket, data: { workflowId: string; userId: string }): void {
    const { workflowId, userId } = data

    socket.leave(`workflow:${workflowId}`)

    // Remove from workflow sessions
    if (this.workflowSessions.has(workflowId)) {
      this.workflowSessions.get(workflowId)!.delete(socket.id)
      if (this.workflowSessions.get(workflowId)!.size === 0) {
        this.workflowSessions.delete(workflowId)
      }
    }

    // Notify other users
    const leaveEvent: UserLeftEvent = {
      type: 'USER_LEFT',
      data: { userId },
      userId,
      timestamp: new Date()
    }

    socket.to(`workflow:${workflowId}`).emit('user-left', leaveEvent)

    console.log(`User ${userId} left workflow ${workflowId}`)
  }

  private handleCursorUpdate(socket: Socket, data: { workflowId: string; userId: string; cursor: CursorPosition }): void {
    const { workflowId, userId, cursor } = data
    const session = this.sessions.get(socket.id)

    if (session) {
      session.cursor = cursor
      session.lastActivity = new Date()

      const cursorEvent: CursorUpdateEvent = {
        type: 'CURSOR_UPDATE',
        data: { userId, cursor },
        userId,
        timestamp: new Date()
      }

      socket.to(`workflow:${workflowId}`).emit('cursor-update', cursorEvent)
    }
  }

  private handleSelectionUpdate(socket: Socket, data: { workflowId: string; userId: string; selection: SelectionRange }): void {
    const { workflowId, userId, selection } = data
    const session = this.sessions.get(socket.id)

    if (session) {
      session.selection = selection
      session.lastActivity = new Date()

      socket.to(`workflow:${workflowId}`).emit('selection-update', {
        type: 'SELECTION_UPDATE',
        data: { userId, selection },
        userId,
        timestamp: new Date()
      })
    }
  }

  private handleOperation(socket: Socket, data: { workflowId: string; operation: CollaborativeOperation }): void {
    const { workflowId, operation } = data

    // Add operation to queue for operational transform
    if (!this.operationQueue.has(workflowId)) {
      this.operationQueue.set(workflowId, [])
    }

    const queue = this.operationQueue.get(workflowId)!
    queue.push(operation)

    // Apply operational transform
    const transformedOperation = this.applyOperationalTransform(operation, queue)

    // Broadcast to other users
    const operationEvent: OperationEvent = {
      type: 'OPERATION',
      data: transformedOperation,
      userId: operation.userId,
      timestamp: new Date()
    }

    socket.to(`workflow:${workflowId}`).emit('operation', operationEvent)

    // Acknowledge to sender
    socket.emit('operation-ack', { operationId: operation.id })

    console.log(`Operation ${operation.operation} applied to workflow ${workflowId}`)
  }

  private handleDisconnect(socket: Socket): void {
    const session = this.sessions.get(socket.id)
    if (session) {
      this.handleLeaveWorkflow(socket, {
        workflowId: session.workflowId,
        userId: session.userId
      })
      this.sessions.delete(socket.id)
    }

    console.log(`Client disconnected: ${socket.id}`)
  }

  private getActiveUsers(workflowId: string): CollaborationSession[] {
    const sessionIds = this.workflowSessions.get(workflowId) || new Set()
    const activeUsers: CollaborationSession[] = []

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId)
      if (session) {
        activeUsers.push(session)
      }
    }

    return activeUsers
  }

  private applyOperationalTransform(
    operation: CollaborativeOperation,
    queue: CollaborativeOperation[]
  ): CollaborativeOperation {
    // Simple operational transform implementation
    // In a production system, you'd want a more sophisticated OT algorithm
    
    let transformedOperation = { ...operation }

    // Find concurrent operations
    const concurrentOps = queue.filter(op => 
      op.id !== operation.id && 
      op.timestamp <= operation.timestamp &&
      !op.applied
    )

    // Apply transforms based on operation type
    for (const concurrentOp of concurrentOps) {
      transformedOperation = this.transformOperation(transformedOperation, concurrentOp)
    }

    // Mark operation as applied
    transformedOperation.applied = true

    return transformedOperation
  }

  private transformOperation(
    operation: CollaborativeOperation,
    concurrentOp: CollaborativeOperation
  ): CollaborativeOperation {
    // Basic operational transform rules
    // This is a simplified implementation - production would need more sophisticated logic

    if (operation.operation === OperationType.NODE_ADD && concurrentOp.operation === OperationType.NODE_ADD) {
      // Handle concurrent node additions
      if (operation.data.position && concurrentOp.data.position) {
        // Offset position to avoid overlap
        operation.data.position.x += 50
        operation.data.position.y += 50
      }
    }

    if (operation.operation === OperationType.NODE_UPDATE && concurrentOp.operation === OperationType.NODE_DELETE) {
      // If trying to update a deleted node, convert to no-op
      if (operation.data.nodeId === concurrentOp.data.nodeId) {
        operation.operation = OperationType.NODE_ADD // Convert to add operation
      }
    }

    return operation
  }

  // Public methods for external use
  public getWorkflowSessions(workflowId: string): CollaborationSession[] {
    return this.getActiveUsers(workflowId)
  }

  public broadcastToWorkflow(workflowId: string, event: string, data: any): void {
    this.io.to(`workflow:${workflowId}`).emit(event, data)
  }

  public getSessionCount(workflowId: string): number {
    return this.workflowSessions.get(workflowId)?.size || 0
  }
}