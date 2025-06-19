"use client"

import { useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronRight, Folder, FolderOpen, Settings, Workflow, Loader2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { TriggerWorkflowModal } from "./trigger-workflow-modal"

interface Workflow {
  id: string;
  name: string;
  description: string;
  engine: "langflow" | "flowbit";
  folder?: string;
}

interface Folder {
  name: string;
  workflows: Workflow[];
}

export function AppSidebar() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
  const fetchWorkflows = async () => {
    try {
        const response = await fetch("/api/langflow/workflows");
        if (!response.ok) throw new Error("Failed to fetch workflows");
        const data = await response.json();
        setWorkflows(data);
        // Group workflows by folder (if you want to support folders in the future)
        // For now, just put all in one group
        setFolders([{ name: "All", workflows: data }]);
    } catch (err) {
        console.error("Error fetching workflows:", err);
        setError("Failed to load workflows");
      } finally {
        setLoading(false);
    }
  };

    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) =>
      prev.includes(folderName)
        ? prev.filter((name) => name !== folderName)
        : [...prev, folderName]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
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
            <Button variant="ghost" size="sm" onClick={() => {}} className="h-6 w-6 p-0">
              <Settings className="w-3 h-3" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {}}
                  isActive={false}
                  className="w-full justify-start"
                >
                  <Workflow className="w-4 h-4" />
                  <span>All Workflows</span>
                  <Badge variant="secondary" className="ml-auto">
                    {workflows.length}
                  </Badge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {folders.map((folder) => (
                <Collapsible key={folder.name} open={expandedFolders.includes(folder.name)} onOpenChange={() => toggleFolder(folder.name)}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="w-full justify-start">
                        {expandedFolders.includes(folder.name) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {expandedFolders.includes(folder.name) ? (
                          <FolderOpen className="w-4 h-4" />
                        ) : (
                          <Folder className="w-4 h-4" />
                        )}
                        <span>{folder.name}</span>
                        <Badge variant="secondary" className="ml-auto">{folder.workflows.length}</Badge>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {folder.workflows.map((wf) => (
                          <SidebarMenuSubItem key={wf.name}>
                            <SidebarMenuSubButton
                              onClick={() => {
                                setSelectedWorkflow(wf);
                                setTriggerModalOpen(true);
                              }}
                              isActive={false}
                              className="flex items-center justify-between"
                            >
                              <span className="truncate">{wf.name}</span>
                              <Badge className="bg-green-100 text-green-800">LangFlow</Badge>
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

      {selectedWorkflow && (
        <TriggerWorkflowModal
          open={triggerModalOpen}
          onOpenChange={setTriggerModalOpen}
          workflowId={selectedWorkflow.filename}
        />
      )}

      <SidebarFooter className="border-t border-gray-200 p-4">
        <div className="text-xs text-gray-500">FlowBit Orchestration v1.1</div>
      </SidebarFooter>
    </Sidebar>
  );
}