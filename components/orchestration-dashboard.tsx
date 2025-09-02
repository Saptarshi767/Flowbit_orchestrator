"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { RecentExecutions } from "@/components/dashboard/recent-executions"
import { WorkflowOverview } from "@/components/dashboard/workflow-overview"
import { ExecutionStatus, EngineType } from "@/types/workflow"

// Mock data - in real app this would come from API
const mockStats = {
  totalWorkflows: 24,
  activeExecutions: 3,
  successfulExecutions: 156,
  failedExecutions: 8,
  avgExecutionTime: 45,
  executionsToday: 32
}

const mockExecutions = [
  {
    id: "1",
    workflowId: "wf-1",
    workflowName: "Customer Data Processing",
    status: ExecutionStatus.RUNNING,
    startTime: new Date(Date.now() - 300000), // 5 minutes ago
    engineType: EngineType.LANGFLOW,
    triggeredBy: "john.doe@example.com"
  },
  {
    id: "2",
    workflowId: "wf-2",
    workflowName: "Email Campaign Automation",
    status: ExecutionStatus.COMPLETED,
    startTime: new Date(Date.now() - 900000), // 15 minutes ago
    endTime: new Date(Date.now() - 600000), // 10 minutes ago
    duration: 300,
    engineType: EngineType.N8N,
    triggeredBy: "jane.smith@example.com"
  },
  {
    id: "3",
    workflowId: "wf-3",
    workflowName: "Document Analysis Pipeline",
    status: ExecutionStatus.FAILED,
    startTime: new Date(Date.now() - 1800000), // 30 minutes ago
    endTime: new Date(Date.now() - 1500000), // 25 minutes ago
    duration: 180,
    engineType: EngineType.LANGSMITH,
    triggeredBy: "system",
    error: "API rate limit exceeded"
  },
  {
    id: "4",
    workflowId: "wf-4",
    workflowName: "Social Media Monitoring",
    status: ExecutionStatus.COMPLETED,
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(Date.now() - 3300000), // 55 minutes ago
    duration: 120,
    engineType: EngineType.LANGFLOW,
    triggeredBy: "scheduler"
  }
]

const mockWorkflows = [
  {
    id: "wf-1",
    name: "Customer Data Processing",
    description: "Automated pipeline for processing and enriching customer data from multiple sources",
    engineType: EngineType.LANGFLOW,
    version: 3,
    createdBy: "john.doe@example.com",
    createdAt: new Date(Date.now() - 86400000 * 7), // 1 week ago
    updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
    tags: ["data-processing", "customers", "automation"],
    isPublic: false,
    organizationId: "org-1",
    definition: { nodes: [], edges: [] }
  },
  {
    id: "wf-2",
    name: "Email Campaign Automation",
    description: "Automated email marketing campaigns with personalization and A/B testing",
    engineType: EngineType.N8N,
    version: 2,
    createdBy: "jane.smith@example.com",
    createdAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
    updatedAt: new Date(Date.now() - 7200000), // 2 hours ago
    tags: ["email", "marketing", "automation", "personalization"],
    isPublic: true,
    organizationId: "org-1",
    definition: { nodes: [], edges: [] }
  },
  {
    id: "wf-3",
    name: "Document Analysis Pipeline",
    description: "AI-powered document analysis and classification system",
    engineType: EngineType.LANGSMITH,
    version: 1,
    createdBy: "ai.team@example.com",
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    updatedAt: new Date(Date.now() - 86400000), // 1 day ago
    tags: ["ai", "documents", "classification"],
    isPublic: false,
    organizationId: "org-1",
    definition: { nodes: [], edges: [] }
  }
]

export function OrchestrationDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor your AI workflows and executions
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards stats={mockStats} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentExecutions executions={mockExecutions} />
          <WorkflowOverview workflows={mockWorkflows} />
        </div>
      </div>
    </DashboardLayout>
  )
}