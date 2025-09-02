"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExecutionStatus, Execution, EngineType } from "@/types/workflow"
import { formatDistanceToNow } from "date-fns"
import { Eye, MoreHorizontal } from "lucide-react"

interface RecentExecutionsProps {
  executions: Execution[]
}

const statusColors = {
  [ExecutionStatus.PENDING]: "warning",
  [ExecutionStatus.RUNNING]: "default",
  [ExecutionStatus.COMPLETED]: "success",
  [ExecutionStatus.FAILED]: "destructive",
  [ExecutionStatus.CANCELLED]: "secondary"
} as const

const engineColors = {
  [EngineType.LANGFLOW]: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  [EngineType.N8N]: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  [EngineType.LANGSMITH]: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
}

export function RecentExecutions({ executions }: RecentExecutionsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Executions</CardTitle>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {executions.map((execution) => (
            <div
              key={execution.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {execution.workflowName}
                    </span>
                    <Badge 
                      variant={statusColors[execution.status]}
                      className="text-xs"
                    >
                      {execution.status}
                    </Badge>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${engineColors[execution.engineType]}`}>
                      {execution.engineType}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>Started {formatDistanceToNow(execution.startTime)} ago</span>
                    {execution.duration && (
                      <span>Duration: {execution.duration}s</span>
                    )}
                    <span>by {execution.triggeredBy}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}