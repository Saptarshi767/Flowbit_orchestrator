import { describe, it, expect, beforeEach } from 'vitest'
import { UserRole, SubscriptionPlan } from '@prisma/client'
import { UserService } from '../../src/services/user.service'
import { RBACService } from '../../src/services/rbac.service'
import { NotificationService } from '../../src/services/notification.service'
import { testPrisma, testRedis } from '../setup'

describe('UserService Integration Tests', () => {
  let userService: UserService
  let rbacService: RBACService
  let notificationService: NotificationService
  let testOrganization: any
  let adminUser: any

  beforeEach(async () => {
    // Initialize services
    rbacService = new RBACService(testPrisma, testRedis)
    notificationService = new NotificationService(testPrisma)
    userService = new UserService(testPrisma, testRedis, rbacService, notificationService)

    // Create test organization
    testOrganization = await testPrisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
        plan: SubscriptionPlan.PROFESSIONAL,
        settings: {
          allowPublicWorkflows: true,
          maxConcurrentExecutions: 10,
          retentionDays: 30
        }
      }
    })

    // Create admin user
    adminUser = await testPrisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'hashedpassword',
        role: UserRole.ADMIN,
        organizationId: testOrganization.id,
        emailVerified: new Date(),
        preferences: {
          theme: 'light',
          notifications: { email: true, inApp: true },
          defaultEngine: 'LANGFLOW'
        }
      }
    })
  })

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const createRequest = {
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: testOrganization.id,
        permissions: ['workflows:read', 'workflows:write']
      }

      const user = await userService.createUser(createRequest, adminUser.id)

      expect(user).toBeDefined()
      expect(user.name).toBe(createRequest.name)
      expect(user.email).toBe(createRequest.email)
      expect(user.role).toBe(createRequest.role)
      expect(user.organizationId).toBe(createRequest.organizationId)
      expect(user.permissions).toEqual(createRequest.permissions)
      expect(user.isActive).toBe(true)
    })

    it('should throw error for duplicate email', async () => {
      const createRequest = {
        name: 'Test User',
        email: 'admin@test.com', // Same as admin user
        role: UserRole.DEVELOPER,
        organizationId: testOrganization.id
      }

      await expect(userService.createUser(createRequest, adminUser.id))
        .rejects.toThrow('User with this email already exists')
    })

    it('should throw error for invalid organization', async () => {
      const createRequest = {
        name: 'Test User',
        email: 'test@example.com',
        role: UserRole.DEVELOPER,
        organizationId: 'invalid-org-id'
      }

      await expect(userService.createUser(createRequest, adminUser.id))
        .rejects.toThrow('Organization not found')
    })
  })

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const user = await userService.getUserById(adminUser.id, adminUser.id)

      expect(user).toBeDefined()
      expect(user!.id).toBe(adminUser.id)
      expect(user!.email).toBe(adminUser.email)
      expect(user!.organization).toBeDefined()
      expect(user!.organization.id).toBe(testOrganization.id)
    })

    it('should return null for non-existent user', async () => {
      const user = await userService.getUserById('non-existent-id', adminUser.id)
      expect(user).toBeNull()
    })
  })

  describe('updateUser', () => {
    let testUser: any

    beforeEach(async () => {
      testUser = await testPrisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'hashedpassword',
          role: UserRole.DEVELOPER,
          organizationId: testOrganization.id,
          emailVerified: new Date(),
          preferences: {
            theme: 'light',
            notifications: { email: true, inApp: true },
            defaultEngine: 'LANGFLOW'
          }
        }
      })
    })

    it('should update user successfully', async () => {
      const updateRequest = {
        name: 'Updated Name',
        role: UserRole.MANAGER,
        permissions: ['workflows:read', 'workflows:write', 'workflows:delete']
      }

      const updatedUser = await userService.updateUser(testUser.id, updateRequest, adminUser.id)

      expect(updatedUser.name).toBe(updateRequest.name)
      expect(updatedUser.role).toBe(updateRequest.role)
      expect(updatedUser.permissions).toEqual(updateRequest.permissions)
    })

    it('should throw error for duplicate email', async () => {
      const updateRequest = {
        email: 'admin@test.com' // Same as admin user
      }

      await expect(userService.updateUser(testUser.id, updateRequest, adminUser.id))
        .rejects.toThrow('Email already in use')
    })
  })

  describe('deleteUser', () => {
    let testUser: any

    beforeEach(async () => {
      testUser = await testPrisma.user.create({
        data: {
          name: 'Test User',
          email: 'test@example.com',
          password: 'hashedpassword',
          role: UserRole.DEVELOPER,
          organizationId: testOrganization.id,
          emailVerified: new Date(),
          preferences: {
            theme: 'light',
            notifications: { email: true, inApp: true },
            defaultEngine: 'LANGFLOW'
          }
        }
      })
    })

    it('should soft delete user successfully', async () => {
      await userService.deleteUser(testUser.id, adminUser.id)

      const deletedUser = await testPrisma.user.findUnique({
        where: { id: testUser.id }
      })

      expect(deletedUser).toBeDefined()
      expect(deletedUser!.isActive).toBe(false)
      expect(deletedUser!.email).toContain('deleted_')
    })

    it('should prevent self-deletion', async () => {
      await expect(userService.deleteUser(adminUser.id, adminUser.id))
        .rejects.toThrow('Cannot delete your own account')
    })
  })

  describe('listUsers', () => {
    beforeEach(async () => {
      // Create multiple test users
      await testPrisma.user.createMany({
        data: [
          {
            name: 'Developer 1',
            email: 'dev1@example.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          },
          {
            name: 'Developer 2',
            email: 'dev2@example.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          },
          {
            name: 'Manager 1',
            email: 'manager1@example.com',
            password: 'hashedpassword',
            role: UserRole.MANAGER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          }
        ]
      })
    })

    it('should list all users', async () => {
      const result = await userService.listUsers({}, 1, 10, adminUser.id)

      expect(result.users).toHaveLength(4) // 3 created + 1 admin
      expect(result.pagination.total).toBe(4)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
    })

    it('should filter users by role', async () => {
      const result = await userService.listUsers(
        { role: UserRole.DEVELOPER },
        1,
        10,
        adminUser.id
      )

      expect(result.users).toHaveLength(2)
      expect(result.users.every(user => user.role === UserRole.DEVELOPER)).toBe(true)
    })

    it('should search users by name', async () => {
      const result = await userService.listUsers(
        { search: 'Developer' },
        1,
        10,
        adminUser.id
      )

      expect(result.users).toHaveLength(2)
      expect(result.users.every(user => user.name!.includes('Developer'))).toBe(true)
    })

    it('should paginate results', async () => {
      const result = await userService.listUsers({}, 1, 2, adminUser.id)

      expect(result.users).toHaveLength(2)
      expect(result.pagination.totalPages).toBe(2)
    })
  })

  describe('getUserStats', () => {
    beforeEach(async () => {
      // Create test users with different roles
      await testPrisma.user.createMany({
        data: [
          {
            name: 'Developer 1',
            email: 'dev1@example.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {},
            lastLoginAt: new Date()
          },
          {
            name: 'Developer 2',
            email: 'dev2@example.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {},
            isActive: false
          },
          {
            name: 'Manager 1',
            email: 'manager1@example.com',
            password: 'hashedpassword',
            role: UserRole.MANAGER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {},
            lastLoginAt: new Date()
          }
        ]
      })
    })

    it('should return correct user statistics', async () => {
      const stats = await userService.getUserStats(testOrganization.id, adminUser.id)

      expect(stats.total).toBe(4) // 3 created + 1 admin
      expect(stats.active).toBe(3) // 1 is inactive
      expect(stats.byRole[UserRole.ADMIN]).toBe(1)
      expect(stats.byRole[UserRole.DEVELOPER]).toBe(2)
      expect(stats.byRole[UserRole.MANAGER]).toBe(1)
      expect(stats.recentLogins).toBe(3) // Admin + 2 with recent login
    })
  })

  describe('bulkOperation', () => {
    let testUsers: any[]

    beforeEach(async () => {
      const users = await testPrisma.user.createMany({
        data: [
          {
            name: 'User 1',
            email: 'user1@example.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          },
          {
            name: 'User 2',
            email: 'user2@example.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          }
        ]
      })

      testUsers = await testPrisma.user.findMany({
        where: {
          email: { in: ['user1@example.com', 'user2@example.com'] }
        }
      })
    })

    it('should deactivate users in bulk', async () => {
      const operation = {
        userIds: testUsers.map(u => u.id),
        operation: 'deactivate' as const
      }

      const result = await userService.bulkOperation(operation, adminUser.id)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(2)
      expect(result.failed).toBe(0)

      // Verify users are deactivated
      const updatedUsers = await testPrisma.user.findMany({
        where: { id: { in: testUsers.map(u => u.id) } }
      })

      expect(updatedUsers.every(u => !u.isActive)).toBe(true)
    })

    it('should update roles in bulk', async () => {
      const operation = {
        userIds: testUsers.map(u => u.id),
        operation: 'updateRole' as const,
        data: {
          role: UserRole.MANAGER,
          permissions: ['workflows:read', 'workflows:write']
        }
      }

      const result = await userService.bulkOperation(operation, adminUser.id)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(2)

      // Verify roles are updated
      const updatedUsers = await testPrisma.user.findMany({
        where: { id: { in: testUsers.map(u => u.id) } }
      })

      expect(updatedUsers.every(u => u.role === UserRole.MANAGER)).toBe(true)
    })
  })

  describe('invitation flow', () => {
    it('should create and accept invitation successfully', async () => {
      // Create invitation
      const invitationRequest = {
        email: 'invited@example.com',
        role: UserRole.DEVELOPER,
        permissions: ['workflows:read'],
        message: 'Welcome to our team!'
      }

      const invitation = await userService.createInvitation(invitationRequest, adminUser.id)

      expect(invitation.email).toBe(invitationRequest.email)
      expect(invitation.role).toBe(invitationRequest.role)
      expect(invitation.token).toBeDefined()

      // Accept invitation
      const acceptRequest = {
        token: invitation.token,
        name: 'Invited User',
        password: 'SecurePassword123!'
      }

      const user = await userService.acceptInvitation(acceptRequest)

      expect(user.name).toBe(acceptRequest.name)
      expect(user.email).toBe(invitationRequest.email)
      expect(user.role).toBe(invitationRequest.role)
      expect(user.emailVerified).toBe(true)
    })

    it('should reject invalid invitation token', async () => {
      const acceptRequest = {
        token: 'invalid-token',
        name: 'User',
        password: 'SecurePassword123!'
      }

      await expect(userService.acceptInvitation(acceptRequest))
        .rejects.toThrow('Invalid or expired invitation token')
    })
  })

  describe('updateProfile', () => {
    it('should allow users to update their own profile', async () => {
      const updates = {
        name: 'Updated Admin Name',
        preferences: {
          theme: 'dark' as const,
          notifications: { email: false, inApp: true },
          defaultEngine: 'N8N' as const
        }
      }

      const updatedUser = await userService.updateProfile(adminUser.id, updates)

      expect(updatedUser.name).toBe(updates.name)
      expect(updatedUser.preferences.theme).toBe(updates.preferences.theme)
      expect(updatedUser.preferences.notifications.email).toBe(false)
    })

    it('should not allow updating restricted fields', async () => {
      const updates = {
        email: 'newemail@example.com', // Should be filtered out
        role: UserRole.VIEWER, // Should be filtered out
        name: 'Updated Name'
      }

      const updatedUser = await userService.updateProfile(adminUser.id, updates)

      expect(updatedUser.name).toBe(updates.name)
      expect(updatedUser.email).toBe(adminUser.email) // Should remain unchanged
      expect(updatedUser.role).toBe(adminUser.role) // Should remain unchanged
    })
  })
})