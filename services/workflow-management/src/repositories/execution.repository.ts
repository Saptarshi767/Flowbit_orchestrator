import { PrismaClient } from '@prisma/client'
import { Execution, ExecutionStatus } from '../types/workflow.types'
import { IExecutionRepository } from './interfaces/workflow.repository.interface'

export class ExecutionRepository implements IExecutionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(execution: Omit<Execution, 'id' | 'createdAt' | 'updatedAt'>): Promise<Execution> {
    const created = await this.prisma.execution.create({
      data: {
        workflowId: execution.workflowId,
        workflowVersion: execution.workflowVersion,
        status: execution.status,
        parameters: execution.parameters,
        result: execution.result,
        logs: execution.logs,
        metrics: execution.metrics,
        startTime: execution.startTime,
        endTime: execution.endTime,
        executorId: execution.executorId,
        userId: execution.userId,
        organizationId: execution.organizationId
      }
    })

    return this.mapToExecution(created)
  }

  async findById(id: string): Promise<Execution | null> {
    const execution = await this.prisma.execution.findUnique({
      where: { id }
    })

    return execution ? this.mapToExecution(execution) : null
  }

  async update(id: string, updates: Partial<Execution>): Promise<Execution> {
    const updated = await this.prisma.execution.update({
      where: { id },
      data: {
        ...(updates.status && { status: updates.status }),
        ...(updates.result !== undefined && { result: updates.result }),
        ...(updates.logs !== undefined && { logs: updates.logs }),
        ...(updates.metrics !== undefined && { metrics: updates.metrics }),
        ...(updates.endTime !== undefined && { endTime: updates.endTime }),
        ...(updates.executorId !== undefined && { executorId: updates.executorId }),
        updatedAt: new Date()
      }
    })

    return this.mapToExecution(updated)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.execution.delete({
      where: { id }
    })
  }

  async findByWorkflowId(
    workflowId: string,
    limit = 20,
    offset = 0
  ): Promise<Execution[]> {
    const executions = await this.prisma.execution.findMany({
      where: { workflowId },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset
    })

    return executions.map(e => this.mapToExecution(e))
  }

  async findByUserId(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<Execution[]> {
    const executions = await this.prisma.execution.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset
    })

    return executions.map(e => this.mapToExecution(e))
  }

  async findByStatus(
    status: string,
    limit = 20,
    offset = 0
  ): Promise<Execution[]> {
    const executions = await this.prisma.execution.findMany({
      where: { status: status as ExecutionStatus },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset
    })

    return executions.map(e => this.mapToExecution(e))
  }

  async findByOrganization(
    organizationId: string,
    limit = 20,
    offset = 0
  ): Promise<Execution[]> {
    const executions = await this.prisma.execution.findMany({
      where: { organizationId },
      orderBy: { startTime: 'desc' },
      take: limit,
      skip: offset
    })

    return executions.map(e => this.mapToExecution(e))
  }

  async getExecutionStats(
    workflowId?: string,
    organizationId?: string
  ): Promise<any> {
    const where: any = {}
    
    if (workflowId) where.workflowId = workflowId
    if (organizationId) where.organizationId = organizationId

    const [
      totalExecutions,
      executionsByStatus,
      recentExecutions,
      avgDuration
    ] = await Promise.all([
      this.prisma.execution.count({ where }),
      this.prisma.execution.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      this.prisma.execution.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
          workflowId: true
        }
      }),
      this.calculateAverageExecutionTime(where)
    ])

    const statusCounts = Object.values(ExecutionStatus).reduce((acc, status) => {
      acc[status] = executionsByStatus.find(e => e.status === status)?._count.status || 0
      return acc
    }, {} as Record<ExecutionStatus, number>)

    return {
      totalExecutions,
      executionsByStatus: statusCounts,
      recentExecutions,
      averageExecutionTime: avgDuration,
      successRate: totalExecutions > 0 
        ? (statusCounts[ExecutionStatus.COMPLETED] / totalExecutions) * 100 
        : 0
    }
  }

  async getRecentExecutions(limit = 10): Promise<Execution[]> {
    const executions = await this.prisma.execution.findMany({
      orderBy: { startTime: 'desc' },
      take: limit,
      include: {
        workflow: {
          select: {
            name: true,
            engineType: true
          }
        }
      }
    })

    return executions.map(e => ({
      ...this.mapToExecution(e),
      workflow: e.workflow
    }))
  }

  private async calculateAverageExecutionTime(where: any): Promise<number> {
    const completedExecutions = await this.prisma.execution.findMany({
      where: {
        ...where,
        status: ExecutionStatus.COMPLETED,
        endTime: { not: null }
      },
      select: {
        startTime: true,
        endTime: true
      }
    })

    if (completedExecutions.length === 0) return 0

    const totalDuration = completedExecutions.reduce((sum, exec) => {
      const duration = exec.endTime!.getTime() - exec.startTime.getTime()
      return sum + duration
    }, 0)

    return totalDuration / completedExecutions.length
  }

  private mapToExecution(prismaExecution: any): Execution {
    return {
      id: prismaExecution.id,
      workflowId: prismaExecution.workflowId,
      workflowVersion: prismaExecution.workflowVersion,
      status: prismaExecution.status,
      parameters: prismaExecution.parameters,
      result: prismaExecution.result,
      logs: prismaExecution.logs,
      metrics: prismaExecution.metrics,
      startTime: prismaExecution.startTime,
      endTime: prismaExecution.endTime,
      executorId: prismaExecution.executorId,
      userId: prismaExecution.userId,
      organizationId: prismaExecution.organizationId,
      createdAt: prismaExecution.createdAt,
      updatedAt: prismaExecution.updatedAt
    }
  }
}