import { ExecutionVisualizer } from "@/components/execution/execution-visualizer"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

interface VisualizePageProps {
  params: {
    id: string
  }
}

export default function VisualizePage({ params }: VisualizePageProps) {
  return (
    <DashboardLayout>
      <ExecutionVisualizer 
        executionId={params.id}
        workflowId="workflow-123"
        isLive={true}
      />
    </DashboardLayout>
  )
}