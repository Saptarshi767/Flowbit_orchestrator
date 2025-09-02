import {
  WorkflowDefinition,
  WorkflowVersion,
  ValidationResult
} from '../types/workflow.types'

export interface ConflictResolution {
  conflictId: string
  workflowId: string
  baseVersion: number
  conflictingVersions: ConflictingVersion[]
  resolvedDefinition?: WorkflowDefinition
  status: 'pending' | 'resolved' | 'rejected'
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
}

export interface ConflictingVersion {
  version: number
  userId: string
  definition: WorkflowDefinition
  timestamp: Date
  changes: WorkflowChange[]
}

export interface WorkflowChange {
  type: 'node_added' | 'node_removed' | 'node_modified' | 'edge_added' | 'edge_removed' | 'edge_modified' | 'property_changed'
  path: string
  oldValue?: any
  newValue?: any
  nodeId?: string
  edgeId?: string
}

export interface MergeStrategy {
  strategy: 'auto' | 'manual' | 'last_writer_wins' | 'first_writer_wins'
  conflictResolution?: 'prefer_local' | 'prefer_remote' | 'merge_both'
}

export class ConflictResolutionService {
  private conflicts: Map<string, ConflictResolution> = new Map()

  /**
   * Detect conflicts between workflow versions
   */
  detectConflicts(
    baseVersion: WorkflowVersion,
    version1: WorkflowVersion,
    version2: WorkflowVersion
  ): ConflictResolution | null {
    const changes1 = this.calculateChanges(baseVersion.definition, version1.definition)
    const changes2 = this.calculateChanges(baseVersion.definition, version2.definition)

    const conflicts = this.findConflictingChanges(changes1, changes2)
    
    if (conflicts.length === 0) {
      return null // No conflicts
    }

    const conflictResolution: ConflictResolution = {
      conflictId: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowId: baseVersion.workflowId,
      baseVersion: baseVersion.version,
      conflictingVersions: [
        {
          version: version1.version,
          userId: version1.createdBy,
          definition: version1.definition,
          timestamp: version1.createdAt,
          changes: changes1
        },
        {
          version: version2.version,
          userId: version2.createdBy,
          definition: version2.definition,
          timestamp: version2.createdAt,
          changes: changes2
        }
      ],
      status: 'pending',
      createdAt: new Date()
    }

    this.conflicts.set(conflictResolution.conflictId, conflictResolution)
    return conflictResolution
  }

  /**
   * Attempt automatic merge of workflow definitions
   */
  attemptAutoMerge(
    baseDefinition: WorkflowDefinition,
    definition1: WorkflowDefinition,
    definition2: WorkflowDefinition,
    strategy: MergeStrategy = { strategy: 'auto' }
  ): { success: boolean; mergedDefinition?: WorkflowDefinition; conflicts?: string[] } {
    try {
      const changes1 = this.calculateChanges(baseDefinition, definition1)
      const changes2 = this.calculateChanges(baseDefinition, definition2)
      
      const conflictingChanges = this.findConflictingChanges(changes1, changes2)
      
      if (conflictingChanges.length > 0 && strategy.strategy === 'auto') {
        return { success: false, conflicts: conflictingChanges.map(c => c.path) }
      }

      // Start with base definition
      const mergedDefinition: WorkflowDefinition = JSON.parse(JSON.stringify(baseDefinition))

      // Apply non-conflicting changes from both versions
      const allChanges = [...changes1, ...changes2]
      const nonConflictingChanges = allChanges.filter(change => 
        !conflictingChanges.some(conflict => conflict.path === change.path)
      )

      this.applyChanges(mergedDefinition, nonConflictingChanges)

      // Handle conflicts based on strategy
      if (conflictingChanges.length > 0) {
        this.resolveConflicts(mergedDefinition, conflictingChanges, strategy)
      }

      return { success: true, mergedDefinition }
    } catch (error) {
      return { success: false, conflicts: [`Merge failed: ${error.message}`] }
    }
  }

  /**
   * Resolve conflicts manually
   */
  resolveConflictManually(
    conflictId: string,
    resolvedDefinition: WorkflowDefinition,
    userId: string
  ): ConflictResolution {
    const conflict = this.conflicts.get(conflictId)
    if (!conflict) {
      throw new Error('Conflict not found')
    }

    if (conflict.status !== 'pending') {
      throw new Error('Conflict already resolved')
    }

    conflict.resolvedDefinition = resolvedDefinition
    conflict.status = 'resolved'
    conflict.resolvedAt = new Date()
    conflict.resolvedBy = userId

    this.conflicts.set(conflictId, conflict)
    return conflict
  }

  /**
   * Get conflict by ID
   */
  getConflict(conflictId: string): ConflictResolution | null {
    return this.conflicts.get(conflictId) || null
  }

  /**
   * Get conflicts for a workflow
   */
  getWorkflowConflicts(workflowId: string): ConflictResolution[] {
    return Array.from(this.conflicts.values())
      .filter(conflict => conflict.workflowId === workflowId)
  }

  /**
   * Calculate changes between two workflow definitions
   */
  private calculateChanges(
    baseDefinition: WorkflowDefinition,
    newDefinition: WorkflowDefinition
  ): WorkflowChange[] {
    const changes: WorkflowChange[] = []

    // Compare nodes
    const baseNodes = baseDefinition.nodes || []
    const newNodes = newDefinition.nodes || []

    // Find added nodes
    newNodes.forEach(node => {
      if (!baseNodes.find(n => n.id === node.id)) {
        changes.push({
          type: 'node_added',
          path: `nodes.${node.id}`,
          newValue: node,
          nodeId: node.id
        })
      }
    })

    // Find removed nodes
    baseNodes.forEach(node => {
      if (!newNodes.find(n => n.id === node.id)) {
        changes.push({
          type: 'node_removed',
          path: `nodes.${node.id}`,
          oldValue: node,
          nodeId: node.id
        })
      }
    })

    // Find modified nodes
    baseNodes.forEach(baseNode => {
      const newNode = newNodes.find(n => n.id === baseNode.id)
      if (newNode && JSON.stringify(baseNode) !== JSON.stringify(newNode)) {
        changes.push({
          type: 'node_modified',
          path: `nodes.${baseNode.id}`,
          oldValue: baseNode,
          newValue: newNode,
          nodeId: baseNode.id
        })
      }
    })

    // Compare edges
    const baseEdges = baseDefinition.edges || []
    const newEdges = newDefinition.edges || []

    // Find added edges
    newEdges.forEach(edge => {
      if (!baseEdges.find(e => e.id === edge.id)) {
        changes.push({
          type: 'edge_added',
          path: `edges.${edge.id}`,
          newValue: edge,
          edgeId: edge.id
        })
      }
    })

    // Find removed edges
    baseEdges.forEach(edge => {
      if (!newEdges.find(e => e.id === edge.id)) {
        changes.push({
          type: 'edge_removed',
          path: `edges.${edge.id}`,
          oldValue: edge,
          edgeId: edge.id
        })
      }
    })

    // Find modified edges
    baseEdges.forEach(baseEdge => {
      const newEdge = newEdges.find(e => e.id === baseEdge.id)
      if (newEdge && JSON.stringify(baseEdge) !== JSON.stringify(newEdge)) {
        changes.push({
          type: 'edge_modified',
          path: `edges.${baseEdge.id}`,
          oldValue: baseEdge,
          newValue: newEdge,
          edgeId: baseEdge.id
        })
      }
    })

    // Compare other properties
    const propertiesToCompare = ['variables', 'settings', 'metadata']
    propertiesToCompare.forEach(prop => {
      const baseProp = (baseDefinition as any)[prop]
      const newProp = (newDefinition as any)[prop]
      
      if (JSON.stringify(baseProp) !== JSON.stringify(newProp)) {
        changes.push({
          type: 'property_changed',
          path: prop,
          oldValue: baseProp,
          newValue: newProp
        })
      }
    })

    return changes
  }

  /**
   * Find conflicting changes between two change sets
   */
  private findConflictingChanges(
    changes1: WorkflowChange[],
    changes2: WorkflowChange[]
  ): WorkflowChange[] {
    const conflicts: WorkflowChange[] = []

    changes1.forEach(change1 => {
      const conflictingChange = changes2.find(change2 => 
        change1.path === change2.path && 
        JSON.stringify(change1.newValue) !== JSON.stringify(change2.newValue)
      )
      
      if (conflictingChange) {
        conflicts.push(change1)
      }
    })

    return conflicts
  }

  /**
   * Apply changes to a workflow definition
   */
  private applyChanges(definition: WorkflowDefinition, changes: WorkflowChange[]): void {
    changes.forEach(change => {
      switch (change.type) {
        case 'node_added':
          if (!definition.nodes) definition.nodes = []
          definition.nodes.push(change.newValue)
          break
        case 'node_removed':
          if (definition.nodes) {
            definition.nodes = definition.nodes.filter(n => n.id !== change.nodeId)
          }
          break
        case 'node_modified':
          if (definition.nodes) {
            const nodeIndex = definition.nodes.findIndex(n => n.id === change.nodeId)
            if (nodeIndex >= 0) {
              definition.nodes[nodeIndex] = change.newValue
            }
          }
          break
        case 'edge_added':
          if (!definition.edges) definition.edges = []
          definition.edges.push(change.newValue)
          break
        case 'edge_removed':
          if (definition.edges) {
            definition.edges = definition.edges.filter(e => e.id !== change.edgeId)
          }
          break
        case 'edge_modified':
          if (definition.edges) {
            const edgeIndex = definition.edges.findIndex(e => e.id === change.edgeId)
            if (edgeIndex >= 0) {
              definition.edges[edgeIndex] = change.newValue
            }
          }
          break
        case 'property_changed':
          (definition as any)[change.path] = change.newValue
          break
      }
    })
  }

  /**
   * Resolve conflicts based on strategy
   */
  private resolveConflicts(
    definition: WorkflowDefinition,
    conflicts: WorkflowChange[],
    strategy: MergeStrategy
  ): void {
    conflicts.forEach(conflict => {
      switch (strategy.strategy) {
        case 'last_writer_wins':
          // Apply the change (assuming it's the later one)
          this.applyChanges(definition, [conflict])
          break
        case 'first_writer_wins':
          // Don't apply the change (keep the earlier one)
          break
        case 'manual':
          // Skip - requires manual resolution
          break
        default:
          // Auto strategy - try to merge intelligently
          this.applyChanges(definition, [conflict])
      }
    })
  }
}