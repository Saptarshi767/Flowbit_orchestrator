"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { WorkflowCanvas } from "@/components/workflow-editor/workflow-canvas"
import { NodePalette } from "@/components/workflow-editor/node-palette"
import { EngineType } from "@/types/workflow"

export default function EditWorkflowPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const workflowId = params.id as string
  
  const [engineType, setEngineType] = useState<EngineType>(EngineType.LANGFLOW)
  const [workflowName, setWorkflowName] = useState("Untitled Workflow")

  useEffect(() => {
    // Get initial values from URL params (for new workflows)
    const engine = searchParams.get('engine') as EngineType
    const name = searchParams.get('name')
    
    if (engine && Object.values(EngineType).includes(engine)) {
      setEngineType(engine)
    }
    
    if (name) {
      setWorkflowName(decodeURIComponent(name))
    }
    
    // In a real app, you would fetch workflow data here if editing existing workflow
    // fetchWorkflow(workflowId)
  }, [searchParams, workflowId])

  const handleSave = () => {
    // In a real app, this would save the workflow
    console.log('Saving workflow:', workflowId)
  }

  const handleRun = () => {
    // In a real app, this would execute the workflow
    console.log('Running workflow:', workflowId)
  }

  return (
    <DashboardLayout>
      <div className="h-full flex space-x-6">
        {/* Node Palette */}
        <div className="w-80 flex-shrink-0">
          <NodePalette selectedEngine={engineType} />
        </div>
        
        {/* Workflow Canvas */}
        <div className="flex-1 min-h-0">
          <WorkflowCanvas
            engineType={engineType}
            workflowName={workflowName}
            onSave={handleSave}
            onRun={handleRun}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}