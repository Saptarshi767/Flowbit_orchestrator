import { Router, Request, Response } from 'express'
import { OrganizationService } from '../services/organization.service'
import { 
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationFilters,
  TransferOwnershipRequest
} from '../types/organization.types'
import { z } from 'zod'
import { SubscriptionPlan } from '@prisma/client'

/**
 * Organization management routes
 */

// Validation schemas
const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  plan: z.nativeEnum(SubscriptionPlan),
  settings: z.object({
    allowPublicWorkflows: z.boolean(),
    maxConcurrentExecutions: z.number().min(1),
    retentionDays: z.number().min(1),
    allowedDomains: z.array(z.string()).optional(),
    ssoEnabled: z.boolean().optional(),
    ssoProvider: z.string().optional(),
    requireEmailVerification: z.boolean(),
    passwordPolicy: z.object({
      minLength: z.number().min(8),
      requireUppercase: z.boolean(),
      requireLowercase: z.boolean(),
      requireNumbers: z.boolean(),
      requireSpecialChars: z.boolean(),
      maxAge: z.number().optional()
    }).optional(),
    features: z.object({
      marketplace: z.boolean(),
      collaboration: z.boolean(),
      analytics: z.boolean(),
      apiAccess: z.boolean()
    }).optional()
  }).optional(),
  adminUser: z.object({
    name: z.string().min(1, 'Admin name is required'),
    email: z.string().email('Invalid admin email'),
    password: z.string().min(8, 'Admin password must be at least 8 characters')
  })
})

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  plan: z.nativeEnum(SubscriptionPlan).optional(),
  settings: z.object({
    allowPublicWorkflows: z.boolean().optional(),
    maxConcurrentExecutions: z.number().min(1).optional(),
    retentionDays: z.number().min(1).optional(),
    allowedDomains: z.array(z.string()).optional(),
    ssoEnabled: z.boolean().optional(),
    ssoProvider: z.string().optional(),
    requireEmailVerification: z.boolean().optional(),
    passwordPolicy: z.object({
      minLength: z.number().min(8).optional(),
      requireUppercase: z.boolean().optional(),
      requireLowercase: z.boolean().optional(),
      requireNumbers: z.boolean().optional(),
      requireSpecialChars: z.boolean().optional(),
      maxAge: z.number().optional()
    }).optional(),
    features: z.object({
      marketplace: z.boolean().optional(),
      collaboration: z.boolean().optional(),
      analytics: z.boolean().optional(),
      apiAccess: z.boolean().optional()
    }).optional()
  }).optional(),
  isActive: z.boolean().optional()
})

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid('Invalid user ID'),
  confirmationCode: z.string().min(1, 'Confirmation code is required')
})

export function createOrganizationRoutes(organizationService: OrganizationService): Router {
  const router = Router()

  /**
   * POST /organizations
   * Create a new organization
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const validatedData = createOrganizationSchema.parse(req.body)

      const organization = await organizationService.createOrganization(validatedData)

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        data: organization
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create organization'
        })
      }
    }
  })

  /**
   * GET /organizations/:id
   * Get organization by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const organization = await organizationService.getOrganizationById(organizationId, requesterId)

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found'
        })
      }

      res.json({
        success: true,
        data: organization
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get organization'
      })
    }
  })

  /**
   * PUT /organizations/:id
   * Update organization
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const validatedData = updateOrganizationSchema.parse(req.body)
      const updatedBy = (req as any).user?.userId

      if (!updatedBy) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const organization = await organizationService.updateOrganization(organizationId, validatedData, updatedBy)

      res.json({
        success: true,
        message: 'Organization updated successfully',
        data: organization
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update organization'
        })
      }
    }
  })

  /**
   * GET /organizations
   * List organizations with filtering and pagination
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

      // Parse filters
      const filterData = {
        plan: req.query.plan,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        search: req.query.search,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined
      }

      // Remove undefined values
      const filters = Object.fromEntries(
        Object.entries(filterData).filter(([_, value]) => value !== undefined)
      ) as OrganizationFilters

      const result = await organizationService.listOrganizations(filters, page, limit, requesterId)

      res.json({
        success: true,
        data: result.organizations,
        pagination: result.pagination
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list organizations'
      })
    }
  })

  /**
   * GET /organizations/:id/members
   * Get organization members
   */
  router.get('/:id/members', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const members = await organizationService.getOrganizationMembers(organizationId, requesterId)

      res.json({
        success: true,
        data: members
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get organization members'
      })
    }
  })

  /**
   * GET /organizations/:id/stats
   * Get organization statistics
   */
  router.get('/:id/stats', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const stats = await organizationService.getOrganizationStats(organizationId, requesterId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get organization stats'
      })
    }
  })

  /**
   * POST /organizations/:id/transfer-ownership
   * Transfer organization ownership
   */
  router.post('/:id/transfer-ownership', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const validatedData = transferOwnershipSchema.parse(req.body)
      const currentOwnerId = (req as any).user?.userId

      if (!currentOwnerId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      await organizationService.transferOwnership(organizationId, validatedData, currentOwnerId)

      res.json({
        success: true,
        message: 'Ownership transferred successfully'
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      } else {
        res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to transfer ownership'
        })
      }
    }
  })

  /**
   * GET /organizations/:id/usage
   * Get organization usage statistics
   */
  router.get('/:id/usage', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const usage = await organizationService.getOrganizationUsage(organizationId, requesterId)

      res.json({
        success: true,
        data: usage
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get organization usage'
      })
    }
  })

  /**
   * GET /organizations/:id/billing
   * Get organization billing information
   */
  router.get('/:id/billing', async (req: Request, res: Response) => {
    try {
      const organizationId = req.params.id
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const billing = await organizationService.getBillingInfo(organizationId, requesterId)

      res.json({
        success: true,
        data: billing
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get billing information'
      })
    }
  })

  return router
}