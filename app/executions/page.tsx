"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  Filter, 
  Eye, 
  RotateCcw, 
  X, 
  Play,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  Calendar,
  User,
  Workflow
} from "lucide-react"
import { ExecutionStatus, Execution, EngineType } from "@/types/workflow"
import { formatDistanceToNow, format } from "date-fns"

// Mock data
const mockExecutions: Execution[] = [
  {
    id: "exec-1",
    workflowId: "wf-1",
    workflowName: "Customer Data Processing",
    status: ExecutionStatus.RUNNING,
    startTime: new Date(Date.now() - 300000), // 5 minutes ago
    engineType: EngineType.LANGFLOW,
    triggeredBy: "john.doe@example.com",
    logs: ["Starting workflow execution...", "Processing customer data..."]
  },
  {
    id: "exec-2",
    workflowId: "wf-2",
    workflowName: "Email Campaign Automation",
    status: ExecutionStatus.COMPLETED,
    startTime: new Date(Date.now() - 900000), // 15 minutes ago
    endTime: new Date(Date.now() - 600000), // 10 minutes ago
    duration: 300,
    engineType: EngineType.N8N,
    triggeredBy: "jane.smith@example.com",
    logs: ["Workflow started", "Sending emails...", "Campaign completed successfully"]
  },
  {
    id: "exec-3",
    workflowId: "wf-3",
    workflowName: "Document Analysis Pipeline",
    status: ExecutionStatus.FAILED,
    startTime: new Date(Date.now() - 1800000), // 30 minutes ago
    endTime: new Date(Date.now() - 1500000), // 25 minutes ago
    duration: 180,
    engineType: EngineType.LANGSMITH,
    triggeredBy: "system",
    error: "API rate limit exceeded",
    logs: ["Starting document analysis", "Processing documents...", "Error: Rate limit exceeded"]
  },
  {
    id: "exec-4",
    workflowId: "wf-4",
    workflowName: "Social Media Monitoring",
    status: ExecutionStatus.COMPLETED,
    startTime: new Date(Date.now() - 3600000), // 1 hour ago
    endTime: new Date(Date.now() - 3300000), // 55 minutes ago
    duration: 120,
    engineType: EngineType.LANGFLOW,
    triggeredBy: "scheduler",
    logs: ["Scheduled execution started", "Monitoring social media...", "Analysis completed"]
  },
  {
    id: "exec-5",
    workflowId: "wf-1",
    workflowName: "Customer Data Processing",
    status: ExecutionStatus.CANCELLED,
    startTime: new Date(Date.now() - 7200000), // 2 hours ago
    endTime: new Date(Date.now() - 7000000),
    duration: 200,
    engineType: EngineType.LANGFLOW,
    triggeredBy: "john.doe@example.com",
    logs: ["Workflow started", "Processing data...", "Execution cancelled by user"]
  }
]

const statusConfig = {
  [ExecutionStatus.PENDING]: {
    color: "warning",
    icon: Clock,
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
  },
  [ExecutionStatus.RUNNING]: {
    color: "default",
    icon: Play,
    bgColor: "bg-blue-50 dark:bg-blue-900/20"
  },
  [ExecutionStatus.COMPLETED]: {
    color: "success",
    icon: CheckCircle,
    bgColor: "bg-green-50 dark:bg-green-900/20"
  },
  [ExecutionStatus.FAILED]: {
    color: "destructive",
    icon: XCircle,
    bgColor: "bg-red-50 dark:bg-red-900/20"
  },
  [ExecutionStatus.CANCELLED]: {
    color: "secondary",
    icon: Pause,
    bgColor: "bg-gray-50 dark:bg-gray-900/20"
  }
} as const

const engineColors = {
  [EngineType.LANGFLOW]: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  [EngineType.N8N]: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  [EngineType.LANGSMITH]: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
}

export default function ExecutionsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState<ExecutionStatus | "all">("all")
  const [selectedEngine, setSelectedEngine] = useState<EngineType | "all">("all")
  const [executions] = useState(mockExecutions)

  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = execution.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         execution.triggeredBy.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || execution.status === selectedStatus
    const matchesEngine = selectedEngine === "all" || execution.engineType === selectedEngine
    return matchesSearch && matchesStatus && matchesEngine
  })

  const handleRetry = (executionId: string) => {
    console.log('Retrying execution:', executionId)
  }

  const handleCancel = (executionId: string) => {
    console.log('Cancelling execution:', executionId)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Executions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor and manage workflow executions
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search executions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as ExecutionStatus | "all")}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="all">All Status</option>
                  <option value={ExecutionStatus.PENDING}>Pending</option>
                  <option value={ExecutionStatus.RUNNING}>Running</option>
                  <option value={ExecutionStatus.COMPLETED}>Completed</option>
                  <option value={ExecutionStatus.FAILED}>Failed</option>
                  <option value={ExecutionStatus.CANCELLED}>Cancelled</option>
                </select>
                <select
                  value={selectedEngine}
                  onChange={(e) => setSelectedEngine(e.target.value as EngineType | "all")}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="all">All Engines</option>
                  <option value={EngineType.LANGFLOW}>Langflow</option>
                  <option value={EngineType.N8N}>N8N</option>
                  <option value={EngineType.LANGSMITH}>LangSmith</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executions List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredExecutions.map((execution) => {
                const statusInfo = statusConfig[execution.status]
                const StatusIcon = statusInfo.icon
                
                return (
                  <div
                    key={execution.id}
                    className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${statusInfo.bgColor} hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                          <StatusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {execution.workflowName}
                            </h3>
                            <Badge variant={statusInfo.color} className="text-xs">
                              {execution.status}
                            </Badge>
                            <Badge className={`text-xs ${engineColors[execution.engineType]}`}>
                              {execution.engineType}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Started {formatDistanceToNow(execution.startTime)} ago</span>
                            </div>
                            
                            {execution.duration && (
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>Duration: {execution.duration}s</span>
                              </div>
                            )}
                            
                            <div className="flex items-center space-x-1">
                              <User className="w-4 h-4" />
                              <span>by {execution.triggeredBy}</span>
                            </div>
                          </div>
                          
                          {execution.error && (
                            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                              Error: {execution.error}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="icon" title="View details">
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {execution.status === ExecutionStatus.FAILED && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Retry execution"
                            onClick={() => handleRetry(execution.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        
                        {execution.status === ExecutionStatus.RUNNING && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Cancel execution"
                            onClick={() => handleCancel(execution.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {filteredExecutions.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Play className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No executions found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm || selectedStatus !== "all" || selectedEngine !== "all"
                  ? "Try adjusting your search or filters"
                  : "No workflow executions have been started yet"
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}