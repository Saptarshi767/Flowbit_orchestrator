#!/usr/bin/env tsx

/**
 * Database Connection Test Script
 * Tests the connection to the Neon PostgreSQL database
 */

import { PrismaClient } from '@prisma/client'
import { program } from 'commander'

program
  .name('test-connection')
  .description('Test database connection')
  .action(async () => {
    console.log('🔍 Testing database connection...')
    
    const prisma = new PrismaClient({
      log: ['info', 'warn', 'error'],
    })
    
    try {
      // Test basic connection
      console.log('📡 Connecting to database...')
      await prisma.$connect()
      console.log('✅ Database connection established')
      
      // Test query execution
      console.log('🔍 Testing query execution...')
      const result = await prisma.$queryRaw`SELECT 1 as test`
      console.log('✅ Query executed successfully:', result)
      
      // Test database info
      console.log('📊 Getting database information...')
      const dbInfo = await prisma.$queryRaw`
        SELECT 
          current_database() as database_name,
          current_user as user_name,
          version() as version
      `
      console.log('✅ Database info:', dbInfo)
      
      // Check if tables exist
      console.log('📋 Checking existing tables...')
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `
      console.log('📋 Existing tables:', tables)
      
      console.log('\n🎉 Database connection test completed successfully!')
      
    } catch (error) {
      console.error('❌ Database connection test failed:', error)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
      console.log('🔌 Database connection closed')
    }
  })

program.parse()