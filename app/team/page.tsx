"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Plus, 
  Search, 
  Mail, 
  MoreHorizontal,
  Crown,
  Shield,
  User,
  Calendar
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "member" | "viewer"
  avatar?: string
  joinedAt: Date
  lastActive: Date
  status: "active" | "invited" | "inactive"
}

const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    role: "owner",
    joinedAt: new Date(Date.now() - 86400000 * 180),
    lastActive: new Date(Date.now() - 3600000),
    status: "active"
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    role: "admin",
    joinedAt: new Date(Date.now() - 86400000 * 120),
    lastActive: new Date(Date.now() - 7200000),
    status: "active"
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike.johnson@example.com",
    role: "member",
    joinedAt: new Date(Date.now() - 86400000 * 60),
    lastActive: new Date(Date.now() - 86400000),
    status: "active"
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah.wilson@example.com",
    role: "member",
    joinedAt: new Date(Date.now() - 86400000 * 30),
    lastActive: new Date(Date.now() - 86400000 * 3),
    status: "invited"
  },
  {
    id: "5",
    name: "David Brown",
    email: "david.brown@example.com",
    role: "viewer",
    joinedAt: new Date(Date.now() - 86400000 * 15),
    lastActive: new Date(Date.now() - 86400000 * 7),
    status: "active"
  }
]

const roleConfig = {
  owner: { icon: Crown, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300", label: "Owner" },
  admin: { icon: Shield, color: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300", label: "Admin" },
  member: { icon: User, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300", label: "Member" },
  viewer: { icon: User, color: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300", label: "Viewer" }
}

const statusConfig = {
  active: { color: "success" as const, label: "Active" },
  invited: { color: "warning" as const, label: "Invited" },
  inactive: { color: "secondary" as const, label: "Inactive" }
}

export default function TeamPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Team
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your team members and their permissions
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockTeamMembers.length}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockTeamMembers.filter(m => m.status === "active").length}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockTeamMembers.filter(m => m.status === "invited").length}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Invites</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockTeamMembers.filter(m => m.role === "admin" || m.role === "owner").length}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Admins</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search team members..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockTeamMembers.map((member) => {
                const roleInfo = roleConfig[member.role]
                const statusInfo = statusConfig[member.status]
                const RoleIcon = roleInfo.icon
                
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {member.name}
                          </h3>
                          <Badge variant={statusInfo.color} className="text-xs">
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span>{member.email}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>Joined {formatDistanceToNow(member.joinedAt)} ago</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Last active {formatDistanceToNow(member.lastActive)} ago
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <RoleIcon className="w-4 h-4" />
                        <Badge className={`text-xs ${roleInfo.color}`}>
                          {roleInfo.label}
                        </Badge>
                      </div>
                      
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}