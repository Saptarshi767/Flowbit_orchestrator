"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Trash2,
  MarkAsRead,
  Settings
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: "success" | "error" | "warning" | "info"
  title: string
  message: string
  timestamp: Date
  read: boolean
  actionUrl?: string
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "success",
    title: "Workflow Completed",
    message: "Customer Data Processing workflow completed successfully with 1,247 records processed.",
    timestamp: new Date(Date.now() - 300000), // 5 minutes ago
    read: false,
    actionUrl: "/executions/exec-123"
  },
  {
    id: "2",
    type: "error",
    title: "Workflow Failed",
    message: "Document Analysis Pipeline failed due to API rate limit exceeded. Please check your API quotas.",
    timestamp: new Date(Date.now() - 900000), // 15 minutes ago
    read: false,
    actionUrl: "/executions/exec-124"
  },
  {
    id: "3",
    type: "warning",
    title: "High API Usage",
    message: "Your organization has used 85% of the monthly API quota. Consider upgrading your plan.",
    timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
    read: true
  },
  {
    id: "4",
    type: "info",
    title: "New Team Member",
    message: "Sarah Wilson has joined your organization and has been assigned the Member role.",
    timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    read: true,
    actionUrl: "/team"
  },
  {
    id: "5",
    type: "success",
    title: "Workflow Published",
    message: "Your workflow 'Email Campaign Automation' has been successfully published to the marketplace.",
    timestamp: new Date(Date.now() - 7200000), // 2 hours ago
    read: true,
    actionUrl: "/marketplace"
  },
  {
    id: "6",
    type: "warning",
    title: "Security Alert",
    message: "New login detected from an unrecognized device. If this wasn't you, please secure your account.",
    timestamp: new Date(Date.now() - 86400000), // 1 day ago
    read: true,
    actionUrl: "/settings/security"
  },
  {
    id: "7",
    type: "info",
    title: "System Maintenance",
    message: "Scheduled maintenance will occur on Sunday, January 28th from 2:00 AM to 4:00 AM UTC.",
    timestamp: new Date(Date.now() - 86400000 * 2), // 2 days ago
    read: true
  }
]

const notificationConfig = {
  success: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800"
  },
  error: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800"
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800"
  }
}

export default function NotificationsPage() {
  const unreadCount = mockNotifications.filter(n => !n.read).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Notifications
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Stay updated with your workflow activities and system alerts
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline">
              <MarkAsRead className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mockNotifications.length}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {unreadCount}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Unread</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mockNotifications.filter(n => n.type === "success").length}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Success</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {mockNotifications.filter(n => n.type === "error").length}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notifications List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockNotifications.map((notification) => {
                const config = notificationConfig[notification.type]
                const Icon = config.icon
                
                return (
                  <div
                    key={notification.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      notification.read 
                        ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" 
                        : `${config.borderColor} ${config.bgColor}`
                    } hover:shadow-md`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                          <Badge 
                            variant={notification.type === "error" ? "destructive" : 
                                   notification.type === "warning" ? "warning" :
                                   notification.type === "success" ? "success" : "default"}
                            className="text-xs"
                          >
                            {notification.type}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDistanceToNow(notification.timestamp)} ago
                          </span>
                          
                          <div className="flex items-center space-x-2">
                            {notification.actionUrl && (
                              <Button variant="ghost" size="sm">
                                View Details
                              </Button>
                            )}
                            {!notification.read && (
                              <Button variant="ghost" size="sm">
                                Mark as Read
                              </Button>
                            )}
                            <Button variant="ghost" size="icon">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {mockNotifications.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Bell className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No notifications
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You're all caught up! New notifications will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}