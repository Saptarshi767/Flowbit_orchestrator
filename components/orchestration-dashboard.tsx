"use client"

import { useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { ExecutionsDashboard } from "@/components/executions-dashboard"
import { CreateWorkflowModal } from "@/components/create-workflow-modal"
import { FolderManagementModal } from "@/components/folder-management-modal"

// Define folder type
export interface Folder {
  id: string
  name: string
  workflowCount: number
  isDefault: boolean
}

// Initial folders data
const initialFolders: Folder[] = [
  { id: "unassigned", name: "Unassigned", workflowCount: 2, isDefault: true },
  { id: "marketing", name: "Marketing Automation", workflowCount: 2, isDefault: false },
  { id: "data-processing", name: "Data Processing", workflowCount: 2, isDefault: false },
]

export function OrchestrationDashboard() {
  const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false)
  const [folderManagementOpen, setFolderManagementOpen] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>(initialFolders)

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AppSidebar
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
          onManageFolders={() => setFolderManagementOpen(true)}
          folders={folders}
        />
        <div className="flex-1 flex flex-col">
          <DashboardHeader onCreateWorkflow={() => setCreateWorkflowOpen(true)} />
          <main className="flex-1 p-6">
            <ExecutionsDashboard selectedFolder={selectedFolder} />
          </main>
        </div>
      </div>

      <CreateWorkflowModal open={createWorkflowOpen} onOpenChange={setCreateWorkflowOpen} folders={folders} />
      <FolderManagementModal
        open={folderManagementOpen}
        onOpenChange={setFolderManagementOpen}
        folders={folders}
        setFolders={setFolders}
      />
    </SidebarProvider>
  )
}
