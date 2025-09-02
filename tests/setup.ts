import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}))

// Mock ReactFlow
vi.mock('reactflow', () => ({
  default: vi.fn().mockImplementation(({ children, ...props }) => 
    ({ type: 'div', props: { 'data-testid': 'react-flow', ...props, children } })
  ),
  Controls: vi.fn().mockImplementation(() => 
    ({ type: 'div', props: { 'data-testid': 'react-flow-controls' } })
  ),
  MiniMap: vi.fn().mockImplementation(() => 
    ({ type: 'div', props: { 'data-testid': 'react-flow-minimap' } })
  ),
  Background: vi.fn().mockImplementation(() => 
    ({ type: 'div', props: { 'data-testid': 'react-flow-background' } })
  ),
  Panel: vi.fn().mockImplementation(({ children, ...props }) => 
    ({ type: 'div', props: { 'data-testid': 'react-flow-panel', ...props, children } })
  ),
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  addEdge: vi.fn(),
  BackgroundVariant: { Dots: 'dots' }
}))

// Mock fetch
global.fetch = vi.fn()

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})