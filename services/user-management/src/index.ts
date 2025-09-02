import dotenv from 'dotenv'
import { UserManagementApp } from './app'

// Load environment variables
dotenv.config()

// Start the application
const app = new UserManagementApp()
const port = parseInt(process.env.PORT || '3002')

app.start(port).catch((error) => {
  console.error('Failed to start User Management Service:', error)
  process.exit(1)
})