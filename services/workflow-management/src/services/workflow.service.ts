import {
  Workflow,
  WorkflowVersion,
  WorkflowCollaborator,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateWorkflowVersionRequest,
  ShareWorkflowRequest,
  WorkflowSearchOptions,
  WorkflowSearchResult,
  WorkflowStats,
  ValidationResult
} from '../types/workflow.types'
import {
  IWorkflowRepository,
  IWorkflowVersionRepository,
  IWorkflowCollaboratorRepository
} from '../repositories/interfaces/workflow.repository.interface'
import { validateWorkflowDefinition, validateWorkflowName, validateWorkflowTags } from '../utils/validation.utils'

export class WorkflowService {
  constructor(
    private workflowRepository: IWorkflowRepository,
    private workflowVersionRepository: IWorkflowVersionRepository,
    private workflowCollaboratorRepository: IWorkflowCollaboratorRepository
  ) {}

  /**
   * Creates a new workflow
   */
  async createWorkflow(
    request: CreateWorkflowRequest,
    userId: string,
    organizationId: string
  ): Promise<Workflow> {
    // Validate workflow name
    const nameValidation = validateWorkflowName(request.name)
    if (!nameValidation.isValid) {
      throw new Error(`Invalid workflow name: ${nameValidation.errors[0]?.message}`)
    }

    // Validate workflow tags
    if (request.tags) {
      const tagsValidation = validateWorkflowTags(request.tags)
      if (!tagsValidation.isValid) {
        throw new Error(`Invalid workflow tags: ${tagsValidation.errors[0]?.message}`)
      }
    }

    // Validate workflow definition
    const definitionValidation = validateWorkflowDefinition(request.definition, request.engineType)
    if (!definitionValidation.isValid) {
      throw new Error(`Invalid workflow definition: ${definitionValidation.errors[0]?.message}`)
    }

    return this.workflowRepository.create(request, userId, organizationId)
  }

  /**
   * Gets a workflow by ID
   */
  async getWorkflow(id: string, userId: string): Promise<Workflow | null> {
    const workflow = await this.workflowRepository.findById(id)
    if (!workflow) return null

    // Check access permissions
    const hasAccess = await this.workflowRepository.hasAccess(id, userId, 'read')
    if (!hasAccess) {
      throw new Error('Insufficient permissions to access this workflow')
    }

    return workflow
  }

  /**
   * Gets a workflow with all its versions
   */
  async getWorkflowWithVersions(id: string, userId: string): Promise<Workflow & { versions: WorkflowVersion[] } | null> {
    // Check access permissions first
    const hasAccess = await this.workflowRepository.hasAccess(id, userId, 'read')
    if (!hasAccess) {
      throw new Error('Insufficient permissions to access this workflow')
    }

    return this.workflowRepository.findByIdWithVersions(id)
  }

  /**
   * Updates a workflow
   */
  async updateWorkflow(
    id: string,
    request: UpdateWorkflowRequest,
    userId: string
  ): Promise<Workflow> {
    // Check write permissions
    const canWrite = await this.workflowRepository.hasAccess(id, userId, 'write')
    if (!canWrite) {
      throw new Error('Insufficient permissions to update this workflow')
    }

    // Validate updates
    if (request.name) {
      const nameValidation = validateWorkflowName(request.name)
      if (!nameValidation.isValid) {
        throw new Error(`Invalid workflow name: ${nameValidation.errors[0]?.message}`)
      }
    }

    if (request.tags) {
      const tagsValidation = validateWorkflowTags(request.tags)
      if (!tagsValidation.isValid) {
        throw new Error(`Invalid workflow tags: ${tagsValidation.errors[0]?.message}`)
      }
    }

    if (request.definition) {
      const workflow = await this.workflowRepository.findById(id)
      if (workflow) {
        const definitionValidation = validateWorkflowDefinition(request.definition, workflow.engineType)
        if (!definitionValidation.isValid) {
          throw new Error(`Invalid workflow definition: ${definitionValidation.errors[0]?.message}`)
        }
      }
    }

    return this.workflowRepository.update(id, request, userId)
  }

  /**
   * Deletes a workflow
   */
  async deleteWorkflow(id: string, userId: string): Promise<void> {
    // Check delete permissions
    const canDelete = await this.workflowRepository.hasAccess(id, userId, 'delete')
    if (!canDelete) {
      throw new Error('Insufficient permissions to delete this workflow')
    }

    return this.workflowRepository.delete(id, userId)
  }

  /**
   * Searches workflows
   */
  async searchWorkflows(options: WorkflowSearchOptions): Promise<WorkflowSearchResult> {
    return this.workflowRepository.search(options)
  }

  /**
   * Gets workflows by organization
   */
  async getWorkflowsByOrganization(
    organizationId: string,
    limit?: number,
    offset?: number
  ): Promise<Workflow[]> {
    return this.workflowRepository.findByOrganization(organizationId, limit, offset)
  }

  /**
   * Gets workflows by user (created or collaborated on)
   */
  async getWorkflowsByUser(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<Workflow[]> {
    return this.workflowRepository.findByUser(userId, limit, offset)
  }

  /**
   * Gets workflow statistics
   */
  async getWorkflowStats(organizationId?: string): Promise<WorkflowStats> {
    return this.workflowRepository.getStats(organizationId)
  }

  /**
   * Creates a new workflow version
   */
  async createWorkflowVersion(
    workflowId: string,
    request: CreateWorkflowVersionRequest,
    userId: string
  ): Promise<WorkflowVersion> {
    // Check write permissions
    const canWrite = await this.workflowRepository.hasAccess(workflowId, userId, 'write')
    if (!canWrite) {
      throw new Error('Insufficient permissions to create workflow version')
    }

    // Validate definition
    const workflow = await this.workflowRepository.findById(workflowId)
    if (!workflow) {
      throw new Error('Workflow not found')
    }

    const definitionValidation = validateWorkflowDefinition(request.definition, workflow.engineType)
    if (!definitionValidation.isValid) {
      throw new Error(`Invalid workflow definition: ${definitionValidation.errors[0]?.message}`)
    }

    return this.workflowVersionRepository.create(workflowId, request, userId)
  }

  /**
   * Gets workflow versions
   */
  async getWorkflowVersions(workflowId: string, userId: string): Promise<WorkflowVersion[]> {
    // Check read permissions
    const hasAccess = await this.workflowRepository.hasAccess(workflowId, userId, 'read')
    if (!hasAccess) {
      throw new Error('Insufficient permissions to access workflow versions')
    }

    return this.workflowVersionRepository.findByWorkflowId(workflowId)
  }

  /**
   * Gets a specific workflow version
   */
  async getWorkflowVersion(
    workflowId: string,
    version: number,
    userId: string
  ): Promise<WorkflowVersion | null> {
    // Check read permissions
    const hasAccess = await this.workflowRepository.hasAccess(workflowId, userId, 'read')
    if (!hasAccess) {
      throw new Error('Insufficient permissions to access workflow version')
    }

    return this.workflowVersionRepository.findByVersion(workflowId, version)
  }

  /**
   * Compares two workflow versions
   */
  async compareWorkflowVersions(
    workflowId: string,
    version1: number,
    version2: number,
    userId: string
  ): Promise<any> {
    // Check read permissions
    const hasAccess = await this.workflowRepository.hasAccess(workflowId, userId, 'read')
    if (!hasAccess) {
      throw new Error('Insufficient permissions to compare workflow versions')
    }

    return this.workflowVersionRepository.compareVersions(workflowId, version1, version2)
  }

  /**
   * Shares a workflow with another user
   */
  async shareWorkflow(
    workflowId: string,
    request: ShareWorkflowRequest,
    userId: string
  ): Promise<WorkflowCollaborator> {
    // Check if user is owner or has sharing permissions
    const isOwner = await this.workflowRepository.isOwner(workflowId, userId)
    if (!isOwner) {
      throw new Error('Only workflow owners can share workflows')
    }

    return this.workflowCollaboratorRepository.addCollaborator(workflowId, request)
  }

  /**
   * Removes a collaborator from a workflow
   */
  async removeCollaborator(
    workflowId: string,
    collaboratorUserId: string,
    userId: string
  ): Promise<void> {
    // Check if user is owner
    const isOwner = await this.workflowRepository.isOwner(workflowId, userId)
    if (!isOwner) {
      throw new Error('Only workflow owners can remove collaborators')
    }

    return this.workflowCollaboratorRepository.removeCollaborator(workflowId, collaboratorUserId)
  }

  /**
   * Updates a collaborator's role
   */
  async updateCollaboratorRole(
    workflowId: string,
    collaboratorUserId: string,
    role: string,
    userId: string
  ): Promise<WorkflowCollaborator> {
    // Check if user is owner
    const isOwner = await this.workflowRepository.isOwner(workflowId, userId)
    if (!isOwner) {
      throw new Error('Only workflow owners can update collaborator roles')
    }

    return this.workflowCollaboratorRepository.updateCollaboratorRole(workflowId, collaboratorUserId, role)
  }

  /**
   * Gets workflow collaborators
   */
  async getWorkflowCollaborators(workflowId: string, userId: string): Promise<WorkflowCollaborator[]> {
    // Check read permissions
    const hasAccess = await this.workflowRepository.hasAccess(workflowId, userId, 'read')
    if (!hasAccess) {
      throw new Error('Insufficient permissions to view workflow collaborators')
    }

    return this.workflowCollaboratorRepository.findByWorkflowId(workflowId)
  }

  /**
   * Gets workflows where user is a collaborator
   */
  async getCollaboratedWorkflows(userId: string): Promise<WorkflowCollaborator[]> {
    return this.workflowCollaboratorRepository.findByUserId(userId)
  }

  /**
   * Validates a workflow definition
   */
  validateWorkflowDefinition(definition: any, engineType: any): ValidationResult {
    return validateWorkflowDefinition(definition, engineType)
  }
}