import { describe, it, expect, beforeEach } from 'vitest'
import { UserRole, SubscriptionPlan } from '@prisma/client'
import { OrganizationService } from '../../src/services/organization.service'
import { RBACService } from '../../src/services/rbac.service'
import { testPrisma, testRedis } from '../setup'

describe('OrganizationService Integration Tests', () => {
  let organizationService: OrganizationService
  let rbacService: RBACService

  beforeEach(async () => {
    rbacService = new RBACService(testPrisma, testRedis)
    organizationService = new OrganizationService(testPrisma, testRedis, rbacService)
  })

  describe('createOrganization', () => {
    it('should create organization with admin user successfully', async () => {
      const createRequest = {
        name: 'Test Organization',
        slug: 'test-org',
        plan: SubscriptionPlan.PROFESSIONAL,
        settings: {
          allowPublicWorkflows: true,
          maxConcurrentExecutions: 10,
          retentionDays: 30,
          requireEmailVerification: true,
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true
          },
          features: {
            marketplace: true,
            collaboration: true,
            analytics: true,
            apiAccess: true
          }
        },
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      }

      const organization = await organizationService.createOrganization(createRequest)

      expect(organization).toBeDefined()
      expect(organization.name).toBe(createRequest.name)
      expect(organization.slug).toBe(createRequest.slug)
      expect(organization.plan).toBe(createRequest.plan)
      expect(organization.settings).toEqual(createRequest.settings)
      expect(organization.isActive).toBe(true)

      // Verify admin user was created
      const adminUser = await testPrisma.user.findUnique({
        where: { email: createRequest.adminUser.email }
      })

      expect(adminUser).toBeDefined()
      expect(adminUser!.name).toBe(createRequest.adminUser.name)
      expect(adminUser!.role).toBe(UserRole.ADMIN)
      expect(adminUser!.organizationId).toBe(organization.id)
    })

    it('should generate slug if not provided', async () => {
      const createRequest = {
        name: 'Test Organization Without Slug',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      }

      const organization = await organizationService.createOrganization(createRequest)

      expect(organization.slug).toBeDefined()
      expect(organization.slug).toMatch(/^test-organization-without-slug-[a-z0-9]+$/)
    })

    it('should throw error for duplicate slug', async () => {
      const createRequest1 = {
        name: 'Test Organization 1',
        slug: 'duplicate-slug',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Admin User 1',
          email: 'admin1@test.com',
          password: 'SecurePassword123!'
        }
      }

      const createRequest2 = {
        name: 'Test Organization 2',
        slug: 'duplicate-slug',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Admin User 2',
          email: 'admin2@test.com',
          password: 'SecurePassword123!'
        }
      }

      await organizationService.createOrganization(createRequest1)

      await expect(organizationService.createOrganization(createRequest2))
        .rejects.toThrow('Organization slug already exists')
    })

    it('should throw error for duplicate admin email', async () => {
      const createRequest1 = {
        name: 'Test Organization 1',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      }

      const createRequest2 = {
        name: 'Test Organization 2',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com', // Same email
          password: 'SecurePassword123!'
        }
      }

      await organizationService.createOrganization(createRequest1)

      await expect(organizationService.createOrganization(createRequest2))
        .rejects.toThrow('Admin user email already exists')
    })
  })

  describe('getOrganizationById', () => {
    let testOrganization: any
    let adminUser: any

    beforeEach(async () => {
      const createRequest = {
        name: 'Test Organization',
        plan: SubscriptionPlan.PROFESSIONAL,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      }

      testOrganization = await organizationService.createOrganization(createRequest)
      adminUser = await testPrisma.user.findUnique({
        where: { email: 'admin@test.com' }
      })
    })

    it('should return organization by ID', async () => {
      const organization = await organizationService.getOrganizationById(
        testOrganization.id,
        adminUser.id
      )

      expect(organization).toBeDefined()
      expect(organization!.id).toBe(testOrganization.id)
      expect(organization!.name).toBe(testOrganization.name)
    })

    it('should return null for non-existent organization', async () => {
      const organization = await organizationService.getOrganizationById(
        'non-existent-id',
        adminUser.id
      )

      expect(organization).toBeNull()
    })
  })

  describe('updateOrganization', () => {
    let testOrganization: any
    let adminUser: any

    beforeEach(async () => {
      const createRequest = {
        name: 'Test Organization',
        plan: SubscriptionPlan.PROFESSIONAL,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      }

      testOrganization = await organizationService.createOrganization(createRequest)
      adminUser = await testPrisma.user.findUnique({
        where: { email: 'admin@test.com' }
      })
    })

    it('should update organization successfully', async () => {
      const updateRequest = {
        name: 'Updated Organization Name',
        plan: SubscriptionPlan.ENTERPRISE,
        settings: {
          allowPublicWorkflows: false,
          maxConcurrentExecutions: 50,
          retentionDays: 90,
          requireEmailVerification: true,
          features: {
            marketplace: true,
            collaboration: true,
            analytics: true,
            apiAccess: true
          }
        }
      }

      const updatedOrganization = await organizationService.updateOrganization(
        testOrganization.id,
        updateRequest,
        adminUser.id
      )

      expect(updatedOrganization.name).toBe(updateRequest.name)
      expect(updatedOrganization.plan).toBe(updateRequest.plan)
      expect(updatedOrganization.settings.maxConcurrentExecutions).toBe(50)
      expect(updatedOrganization.settings.allowPublicWorkflows).toBe(false)
    })

    it('should throw error for duplicate slug', async () => {
      // Create another organization
      const anotherOrg = await organizationService.createOrganization({
        name: 'Another Organization',
        slug: 'another-org',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Another Admin',
          email: 'another@test.com',
          password: 'SecurePassword123!'
        }
      })

      const updateRequest = {
        slug: 'another-org' // Try to use existing slug
      }

      await expect(organizationService.updateOrganization(
        testOrganization.id,
        updateRequest,
        adminUser.id
      )).rejects.toThrow('Slug already in use')
    })
  })

  describe('listOrganizations', () => {
    let adminUser: any
    let regularUser: any

    beforeEach(async () => {
      // Create multiple organizations
      await organizationService.createOrganization({
        name: 'Organization 1',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Admin 1',
          email: 'admin1@test.com',
          password: 'SecurePassword123!'
        }
      })

      await organizationService.createOrganization({
        name: 'Organization 2',
        plan: SubscriptionPlan.PROFESSIONAL,
        adminUser: {
          name: 'Admin 2',
          email: 'admin2@test.com',
          password: 'SecurePassword123!'
        }
      })

      const org3 = await organizationService.createOrganization({
        name: 'Organization 3',
        plan: SubscriptionPlan.ENTERPRISE,
        adminUser: {
          name: 'Admin 3',
          email: 'admin3@test.com',
          password: 'SecurePassword123!'
        }
      })

      adminUser = await testPrisma.user.findUnique({
        where: { email: 'admin1@test.com' }
      })

      // Create a regular user in org3
      regularUser = await testPrisma.user.create({
        data: {
          name: 'Regular User',
          email: 'regular@test.com',
          password: 'hashedpassword',
          role: UserRole.DEVELOPER,
          organizationId: org3.id,
          emailVerified: new Date(),
          preferences: {}
        }
      })
    })

    it('should list all organizations for admin', async () => {
      // Make admin user a system admin
      await testPrisma.user.update({
        where: { id: adminUser.id },
        data: { role: UserRole.ADMIN }
      })

      const result = await organizationService.listOrganizations(
        {},
        1,
        10,
        adminUser.id
      )

      expect(result.organizations).toHaveLength(3)
      expect(result.pagination.total).toBe(3)
    })

    it('should list only own organization for regular user', async () => {
      const result = await organizationService.listOrganizations(
        {},
        1,
        10,
        regularUser.id
      )

      expect(result.organizations).toHaveLength(1)
      expect(result.organizations[0].name).toBe('Organization 3')
    })

    it('should filter organizations by plan', async () => {
      // Make admin user a system admin
      await testPrisma.user.update({
        where: { id: adminUser.id },
        data: { role: UserRole.ADMIN }
      })

      const result = await organizationService.listOrganizations(
        { plan: SubscriptionPlan.PROFESSIONAL },
        1,
        10,
        adminUser.id
      )

      expect(result.organizations).toHaveLength(1)
      expect(result.organizations[0].plan).toBe(SubscriptionPlan.PROFESSIONAL)
    })

    it('should search organizations by name', async () => {
      // Make admin user a system admin
      await testPrisma.user.update({
        where: { id: adminUser.id },
        data: { role: UserRole.ADMIN }
      })

      const result = await organizationService.listOrganizations(
        { search: 'Organization 2' },
        1,
        10,
        adminUser.id
      )

      expect(result.organizations).toHaveLength(1)
      expect(result.organizations[0].name).toBe('Organization 2')
    })
  })

  describe('getOrganizationMembers', () => {
    let testOrganization: any
    let adminUser: any

    beforeEach(async () => {
      testOrganization = await organizationService.createOrganization({
        name: 'Test Organization',
        plan: SubscriptionPlan.PROFESSIONAL,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      })

      adminUser = await testPrisma.user.findUnique({
        where: { email: 'admin@test.com' }
      })

      // Add more members
      await testPrisma.user.createMany({
        data: [
          {
            name: 'Developer 1',
            email: 'dev1@test.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          },
          {
            name: 'Manager 1',
            email: 'manager1@test.com',
            password: 'hashedpassword',
            role: UserRole.MANAGER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {}
          }
        ]
      })
    })

    it('should return all organization members', async () => {
      const members = await organizationService.getOrganizationMembers(
        testOrganization.id,
        adminUser.id
      )

      expect(members).toHaveLength(3) // Admin + 2 created members
      expect(members.some(m => m.role === UserRole.ADMIN)).toBe(true)
      expect(members.some(m => m.role === UserRole.DEVELOPER)).toBe(true)
      expect(members.some(m => m.role === UserRole.MANAGER)).toBe(true)
    })

    it('should return members ordered by join date', async () => {
      const members = await organizationService.getOrganizationMembers(
        testOrganization.id,
        adminUser.id
      )

      // Admin should be first (created first)
      expect(members[0].email).toBe('admin@test.com')
    })
  })

  describe('getOrganizationStats', () => {
    let testOrganization: any
    let adminUser: any

    beforeEach(async () => {
      testOrganization = await organizationService.createOrganization({
        name: 'Test Organization',
        plan: SubscriptionPlan.PROFESSIONAL,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      })

      adminUser = await testPrisma.user.findUnique({
        where: { email: 'admin@test.com' }
      })

      // Add members and workflows
      await testPrisma.user.createMany({
        data: [
          {
            name: 'Developer 1',
            email: 'dev1@test.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {},
            isActive: true
          },
          {
            name: 'Developer 2',
            email: 'dev2@test.com',
            password: 'hashedpassword',
            role: UserRole.DEVELOPER,
            organizationId: testOrganization.id,
            emailVerified: new Date(),
            preferences: {},
            isActive: false // Inactive user
          }
        ]
      })

      // Create workflows
      await testPrisma.workflow.createMany({
        data: [
          {
            name: 'Workflow 1',
            description: 'Test workflow 1',
            engineType: 'LANGFLOW',
            definition: {},
            visibility: 'PRIVATE',
            tags: [],
            createdBy: adminUser.id,
            organizationId: testOrganization.id
          },
          {
            name: 'Workflow 2',
            description: 'Test workflow 2',
            engineType: 'N8N',
            definition: {},
            visibility: 'ORGANIZATION',
            tags: [],
            createdBy: adminUser.id,
            organizationId: testOrganization.id
          }
        ]
      })

      // Create executions
      const workflows = await testPrisma.workflow.findMany({
        where: { organizationId: testOrganization.id }
      })

      await testPrisma.execution.createMany({
        data: [
          {
            workflowId: workflows[0].id,
            workflowVersion: 1,
            status: 'COMPLETED',
            parameters: {},
            logs: [],
            metrics: {},
            startTime: new Date(),
            executorId: 'executor-1',
            userId: adminUser.id,
            organizationId: testOrganization.id
          },
          {
            workflowId: workflows[1].id,
            workflowVersion: 1,
            status: 'FAILED',
            parameters: {},
            logs: [],
            metrics: {},
            startTime: new Date(),
            executorId: 'executor-1',
            userId: adminUser.id,
            organizationId: testOrganization.id
          }
        ]
      })
    })

    it('should return correct organization statistics', async () => {
      const stats = await organizationService.getOrganizationStats(
        testOrganization.id,
        adminUser.id
      )

      expect(stats.totalMembers).toBe(3) // Admin + 2 developers
      expect(stats.activeMembers).toBe(2) // Admin + 1 active developer
      expect(stats.membersByRole[UserRole.ADMIN]).toBe(1)
      expect(stats.membersByRole[UserRole.DEVELOPER]).toBe(2)
      expect(stats.totalWorkflows).toBe(2)
      expect(stats.totalExecutions).toBe(2)
    })
  })

  describe('transferOwnership', () => {
    let testOrganization: any
    let adminUser: any
    let managerUser: any

    beforeEach(async () => {
      testOrganization = await organizationService.createOrganization({
        name: 'Test Organization',
        plan: SubscriptionPlan.PROFESSIONAL,
        adminUser: {
          name: 'Admin User',
          email: 'admin@test.com',
          password: 'SecurePassword123!'
        }
      })

      adminUser = await testPrisma.user.findUnique({
        where: { email: 'admin@test.com' }
      })

      // Create manager user
      managerUser = await testPrisma.user.create({
        data: {
          name: 'Manager User',
          email: 'manager@test.com',
          password: 'hashedpassword',
          role: UserRole.MANAGER,
          organizationId: testOrganization.id,
          emailVerified: new Date(),
          preferences: {}
        }
      })
    })

    it('should transfer ownership successfully', async () => {
      const transferRequest = {
        newOwnerId: managerUser.id,
        confirmationCode: 'CONFIRM_TRANSFER'
      }

      await organizationService.transferOwnership(
        testOrganization.id,
        transferRequest,
        adminUser.id
      )

      // Verify role changes
      const updatedAdmin = await testPrisma.user.findUnique({
        where: { id: adminUser.id }
      })
      const updatedManager = await testPrisma.user.findUnique({
        where: { id: managerUser.id }
      })

      expect(updatedAdmin!.role).toBe(UserRole.MANAGER)
      expect(updatedManager!.role).toBe(UserRole.ADMIN)
    })

    it('should reject invalid confirmation code', async () => {
      const transferRequest = {
        newOwnerId: managerUser.id,
        confirmationCode: 'INVALID_CODE'
      }

      await expect(organizationService.transferOwnership(
        testOrganization.id,
        transferRequest,
        adminUser.id
      )).rejects.toThrow('Invalid confirmation code')
    })

    it('should reject transfer to non-member', async () => {
      // Create user in different organization
      const otherOrg = await organizationService.createOrganization({
        name: 'Other Organization',
        plan: SubscriptionPlan.FREE,
        adminUser: {
          name: 'Other Admin',
          email: 'other@test.com',
          password: 'SecurePassword123!'
        }
      })

      const otherUser = await testPrisma.user.findUnique({
        where: { email: 'other@test.com' }
      })

      const transferRequest = {
        newOwnerId: otherUser!.id,
        confirmationCode: 'CONFIRM_TRANSFER'
      }

      await expect(organizationService.transferOwnership(
        testOrganization.id,
        transferRequest,
        adminUser.id
      )).rejects.toThrow('New owner must be an active member of the organization')
    })
  })
})