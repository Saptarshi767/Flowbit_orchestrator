"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  BookOpen, 
  Code, 
  Zap, 
  Settings, 
  HelpCircle,
  ExternalLink,
  FileText,
  Video,
  Github
} from "lucide-react"

const documentationSections = [
  {
    title: "Getting Started",
    icon: BookOpen,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    items: [
      { title: "Quick Start Guide", type: "guide", readTime: "5 min" },
      { title: "Creating Your First Workflow", type: "tutorial", readTime: "10 min" },
      { title: "Understanding Engines", type: "concept", readTime: "8 min" },
      { title: "Dashboard Overview", type: "guide", readTime: "3 min" }
    ]
  },
  {
    title: "Workflow Builder",
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    items: [
      { title: "Drag & Drop Interface", type: "guide", readTime: "7 min" },
      { title: "Node Types and Configuration", type: "reference", readTime: "15 min" },
      { title: "Connecting Nodes", type: "tutorial", readTime: "5 min" },
      { title: "Testing and Debugging", type: "guide", readTime: "12 min" }
    ]
  },
  {
    title: "API Reference",
    icon: Code,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-900/20",
    items: [
      { title: "Authentication", type: "reference", readTime: "10 min" },
      { title: "Workflow API", type: "reference", readTime: "20 min" },
      { title: "Execution API", type: "reference", readTime: "15 min" },
      { title: "Webhooks", type: "reference", readTime: "8 min" }
    ]
  },
  {
    title: "Integrations",
    icon: Settings,
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    items: [
      { title: "Langflow Integration", type: "guide", readTime: "12 min" },
      { title: "N8N Integration", type: "guide", readTime: "10 min" },
      { title: "LangSmith Integration", type: "guide", readTime: "8 min" },
      { title: "Custom Integrations", type: "tutorial", readTime: "25 min" }
    ]
  }
]

const popularArticles = [
  { title: "How to Build an AI Content Generator", type: "tutorial", readTime: "20 min", views: 1247 },
  { title: "Setting Up Automated Email Campaigns", type: "guide", readTime: "15 min", views: 892 },
  { title: "Document Processing with AI", type: "tutorial", readTime: "18 min", views: 634 },
  { title: "API Rate Limiting Best Practices", type: "guide", readTime: "8 min", views: 567 },
  { title: "Troubleshooting Common Issues", type: "reference", readTime: "12 min", views: 445 }
]

const resources = [
  { title: "Video Tutorials", icon: Video, description: "Step-by-step video guides", link: "#" },
  { title: "GitHub Repository", icon: Github, description: "Source code and examples", link: "#" },
  { title: "Community Forum", icon: HelpCircle, description: "Get help from the community", link: "#" },
  { title: "API Playground", icon: Code, description: "Test API endpoints interactively", link: "#" }
]

const typeColors = {
  guide: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
  tutorial: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
  reference: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
  concept: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
}

export default function DocsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Documentation
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Learn how to build and manage AI workflows
            </p>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search documentation..."
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {resources.map((resource, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <resource.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {resource.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {resource.description}
                </p>
                <div className="flex items-center justify-center text-blue-600 text-sm">
                  <span>Learn more</span>
                  <ExternalLink className="w-3 h-3 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Documentation Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {documentationSections.map((section, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${section.bgColor}`}>
                    <section.icon className={`w-5 h-5 ${section.color}`} />
                  </div>
                  <CardTitle>{section.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {item.title}
                          </h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className={`text-xs ${typeColors[item.type]}`}>
                              {item.type}
                            </Badge>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.readTime}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Popular Articles */}
        <Card>
          <CardHeader>
            <CardTitle>Popular Articles</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Most viewed documentation articles
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {popularArticles.map((article, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {article.title}
                      </h3>
                      <div className="flex items-center space-x-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <Badge className={`text-xs ${typeColors[article.type]}`}>
                          {article.type}
                        </Badge>
                        <span>{article.readTime}</span>
                        <span>{article.views} views</span>
                      </div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}