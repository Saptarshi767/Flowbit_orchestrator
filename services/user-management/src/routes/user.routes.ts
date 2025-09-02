import { Router, Request, Response } from 'express'
import { UserService } from '../services/user.service'
import { 
  CreateUserRequest,
  UpdateUserRequest,
  UserFilters,
  BulkUserOperation,
  CreateInvitationRequest,
  AcceptInvitationRequest
} from '../types/user.types'
import { z } from 'zod'
import { UserRole } from '@prisma/client'

/**
 * User management routes
 */

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format'),
  role: z.nativeEnum(UserRole),
  organizationId: z.string().uuid('Invalid organization ID'),
  permissions: z.array(z.string()).optional(),
  sendInvitation: z.boolean().optional()
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    notifications: z.object({
      email: z.boolean(),
      inApp: z.boolean(),
      slack: z.boolean().optional()
    }).optional(),
    defaultEngine: z.enum(['LANGFLOW', 'N8N', 'LANGSMITH']).optional(),
    timezone: z.string().optional(),
    language: z.string().optional()
  }).optional()
})

const userFiltersSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional()
})

const bulkOperationSchema = z.object({
  userIds: z.array(z.string().uuid()),
  operation: z.enum(['activate', 'deactivate', 'delete', 'updateRole']),
  data: z.object({
    role: z.nativeEnum(UserRole).optional(),
    permissions: z.array(z.string()).optional()
  }).optional()
})

const createInvitationSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.nativeEnum(UserRole),
  permissions: z.array(z.string()).optional(),
  message: z.string().optional()
})

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export function createUserRoutes(userService: UserService): Router {
  const router = Router()

  /**
   * POST /users
   * Create a new user
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const validatedData = createUserSchema.parse(req.body)
      const createdBy = (req as any).user?.userId

      if (!createdBy) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const user = await userService.createUser(validatedData, createdBy)

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user
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
          error: error instanceof Error ? error.message : 'Failed to create user'
        })
      }
    }
  })

  /**
   * GET /users/:id
   * Get user by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.params.id
      const requesterId = (req as any).user?.userId

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const user = await userService.getUserById(userId, requesterId)

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        })
      }

      res.json({
        success: true,
        data: user
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user'
      })
    }
  })

  /**
   * PUT /users/:id
   * Update user
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.params.id
      const validatedData = updateUserSchema.parse(req.body)
      const updatedBy = (req as any).user?.userId

      if (!updatedBy) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const user = await userService.updateUser(userId, validatedData, updatedBy)

      res.json({
        success: true,
        message: 'User updated successfully',
        data: user
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
          error: error instanceof Error ? error.message : 'Failed to update user'
        })
      }
    }
  })

  /**
   * DELETE /users/:id
   * Delete user
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = req.params.id
      const deletedBy = (req as any).user?.userId

      if (!deletedBy) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      await userService.deleteUser(userId, deletedBy)

      res.json({
        success: true,
        message: 'User deleted successfully'
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user'
      })
    }
  })

  /**
   * GET /users
   * List users with filtering and pagination
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
        role: req.query.role,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        organizationId: req.query.organizationId,
        search: req.query.search,
        createdAfter: req.query.createdAfter ? new Date(req.query.createdAfter as string) : undefined,
        createdBefore: req.query.createdBefore ? new Date(req.query.createdBefore as string) : undefined
      }

      // Remove undefined values
      const filters = Object.fromEntries(
        Object.entries(filterData).filter(([_, value]) => value !== undefined)
      ) as UserFilters

      const result = await userService.listUsers(filters, page, limit, requesterId)

      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list users'
      })
    }
  })

  /**
   * GET /users/stats
   * Get user statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const requesterId = (req as any).user?.userId
      const organizationId = req.query.organizationId as string

      if (!requesterId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const stats = await userService.getUserStats(organizationId, requesterId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user stats'
      })
    }
  })

  /**
   * POST /users/bulk
   * Bulk user operations
   */
  router.post('/bulk', async (req: Request, res: Response) => {
    try {
      const validatedData = bulkOperationSchema.parse(req.body)
      const operatorId = (req as any).user?.userId

      if (!operatorId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const result = await userService.bulkOperation(validatedData, operatorId)

      res.json({
        success: result.success,
        message: `Bulk operation completed. Processed: ${result.processed}, Failed: ${result.failed}`,
        data: result
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
          error: error instanceof Error ? error.message : 'Failed to perform bulk operation'
        })
      }
    }
  })

  /**
   * POST /users/invite
   * Create user invitation
   */
  router.post('/invite', async (req: Request, res: Response) => {
    try {
      const validatedData = createInvitationSchema.parse(req.body)
      const invitedBy = (req as any).user?.userId

      if (!invitedBy) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const invitation = await userService.createInvitation(validatedData, invitedBy)

      res.status(201).json({
        success: true,
        message: 'Invitation sent successfully',
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
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
          error: error instanceof Error ? error.message : 'Failed to create invitation'
        })
      }
    }
  })

  /**
   * POST /users/invite/accept
   * Accept user invitation
   */
  router.post('/invite/accept', async (req: Request, res: Response) => {
    try {
      const validatedData = acceptInvitationSchema.parse(req.body)

      const user = await userService.acceptInvitation(validatedData)

      res.status(201).json({
        success: true,
        message: 'Invitation accepted successfully. You can now log in.',
        data: user
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
          error: error instanceof Error ? error.message : 'Failed to accept invitation'
        })
      }
    }
  })

  /**
   * PUT /users/profile
   * Update user profile (self-service)
   */
  router.put('/profile', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        })
      }

      const validatedData = updateUserSchema.parse(req.body)
      const user = await userService.updateProfile(userId, validatedData)

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
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
          error: error instanceof Error ? error.message : 'Failed to update profile'
        })
      }
    }
  })

  return router
}