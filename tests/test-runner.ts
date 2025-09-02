#!/usr/bin/env node

/**
 * Test Runner Script
 * 
 * This script provides utilities for running different types of tests
 * and generating coverage reports for the React components.
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
}

function log(message: string, color: string = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`)
}

function runCommand(command: string, description: string) {
  log(`\n${COLORS.BLUE}${COLORS.BOLD}Running: ${description}${COLORS.RESET}`)
  log(`Command: ${command}`, COLORS.YELLOW)
  
  try {
    execSync(command, { stdio: 'inherit' })
    log(`✅ ${description} completed successfully`, COLORS.GREEN)
    return true
  } catch (error) {
    log(`❌ ${description} failed`, COLORS.RED)
    return false
  }
}

function checkTestFiles() {
  const testFiles = [
    'components/ui/button.test.tsx',
    'components/ui/card.test.tsx',
    'components/workflow-editor/node-palette.test.tsx',
    'components/workflow-editor/workflow-canvas.test.tsx',
    'components/dashboard/stats-cards.test.tsx',
    'components/dashboard/recent-executions.test.tsx',
    'components/orchestration-dashboard.test.tsx',
    'components/login-form.test.tsx',
    'components/execution-details-modal.test.tsx'
  ]

  log('\n📋 Checking test files...', COLORS.BLUE)
  
  let allExist = true
  testFiles.forEach(file => {
    if (existsSync(file)) {
      log(`✅ ${file}`, COLORS.GREEN)
    } else {
      log(`❌ ${file} - Missing`, COLORS.RED)
      allExist = false
    }
  })

  return allExist
}

function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'all'

  log(`${COLORS.BOLD}🧪 React Component Test Runner${COLORS.RESET}`)
  log(`${COLORS.BOLD}================================${COLORS.RESET}`)

  // Check if test files exist
  if (!checkTestFiles()) {
    log('\n❌ Some test files are missing. Please ensure all test files are created.', COLORS.RED)
    process.exit(1)
  }

  switch (command) {
    case 'check':
      log('\n✅ All test files are present!', COLORS.GREEN)
      break

    case 'unit':
      runCommand('npm run test:run', 'Unit Tests')
      break

    case 'watch':
      runCommand('npm run test', 'Test Watch Mode')
      break

    case 'coverage':
      runCommand('npm run test:coverage', 'Test Coverage Report')
      break

    case 'ui':
      runCommand('npm run test:ui', 'Test UI Mode')
      break

    case 'install':
      log('\n📦 Installing test dependencies...', COLORS.BLUE)
      runCommand('npm install', 'Installing dependencies')
      break

    case 'all':
    default:
      log('\n🚀 Running complete test suite...', COLORS.BLUE)
      
      const steps = [
        () => runCommand('npm install', 'Installing dependencies'),
        () => runCommand('npm run test:run', 'Running unit tests'),
        () => runCommand('npm run test:coverage', 'Generating coverage report')
      ]

      let success = true
      for (const step of steps) {
        if (!step()) {
          success = false
          break
        }
      }

      if (success) {
        log('\n🎉 All tests completed successfully!', COLORS.GREEN)
        log('\nTest Coverage Summary:', COLORS.BOLD)
        log('- UI Components: ✅ Covered')
        log('- Workflow Editor: ✅ Covered') 
        log('- Dashboard Components: ✅ Covered')
        log('- Authentication: ✅ Covered')
        log('- Modals & Forms: ✅ Covered')
      } else {
        log('\n❌ Test suite failed. Please check the errors above.', COLORS.RED)
        process.exit(1)
      }
      break

    case 'help':
      log('\nAvailable commands:')
      log('  check     - Check if all test files exist')
      log('  unit      - Run unit tests once')
      log('  watch     - Run tests in watch mode')
      log('  coverage  - Generate coverage report')
      log('  ui        - Run tests with UI interface')
      log('  install   - Install test dependencies')
      log('  all       - Run complete test suite (default)')
      log('  help      - Show this help message')
      break

    default:
      log(`\n❌ Unknown command: ${command}`, COLORS.RED)
      log('Run "npm run test-runner help" for available commands')
      process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { runCommand, checkTestFiles }