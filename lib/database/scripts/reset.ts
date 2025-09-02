#!/usr/bin/env tsx

/**
 * Database Reset Script
 * Completely resets the database and reinitializes it
 */

import { cleanDatabase, seedDatabase } from '../seed'
import { initializeDatabase } from '../init'
import { runMigrations } from '../migrations'
import { program } from 'commander'

program
  .name('reset')
  .description('Reset and reinitialize the entire database')
  .option('--confirm', 'Confirm the destructive operation')
  .option('--skip-seed', 'Skip seeding after reset')
  .option('--environment <env>', 'Environment (development|testing|production)', 'development')
  .action(async (options) => {
    if (!options.confirm) {
      console.error('❌ This is a destructive operation that will delete ALL data. Use --confirm to proceed.')
      process.exit(1)
    }
    
    if (options.environment === 'production') {
      console.error('❌ Database reset is not allowed in production environment.')
      process.exit(1)
    }
    
    console.log('🔄 Starting complete database reset...')
    
    try {
      // Step 1: Clean existing data
      console.log('🧹 Step 1: Cleaning existing data...')
      await cleanDatabase()
      console.log('✅ Data cleaned')
      
      // Step 2: Initialize database schemas
      console.log('🚀 Step 2: Initializing database schemas...')
      const initResult = await initializeDatabase({
        force: true,
        verbose: false
      })
      
      if (!initResult.success) {
        console.error('❌ Database initialization failed!')
        initResult.errors.forEach(error => console.error(`   - ${error}`))
        process.exit(1)
      }
      console.log('✅ Schemas initialized')
      
      // Step 3: Run migrations
      console.log('🔄 Step 3: Running migrations...')
      await runMigrations()
      console.log('✅ Migrations completed')
      
      // Step 4: Seed data (optional)
      if (!options.skipSeed) {
        console.log('🌱 Step 4: Seeding initial data...')
        const seedResult = await seedDatabase({
          environment: options.environment,
          verbose: false
        })
        
        if (seedResult.success) {
          console.log('✅ Data seeded successfully')
          console.log(`   Organizations: ${seedResult.seeded.organizations}`)
          console.log(`   Users: ${seedResult.seeded.users}`)
          console.log(`   Workflows: ${seedResult.seeded.workflows}`)
          console.log(`   Executions: ${seedResult.seeded.executions}`)
        } else {
          console.log('⚠️  Seeding completed with errors:')
          seedResult.errors.forEach(error => console.log(`   - ${error}`))
        }
      }
      
      console.log('\n🎉 Database reset completed successfully!')
      console.log('   The database is now ready for use.')
      
    } catch (error) {
      console.error('❌ Database reset failed:', error)
      process.exit(1)
    }
  })

program.parse()