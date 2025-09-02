"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Bell, 
  Shield, 
  Key, 
  Database,
  Palette,
  Globe,
  Zap,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit
} from "lucide-react"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile")
  const [showApiKey, setShowApiKey] = useState(false)
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    workflow: true,
    security: true
  })

  const tabs = [
    { id: "profile", name: "Profile", icon: User },
    { id: "notifications", name: "Notifications", icon: Bell },
    { id: "security", name: "Security", icon: Shield },
    { id: "api", name: "API Keys", icon: Key },
    { id: "integrations", name: "Integrations", icon: Database },
    { id: "appearance", name: "Appearance", icon: Palette },
    { id: "organization", name: "Organization", icon: Globe }
  ]

  const apiKeys = [
    { id: "1", name: "Production API", key: "sk-1234...abcd", created: "2024-01-15", lastUsed: "2024-01-20" },
    { id: "2", name: "Development API", key: "sk-5678...efgh", created: "2024-01-10", lastUsed: "2024-01-19" }
  ]

  const integrations = [
    { name: "Slack", status: "connected", icon: "💬" },
    { name: "Microsoft Teams", status: "disconnected", icon: "👥" },
    { name: "Email (SMTP)", status: "connected", icon: "📧" },
    { name: "Webhook", status: "connected", icon: "🔗" }
  ]

  return (
    <DashboardLayout>
      <div className="flex space-x-6">
        {/* Sidebar */}
        <div className="w-64 space-y-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Settings
          </h1>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        First Name
                      </label>
                      <Input defaultValue="John" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Last Name
                      </label>
                      <Input defaultValue="Doe" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address
                    </label>
                    <Input defaultValue="john.doe@example.com" type="email" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Job Title
                    </label>
                    <Input defaultValue="AI Engineer" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm resize-none"
                      rows={3}
                      defaultValue="Passionate about AI and workflow automation. Building the future of intelligent systems."
                    />
                  </div>
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Receive notifications via email</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications.email}
                        onChange={(e) => setNotifications({...notifications, email: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Push Notifications</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Receive browser push notifications</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications.push}
                        onChange={(e) => setNotifications({...notifications, push: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Workflow Updates</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Notifications about workflow executions</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications.workflow}
                        onChange={(e) => setNotifications({...notifications, workflow: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">Security Alerts</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Important security notifications</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications.security}
                        onChange={(e) => setNotifications({...notifications, security: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                  </div>
                  
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Preferences
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Password & Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Password
                    </label>
                    <Input type="password" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Password
                    </label>
                    <Input type="password" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <Input type="password" />
                  </div>
                  <Button>Update Password</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">2FA Status</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security</p>
                    </div>
                    <Badge variant="outline">Disabled</Badge>
                  </div>
                  <Button className="mt-4">Enable 2FA</Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "api" && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>API Keys</CardTitle>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Key
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{key.name}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {showApiKey ? key.key : key.key.replace(/./g, '*')}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setShowApiKey(!showApiKey)}
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Created: {key.created} • Last used: {key.lastUsed}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="icon">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Connected Integrations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {integrations.map((integration, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{integration.icon}</span>
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">{integration.name}</h3>
                            <Badge 
                              variant={integration.status === "connected" ? "success" : "secondary"}
                              className="text-xs mt-1"
                            >
                              {integration.status}
                            </Badge>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          {integration.status === "connected" ? "Configure" : "Connect"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Theme Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Theme
                    </label>
                    <select className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                      <option>System</option>
                      <option>Light</option>
                      <option>Dark</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Accent Color
                    </label>
                    <div className="flex space-x-2">
                      {['blue', 'green', 'purple', 'red', 'orange'].map(color => (
                        <div
                          key={color}
                          className={`w-8 h-8 rounded-full bg-${color}-500 cursor-pointer border-2 border-gray-300`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Appearance
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "organization" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Organization Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Organization Name
                    </label>
                    <Input defaultValue="Acme Corporation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Plan
                    </label>
                    <div className="flex items-center space-x-2">
                      <Badge variant="default">Pro Plan</Badge>
                      <Button variant="outline" size="sm">Upgrade</Button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Team Members
                    </label>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      5 of 10 members used
                    </div>
                  </div>
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Organization
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}