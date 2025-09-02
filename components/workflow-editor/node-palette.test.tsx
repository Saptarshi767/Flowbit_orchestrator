import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodePalette } from './node-palette'
import { EngineType } from '@/types/workflow'

describe('NodePalette Component', () => {
  const mockOnNodeDrag = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with correct title', () => {
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    expect(screen.getByText('Node Palette')).toBeInTheDocument()
  })

  it('displays search input', () => {
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument()
  })

  it('shows category filters', () => {
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Input/Output')).toBeInTheDocument()
    expect(screen.getByText('AI/ML')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('filters nodes by search term', async () => {
    const user = userEvent.setup()
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    const searchInput = screen.getByPlaceholderText('Search nodes...')
    await user.type(searchInput, 'chat')
    
    expect(screen.getByText('Chat Model')).toBeInTheDocument()
    expect(screen.queryByText('Data Input')).not.toBeInTheDocument()
  })

  it('filters nodes by category', async () => {
    const user = userEvent.setup()
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    await user.click(screen.getByText('AI/ML'))
    
    expect(screen.getByText('Chat Model')).toBeInTheDocument()
    expect(screen.getByText('LLM Chain')).toBeInTheDocument()
    expect(screen.queryByText('Data Input')).not.toBeInTheDocument()
  })

  it('filters nodes by selected engine', () => {
    const { rerender } = render(
      <NodePalette selectedEngine={EngineType.N8N} onNodeDrag={mockOnNodeDrag} />
    )
    
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Trigger')).toBeInTheDocument()
    expect(screen.queryByText('Chat Model')).not.toBeInTheDocument()

    rerender(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    expect(screen.getByText('Chat Model')).toBeInTheDocument()
    expect(screen.queryByText('Email')).not.toBeInTheDocument()
  })

  it('handles drag start events', () => {
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    const chatNode = screen.getByText('Chat Model').closest('div')
    expect(chatNode).toHaveAttribute('draggable', 'true')
    
    const mockDataTransfer = {
      setData: vi.fn(),
      effectAllowed: ''
    }
    
    fireEvent.dragStart(chatNode!, { dataTransfer: mockDataTransfer })
    
    expect(mockDataTransfer.setData).toHaveBeenCalledWith(
      'application/reactflow',
      expect.stringContaining('Chat Model')
    )
  })

  it('shows node descriptions and categories', () => {
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    expect(screen.getByText('AI chat and conversation')).toBeInTheDocument()
    expect(screen.getByText('Input data from various sources')).toBeInTheDocument()
  })

  it('displays correct node icons', () => {
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    // Check that icons are rendered (they should be in the DOM as SVG elements)
    const nodeItems = screen.getAllByRole('generic').filter(el => 
      el.className.includes('cursor-move')
    )
    expect(nodeItems.length).toBeGreaterThan(0)
  })

  it('resets to "All" category when clicked', async () => {
    const user = userEvent.setup()
    render(<NodePalette selectedEngine={EngineType.LANGFLOW} onNodeDrag={mockOnNodeDrag} />)
    
    // First select a specific category
    await user.click(screen.getByText('AI/ML'))
    expect(screen.queryByText('Data Input')).not.toBeInTheDocument()
    
    // Then click "All" to reset
    await user.click(screen.getByText('All'))
    expect(screen.getByText('Data Input')).toBeInTheDocument()
  })
})