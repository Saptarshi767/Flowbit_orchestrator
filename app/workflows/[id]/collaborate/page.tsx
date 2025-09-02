import { CollaborativeEditor } from "@/components/collaboration/collaborative-editor"
import { DashboardLayout } from "@/components/layout/dashboard-layout"

interface CollaboratePageProps {
  params: {
    id: string
  }
}

export default function CollaboratePage({ params }: CollaboratePageProps) {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)]">
        <CollaborativeEditor 
          workflowId={params.id}
          initialContent="# Workflow Configuration\n\nThis is a collaborative workflow editor..."
        />
      </div>
    </DashboardLayout>
  )
}