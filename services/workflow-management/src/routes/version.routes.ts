import { Router, Request, Response } from 'express'
import { WorkflowService } from '../services/workflow.service'
import { CreateWorkflowVersionRequest } from '../types/workflow.types'

export function createVersionRoutes(workflowService: WorkflowService): Router {
  const router = Router()

  // Create new workflow version
  router.post('/:workflowId/versions', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const version = await workflowService.createWorkflowVersion(
        req.params.workflowId,
        req.body as CreateWorkflowVersionRequest,
        userId
      )

      res.status(201).json(version)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get all versions for a workflow
  router.get('/:workflowId/versions', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const versions = await workflowService.getWorkflowVersions(req.params.workflowId, userId)
      res.json(versions)
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Get specific workflow version
  router.get('/:workflowId/versions/:version', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const version = await workflowService.getWorkflowVersion(
        req.params.workflowId,
        parseInt(req.params.version),
        userId
      )

      if (!version) {
        return res.status(404).json({ error: 'Version not found' })
      }

      res.json(version)
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  // Compare two workflow versions
  router.get('/:workflowId/versions/:version1/compare/:version2', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const comparison = await workflowService.compareWorkflowVersions(
        req.params.workflowId,
        parseInt(req.params.version1),
        parseInt(req.params.version2),
        userId
      )

      res.json(comparison)
    } catch (error) {
      res.status(403).json({ error: error.message })
    }
  })

  return router
}