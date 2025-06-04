"use client"

import { useState } from "react"
import { ExternalLink } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Update the props interface to accept folders
interface CreateWorkflowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: { id: string; name: string; workflowCount: number; isDefault: boolean }[]
}

export function CreateWorkflowModal({ open, onOpenChange, folders }: CreateWorkflowModalProps) {
  const [selectedEngine, setSelectedEngine] = useState<string>("")
  const [selectedFolder, setSelectedFolder] = useState<string>("unassigned") // Default to unassigned

  const engines = [
    {
      id: "n8n",
      name: "n8n",
      description: "Low-code automation platform with visual workflow builder",
      url: "http://localhost:5678/workflow",
      color: "bg-blue-100 text-blue-800",
    },
    {
      id: "langflow",
      name: "Langflow",
      description: "Visual framework for building multi-agent and RAG applications",
      url: "http://localhost:7860/flow-builder",
      color: "bg-green-100 text-green-800",
    },
    {
      id: "langsmith",
      name: "LangSmith",
      description: "Platform for building production-grade LLM applications",
      url: "https://smith.langchain.com/",
      color: "bg-purple-100 text-purple-800",
    },
  ]

  const handleCreateWorkflow = () => {
    const engine = engines.find((e) => e.id === selectedEngine)
    if (engine) {
      // In a real app, you would create the workflow and assign it to the selected folder
      console.log(`Creating workflow with engine ${selectedEngine} in folder ${selectedFolder}`)
      window.open(engine.url, "_blank")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
          <DialogDescription>Choose a platform to create your new automation workflow</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedEngine} onValueChange={setSelectedEngine}>
            <SelectTrigger>
              <SelectValue placeholder="Select an automation engine" />
            </SelectTrigger>
            <SelectContent>
              {engines.map((engine) => (
                <SelectItem key={engine.id} value={engine.id}>
                  {engine.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add folder selection */}
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select a folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEngine && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {engines.find((e) => e.id === selectedEngine)?.name}
                  <span className={`px-2 py-1 rounded text-xs ${engines.find((e) => e.id === selectedEngine)?.color}`}>
                    {selectedEngine}
                  </span>
                </CardTitle>
                <CardDescription>{engines.find((e) => e.id === selectedEngine)?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Opens in: {engines.find((e) => e.id === selectedEngine)?.url}
                  </div>
                  <Button
                    onClick={handleCreateWorkflow}
                    className="bg-[#7575e4] hover:bg-[#6565d4] text-white"
                    disabled={!selectedFolder} // Disable if no folder is selected
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Create Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
