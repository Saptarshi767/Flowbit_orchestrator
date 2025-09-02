#!/usr/bin/env tsx

/**
 * Database Initialization Script
 * Initializes all database schemas and connections
 */

import { initializeDatabase, InitializationOptions } from '../init'
import { program } from 'commander'

program
  .name('init-db')
  .description('Initialize database schemas and connections')
  .option('--skip-redis', 'Skip Redis initialization')
  .option('--skip-elasticsearch', 'Skip Elasticsearch initialization')
  .option('--force', 'Force initialization even if already initialized')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🚀 Starting database initialization...')
    
    const initOptions: InitializationOptions = {
      skipRedis: options.skipRedis,
      skipElasticsearch: options.skipElasticsearch,
      force: options.force,
      verbose: options.verbose
    }
    
    try {
      const result = await initializeDatabase(initOptions)
      
      if (result.success) {
        console.log('✅ Database initialization completed successfully!')
        console.log(`   PostgreSQL: ${result.postgresql ? '✅' : '❌'}`)
        console.log(`   Redis: ${result.redis ? '✅' : '❌'}`)
        console.log(`   Elasticsearch: ${result.elasticsearch ? '✅' : '❌'}`)
        
        if (result.warnings.length > 0) {
          console.log('\n⚠️  Warnings:')
          result.warnings.forEach(warning => console.log(`   - ${warning}`))
        }
        
        process.exit(0)
      } else {
        console.error('❌ Database initialization failed!')
        result.errors.forEach(error => console.error(`   - ${error}`))
        process.exit(1)
      }
    } catch (error) {
      console.error('❌ Database initialization failed:', error)
      process.exit(1)
    }
  })

program.parse()