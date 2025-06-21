"use client"

import { useState, useEffect } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { ExecutionsDashboard } from "@/components/executions-dashboard"
import { CreateWorkflowModal } from "@/components/create-workflow-modal"
import { FolderManagementModal } from "@/components/folder-management-modal"
import { useTheme } from "next-themes"

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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Theme Toggle Button */}
      {mounted && (
        <button
          className="fixed top-6 right-6 z-50 px-4 py-2 rounded-full glass dark:glass-dark text-lg font-semibold shadow-lg border border-flowbit-blue hover:bg-flowbit-blue/20 transition"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
      )}
      <div className="min-h-screen flex w-full bg-gradient-to-br from-flowbit-teal/20 via-white to-flowbit-blue/20 dark:from-flowbit-deep/90 dark:via-flowbit-blue/80 dark:to-flowbit-blue/60 transition-colors duration-500">
        <AppSidebar
          selectedFolder={selectedFolder}
          onFolderSelect={setSelectedFolder}
          onManageFolders={() => setFolderManagementOpen(true)}
          folders={folders}
        />
        <div className="flex-1 flex flex-col">
          <DashboardHeader onCreateWorkflow={() => setCreateWorkflowOpen(true)} />
          <main className="flex-1 p-6">
            <div className="glass dark:glass-dark rounded-3xl shadow-2xl p-6">
            <ExecutionsDashboard selectedFolder={selectedFolder} />
            </div>
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
