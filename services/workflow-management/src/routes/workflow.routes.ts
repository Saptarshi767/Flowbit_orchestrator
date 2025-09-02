import { Router, Request, Response } from 'express'
import { WorkflowService } from '../services/workflow.service'
import { 
  CreateWorkflowRequest, 
  UpdateWorkflowRequest, 
  CreateWorkflowVersionRequest,
  ShareWorkflowRequest,
  WorkflowSearchOptions,
  WorkflowImportRequest
} from '../types/workflow.types'

export function createWorkflowRoutes(workflowService: WorkflowService): Router {
  const router = Router()

  // Create workflow
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      const organizationId = req.user?.organizationId
      
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workflow = await workflowService.createWorkflow(
        req.body as CreateWorkflowRequest,
        userId,
        organizationId
      )

      res.status(201).json(workflow)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get workflow by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workflow = await workflowService.getWorkflow(req.params.id, userId)
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' })
      }

      res.json(workflow)
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Get workflow with versions
  router.get('/:id/versions', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workflow = await workflowService.getWorkflowWithVersions(req.params.id, userId)
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' })
      }

      res.json(workflow)
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Update workflow
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const workflow = await workflowService.updateWorkflow(
        req.params.id,
        req.body as UpdateWorkflowRequest,
        userId
      )

      res.json(workflow)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Delete workflow
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      await workflowService.deleteWorkflow(req.params.id, userId)
      res.status(204).send()
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Search workflows
  router.get('/', async (req: Request, res: Response) => {
    try {
      const searchOptions: WorkflowSearchOptions = {
        query: req.query.query as string,
        engineType: req.query.engineType as any,
        visibility: req.query.visibility as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        createdBy: req.query.createdBy as string,
        organizationId: req.user?.organizationId,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any
      }

      const result = await workflowService.searchWorkflows(searchOptions)
      res.json(result)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get workflows by organization
  router.get('/organization/:organizationId', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined

      const workflows = await workflowService.getWorkflowsByOrganization(
        req.params.organizationId,
        limit,
        offset
      )

      res.json(workflows)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get user's workflows
  router.get('/user/me', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined

      const workflows = await workflowService.getWorkflowsByUser(userId, limit, offset)
      res.json(workflows)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get workflow statistics
  router.get('/stats/overview', async (req: Request, res: Response) => {
    try {
      const organizationId = req.query.organizationId as string || req.user?.organizationId
      const stats = await workflowService.getWorkflowStats(organizationId)
      res.json(stats)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  return router
}