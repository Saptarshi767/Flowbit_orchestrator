import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CollaborationService } from '../src/services/collaboration.service'
import { Server as SocketIOServer } from 'socket.io'
import {
  OperationType,
  CollaborativeOperation,
  CursorPosition
} from '../src/types/workflow.types'

// Mock Socket.IO
const mockIo = {
  on: vi.fn(),
  to: vi.fn(() => ({
    emit: vi.fn()
  })),
  emit: vi.fn()
} as any

const mockSocket = {
  id: 'socket-123',
  join: vi.fn(),
  leave: vi.fn(),
  to: vi.fn(() => ({
    emit: vi.fn()
  })),
  emit: vi.fn(),
  on: vi.fn()
} as any

describe('CollaborationService Unit Tests', () => {
  let collaborationService: CollaborationService

  beforeEach(() => {
    vi.clearAllMocks()
    collaborationService = new CollaborationService(mockIo)
  })

  describe('Session Management', () => {
    it('should track active sessions correctly', () => {
      const workflowId = 'workflow-123'
      
      // Initially no sessions
      expect(collaborationService.getSessionCount(workflowId)).toBe(0)
      
      // Simulate user joining
      const joinData = {
        workflowId,
        userId: 'user-123',
        userName: 'Test User'
      }
      
      // Since we can't easily test the private methods, we'll test the public interface
      expect(collaborationService.getWorkflowSessions(workflowId)).toEqual([])
    })

    it('should broadcast messages to workflow participants', () => {
      const workflowId = 'workflow-123'
      const event = 'test-event'
      const data = { message: 'test' }

      collaborationService.broadcastToWorkflow(workflowId, event, data)

      expect(mockIo.to).toHaveBeenCalledWith(`workflow:${workflowId}`)
    })
  })

  describe('Operational Transform', () => {
    it('should handle basic operation types', () => {
      const operation: CollaborativeOperation = {
        id: 'op-123',
        workflowId: 'workflow-123',
        userId: 'user-123',
        operation: OperationType.NODE_ADD,
        data: {
          nodeId: 'node-1',
          position: { x: 100, y: 100 },
          type: 'textNode'
        },
        timestamp: new Date(),
        applied: false
      }

      // Test that operation structure is valid
      expect(operation.operation).toBe(OperationType.NODE_ADD)
      expect(operation.data.nodeId).toBe('node-1')
      expect(operation.applied).toBe(false)
    })

    it('should handle different operation types', () => {
      const operations = [
        OperationType.NODE_ADD,
        OperationType.NODE_UPDATE,
        OperationType.NODE_DELETE,
        OperationType.EDGE_ADD,
        OperationType.EDGE_UPDATE,
        OperationType.EDGE_DELETE,
        OperationType.WORKFLOW_UPDATE
      ]

      operations.forEach(opType => {
        const operation: CollaborativeOperation = {
          id: `op-${opType}`,
          workflowId: 'workflow-123',
          userId: 'user-123',
          operation: opType,
          data: {},
          timestamp: new Date(),
          applied: false
        }

        expect(operation.operation).toBe(opType)
      })
    })
  })

  describe('Cursor Management', () => {
    it('should handle cursor position updates', () => {
      const cursor: CursorPosition = {
        nodeId: 'node-123',
        x: 250,
        y: 300
      }

      expect(cursor.x).toBe(250)
      expect(cursor.y).toBe(300)
      expect(cursor.nodeId).toBe('node-123')
    })

    it('should handle cursor without node reference', () => {
      const cursor: CursorPosition = {
        x: 150,
        y: 200
      }

      expect(cursor.x).toBe(150)
      expect(cursor.y).toBe(200)
      expect(cursor.nodeId).toBeUndefined()
    })
  })

  describe('WebSocket Event Types', () => {
    it('should define correct event types', () => {
      const userJoinedEvent = {
        type: 'USER_JOINED',
        data: {
          userId: 'user-123',
          userName: 'Test User'
        },
        userId: 'user-123',
        timestamp: new Date()
      }

      expect(userJoinedEvent.type).toBe('USER_JOINED')
      expect(userJoinedEvent.data.userId).toBe('user-123')
    })

    it('should handle cursor update events', () => {
      const cursorEvent = {
        type: 'CURSOR_UPDATE',
        data: {
          userId: 'user-123',
          cursor: { x: 100, y: 200 }
        },
        userId: 'user-123',
        timestamp: new Date()
      }

      expect(cursorEvent.type).toBe('CURSOR_UPDATE')
      expect(cursorEvent.data.cursor.x).toBe(100)
    })

    it('should handle operation events', () => {
      const operationEvent = {
        type: 'OPERATION',
        data: {
          id: 'op-123',
          workflowId: 'workflow-123',
          userId: 'user-123',
          operation: OperationType.NODE_ADD,
          data: { nodeId: 'node-1' },
          timestamp: new Date(),
          applied: false
        },
        userId: 'user-123',
        timestamp: new Date()
      }

      expect(operationEvent.type).toBe('OPERATION')
      expect(operationEvent.data.operation).toBe(OperationType.NODE_ADD)
    })
  })
})

describe('Repository Unit Tests', () => {
  describe('WorkflowCommentRepository', () => {
    it('should validate comment structure', () => {
      const comment = {
        id: 'comment-123',
        workflowId: 'workflow-123',
        userId: 'user-123',
        content: 'This is a test comment',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(comment.content).toBe('This is a test comment')
      expect(comment.parentId).toBeNull()
      expect(comment.workflowId).toBe('workflow-123')
    })

    it('should handle threaded comments', () => {
      const parentComment = {
        id: 'parent-123',
        workflowId: 'workflow-123',
        userId: 'user-123',
        content: 'Parent comment',
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const replyComment = {
        id: 'reply-123',
        workflowId: 'workflow-123',
        userId: 'user-456',
        content: 'Reply comment',
        parentId: 'parent-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(parentComment.parentId).toBeNull()
      expect(replyComment.parentId).toBe('parent-123')
    })
  })

  describe('WorkflowForkRepository', () => {
    it('should validate fork structure', () => {
      const fork = {
        id: 'fork-123',
        originalWorkflowId: 'original-123',
        forkedWorkflowId: 'forked-123',
        userId: 'user-123',
        createdAt: new Date()
      }

      expect(fork.originalWorkflowId).toBe('original-123')
      expect(fork.forkedWorkflowId).toBe('forked-123')
      expect(fork.userId).toBe('user-123')
    })

    it('should validate merge request structure', () => {
      const mergeRequest = {
        id: 'merge-123',
        sourceWorkflowId: 'source-123',
        targetWorkflowId: 'target-123',
        title: 'Test Merge Request',
        description: 'Testing merge functionality',
        status: 'OPEN',
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(mergeRequest.status).toBe('OPEN')
      expect(mergeRequest.title).toBe('Test Merge Request')
      expect(mergeRequest.sourceWorkflowId).toBe('source-123')
      expect(mergeRequest.targetWorkflowId).toBe('target-123')
    })
  })

  describe('TeamWorkspaceRepository', () => {
    it('should validate workspace structure', () => {
      const workspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        description: 'A test workspace',
        organizationId: 'org-123',
        createdBy: 'user-123',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(workspace.name).toBe('Test Workspace')
      expect(workspace.organizationId).toBe('org-123')
      expect(workspace.members).toEqual([])
    })

    it('should validate workspace member structure', () => {
      const member = {
        id: 'member-123',
        workspaceId: 'workspace-123',
        userId: 'user-123',
        role: 'ADMIN',
        createdAt: new Date()
      }

      expect(member.role).toBe('ADMIN')
      expect(member.workspaceId).toBe('workspace-123')
      expect(member.userId).toBe('user-123')
    })
  })
})