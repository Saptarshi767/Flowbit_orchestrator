"use client"

import type React from "react"

import { useState } from "react"
import { Plus, Trash2, Edit2, Folder } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface FolderManagementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: { id: string; name: string; workflowCount: number; isDefault: boolean }[]
  setFolders: React.Dispatch<
    React.SetStateAction<{ id: string; name: string; workflowCount: number; isDefault: boolean }[]>
  >
}

// Remove the mockFolders constant since we'll use the folders prop

export function FolderManagementModal({ open, onOpenChange, folders, setFolders }: FolderManagementModalProps) {
  const [newFolderName, setNewFolderName] = useState("")
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = {
        id: `folder-${Date.now()}`,
        name: newFolderName.trim(),
        workflowCount: 0,
        isDefault: false,
      }
      setFolders([...folders, newFolder])
      setNewFolderName("")
    }
  }

  const handleDeleteFolder = (folderId: string) => {
    setFolders(folders.filter((f) => f.id !== folderId))
  }

  const handleEditFolder = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId)
    if (folder) {
      setEditingFolder(folderId)
      setEditName(folder.name)
    }
  }

  const handleSaveEdit = () => {
    if (editName.trim() && editingFolder) {
      setFolders(folders.map((f) => (f.id === editingFolder ? { ...f, name: editName.trim() } : f)))
      setEditingFolder(null)
      setEditName("")
    }
  }

  const handleCancelEdit = () => {
    setEditingFolder(null)
    setEditName("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Folders</DialogTitle>
          <DialogDescription>Organize your workflows into folders for better management</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Folder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create New Folder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="bg-[#7575e4] hover:bg-[#6565d4] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Folders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Existing Folders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {folders.map((folder) => (
                  <div key={folder.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-gray-500" />
                      {editingFolder === folder.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSaveEdit()}
                            className="w-48"
                          />
                          <Button size="sm" onClick={handleSaveEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{folder.name}</span>
                          {folder.isDefault && <Badge variant="secondary">Default</Badge>}
                          <Badge variant="outline">{folder.workflowCount} workflows</Badge>
                        </>
                      )}
                    </div>

                    {editingFolder !== folder.id && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditFolder(folder.id)}
                          disabled={folder.isDefault}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteFolder(folder.id)}
                          disabled={folder.isDefault}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
