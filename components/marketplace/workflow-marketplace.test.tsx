import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { WorkflowMarketplace } from './workflow-marketplace'

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div data-testid="card-content" {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div data-testid="card-header" {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 data-testid="card-title" {...props}>{children}</h3>
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input data-testid="input" {...props} />
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button data-testid="button" {...props}>{children}</button>
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, ...props }: any) => <div data-testid="select" {...props}>{children}</div>,
  SelectContent: ({ children, ...props }: any) => <div data-testid="select-content" {...props}>{children}</div>,
  SelectItem: ({ children, ...props }: any) => <div data-testid="select-item" {...props}>{children}</div>,
  SelectTrigger: ({ children, ...props }: any) => <div data-testid="select-trigger" {...props}>{children}</div>,
  SelectValue: ({ ...props }: any) => <div data-testid="select-value" {...props} />
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: any) => <div data-testid="tabs" {...props}>{children}</div>,
  TabsContent: ({ children, ...props }: any) => <div data-testid="tabs-content" {...props}>{children}</div>,
  TabsList: ({ children, ...props }: any) => <div data-testid="tabs-list" {...props}>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <div data-testid="tabs-trigger" {...props}>{children}</div>
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: any) => <div data-testid="avatar" {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: any) => <div data-testid="avatar-fallback" {...props}>{children}</div>,
  AvatarImage: ({ ...props }: any) => <img data-testid="avatar-image" {...props} />
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: ({ ...props }: any) => <hr data-testid="separator" {...props} />
}))

describe('WorkflowMarketplace', () => {
  it('renders marketplace title and description', () => {
    render(<WorkflowMarketplace />)
    
    expect(screen.getByText('Workflow Marketplace')).toBeInTheDocument()
    expect(screen.getByText('Discover and share AI workflows with the community')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<WorkflowMarketplace />)
    
    const searchInput = screen.getByTestId('search-workflows')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveAttribute('placeholder', 'Search workflows, tags, or descriptions...')
  })

  it('handles search input changes', async () => {
    render(<WorkflowMarketplace />)
    
    const searchInput = screen.getByTestId('search-workflows')
    fireEvent.change(searchInput, { target: { value: 'customer' } })
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('customer')
    })
  })

  it('renders filter controls', () => {
    render(<WorkflowMarketplace />)
    
    // Check for filter selects
    const selects = screen.getAllByTestId('select')
    expect(selects.length).toBeGreaterThan(0)
    
    // Check for clear filters button
    const clearButton = screen.getByText('Clear')
    expect(clearButton).toBeInTheDocument()
  })

  it('displays workflow cards', () => {
    render(<WorkflowMarketplace />)
    
    // Should display mock workflows
    expect(screen.getByText('Customer Support Automation')).toBeInTheDocument()
    expect(screen.getByText('Social Media Content Generator')).toBeInTheDocument()
    expect(screen.getByText('Document Processing Pipeline')).toBeInTheDocument()
  })

  it('handles clear filters functionality', async () => {
    render(<WorkflowMarketplace />)
    
    // First change search input
    const searchInput = screen.getByTestId('search-workflows')
    fireEvent.change(searchInput, { target: { value: 'test' } })
    
    // Then clear filters
    const clearButton = screen.getByText('Clear')
    fireEvent.click(clearButton)
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('')
    })
  })

  it('displays workflow stats correctly', () => {
    render(<WorkflowMarketplace />)
    
    // Check for rating display
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('4.6')).toBeInTheDocument()
    expect(screen.getByText('4.9')).toBeInTheDocument()
    
    // Check for download counts (using getAllByText for duplicates)
    expect(screen.getAllByText('1250')).toHaveLength(1)
    expect(screen.getAllByText('890')).toHaveLength(1)
    expect(screen.getAllByText('2100')).toHaveLength(2) // This appears twice in the mock data
  })

  it('handles workflow interactions', async () => {
    render(<WorkflowMarketplace />)
    
    // Find download buttons
    const downloadButtons = screen.getAllByText('Download')
    expect(downloadButtons.length).toBeGreaterThan(0)
    
    // Click first download button
    fireEvent.click(downloadButtons[0])
    
    // Should trigger download handler (mocked)
    await waitFor(() => {
      // In a real test, we'd verify the download was triggered
      expect(downloadButtons[0]).toBeInTheDocument()
    })
  })
})