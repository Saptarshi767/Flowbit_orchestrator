import {
  Workflow,
  WorkflowVersion,
  WorkflowCollaborator,
  Execution,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  CreateWorkflowVersionRequest,
  ShareWorkflowRequest,
  WorkflowSearchOptions,
  WorkflowSearchResult,
  WorkflowStats
} from '../../types/workflow.types'

export interface IWorkflowRepository {
  // Workflow CRUD operations
  create(request: CreateWorkflowRequest, userId: string, organizationId: string): Promise<Workflow>
  findById(id: string): Promise<Workflow | null>
  findByIdWithVersions(id: string): Promise<Workflow & { versions: WorkflowVersion[] } | null>
  update(id: string, request: UpdateWorkflowRequest, userId: string): Promise<Workflow>
  delete(id: string, userId: string): Promise<void>
  
  // Search and filtering
  search(options: WorkflowSearchOptions): Promise<WorkflowSearchResult>
  findByOrganization(organizationId: string, limit?: number, offset?: number): Promise<Workflow[]>
  findByUser(userId: string, limit?: number, offset?: number): Promise<Workflow[]>
  findByTags(tags: string[], organizationId?: string): Promise<Workflow[]>
  
  // Workflow statistics
  getStats(organizationId?: string): Promise<WorkflowStats>
  getWorkflowCount(organizationId?: string): Promise<number>
  
  // Access control
  hasAccess(workflowId: string, userId: string, permission: 'read' | 'write' | 'delete'): Promise<boolean>
  isOwner(workflowId: string, userId: string): Promise<boolean>
}

export interface IWorkflowVersionRepository {
  // Version management
  create(workflowId: string, request: CreateWorkflowVersionRequest, userId: string): Promise<WorkflowVersion>
  findByWorkflowId(workflowId: string): Promise<WorkflowVersion[]>
  findByVersion(workflowId: string, version: number): Promise<WorkflowVersion | null>
  getLatestVersion(workflowId: string): Promise<WorkflowVersion | null>
  getNextVersionNumber(workflowId: string): Promise<number>
  
  // Version comparison
  compareVersions(workflowId: string, version1: number, version2: number): Promise<any>
  getVersionHistory(workflowId: string, limit?: number): Promise<WorkflowVersion[]>
}

export interface IWorkflowCollaboratorRepository {
  // Collaboration management
  addCollaborator(workflowId: string, request: ShareWorkflowRequest): Promise<WorkflowCollaborator>
  removeCollaborator(workflowId: string, userId: string): Promise<void>
  updateCollaboratorRole(workflowId: string, userId: string, role: string): Promise<WorkflowCollaborator>
  
  // Collaborator queries
  findByWorkflowId(workflowId: string): Promise<WorkflowCollaborator[]>
  findByUserId(userId: string): Promise<WorkflowCollaborator[]>
  getCollaboratorRole(workflowId: string, userId: string): Promise<string | null>
  
  // Permission checks
  canRead(workflowId: string, userId: string): Promise<boolean>
  canWrite(workflowId: string, userId: string): Promise<boolean>
  canDelete(workflowId: string, userId: string): Promise<boolean>
}

export interface IExecutionRepository {
  // Execution CRUD
  create(execution: Omit<Execution, 'id' | 'createdAt' | 'updatedAt'>): Promise<Execution>
  findById(id: string): Promise<Execution | null>
  update(id: string, updates: Partial<Execution>): Promise<Execution>
  delete(id: string): Promise<void>
  
  // Execution queries
  findByWorkflowId(workflowId: string, limit?: number, offset?: number): Promise<Execution[]>
  findByUserId(userId: string, limit?: number, offset?: number): Promise<Execution[]>
  findByStatus(status: string, limit?: number, offset?: number): Promise<Execution[]>
  findByOrganization(organizationId: string, limit?: number, offset?: number): Promise<Execution[]>
  
  // Execution statistics
  getExecutionStats(workflowId?: string, organizationId?: string): Promise<any>
  getRecentExecutions(limit?: number): Promise<Execution[]>
}