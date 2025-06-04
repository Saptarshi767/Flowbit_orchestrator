"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Folder, FolderOpen, Settings, Workflow } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Update the props interface to accept folders
interface AppSidebarProps {
  selectedFolder: string | null
  onFolderSelect: (folderId: string | null) => void
  onManageFolders: () => void
  folders: { id: string; name: string; workflowCount: number; isDefault: boolean }[]
}

// Remove the mockFolders constant since we'll use the folders prop

// Update the component to use the folders prop
export function AppSidebar({ selectedFolder, onFolderSelect, onManageFolders, folders }: AppSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<string[]>(["unassigned"])

  // Rest of the component remains the same, but use folders prop instead of mockFolders

  // Mock data for workflows in each folder
  const mockWorkflows = {
    unassigned: [
      { id: "wf-1", name: "Email Processor", engine: "n8n" },
      { id: "wf-2", name: "Data Sync", engine: "langflow" },
    ],
    marketing: [
      { id: "wf-3", name: "Lead Scoring", engine: "n8n" },
      { id: "wf-4", name: "Campaign Tracker", engine: "langsmith" },
    ],
    "data-processing": [
      { id: "wf-5", name: "ETL Pipeline", engine: "langflow" },
      { id: "wf-6", name: "Report Generator", engine: "n8n" },
    ],
  }

  // Function to get workflows for a folder
  const getWorkflowsForFolder = (folderId: string) => {
    return mockWorkflows[folderId as keyof typeof mockWorkflows] || []
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => (prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]))
  }

  const getEngineColor = (engine: string) => {
    switch (engine) {
      case "n8n":
        return "bg-blue-100 text-blue-800"
      case "langflow":
        return "bg-green-100 text-green-800"
      case "langsmith":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Sidebar className="border-r border-gray-200">
      <SidebarHeader className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#7575e4] rounded-lg flex items-center justify-center">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">FlowBit</h1>
            <p className="text-xs text-gray-500">Orchestration</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Workflows</span>
            <Button variant="ghost" size="sm" onClick={onManageFolders} className="h-6 w-6 p-0">
              <Settings className="w-3 h-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onFolderSelect(null)}
                  isActive={selectedFolder === null}
                  className="w-full justify-start"
                >
                  <Workflow className="w-4 h-4" />
                  <span>All Workflows</span>
                  <Badge variant="secondary" className="ml-auto">
                    {folders.reduce((acc, folder) => acc + folder.workflowCount, 0)}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {folders.map((folder) => (
                <Collapsible
                  key={folder.id}
                  open={expandedFolders.includes(folder.id)}
                  onOpenChange={() => toggleFolder(folder.id)}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full justify-start">
                        {expandedFolders.includes(folder.id) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {expandedFolders.includes(folder.id) ? (
                          <FolderOpen className="w-4 h-4" />
                        ) : (
                          <Folder className="w-4 h-4" />
                        )}
                        <span>{folder.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {folder.workflowCount}
                        </Badge>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {getWorkflowsForFolder(folder.id).map((workflow) => (
                          <SidebarMenuSubItem key={workflow.id}>
                            <SidebarMenuSubButton
                              onClick={() => onFolderSelect(folder.id)}
                              isActive={selectedFolder === folder.id}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate">{workflow.name}</span>
                              <Badge variant="outline" className={`text-xs ${getEngineColor(workflow.engine)}`}>
                                {workflow.engine}
                              </Badge>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-gray-200 p-4">
        <div className="text-xs text-gray-500">FlowBit Orchestration v1.1</div>
      </SidebarFooter>
    </Sidebar>
  )
}
