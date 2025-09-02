"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Workflow, EngineType } from "@/types/workflow"
import { formatDistanceToNow } from "date-fns"
import { Play, Edit, MoreHorizontal, Users } from "lucide-react"

interface WorkflowOverviewProps {
  workflows: Workflow[]
}

const engineColors = {
  [EngineType.LANGFLOW]: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  [EngineType.N8N]: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  [EngineType.LANGSMITH]: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
}

export function WorkflowOverview({ workflows }: WorkflowOverviewProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Workflows</CardTitle>
        <Button variant="outline" size="sm">
          Create New
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {workflow.name}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${engineColors[workflow.engineType]}`}>
                      {workflow.engineType}
                    </span>
                    {workflow.isPublic && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        Public
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>v{workflow.version}</span>
                    <span>Updated {formatDistanceToNow(workflow.updatedAt)} ago</span>
                    <span>by {workflow.createdBy}</span>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-md truncate">
                      {workflow.description}
                    </p>
                  )}
                  {workflow.tags.length > 0 && (
                    <div className="flex items-center space-x-1 mt-2">
                      {workflow.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {workflow.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{workflow.tags.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" title="Run workflow">
                  <Play className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" title="Edit workflow">
                  <Edit className="h-4 w-4" />
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