import Joi from 'joi'
import { 
  EngineType, 
  WorkflowDefinition, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning 
} from '../types/workflow.types'

// Base workflow definition schema
const baseWorkflowSchema = Joi.object({
  nodes: Joi.array().items(Joi.object()).optional(),
  edges: Joi.array().items(Joi.object()).optional(),
  variables: Joi.object().optional(),
  settings: Joi.object().optional(),
  metadata: Joi.object().optional()
})

// Langflow-specific validation schema
const langflowSchema = baseWorkflowSchema.keys({
  nodes: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      type: Joi.string().required(),
      position: Joi.object({
        x: Joi.number().required(),
        y: Joi.number().required()
      }).required(),
      data: Joi.object().required()
    })
  ).required(),
  edges: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      source: Joi.string().required(),
      target: Joi.string().required(),
      sourceHandle: Joi.string().optional(),
      targetHandle: Joi.string().optional()
    })
  ).optional()
})

// N8N-specific validation schema
const n8nSchema = baseWorkflowSchema.keys({
  nodes: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().required(),
      type: Joi.string().required(),
      typeVersion: Joi.number().optional(),
      position: Joi.array().items(Joi.number()).length(2).required(),
      parameters: Joi.object().optional(),
      credentials: Joi.object().optional()
    })
  ).required(),
  connections: Joi.object().optional(),
  settings: Joi.object({
    executionOrder: Joi.string().valid('v0', 'v1').optional()
  }).optional()
})

// LangSmith-specific validation schema
const langsmithSchema = baseWorkflowSchema.keys({
  nodes: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      type: Joi.string().valid('llm', 'chain', 'tool', 'prompt').required(),
      config: Joi.object().required(),
      inputs: Joi.object().optional(),
      outputs: Joi.object().optional()
    })
  ).required(),
  chains: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      type: Joi.string().required(),
      steps: Joi.array().items(Joi.string()).required()
    })
  ).optional()
})

/**
 * Validates a workflow definition based on its engine type
 */
export function validateWorkflowDefinition(
  definition: WorkflowDefinition,
  engineType: EngineType
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  try {
    // Get the appropriate schema based on engine type
    let schema: Joi.ObjectSchema
    switch (engineType) {
      case EngineType.LANGFLOW:
        schema = langflowSchema
        break
      case EngineType.N8N:
        schema = n8nSchema
        break
      case EngineType.LANGSMITH:
        schema = langsmithSchema
        break
      default:
        errors.push({
          code: 'INVALID_ENGINE_TYPE',
          message: `Unsupported engine type: ${engineType}`,
          severity: 'error'
        })
        return { isValid: false, errors, warnings }
    }

    // Validate against schema
    const { error } = schema.validate(definition, { abortEarly: false })
    
    if (error) {
      error.details.forEach(detail => {
        errors.push({
          code: 'SCHEMA_VALIDATION_ERROR',
          message: detail.message,
          path: detail.path?.join('.'),
          severity: 'error'
        })
      })
    }

    // Engine-specific validations
    switch (engineType) {
      case EngineType.LANGFLOW:
        validateLangflowSpecific(definition, errors, warnings)
        break
      case EngineType.N8N:
        validateN8NSpecific(definition, errors, warnings)
        break
      case EngineType.LANGSMITH:
        validateLangSmithSpecific(definition, errors, warnings)
        break
    }

  } catch (err) {
    errors.push({
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      severity: 'error'
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Langflow-specific validation logic
 */
function validateLangflowSpecific(
  definition: WorkflowDefinition,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { nodes = [], edges = [] } = definition

  // Check for disconnected nodes
  const connectedNodeIds = new Set<string>()
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  })

  nodes.forEach(node => {
    if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
      warnings.push({
        code: 'DISCONNECTED_NODE',
        message: `Node '${node.id}' is not connected to any other nodes`,
        path: `nodes.${node.id}`,
        severity: 'warning'
      })
    }
  })

  // Check for circular dependencies
  if (hasCircularDependency(nodes, edges)) {
    errors.push({
      code: 'CIRCULAR_DEPENDENCY',
      message: 'Workflow contains circular dependencies',
      severity: 'error'
    })
  }
}

/**
 * N8N-specific validation logic
 */
function validateN8NSpecific(
  definition: WorkflowDefinition,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { nodes = [] } = definition

  // Check for trigger nodes
  const triggerNodes = nodes.filter(node => 
    node.type?.includes('trigger') || node.type === 'n8n-nodes-base.start'
  )

  if (triggerNodes.length === 0) {
    warnings.push({
      code: 'NO_TRIGGER_NODE',
      message: 'Workflow has no trigger nodes - it may not execute automatically',
      severity: 'warning'
    })
  }

  // Check for required credentials
  nodes.forEach((node, index) => {
    if (node.credentials && Object.keys(node.credentials).length === 0) {
      warnings.push({
        code: 'MISSING_CREDENTIALS',
        message: `Node '${node.name}' may require credentials`,
        path: `nodes.${index}`,
        severity: 'warning'
      })
    }
  })
}

/**
 * LangSmith-specific validation logic
 */
function validateLangSmithSpecific(
  definition: WorkflowDefinition,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const { nodes = [], chains = [] } = definition

  // Check for LLM nodes configuration
  const llmNodes = nodes.filter(node => node.type === 'llm')
  llmNodes.forEach((node, index) => {
    if (!node.config?.model) {
      errors.push({
        code: 'MISSING_LLM_MODEL',
        message: `LLM node '${node.id}' is missing model configuration`,
        path: `nodes.${index}.config.model`,
        severity: 'error'
      })
    }
  })

  // Check chain references
  chains?.forEach((chain, chainIndex) => {
    chain.steps?.forEach((stepId, stepIndex) => {
      const referencedNode = nodes.find(node => node.id === stepId)
      if (!referencedNode) {
        errors.push({
          code: 'INVALID_CHAIN_REFERENCE',
          message: `Chain '${chain.id}' references non-existent node '${stepId}'`,
          path: `chains.${chainIndex}.steps.${stepIndex}`,
          severity: 'error'
        })
      }
    })
  })
}

/**
 * Detects circular dependencies in workflow graph
 */
function hasCircularDependency(nodes: any[], edges: any[]): boolean {
  const graph = new Map<string, string[]>()
  
  // Build adjacency list
  nodes.forEach(node => graph.set(node.id, []))
  edges.forEach(edge => {
    const neighbors = graph.get(edge.source) || []
    neighbors.push(edge.target)
    graph.set(edge.source, neighbors)
  })

  // DFS to detect cycles
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    recursionStack.add(nodeId)

    const neighbors = graph.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true
    }

    recursionStack.delete(nodeId)
    return false
  }

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId) && hasCycle(nodeId)) {
      return true
    }
  }

  return false
}

/**
 * Validates workflow name
 */
export function validateWorkflowName(name: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (!name || name.trim().length === 0) {
    errors.push({
      code: 'EMPTY_NAME',
      message: 'Workflow name cannot be empty',
      severity: 'error'
    })
  }

  if (name.length > 100) {
    errors.push({
      code: 'NAME_TOO_LONG',
      message: 'Workflow name cannot exceed 100 characters',
      severity: 'error'
    })
  }

  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    errors.push({
      code: 'INVALID_NAME_CHARACTERS',
      message: 'Workflow name can only contain letters, numbers, spaces, hyphens, and underscores',
      severity: 'error'
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validates workflow tags
 */
export function validateWorkflowTags(tags: string[]): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (tags.length > 10) {
    warnings.push({
      code: 'TOO_MANY_TAGS',
      message: 'Consider using fewer than 10 tags for better organization',
      severity: 'warning'
    })
  }

  tags.forEach((tag, index) => {
    if (tag.length > 50) {
      errors.push({
        code: 'TAG_TOO_LONG',
        message: `Tag at index ${index} exceeds 50 characters`,
        path: `tags.${index}`,
        severity: 'error'
      })
    }

    if (!/^[a-zA-Z0-9\-_]+$/.test(tag)) {
      errors.push({
        code: 'INVALID_TAG_CHARACTERS',
        message: `Tag '${tag}' contains invalid characters`,
        path: `tags.${index}`,
        severity: 'error'
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}