"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EngineType } from "@/types/workflow"
import { ArrowLeft, Workflow, Zap, Brain } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

const engines = [
  {
    type: EngineType.LANGFLOW,
    name: "Langflow",
    description: "Visual AI workflow builder with drag-and-drop interface for LLM applications",
    icon: Brain,
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800",
    features: ["Visual Flow Builder", "LLM Integration", "Custom Components", "Python Support"]
  },
  {
    type: EngineType.N8N,
    name: "n8n",
    description: "Powerful workflow automation platform with 400+ integrations",
    icon: Zap,
    color: "bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-900/20 dark:border-purple-800",
    features: ["400+ Integrations", "Webhook Support", "Scheduling", "Error Handling"]
  },
  {
    type: EngineType.LANGSMITH,
    name: "LangSmith",
    description: "Advanced LLM application development and monitoring platform",
    icon: Workflow,
    color: "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800",
    features: ["LLM Tracing", "Evaluation", "Monitoring", "Chain Management"]
  }
]

export default function NewWorkflowPage() {
  const router = useRouter()
  const [selectedEngine, setSelectedEngine] = useState<EngineType | null>(null)
  const [workflowName, setWorkflowName] = useState("")
  const [workflowDescription, setWorkflowDescription] = useState("")

  const handleCreateWorkflow = () => {
    if (!selectedEngine || !workflowName.trim()) return
    
    // In a real app, this would create the workflow via API
    const workflowId = `wf-${Date.now()}`
    router.push(`/workflows/${workflowId}/edit?engine=${selectedEngine}&name=${encodeURIComponent(workflowName)}`)
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/workflows">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Create New Workflow
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Choose an engine and configure your workflow
            </p>
          </div>
        </div>

        {/* Workflow Details */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Workflow Name *
              </label>
              <Input
                placeholder="Enter workflow name..."
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                placeholder="Describe what this workflow does..."
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm resize-none"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Engine Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Choose Workflow Engine</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select the engine that best fits your workflow requirements
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {engines.map((engine) => (
                <div
                  key={engine.type}
                  className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedEngine === engine.type
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : engine.color
                  }`}
                  onClick={() => setSelectedEngine(engine.type)}
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <engine.icon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {engine.name}
                      </h3>
                      {selectedEngine === engine.type && (
                        <Badge variant="default" className="text-xs mt-1">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {engine.description}
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Key Features
                    </h4>
                    <ul className="space-y-1">
                      {engine.features.map((feature, index) => (
                        <li key={index} className="text-xs text-gray-600 dark:text-gray-300 flex items-center">
                          <div className="w-1 h-1 bg-gray-400 rounded-full mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Link href="/workflows">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button 
            onClick={handleCreateWorkflow}
            disabled={!selectedEngine || !workflowName.trim()}
          >
            Create Workflow
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}