"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Star, Download, Eye, Heart, Tag, User, Calendar, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { EngineType } from "@/types/workflow"

interface MarketplaceWorkflow {
  id: string
  name: string
  description: string
  author: {
    name: string
    avatar?: string
    verified: boolean
  }
  engineType: EngineType
  category: string
  tags: string[]
  rating: number
  downloads: number
  likes: number
  views: number
  createdAt: Date
  updatedAt: Date
  price: number // 0 for free
  featured: boolean
  thumbnail?: string
  complexity: 'beginner' | 'intermediate' | 'advanced'
}

const mockMarketplaceWorkflows: MarketplaceWorkflow[] = [
  {
    id: "mp-1",
    name: "Customer Support Automation",
    description: "Automated customer support workflow with sentiment analysis and ticket routing",
    author: { name: "Sarah Chen", verified: true },
    engineType: EngineType.LANGFLOW,
    category: "Customer Service",
    tags: ["automation", "support", "ai", "sentiment-analysis"],
    rating: 4.8,
    downloads: 1250,
    likes: 89,
    views: 3420,
    createdAt: new Date(Date.now() - 86400000 * 30),
    updatedAt: new Date(Date.now() - 86400000 * 5),
    price: 0,
    featured: true,
    complexity: 'intermediate'
  },
  {
    id: "mp-2", 
    name: "Social Media Content Generator",
    description: "AI-powered content generation for multiple social media platforms with scheduling",
    author: { name: "Alex Rodriguez", verified: true },
    engineType: EngineType.N8N,
    category: "Marketing",
    tags: ["social-media", "content", "ai", "scheduling"],
    rating: 4.6,
    downloads: 890,
    likes: 67,
    views: 2100,
    createdAt: new Date(Date.now() - 86400000 * 15),
    updatedAt: new Date(Date.now() - 86400000 * 2),
    price: 29,
    featured: false,
    complexity: 'beginner'
  },
  {
    id: "mp-3",
    name: "Document Processing Pipeline",
    description: "Advanced document analysis, extraction, and classification system",
    author: { name: "Dr. Emily Watson", verified: true },
    engineType: EngineType.LANGSMITH,
    category: "Data Processing",
    tags: ["documents", "ai", "classification", "extraction"],
    rating: 4.9,
    downloads: 2100,
    likes: 156,
    views: 5600,
    createdAt: new Date(Date.now() - 86400000 * 45),
    updatedAt: new Date(Date.now() - 86400000 * 1),
    price: 49,
    featured: true,
    complexity: 'advanced'
  }
]

const categories = [
  "All Categories",
  "Customer Service", 
  "Marketing",
  "Data Processing",
  "E-commerce",
  "Finance",
  "Healthcare",
  "Education"
]

const complexityColors = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800", 
  advanced: "bg-red-100 text-red-800"
}

export function WorkflowMarketplace() {
  const [workflows, setWorkflows] = useState<MarketplaceWorkflow[]>(mockMarketplaceWorkflows)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [selectedEngine, setSelectedEngine] = useState("all")
  const [sortBy, setSortBy] = useState("featured")
  const [priceFilter, setPriceFilter] = useState("all")
  const [complexityFilter, setComplexityFilter] = useState("all")

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === "All Categories" || workflow.category === selectedCategory
    const matchesEngine = selectedEngine === "all" || workflow.engineType === selectedEngine
    const matchesPrice = priceFilter === "all" || 
                        (priceFilter === "free" && workflow.price === 0) ||
                        (priceFilter === "paid" && workflow.price > 0)
    const matchesComplexity = complexityFilter === "all" || workflow.complexity === complexityFilter

    return matchesSearch && matchesCategory && matchesEngine && matchesPrice && matchesComplexity
  })

  const sortedWorkflows = [...filteredWorkflows].sort((a, b) => {
    switch (sortBy) {
      case "featured":
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.rating - a.rating
      case "rating":
        return b.rating - a.rating
      case "downloads":
        return b.downloads - a.downloads
      case "newest":
        return b.createdAt.getTime() - a.createdAt.getTime()
      case "price-low":
        return a.price - b.price
      case "price-high":
        return b.price - a.price
      default:
        return 0
    }
  })

  const getEngineIcon = (engineType: EngineType) => {
    switch (engineType) {
      case EngineType.LANGFLOW:
        return "🔗"
      case EngineType.N8N:
        return "⚡"
      case EngineType.LANGSMITH:
        return "🧠"
      default:
        return "🔧"
    }
  }

  const handleDownload = (workflowId: string) => {
    // Implementation for downloading workflow
    console.log("Downloading workflow:", workflowId)
  }

  const handleLike = (workflowId: string) => {
    setWorkflows(prev => prev.map(w => 
      w.id === workflowId ? { ...w, likes: w.likes + 1 } : w
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Workflow Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Discover and share AI workflows with the community
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass dark:glass-dark bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-gray-700/50">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search workflows, tags, or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-workflows"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEngine} onValueChange={setSelectedEngine}>
              <SelectTrigger>
                <SelectValue placeholder="Engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engines</SelectItem>
                <SelectItem value={EngineType.LANGFLOW}>Langflow</SelectItem>
                <SelectItem value={EngineType.N8N}>N8N</SelectItem>
                <SelectItem value={EngineType.LANGSMITH}>LangSmith</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Prices</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="downloads">Most Downloaded</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchQuery("")
              setSelectedCategory("All Categories")
              setSelectedEngine("all")
              setPriceFilter("all")
              setComplexityFilter("all")
              setSortBy("featured")
            }}>
              <Filter className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {sortedWorkflows.length} workflows
          </p>
        </div>

        {/* Workflow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="workflow-grid">
          {sortedWorkflows.map(workflow => (
            <Card key={workflow.id} className="group hover:shadow-lg transition-all duration-200 border-gray-200/50 dark:border-gray-700/50" data-testid="workflow-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getEngineIcon(workflow.engineType)}</span>
                    {workflow.featured && (
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                        Featured
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{workflow.rating}</span>
                  </div>
                </div>
                
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {workflow.name}
                </CardTitle>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {workflow.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Author */}
                <div className="flex items-center space-x-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={workflow.author.avatar} />
                    <AvatarFallback className="text-xs">
                      {workflow.author.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {workflow.author.name}
                  </span>
                  {workflow.author.verified && (
                    <Badge variant="secondary" className="text-xs">Verified</Badge>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {workflow.tags.slice(0, 3).map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {workflow.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{workflow.tags.length - 3}
                    </Badge>
                  )}
                </div>

                {/* Complexity */}
                <Badge className={`text-xs ${complexityColors[workflow.complexity]}`}>
                  {workflow.complexity}
                </Badge>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Download className="w-3 h-3" />
                      <span>{workflow.downloads}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Heart className="w-3 h-3" />
                      <span>{workflow.likes}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{workflow.views}</span>
                    </span>
                  </div>
                  <div className="font-medium">
                    {workflow.price === 0 ? 'Free' : `$${workflow.price}`}
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleDownload(workflow.id)}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    {workflow.price === 0 ? 'Download' : 'Purchase'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleLike(workflow.id)}
                  >
                    <Heart className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Eye className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedWorkflows.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No workflows found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search criteria or filters
            </p>
          </div>
        )}
      </div>
    </div>
  )
}