#!/usr/bin/env tsx

/**
 * Database Seeding Script
 * Seeds the database with initial data
 */

import { seedDatabase, cleanDatabase, SeedOptions } from '../seed'
import { program } from 'commander'

program
  .name('seed')
  .description('Database seeding management')

program
  .command('run')
  .description('Seed the database with initial data')
  .option('--skip-redis', 'Skip Redis data seeding')
  .option('--skip-elasticsearch', 'Skip Elasticsearch data seeding')
  .option('--environment <env>', 'Environment (development|testing|production)', 'development')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🌱 Starting database seeding...')
    
    const seedOptions: SeedOptions = {
      skipRedis: options.skipRedis,
      skipElasticsearch: options.skipElasticsearch,
      environment: options.environment,
      verbose: options.verbose
    }
    
    try {
      const result = await seedDatabase(seedOptions)
      
      if (result.success) {
        console.log('✅ Database seeding completed successfully!')
        console.log(`   Organizations: ${result.seeded.organizations}`)
        console.log(`   Users: ${result.seeded.users}`)
        console.log(`   Workflows: ${result.seeded.workflows}`)
        console.log(`   Executions: ${result.seeded.executions}`)
        
        if (result.errors.length > 0) {
          console.log('\n⚠️  Errors:')
          result.errors.forEach(error => console.log(`   - ${error}`))
        }
      } else {
        console.error('❌ Database seeding failed!')
        result.errors.forEach(error => console.error(`   - ${error}`))
        process.exit(1)
      }
    } catch (error) {
      console.error('❌ Database seeding failed:', error)
      process.exit(1)
    }
  })

program
  .command('clean')
  .description('Clean all data from the database')
  .option('--confirm', 'Confirm the destructive operation')
  .action(async (options) => {
    if (!options.confirm) {
      console.error('❌ This is a destructive operation. Use --confirm to proceed.')
      process.exit(1)
    }
    
    console.log('🧹 Cleaning database...')
    
    try {
      await cleanDatabase()
      console.log('✅ Database cleaned successfully!')
    } catch (error) {
      console.error('❌ Database cleaning failed:', error)
      process.exit(1)
    }
  })

program.parse()