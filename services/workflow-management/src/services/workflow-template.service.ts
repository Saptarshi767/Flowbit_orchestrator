import {
  Workflow,
  WorkflowDefinition,
  EngineType,
  WorkflowVisibility,
  CreateWorkflowRequest
} from '../types/workflow.types'
import { WorkflowService } from './workflow.service'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  engineType: EngineType
  definition: WorkflowDefinition
  previewImage?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime?: number // in minutes
  author: string
  version: string
  downloads: number
  rating: number
  createdAt: Date
  updatedAt: Date
}

export interface TemplateCategory {
  id: string
  name: string
  description: string
  icon?: string
  templateCount: number
}

export interface CreateTemplateRequest {
  workflowId: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime?: number
  previewImage?: string
}

export interface TemplateSearchOptions {
  query?: string
  category?: string
  engineType?: EngineType
  difficulty?: string
  tags?: string[]
  limit?: number
  offset?: number
  sortBy?: 'name' | 'downloads' | 'rating' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export class WorkflowTemplateService {
  private templates: Map<string, WorkflowTemplate> = new Map()
  private categories: Map<string, TemplateCategory> = new Map()

  constructor(private workflowService: WorkflowService) {
    this.initializeDefaultCategories()
    this.initializeDefaultTemplates()
  }

  /**
   * Create template from existing workflow
   */
  async createTemplate(
    request: CreateTemplateRequest,
    userId: string
  ): Promise<WorkflowTemplate> {
    // Get the workflow
    const workflow = await this.workflowService.getWorkflow(request.workflowId, userId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    // Check if user owns the workflow
    const isOwner = await this.workflowService['workflowRepository'].isOwner(request.workflowId, userId)
    if (!isOwner) {
      throw new Error('Only workflow owners can create templates')
    }

    const template: WorkflowTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: workflow.name,
      description: workflow.description || '',
      category: request.category,
      tags: workflow.tags,
      engineType: workflow.engineType,
      definition: workflow.definition,
      previewImage: request.previewImage,
      difficulty: request.difficulty,
      estimatedTime: request.estimatedTime,
      author: userId,
      version: '1.0.0',
      downloads: 0,
      rating: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.templates.set(template.id, template)
    this.updateCategoryCount(request.category)

    return template
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<WorkflowTemplate | null> {
    return this.templates.get(id) || null
  }

  /**
   * Search templates
   */
  async searchTemplates(options: TemplateSearchOptions): Promise<{
    templates: WorkflowTemplate[]
    total: number
    hasMore: boolean
  }> {
    let templates = Array.from(this.templates.values())

    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase()
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    if (options.category) {
      templates = templates.filter(t => t.category === options.category)
    }

    if (options.engineType) {
      templates = templates.filter(t => t.engineType === options.engineType)
    }

    if (options.difficulty) {
      templates = templates.filter(t => t.difficulty === options.difficulty)
    }

    if (options.tags && options.tags.length > 0) {
      templates = templates.filter(t => 
        options.tags!.some(tag => t.tags.includes(tag))
      )
    }

    // Apply sorting
    const sortBy = options.sortBy || 'downloads'
    const sortOrder = options.sortOrder || 'desc'
    
    templates.sort((a, b) => {
      let aValue = a[sortBy as keyof WorkflowTemplate]
      let bValue = b[sortBy as keyof WorkflowTemplate]
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = (bValue as string).toLowerCase()
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    // Apply pagination
    const limit = options.limit || 20
    const offset = options.offset || 0
    const total = templates.length
    const paginatedTemplates = templates.slice(offset, offset + limit)

    return {
      templates: paginatedTemplates,
      total,
      hasMore: offset + limit < total
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<TemplateCategory[]> {
    return Array.from(this.categories.values())
  }

  /**
   * Get category by ID
   */
  async getCategory(id: string): Promise<TemplateCategory | null> {
    return this.categories.get(id) || null
  }

  /**
   * Create workflow from template
   */
  async createWorkflowFromTemplate(
    templateId: string,
    name: string,
    userId: string,
    organizationId: string
  ): Promise<Workflow> {
    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    // Increment download count
    template.downloads++
    this.templates.set(templateId, template)

    // Create workflow from template
    const createRequest: CreateWorkflowRequest = {
      name,
      description: `Created from template: ${template.name}`,
      engineType: template.engineType,
      definition: { ...template.definition }, // Deep copy
      visibility: WorkflowVisibility.PRIVATE,
      tags: [...template.tags, 'from-template']
    }

    return this.workflowService.createWorkflow(createRequest, userId, organizationId)
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(limit = 10): Promise<WorkflowTemplate[]> {
    const templates = Array.from(this.templates.values())
    return templates
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit)
  }

  /**
   * Get recent templates
   */
  async getRecentTemplates(limit = 10): Promise<WorkflowTemplate[]> {
    const templates = Array.from(this.templates.values())
    return templates
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(categoryId: string, limit = 20): Promise<WorkflowTemplate[]> {
    const templates = Array.from(this.templates.values())
    return templates
      .filter(t => t.category === categoryId)
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, limit)
  }

  /**
   * Rate template
   */
  async rateTemplate(templateId: string, rating: number, userId: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    const template = this.templates.get(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    // In a real implementation, you'd store individual ratings and calculate average
    // For now, we'll just update the rating directly
    template.rating = rating
    template.updatedAt = new Date()
    this.templates.set(templateId, template)
  }

  /**
   * Initialize default categories
   */
  private initializeDefaultCategories(): void {
    const defaultCategories: TemplateCategory[] = [
      {
        id: 'data-processing',
        name: 'Data Processing',
        description: 'Templates for data transformation, cleaning, and analysis',
        icon: 'database',
        templateCount: 0
      },
      {
        id: 'ai-ml',
        name: 'AI & Machine Learning',
        description: 'Templates for AI model integration and ML workflows',
        icon: 'brain',
        templateCount: 0
      },
      {
        id: 'automation',
        name: 'Automation',
        description: 'Templates for business process automation',
        icon: 'robot',
        templateCount: 0
      },
      {
        id: 'integration',
        name: 'Integration',
        description: 'Templates for system and API integrations',
        icon: 'link',
        templateCount: 0
      },
      {
        id: 'notification',
        name: 'Notifications',
        description: 'Templates for alerts, emails, and messaging',
        icon: 'bell',
        templateCount: 0
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description: 'Templates for reporting and analytics workflows',
        icon: 'chart',
        templateCount: 0
      }
    ]

    defaultCategories.forEach(category => {
      this.categories.set(category.id, category)
    })
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Simple Data Pipeline',
        description: 'A basic data processing pipeline for CSV files',
        category: 'data-processing',
        tags: ['csv', 'data', 'pipeline', 'beginner'],
        engineType: EngineType.N8N,
        definition: {
          nodes: [
            { id: 'start', type: 'trigger', position: { x: 100, y: 100 }, data: {} },
            { id: 'process', type: 'csv-processor', position: { x: 300, y: 100 }, data: {} },
            { id: 'output', type: 'file-output', position: { x: 500, y: 100 }, data: {} }
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'process' },
            { id: 'e2', source: 'process', target: 'output' }
          ]
        },
        difficulty: 'beginner',
        estimatedTime: 15,
        author: 'system',
        version: '1.0.0',
        downloads: 150,
        rating: 4.5
      },
      {
        name: 'AI Text Classification',
        description: 'Classify text using AI models with confidence scoring',
        category: 'ai-ml',
        tags: ['ai', 'nlp', 'classification', 'intermediate'],
        engineType: EngineType.LANGFLOW,
        definition: {
          nodes: [
            { id: 'input', type: 'text-input', position: { x: 100, y: 100 }, data: {} },
            { id: 'classifier', type: 'ai-classifier', position: { x: 300, y: 100 }, data: {} },
            { id: 'output', type: 'result-output', position: { x: 500, y: 100 }, data: {} }
          ],
          edges: [
            { id: 'e1', source: 'input', target: 'classifier' },
            { id: 'e2', source: 'classifier', target: 'output' }
          ]
        },
        difficulty: 'intermediate',
        estimatedTime: 30,
        author: 'system',
        version: '1.0.0',
        downloads: 89,
        rating: 4.2
      }
    ]

    defaultTemplates.forEach(template => {
      const fullTemplate: WorkflowTemplate = {
        ...template,
        id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      this.templates.set(fullTemplate.id, fullTemplate)
      this.updateCategoryCount(template.category)
    })
  }

  /**
   * Update category template count
   */
  private updateCategoryCount(categoryId: string): void {
    const category = this.categories.get(categoryId)
    if (category) {
      category.templateCount = Array.from(this.templates.values())
        .filter(t => t.category === categoryId).length
      this.categories.set(categoryId, category)
    }
  }
}