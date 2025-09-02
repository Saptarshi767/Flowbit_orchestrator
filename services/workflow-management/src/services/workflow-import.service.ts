import {
  WorkflowImportRequest,
  EngineType,
  WorkflowDefinition,
  ValidationResult,
  Workflow,
  CreateWorkflowRequest
} from '../types/workflow.types'
import { WorkflowService } from './workflow.service'
import { validateWorkflowDefinition } from '../utils/validation.utils'

export class WorkflowImportService {
  constructor(private workflowService: WorkflowService) {}

  /**
   * Import workflow from different engines
   */
  async importWorkflow(
    request: WorkflowImportRequest,
    userId: string,
    organizationId: string
  ): Promise<Workflow> {
    // Convert source to workflow definition based on engine type
    const definition = await this.convertToWorkflowDefinition(request.source, request.engineType)
    
    // Validate the converted definition
    const validation = validateWorkflowDefinition(definition, request.engineType)
    if (!validation.isValid) {
      throw new Error(`Invalid workflow definition: ${validation.errors[0]?.message}`)
    }

    // Create workflow request
    const createRequest: CreateWorkflowRequest = {
      name: request.name || this.extractWorkflowName(request.source, request.engineType),
      description: request.description || this.extractWorkflowDescription(request.source, request.engineType),
      engineType: request.engineType,
      definition,
      tags: this.extractWorkflowTags(request.source, request.engineType)
    }

    return this.workflowService.createWorkflow(createRequest, userId, organizationId)
  }

  /**
   * Convert source format to standardized workflow definition
   */
  private async convertToWorkflowDefinition(
    source: any,
    engineType: EngineType
  ): Promise<WorkflowDefinition> {
    switch (engineType) {
      case EngineType.LANGFLOW:
        return this.convertLangflowToDefinition(source)
      case EngineType.N8N:
        return this.convertN8NToDefinition(source)
      case EngineType.LANGSMITH:
        return this.convertLangSmithToDefinition(source)
      default:
        throw new Error(`Unsupported engine type: ${engineType}`)
    }
  }

  /**
   * Convert Langflow format to workflow definition
   */
  private convertLangflowToDefinition(source: any): WorkflowDefinition {
    // Langflow typically uses a flow structure with nodes and edges
    if (!source.data || !source.data.nodes) {
      throw new Error('Invalid Langflow format: missing nodes')
    }

    return {
      nodes: source.data.nodes.map((node: any) => ({
        id: node.id,
        type: node.data?.type || 'unknown',
        position: node.position,
        data: {
          ...node.data,
          template: node.data?.template || {}
        }
      })),
      edges: source.data.edges?.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
      })) || [],
      variables: source.data.variables || {},
      settings: {
        langflowVersion: source.version,
        originalId: source.id
      },
      metadata: {
        importedFrom: 'langflow',
        importedAt: new Date().toISOString(),
        originalFormat: 'langflow'
      }
    }
  }

  /**
   * Convert N8N format to workflow definition
   */
  private convertN8NToDefinition(source: any): WorkflowDefinition {
    // N8N uses a workflow structure with nodes and connections
    if (!source.nodes) {
      throw new Error('Invalid N8N format: missing nodes')
    }

    return {
      nodes: source.nodes.map((node: any) => ({
        id: node.name,
        type: node.type,
        position: node.position,
        data: {
          parameters: node.parameters || {},
          credentials: node.credentials || {},
          typeVersion: node.typeVersion
        }
      })),
      edges: source.connections ? this.convertN8NConnections(source.connections) : [],
      variables: source.settings?.variables || {},
      settings: {
        n8nVersion: source.meta?.n8nVersion,
        originalId: source.id,
        active: source.active,
        settings: source.settings
      },
      metadata: {
        importedFrom: 'n8n',
        importedAt: new Date().toISOString(),
        originalFormat: 'n8n'
      }
    }
  }

  /**
   * Convert N8N connections to edges format
   */
  private convertN8NConnections(connections: any): any[] {
    const edges: any[] = []
    
    Object.keys(connections).forEach(sourceNode => {
      const nodeConnections = connections[sourceNode]
      Object.keys(nodeConnections).forEach(outputIndex => {
        const outputs = nodeConnections[outputIndex]
        outputs.forEach((connection: any, index: number) => {
          edges.push({
            id: `${sourceNode}-${outputIndex}-${connection.node}-${connection.type}-${index}`,
            source: sourceNode,
            target: connection.node,
            sourceHandle: outputIndex,
            targetHandle: connection.type
          })
        })
      })
    })

    return edges
  }

  /**
   * Convert LangSmith format to workflow definition
   */
  private convertLangSmithToDefinition(source: any): WorkflowDefinition {
    // LangSmith typically uses chain definitions
    if (!source.chain && !source.steps) {
      throw new Error('Invalid LangSmith format: missing chain or steps')
    }

    const nodes = []
    const edges = []

    if (source.steps) {
      // Convert steps to nodes
      source.steps.forEach((step: any, index: number) => {
        nodes.push({
          id: step.id || `step-${index}`,
          type: step.type || 'langsmith-step',
          position: { x: index * 200, y: 100 },
          data: {
            config: step.config || {},
            inputs: step.inputs || {},
            outputs: step.outputs || {}
          }
        })

        // Create edges between sequential steps
        if (index > 0) {
          edges.push({
            id: `edge-${index - 1}-${index}`,
            source: source.steps[index - 1].id || `step-${index - 1}`,
            target: step.id || `step-${index}`,
            sourceHandle: 'output',
            targetHandle: 'input'
          })
        }
      })
    }

    return {
      nodes,
      edges,
      variables: source.variables || {},
      settings: {
        langsmithVersion: source.version,
        originalId: source.id,
        chainType: source.chain?.type
      },
      metadata: {
        importedFrom: 'langsmith',
        importedAt: new Date().toISOString(),
        originalFormat: 'langsmith'
      }
    }
  }

  /**
   * Extract workflow name from source
   */
  private extractWorkflowName(source: any, engineType: EngineType): string {
    switch (engineType) {
      case EngineType.LANGFLOW:
        return source.name || source.data?.name || 'Imported Langflow Workflow'
      case EngineType.N8N:
        return source.name || 'Imported N8N Workflow'
      case EngineType.LANGSMITH:
        return source.name || source.chain?.name || 'Imported LangSmith Workflow'
      default:
        return 'Imported Workflow'
    }
  }

  /**
   * Extract workflow description from source
   */
  private extractWorkflowDescription(source: any, engineType: EngineType): string {
    switch (engineType) {
      case EngineType.LANGFLOW:
        return source.description || source.data?.description || 'Workflow imported from Langflow'
      case EngineType.N8N:
        return source.description || 'Workflow imported from N8N'
      case EngineType.LANGSMITH:
        return source.description || source.chain?.description || 'Workflow imported from LangSmith'
      default:
        return 'Imported workflow'
    }
  }

  /**
   * Extract workflow tags from source
   */
  private extractWorkflowTags(source: any, engineType: EngineType): string[] {
    const tags = [`imported-${engineType.toLowerCase()}`]
    
    switch (engineType) {
      case EngineType.LANGFLOW:
        if (source.tags) tags.push(...source.tags)
        if (source.data?.tags) tags.push(...source.data.tags)
        break
      case EngineType.N8N:
        if (source.tags) tags.push(...source.tags)
        break
      case EngineType.LANGSMITH:
        if (source.tags) tags.push(...source.tags)
        if (source.chain?.tags) tags.push(...source.chain.tags)
        break
    }

    return [...new Set(tags)] // Remove duplicates
  }

  /**
   * Validate imported workflow
   */
  async validateImportedWorkflow(
    source: any,
    engineType: EngineType
  ): Promise<ValidationResult> {
    try {
      const definition = await this.convertToWorkflowDefinition(source, engineType)
      return validateWorkflowDefinition(definition, engineType)
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          code: 'IMPORT_ERROR',
          message: error.message,
          severity: 'error' as const
        }],
        warnings: []
      }
    }
  }

  /**
   * Get supported import formats for an engine
   */
  getSupportedFormats(engineType: EngineType): string[] {
    switch (engineType) {
      case EngineType.LANGFLOW:
        return ['json', 'langflow']
      case EngineType.N8N:
        return ['json', 'n8n']
      case EngineType.LANGSMITH:
        return ['json', 'yaml', 'langsmith']
      default:
        return ['json']
    }
  }
}