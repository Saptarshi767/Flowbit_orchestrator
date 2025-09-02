import { PrismaClient } from '@prisma/client'
import {
  WorkflowVersion,
  CreateWorkflowVersionRequest
} from '../types/workflow.types'
import { IWorkflowVersionRepository } from './interfaces/workflow.repository.interface'

export class WorkflowVersionRepository implements IWorkflowVersionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(
    workflowId: string,
    request: CreateWorkflowVersionRequest,
    userId: string
  ): Promise<WorkflowVersion> {
    // Get next version number
    const nextVersion = await this.getNextVersionNumber(workflowId)

    const version = await this.prisma.workflowVersion.create({
      data: {
        workflowId,
        version: nextVersion,
        definition: request.definition,
        changeLog: request.changeLog || `Version ${nextVersion}`,
        createdBy: userId
      }
    })

    // Update workflow's current version
    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: {
        version: nextVersion,
        definition: request.definition,
        updatedAt: new Date()
      }
    })

    return this.mapToWorkflowVersion(version)
  }

  async findByWorkflowId(workflowId: string): Promise<WorkflowVersion[]> {
    const versions = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' }
    })

    return versions.map(v => this.mapToWorkflowVersion(v))
  }

  async findByVersion(
    workflowId: string,
    version: number
  ): Promise<WorkflowVersion | null> {
    const workflowVersion = await this.prisma.workflowVersion.findUnique({
      where: {
        workflowId_version: {
          workflowId,
          version
        }
      }
    })

    return workflowVersion ? this.mapToWorkflowVersion(workflowVersion) : null
  }

  async getLatestVersion(workflowId: string): Promise<WorkflowVersion | null> {
    const version = await this.prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' }
    })

    return version ? this.mapToWorkflowVersion(version) : null
  }

  async getNextVersionNumber(workflowId: string): Promise<number> {
    const latestVersion = await this.prisma.workflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
      select: { version: true }
    })

    return (latestVersion?.version || 0) + 1
  }

  async compareVersions(
    workflowId: string,
    version1: number,
    version2: number
  ): Promise<any> {
    const [v1, v2] = await Promise.all([
      this.findByVersion(workflowId, version1),
      this.findByVersion(workflowId, version2)
    ])

    if (!v1 || !v2) {
      throw new Error('One or both versions not found')
    }

    return {
      version1: {
        version: v1.version,
        definition: v1.definition,
        changeLog: v1.changeLog,
        createdAt: v1.createdAt,
        createdBy: v1.createdBy
      },
      version2: {
        version: v2.version,
        definition: v2.definition,
        changeLog: v2.changeLog,
        createdAt: v2.createdAt,
        createdBy: v2.createdBy
      },
      differences: this.calculateDifferences(v1.definition, v2.definition)
    }
  }

  async getVersionHistory(
    workflowId: string,
    limit = 10
  ): Promise<WorkflowVersion[]> {
    const versions = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' },
      take: limit
    })

    return versions.map(v => this.mapToWorkflowVersion(v))
  }

  private calculateDifferences(def1: any, def2: any): any {
    // Simple difference calculation
    // In a real implementation, you might use a library like 'deep-diff'
    const changes: any = {
      added: [],
      removed: [],
      modified: []
    }

    // Compare nodes
    const nodes1 = def1.nodes || []
    const nodes2 = def2.nodes || []
    
    const nodeIds1 = new Set(nodes1.map((n: any) => n.id))
    const nodeIds2 = new Set(nodes2.map((n: any) => n.id))

    // Find added nodes
    nodes2.forEach((node: any) => {
      if (!nodeIds1.has(node.id)) {
        changes.added.push({ type: 'node', id: node.id, data: node })
      }
    })

    // Find removed nodes
    nodes1.forEach((node: any) => {
      if (!nodeIds2.has(node.id)) {
        changes.removed.push({ type: 'node', id: node.id, data: node })
      }
    })

    // Find modified nodes
    nodes1.forEach((node1: any) => {
      const node2 = nodes2.find((n: any) => n.id === node1.id)
      if (node2 && JSON.stringify(node1) !== JSON.stringify(node2)) {
        changes.modified.push({
          type: 'node',
          id: node1.id,
          before: node1,
          after: node2
        })
      }
    })

    // Compare edges/connections
    const edges1 = def1.edges || def1.connections || []
    const edges2 = def2.edges || def2.connections || []

    if (JSON.stringify(edges1) !== JSON.stringify(edges2)) {
      changes.modified.push({
        type: 'connections',
        before: edges1,
        after: edges2
      })
    }

    return changes
  }

  private mapToWorkflowVersion(prismaVersion: any): WorkflowVersion {
    return {
      id: prismaVersion.id,
      workflowId: prismaVersion.workflowId,
      version: prismaVersion.version,
      definition: prismaVersion.definition,
      changeLog: prismaVersion.changeLog,
      createdBy: prismaVersion.createdBy,
      createdAt: prismaVersion.createdAt
    }
  }
}