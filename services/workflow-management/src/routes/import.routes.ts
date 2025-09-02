import { Router, Request, Response } from 'express'
import { WorkflowImportService } from '../services/workflow-import.service'
import { WorkflowImportRequest, EngineType } from '../types/workflow.types'

export function createImportRoutes(importService: WorkflowImportService): Router {
  const router = Router()

  // Import workflow
  router.post('/import', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id
      const organizationId = req.user?.organizationId
      
      if (!userId || !organizationId) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const importRequest: WorkflowImportRequest = req.body

      // Validate engine type
      if (!Object.values(EngineType).includes(importRequest.engineType)) {
        return res.status(400).json({ error: 'Invalid engine type' })
      }

      const workflow = await importService.importWorkflow(
        importRequest,
        userId,
        organizationId
      )

      res.status(201).json(workflow)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Validate import before importing
  router.post('/import/validate', async (req: Request, res: Response) => {
    try {
      const { source, engineType } = req.body

      if (!Object.values(EngineType).includes(engineType)) {
        return res.status(400).json({ error: 'Invalid engine type' })
      }

      const validation = await importService.validateImportedWorkflow(source, engineType)
      res.json(validation)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // Get supported formats for an engine
  router.get('/import/formats/:engineType', async (req: Request, res: Response) => {
    try {
      const engineType = req.params.engineType as EngineType

      if (!Object.values(EngineType).includes(engineType)) {
        return res.status(400).json({ error: 'Invalid engine type' })
      }

      const formats = importService.getSupportedFormats(engineType)
      res.json({ formats })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  return router
}