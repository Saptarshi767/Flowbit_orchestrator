import { PrismaClient, UserRole, SubscriptionPlan, EngineType, ExecutionStatus, WorkflowVisibility } from '@prisma/client'
import { ConnectionManager } from './connection'
import { redisSchema } from './redis-schema'
import { elasticsearchSchema } from './elasticsearch-mappings'

/**
 * Database Seeding Script
 * Seeds the database with initial data for development and testing
 */

export interface SeedOptions {
  skipRedis?: boolean
  skipElasticsearch?: boolean
  environment?: 'development' | 'testing' | 'production'
  verbose?: boolean
}

export interface SeedResult {
  success: boolean
  seeded: {
    organizations: number
    users: number
    workflows: number
    executions: number
  }
  errors: string[]
}

export class DatabaseSeeder {
  private prisma: PrismaClient
  private options: SeedOptions
  private result: SeedResult

  constructor(options: SeedOptions = {}) {
    this.prisma = ConnectionManager.getDatabase()
    this.options = { environment: 'development', ...options }
    this.result = {
      success: false,
      seeded: {
        organizations: 0,
        users: 0,
        workflows: 0,
        executions: 0
      },
      errors: []
    }
  }

  async seed(): Promise<SeedResult> {
    this.log('Starting database seeding...')

    try {
      // Initialize connections
      await ConnectionManager.initialize()

      // Clear existing data in development/testing
      if (this.options.environment !== 'production') {
        await this.clearExistingData()
      }

      // Seed core data
      await this.seedOrganizations()
      await this.seedUsers()
      await this.seedWorkflows()
      await this.seedExecutions()

      // Seed Redis data
      if (!this.options.skipRedis) {
        await this.seedRedisData()
      }

      // Seed Elasticsearch data
      if (!this.options.skipElasticsearch) {
        await this.seedElasticsearchData()
      }

      this.result.success = true
      this.log('Database seeding completed successfully')
      
      return this.result
    } catch (error) {
      this.result.errors.push(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`)
      this.log(`Database seeding failed: ${error}`)
      return this.result
    }
  }

  private async clearExistingData(): Promise<void> {
    this.log('Clearing existing data...')
    
    // Delete in reverse dependency order
    await this.prisma.workflowRating.deleteMany()
    await this.prisma.marketplaceItem.deleteMany()
    await this.prisma.workflowCollaborator.deleteMany()
    await this.prisma.execution.deleteMany()
    await this.prisma.workflowVersion.deleteMany()
    await this.prisma.workflow.deleteMany()
    await this.prisma.notification.deleteMany()
    await this.prisma.auditLog.deleteMany()
    await this.prisma.systemMetric.deleteMany()
    await this.prisma.session.deleteMany()
    await this.prisma.account.deleteMany()
    await this.prisma.user.deleteMany()
    await this.prisma.organization.deleteMany()
    
    this.log('Existing data cleared')
  }

  private async seedOrganizations(): Promise<void> {
    this.log('Seeding organizations...')
    
    const organizations = [
      {
        name: 'Acme Corporation',
        slug: 'acme-corp',
        plan: SubscriptionPlan.ENTERPRISE,
        settings: {
          allowPublicWorkflows: true,
          maxConcurrentExecutions: 50,
          retentionDays: 90
        }
      },
      {
        name: 'TechStart Inc',
        slug: 'techstart',
        plan: SubscriptionPlan.PROFESSIONAL,
        settings: {
          allowPublicWorkflows: false,
          maxConcurrentExecutions: 20,
          retentionDays: 30
        }
      },
      {
        name: 'Open Source Community',
        slug: 'opensource',
        plan: SubscriptionPlan.FREE,
        settings: {
          allowPublicWorkflows: true,
          maxConcurrentExecutions: 5,
          retentionDays: 7
        }
      }
    ]

    for (const orgData of organizations) {
      const org = await this.prisma.organization.create({
        data: orgData
      })
      this.result.seeded.organizations++
      this.log(`Created organization: ${org.name}`)
    }
  }

  private async seedUsers(): Promise<void> {
    this.log('Seeding users...')
    
    const organizations = await this.prisma.organization.findMany()
    
    const users = [
      {
        name: 'Admin User',
        email: 'admin@acme-corp.com',
        role: UserRole.ADMIN,
        organizationId: organizations.find(o => o.slug === 'acme-corp')!.id,
        preferences: {
          theme: 'dark',
          notifications: { email: true, inApp: true },
          defaultEngine: 'LANGFLOW'
        }
      },
      {
        name: 'John Developer',
        email: 'john@acme-corp.com',
        role: UserRole.DEVELOPER,
        organizationId: organizations.find(o => o.slug === 'acme-corp')!.id,
        preferences: {
          theme: 'light',
          notifications: { email: true, inApp: false },
          defaultEngine: 'N8N'
        }
      },
      {
        name: 'Sarah Manager',
        email: 'sarah@techstart.com',
        role: UserRole.MANAGER,
        organizationId: organizations.find(o => o.slug === 'techstart')!.id,
        preferences: {
          theme: 'auto',
          notifications: { email: true, inApp: true },
          defaultEngine: 'LANGSMITH'
        }
      },
      {
        name: 'Open Source Contributor',
        email: 'contributor@opensource.org',
        role: UserRole.DEVELOPER,
        organizationId: organizations.find(o => o.slug === 'opensource')!.id,
        preferences: {
          theme: 'light',
          notifications: { email: false, inApp: true },
          defaultEngine: 'LANGFLOW'
        }
      }
    ]

    for (const userData of users) {
      const user = await this.prisma.user.create({
        data: userData
      })
      this.result.seeded.users++
      this.log(`Created user: ${user.name}`)
    }
  }

  private async seedWorkflows(): Promise<void> {
    this.log('Seeding workflows...')
    
    const users = await this.prisma.user.findMany({ include: { organization: true } })
    
    const workflows = [
      {
        name: 'Customer Support Chatbot',
        description: 'AI-powered customer support chatbot with sentiment analysis',
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            { id: 'input', type: 'TextInput', position: { x: 0, y: 0 } },
            { id: 'sentiment', type: 'SentimentAnalysis', position: { x: 200, y: 0 } },
            { id: 'response', type: 'ChatGPT', position: { x: 400, y: 0 } },
            { id: 'output', type: 'TextOutput', position: { x: 600, y: 0 } }
          ],
          edges: [
            { source: 'input', target: 'sentiment' },
            { source: 'sentiment', target: 'response' },
            { source: 'response', target: 'output' }
          ]
        },
        visibility: WorkflowVisibility.PUBLIC,
        tags: ['chatbot', 'customer-support', 'ai', 'sentiment-analysis'],
        createdBy: users.find(u => u.role === UserRole.DEVELOPER)!.id,
        organizationId: users.find(u => u.role === UserRole.DEVELOPER)!.organizationId
      },
      {
        name: 'Data Processing Pipeline',
        description: 'Automated data processing and transformation pipeline',
        engineType: EngineType.N8N,
        definition: {
          nodes: [
            { id: 'webhook', type: 'Webhook', position: { x: 0, y: 0 } },
            { id: 'validate', type: 'DataValidator', position: { x: 200, y: 0 } },
            { id: 'transform', type: 'DataTransformer', position: { x: 400, y: 0 } },
            { id: 'store', type: 'DatabaseStore', position: { x: 600, y: 0 } }
          ],
          edges: [
            { source: 'webhook', target: 'validate' },
            { source: 'validate', target: 'transform' },
            { source: 'transform', target: 'store' }
          ]
        },
        visibility: WorkflowVisibility.ORGANIZATION,
        tags: ['data-processing', 'automation', 'pipeline'],
        createdBy: users.find(u => u.role === UserRole.ADMIN)!.id,
        organizationId: users.find(u => u.role === UserRole.ADMIN)!.organizationId
      },
      {
        name: 'LangChain Document QA',
        description: 'Question answering system using LangChain and vector databases',
        engineType: EngineType.LANGSMITH,
        definition: {
          chains: [
            { id: 'loader', type: 'DocumentLoader' },
            { id: 'splitter', type: 'TextSplitter' },
            { id: 'embeddings', type: 'OpenAIEmbeddings' },
            { id: 'vectorstore', type: 'Chroma' },
            { id: 'qa', type: 'RetrievalQA' }
          ],
          connections: [
            { from: 'loader', to: 'splitter' },
            { from: 'splitter', to: 'embeddings' },
            { from: 'embeddings', to: 'vectorstore' },
            { from: 'vectorstore', to: 'qa' }
          ]
        },
        visibility: WorkflowVisibility.PRIVATE,
        tags: ['langchain', 'qa', 'documents', 'vector-db'],
        createdBy: users.find(u => u.role === UserRole.MANAGER)!.id,
        organizationId: users.find(u => u.role === UserRole.MANAGER)!.organizationId
      }
    ]

    for (const workflowData of workflows) {
      const workflow = await this.prisma.workflow.create({
        data: workflowData
      })
      
      // Create initial version
      await this.prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          definition: workflowData.definition,
          changeLog: 'Initial version',
          createdBy: workflowData.createdBy
        }
      })
      
      this.result.seeded.workflows++
      this.log(`Created workflow: ${workflow.name}`)
    }
  }

  private async seedExecutions(): Promise<void> {
    this.log('Seeding executions...')
    
    const workflows = await this.prisma.workflow.findMany({ include: { creator: true } })
    
    for (const workflow of workflows) {
      // Create multiple executions for each workflow
      const executionCount = Math.floor(Math.random() * 5) + 1
      
      for (let i = 0; i < executionCount; i++) {
        const statuses = [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.RUNNING]
        const status = statuses[Math.floor(Math.random() * statuses.length)]
        
        const startTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Last 7 days
        const endTime = status === ExecutionStatus.RUNNING ? null : 
          new Date(startTime.getTime() + Math.random() * 60 * 60 * 1000) // Up to 1 hour duration
        
        const execution = await this.prisma.execution.create({
          data: {
            workflowId: workflow.id,
            workflowVersion: 1,
            status,
            parameters: {
              input: `Test input ${i + 1}`,
              config: { timeout: 300, retries: 3 }
            },
            result: status === ExecutionStatus.COMPLETED ? {
              output: `Generated result ${i + 1}`,
              metrics: { duration: Math.random() * 1000, nodes: 4 }
            } : undefined,
            logs: [
              {
                timestamp: startTime.toISOString(),
                level: 'INFO',
                message: 'Execution started',
                component: 'orchestrator'
              },
              ...(status === ExecutionStatus.FAILED ? [{
                timestamp: endTime?.toISOString(),
                level: 'ERROR',
                message: 'Execution failed due to timeout',
                component: 'engine'
              }] : [])
            ],
            metrics: {
              cpuUsage: Math.random() * 100,
              memoryUsage: Math.random() * 1024 * 1024 * 1024,
              networkIO: Math.random() * 1024 * 1024,
              nodeExecutionTimes: {
                input: Math.random() * 100,
                processing: Math.random() * 500,
                output: Math.random() * 50
              }
            },
            startTime,
            endTime,
            executorId: `executor-${Math.floor(Math.random() * 3) + 1}`,
            userId: workflow.createdBy,
            organizationId: workflow.organizationId
          }
        })
        
        this.result.seeded.executions++
      }
      
      this.log(`Created executions for workflow: ${workflow.name}`)
    }
  }

  private async seedRedisData(): Promise<void> {
    this.log('Seeding Redis data...')
    
    try {
      const users = await this.prisma.user.findMany()
      
      // Create sample sessions
      for (const user of users.slice(0, 2)) { // Only for first 2 users
        const sessionId = `session_${user.id}_${Date.now()}`
        await redisSchema.setSession(sessionId, {
          userId: user.id,
          organizationId: user.organizationId,
          role: user.role,
          permissions: ['read', 'write', 'execute'],
          lastActivity: Date.now(),
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
      }
      
      // Set up some cached data
      await redisSchema.setCache('system:stats', {
        totalWorkflows: this.result.seeded.workflows,
        totalExecutions: this.result.seeded.executions,
        activeUsers: this.result.seeded.users
      })
      
      // Initialize some metrics
      await redisSchema.incrementMetric('system.startup', 1)
      await redisSchema.incrementMetric('workflows.created', this.result.seeded.workflows)
      
      this.log('Redis data seeded successfully')
    } catch (error) {
      this.result.errors.push(`Redis seeding failed: ${error}`)
    }
  }

  private async seedElasticsearchData(): Promise<void> {
    this.log('Seeding Elasticsearch data...')
    
    try {
      // This would typically be done by the application during normal operation
      // For now, we just ensure the indices are created
      await elasticsearchSchema.initializeSchema()
      
      this.log('Elasticsearch data seeded successfully')
    } catch (error) {
      this.result.errors.push(`Elasticsearch seeding failed: ${error}`)
    }
  }

  private log(message: string): void {
    if (this.options.verbose !== false) {
      console.log(`[DB Seed] ${message}`)
    }
  }
}

// CLI interface for database seeding
export async function seedDatabase(options: SeedOptions = {}): Promise<SeedResult> {
  const seeder = new DatabaseSeeder(options)
  return await seeder.seed()
}

// Utility to clean database (for testing)
export async function cleanDatabase(): Promise<void> {
  const seeder = new DatabaseSeeder({ environment: 'testing' })
  await seeder['clearExistingData']()
  console.log('Database cleaned successfully')
}