"use client"

import { useState, useEffect, useRef } from "react"
import { Users, MessageCircle, History, Share2, Lock, Unlock, Eye, Edit3, Save, Undo, Redo } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CollaboratorCursor {
  id: string
  user: {
    name: string
    avatar?: string
    color: string
  }
  position: { x: number; y: number }
  selection?: { start: number; end: number }
}

interface Comment {
  id: string
  user: {
    name: string
    avatar?: string
  }
  content: string
  timestamp: Date
  position?: { x: number; y: number }
  resolved: boolean
  replies: Comment[]
}

interface VersionHistory {
  id: string
  user: {
    name: string
    avatar?: string
  }
  timestamp: Date
  changes: string
  version: number
}

interface CollaborativeEditorProps {
  workflowId: string
  initialContent?: string
  readOnly?: boolean
}

const mockCollaborators: CollaboratorCursor[] = [
  {
    id: "user-1",
    user: { name: "Sarah Chen", color: "#3B82F6" },
    position: { x: 150, y: 200 }
  },
  {
    id: "user-2", 
    user: { name: "Alex Rodriguez", color: "#10B981" },
    position: { x: 300, y: 150 }
  }
]

const mockComments: Comment[] = [
  {
    id: "comment-1",
    user: { name: "Sarah Chen" },
    content: "Should we add error handling for this API call?",
    timestamp: new Date(Date.now() - 300000),
    position: { x: 200, y: 250 },
    resolved: false,
    replies: [
      {
        id: "reply-1",
        user: { name: "Alex Rodriguez" },
        content: "Good point! I'll add a try-catch block here.",
        timestamp: new Date(Date.now() - 240000),
        resolved: false,
        replies: []
      }
    ]
  },
  {
    id: "comment-2",
    user: { name: "Dr. Emily Watson" },
    content: "This workflow looks great! Ready for production.",
    timestamp: new Date(Date.now() - 600000),
    resolved: true,
    replies: []
  }
]

const mockVersionHistory: VersionHistory[] = [
  {
    id: "v-1",
    user: { name: "Sarah Chen" },
    timestamp: new Date(Date.now() - 3600000),
    changes: "Added customer data validation node",
    version: 3
  },
  {
    id: "v-2",
    user: { name: "Alex Rodriguez" },
    timestamp: new Date(Date.now() - 7200000),
    changes: "Updated API endpoint configuration",
    version: 2
  },
  {
    id: "v-3",
    user: { name: "Sarah Chen" },
    timestamp: new Date(Date.now() - 10800000),
    changes: "Initial workflow creation",
    version: 1
  }
]

export function CollaborativeEditor({ workflowId, initialContent = "", readOnly = false }: CollaborativeEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [collaborators, setCollaborators] = useState<CollaboratorCursor[]>(mockCollaborators)
  const [comments, setComments] = useState<Comment[]>(mockComments)
  const [versionHistory, setVersionHistory] = useState<VersionHistory[]>(mockVersionHistory)
  const [isLocked, setIsLocked] = useState(false)
  const [showComments, setShowComments] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [selectedComment, setSelectedComment] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const editorRef = useRef<HTMLDivElement>(null)

  // Simulate real-time collaboration
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate cursor movements
      setCollaborators(prev => prev.map(collab => ({
        ...collab,
        position: {
          x: collab.position.x + (Math.random() - 0.5) * 20,
          y: collab.position.y + (Math.random() - 0.5) * 20
        }
      })))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleContentChange = (newContent: string) => {
    if (readOnly || isLocked) return
    setContent(newContent)
    setHasUnsavedChanges(true)
  }

  const handleSave = () => {
    // Simulate saving
    setHasUnsavedChanges(false)
    const newVersion: VersionHistory = {
      id: `v-${Date.now()}`,
      user: { name: "You" },
      timestamp: new Date(),
      changes: "Updated workflow content",
      version: versionHistory[0].version + 1
    }
    setVersionHistory(prev => [newVersion, ...prev])
  }

  const handleAddComment = (position?: { x: number; y: number }) => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      user: { name: "You" },
      content: newComment,
      timestamp: new Date(),
      position,
      resolved: false,
      replies: []
    }

    setComments(prev => [comment, ...prev])
    setNewComment("")
  }

  const handleResolveComment = (commentId: string) => {
    setComments(prev => prev.map(comment =>
      comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment
    ))
  }

  const handleReplyToComment = (commentId: string, replyContent: string) => {
    const reply: Comment = {
      id: `reply-${Date.now()}`,
      user: { name: "You" },
      content: replyContent,
      timestamp: new Date(),
      resolved: false,
      replies: []
    }

    setComments(prev => prev.map(comment =>
      comment.id === commentId 
        ? { ...comment, replies: [...comment.replies, reply] }
        : comment
    ))
  }

  const handleRestoreVersion = (versionId: string) => {
    // Simulate version restoration
    console.log("Restoring version:", versionId)
  }

  const unresolvedComments = comments.filter(c => !c.resolved)
  const resolvedComments = comments.filter(c => c.resolved)

  return (
    <div className="flex h-full">
      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="glass dark:glass-dark bg-white/80 dark:bg-gray-800/80 rounded-t-2xl shadow-lg p-4 border border-gray-200/50 dark:border-gray-700/50 border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Collaborators */}
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <div className="flex -space-x-2">
                  {collaborators.map(collab => (
                    <TooltipProvider key={collab.id}>
                      <Tooltip>
                        <TooltipTrigger>
                          <Avatar className="w-6 h-6 border-2 border-white dark:border-gray-800">
                            <AvatarImage src={collab.user.avatar} />
                            <AvatarFallback 
                              className="text-xs text-white"
                              style={{ backgroundColor: collab.user.color }}
                            >
                              {collab.user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{collab.user.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {collaborators.length + 1} editing
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Editor Actions */}
              <Button size="sm" variant="outline" disabled>
                <Undo className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" disabled>
                <Redo className="w-4 h-4" />
              </Button>

              <Separator orientation="vertical" className="h-6" />

              {/* Lock/Unlock */}
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setIsLocked(!isLocked)}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </Button>

              {/* Comments Toggle */}
              <Button 
                size="sm" 
                variant={showComments ? "default" : "outline"}
                onClick={() => setShowComments(!showComments)}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                {unresolvedComments.length}
              </Button>

              {/* History Toggle */}
              <Button 
                size="sm" 
                variant={showHistory ? "default" : "outline"}
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="w-4 h-4" />
              </Button>

              {/* Save */}
              <Button 
                size="sm" 
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className="bg-primary hover:bg-primary/90"
              >
                <Save className="w-4 h-4 mr-1" />
                {hasUnsavedChanges ? 'Save' : 'Saved'}
              </Button>

              {/* Share */}
              <Button size="sm" variant="outline">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div 
          ref={editorRef}
          className="flex-1 relative glass dark:glass-dark bg-white/80 dark:bg-gray-800/80 rounded-b-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 border-t-0"
        >
          {/* Collaborative Cursors */}
          {collaborators.map(collab => (
            <div
              key={collab.id}
              className="absolute pointer-events-none z-10"
              style={{
                left: collab.position.x,
                top: collab.position.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div 
                className="w-3 h-3 rounded-full border-2 border-white"
                style={{ backgroundColor: collab.user.color }}
              />
              <div 
                className="absolute top-4 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
                style={{ backgroundColor: collab.user.color }}
              >
                {collab.user.name}
              </div>
            </div>
          ))}

          {/* Comment Markers */}
          {comments.filter(c => c.position && !c.resolved).map(comment => (
            <div
              key={comment.id}
              className="absolute z-20 cursor-pointer"
              style={{
                left: comment.position!.x,
                top: comment.position!.y,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={() => setSelectedComment(comment.id)}
            >
              <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                <MessageCircle className="w-3 h-3" />
              </div>
            </div>
          ))}

          {/* Main Content Area */}
          <div className="p-6 h-full">
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Start editing your workflow..."
              className="w-full h-full resize-none border-none focus:ring-0 bg-transparent"
              disabled={readOnly || isLocked}
            />
          </div>

          {/* Lock Overlay */}
          {isLocked && (
            <div className="absolute inset-0 bg-gray-900/20 flex items-center justify-center">
              <div className="glass dark:glass-dark p-4 rounded-lg text-center">
                <Lock className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Workflow is locked for editing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      {(showComments || showHistory) && (
        <div className="w-80 border-l border-gray-200 dark:border-gray-700">
          {showComments && (
            <Card className="h-full rounded-none border-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Comments</span>
                  <Badge variant="secondary">{unresolvedComments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  <div className="p-4 space-y-4">
                    {/* Add Comment */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => handleAddComment()}
                        disabled={!newComment.trim()}
                      >
                        Add Comment
                      </Button>
                    </div>

                    <Separator />

                    {/* Unresolved Comments */}
                    {unresolvedComments.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Open ({unresolvedComments.length})</h4>
                        {unresolvedComments.map(comment => (
                          <div key={comment.id} className="space-y-2 p-3 border rounded-lg mb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={comment.user.avatar} />
                                  <AvatarFallback className="text-xs">
                                    {comment.user.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{comment.user.name}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolveComment(comment.id)}
                              >
                                Resolve
                              </Button>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {comment.content}
                            </p>
                            <p className="text-xs text-gray-500">
                              {comment.timestamp.toLocaleString()}
                            </p>
                            
                            {/* Replies */}
                            {comment.replies.map(reply => (
                              <div key={reply.id} className="ml-4 pl-3 border-l-2 border-gray-200">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Avatar className="w-4 h-4">
                                    <AvatarImage src={reply.user.avatar} />
                                    <AvatarFallback className="text-xs">
                                      {reply.user.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs font-medium">{reply.user.name}</span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {reply.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Resolved Comments */}
                    {resolvedComments.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Resolved ({resolvedComments.length})</h4>
                        {resolvedComments.map(comment => (
                          <div key={comment.id} className="space-y-2 p-3 border rounded-lg mb-2 opacity-60">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={comment.user.avatar} />
                                  <AvatarFallback className="text-xs">
                                    {comment.user.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{comment.user.name}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">Resolved</Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {showHistory && (
            <Card className="h-full rounded-none border-0">
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  <div className="p-4 space-y-3">
                    {versionHistory.map(version => (
                      <div key={version.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={version.user.avatar} />
                          <AvatarFallback className="text-xs">
                            {version.user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">v{version.version}</p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestoreVersion(version.id)}
                            >
                              Restore
                            </Button>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {version.changes}
                          </p>
                          <p className="text-xs text-gray-500">
                            {version.user.name} • {version.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}