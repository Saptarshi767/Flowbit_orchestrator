import express from 'express'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { createWorkflowService } from './index'
import { WorkflowImportService } from './services/workflow-import.service'
import { WorkflowTemplateService } from './services/workflow-template.service'
import { ConflictResolutionService } from './services/conflict-resolution.service'
import { CollaborationService } from './services/collaboration.service'
import { WorkflowCommentRepository } from './repositories/workflow-comment.repository'
import { WorkflowForkRepository } from './repositories/workflow-fork.repository'
import { TeamWorkspaceRepository } from './repositories/team-workspace.repository'
import { createWorkflowRoutes } from './routes/workflow.routes'
import { createVersionRoutes } from './routes/version.routes'
import { createCollaborationRoutes } from './routes/collaboration.routes'
import { createImportRoutes } from './routes/import.routes'
import { createTemplateRoutes, createTemplateCategoryRoutes } from './routes/template.routes'
import { createConflictResolutionRoutes } from './routes/conflict-resolution.routes'

// Middleware to simulate user authentication (in real app, this would be JWT middleware)
interface AuthenticatedUser {
  id: string
  organizationId: string
  email: string
  role: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export function createWorkflowManagementApp(prisma: PrismaClient): { app: express.Application; server: any; io: SocketIOServer } {
  const app = express()
  const server = createServer(app)
  
  // Initialize Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  })

  // Middleware
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // Mock authentication middleware (replace with real JWT middleware)
  app.use((req, res, next) => {
    // In a real application, this would validate JWT tokens
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Mock user for testing
      req.user = {
        id: 'user-123',
        organizationId: 'org-123',
        email: 'test@example.com',
        role: 'admin'
      }
    }
    next()
  })

  // Initialize services and repositories
  const workflowService = createWorkflowService(prisma)
  const importService = new WorkflowImportService(workflowService)
  const templateService = new WorkflowTemplateService(workflowService)
  const conflictService = new ConflictResolutionService()
  const collaborationService = new CollaborationService(io)
  const commentRepository = new WorkflowCommentRepository(prisma)
  const forkRepository = new WorkflowForkRepository(prisma)
  const workspaceRepository = new TeamWorkspaceRepository(prisma)

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'workflow-management' })
  })

  // API routes
  app.use('/api/workflows', createWorkflowRoutes(workflowService))
  app.use('/api/workflows', createVersionRoutes(workflowService))
  app.use('/api/workflows', createCollaborationRoutes(
    workflowService,
    collaborationService,
    commentRepository,
    forkRepository,
    workspaceRepository
  ))
  app.use('/api/workflows', createImportRoutes(importService))
  app.use('/api/workflows', createConflictResolutionRoutes(conflictService, workflowService))
  app.use('/api/templates', createTemplateRoutes(templateService))
  app.use('/api/template-categories', createTemplateCategoryRoutes(templateService))

  // Error handling middleware
  app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Workflow Management Service Error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  })

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })

  return { app, server, io }
}

// Start server if this file is run directly
if (require.main === module) {
  const prisma = new PrismaClient()
  const { app, server, io } = createWorkflowManagementApp(prisma)
  const port = process.env.PORT || 3003

  server.listen(port, () => {
    console.log(`Workflow Management Service running on port ${port}`)
    console.log(`WebSocket server enabled for real-time collaboration`)
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down workflow management service...')
    io.close()
    await prisma.$disconnect()
    process.exit(0)
  })
}