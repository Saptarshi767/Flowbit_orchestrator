# React Component Testing

This directory contains comprehensive unit tests for all React components in the AI Orchestrator platform.

## 🧪 Test Coverage

### UI Components
- ✅ `Button` - All variants, sizes, states, and interactions
- ✅ `Card` - All card components and compositions

### Workflow Editor
- ✅ `NodePalette` - Drag & drop, filtering, search functionality
- ✅ `WorkflowCanvas` - ReactFlow integration, engine support, actions

### Dashboard Components  
- ✅ `StatsCards` - Statistics display and calculations
- ✅ `RecentExecutions` - Execution list, status badges, timing
- ✅ `OrchestrationDashboard` - Main dashboard integration

### Forms & Modals
- ✅ `LoginForm` - Authentication, validation, OAuth integration
- ✅ `ExecutionDetailsModal` - Modal behavior, data fetching, error handling

## 🚀 Running Tests

### Quick Start
```bash
# Install dependencies and run all tests
npm run test-runner

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Generate coverage report
npm run test:coverage

# Open test UI
npm run test:ui
```

### Test Runner Commands
```bash
# Check if all test files exist
npm run test-runner check

# Run only unit tests
npm run test-runner unit

# Run tests in watch mode
npm run test-runner watch

# Generate coverage report
npm run test-runner coverage

# Install test dependencies
npm run test-runner install

# Show help
npm run test-runner help
```

## 📋 Test Structure

Each test file follows this structure:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentName } from './component-name'

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('handles interactions', async () => {
    const mockFn = vi.fn()
    render(<ComponentName onClick={mockFn} />)
    
    fireEvent.click(screen.getByRole('button'))
    expect(mockFn).toHaveBeenCalled()
  })
})
```

## 🛠 Testing Tools

- **Vitest** - Fast unit test runner with Jest-compatible API
- **@testing-library/react** - Simple and complete testing utilities
- **@testing-library/jest-dom** - Custom Jest matchers for DOM elements
- **@testing-library/user-event** - Advanced user interaction simulation
- **jsdom** - DOM implementation for Node.js

## 📊 Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## 🔧 Configuration

### Vitest Config (`vitest.config.ts`)
- React plugin for JSX support
- jsdom environment for DOM testing
- Path aliases matching Next.js config
- Test setup file for global mocks

### Test Setup (`tests/setup.ts`)
- Jest-DOM matchers
- Next.js router mocks
- ReactFlow component mocks
- Global fetch mock
- Window.matchMedia mock

## 📝 Writing New Tests

When adding new components, create corresponding test files:

1. **Create test file**: `components/your-component/your-component.test.tsx`
2. **Follow naming convention**: `ComponentName.test.tsx`
3. **Test key behaviors**:
   - Rendering with different props
   - User interactions
   - Error states
   - Loading states
   - Accessibility

### Example Test Template
```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YourComponent } from './your-component'

describe('YourComponent', () => {
  it('renders with default props', () => {
    render(<YourComponent />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('handles user interactions', async () => {
    const user = userEvent.setup()
    const mockFn = vi.fn()
    
    render(<YourComponent onClick={mockFn} />)
    await user.click(screen.getByRole('button'))
    
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})
```

## 🐛 Common Issues

### Mock Issues
- Ensure all external dependencies are mocked in `setup.ts`
- Use `vi.mock()` for module mocking
- Mock API calls with `global.fetch`

### Async Testing
- Use `waitFor()` for async operations
- Use `findBy*` queries for elements that appear asynchronously
- Always await user interactions with `userEvent`

### Component Dependencies
- Mock child components that aren't being tested
- Use `data-testid` for complex component queries
- Test component contracts, not implementation details

## 📈 Continuous Integration

Tests run automatically on:
- Pull requests
- Main branch pushes
- Release builds

Coverage reports are generated and stored as artifacts.

## 🎯 Best Practices

1. **Test behavior, not implementation**
2. **Use semantic queries** (`getByRole`, `getByLabelText`)
3. **Mock external dependencies**
4. **Test error states and edge cases**
5. **Keep tests focused and isolated**
6. **Use descriptive test names**
7. **Group related tests with `describe`**
8. **Clean up after tests** (automatic with testing-library)

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [User Event API](https://testing-library.com/docs/user-event/intro/)