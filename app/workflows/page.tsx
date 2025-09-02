"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Edit, 
  Copy, 
  Trash2, 
  MoreHorizontal,
  Users,
  Calendar,
  Activity,
  Workflow as WorkflowIcon
} from "lucide-react"
import { EngineType, Workflow } from "@/types/workflow"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

// Mock data
const mockWorkflows: Workflow[] = [
  {
    id: "wf-1",
    name: "Customer Data Processing",
    description: "Automated pipeline for processing and enriching customer data from multiple sources",
    engineType: EngineType.LANGFLOW,
    version: 3,
    createdBy: "john.doe@example.com",
    createdAt: new Date(Date.now() - 86400000 * 7),
    updatedAt: new Date(Date.now() - 3600000),
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
    createdAt: new Date(Date.now() - 86400000 * 3),
    updatedAt: new Date(Date.now() - 7200000),
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
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
    tags: ["ai", "documents", "classification"],
    isPublic: false,
    organizationId: "org-1",
    definition: { nodes: [], edges: [] }
  },
  {
    id: "wf-4",
    name: "Social Media Monitoring",
    description: "Monitor social media mentions and sentiment analysis",
    engineType: EngineType.LANGFLOW,
    version: 5,
    createdBy: "marketing@example.com",
    createdAt: new Date(Date.now() - 86400000 * 14),
    updatedAt: new Date(Date.now() - 86400000 * 2),
    tags: ["social-media", "monitoring", "sentiment"],
    isPublic: true,
    organizationId: "org-1",
    definition: { nodes: [], edges: [] }
  }
]

const engineColors = {
  [EngineType.LANGFLOW]: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  [EngineType.N8N]: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  [EngineType.LANGSMITH]: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
}

export default function WorkflowsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEngine, setSelectedEngine] = useState<EngineType | "all">("all")
  const [workflows] = useState(mockWorkflows)

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesEngine = selectedEngine === "all" || workflow.engineType === selectedEngine
    return matchesSearch && matchesEngine
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Workflows
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage and organize your AI workflows
            </p>
          </div>
          <Link href="/workflows/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500" />
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

        {/* Workflows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      {workflow.isPublic && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          Public
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={`text-xs ${engineColors[workflow.engineType]}`}>
                        {workflow.engineType}
                      </Badge>
                      <span className="text-xs text-gray-500">v{workflow.version}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                  {workflow.description}
                </p>
                
                {workflow.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {workflow.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {workflow.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{workflow.tags.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    Updated {formatDistanceToNow(workflow.updatedAt)} ago
                  </div>
                  <div className="flex items-center">
                    <Activity className="w-3 h-3 mr-1" />
                    {workflow.createdBy.split('@')[0]}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link href={`/workflows/${workflow.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm">
                    <Play className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredWorkflows.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <WorkflowIcon className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No workflows found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchTerm || selectedEngine !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first workflow"
                }
              </p>
              {!searchTerm && selectedEngine === "all" && (
                <Link href="/workflows/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Workflow
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}