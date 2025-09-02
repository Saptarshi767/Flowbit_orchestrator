#!/usr/bin/env tsx

/**
 * Database Migration Script
 * Runs database migrations
 */

import { runMigrations, getMigrationStatus, rollbackMigration } from '../migrations'
import { program } from 'commander'

program
  .name('migrate')
  .description('Database migration management')

program
  .command('up')
  .description('Run pending migrations')
  .action(async () => {
    console.log('🔄 Running database migrations...')
    
    try {
      await runMigrations()
      console.log('✅ All migrations completed successfully!')
    } catch (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    console.log('📊 Checking migration status...')
    
    try {
      const status = await getMigrationStatus()
      
      console.log(`\n📈 Migration Status:`)
      console.log(`   Total migrations: ${status.total}`)
      console.log(`   Applied: ${status.applied.length}`)
      console.log(`   Pending: ${status.pending.length}`)
      
      if (status.applied.length > 0) {
        console.log('\n✅ Applied migrations:')
        status.applied.forEach(migration => {
          console.log(`   - ${migration.name} (${migration.appliedAt.toISOString()})`)
        })
      }
      
      if (status.pending.length > 0) {
        console.log('\n⏳ Pending migrations:')
        status.pending.forEach(migration => {
          console.log(`   - ${migration}`)
        })
      }
    } catch (error) {
      console.error('❌ Failed to get migration status:', error)
      process.exit(1)
    }
  })

program
  .command('rollback')
  .description('Rollback a specific migration')
  .argument('<migration-id>', 'Migration ID to rollback')
  .action(async (migrationId) => {
    console.log(`🔄 Rolling back migration: ${migrationId}`)
    
    try {
      await rollbackMigration(migrationId)
      console.log('✅ Migration rolled back successfully!')
    } catch (error) {
      console.error('❌ Rollback failed:', error)
      process.exit(1)
    }
  })

program.parse()