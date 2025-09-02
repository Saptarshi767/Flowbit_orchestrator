#!/usr/bin/env tsx

/**
 * Database Status Script
 * Shows the status of all database connections and schemas
 */

import { checkDatabaseHealth } from '../init'
import { getMigrationStatus } from '../migrations'
import { ConnectionManager } from '../connection'
import { program } from 'commander'

program
  .name('status')
  .description('Check database status and health')
  .action(async () => {
    console.log('🔍 Checking database status...')
    
    try {
      // Check overall health
      const health = await checkDatabaseHealth()
      
      console.log(`\n🏥 Database Health (${health.timestamp.toISOString()}):`)
      console.log(`   Overall: ${health.overall ? '✅ Healthy' : '❌ Unhealthy'}`)
      console.log(`   PostgreSQL: ${health.details.postgresql ? '✅ Connected' : '❌ Disconnected'}`)
      console.log(`   Redis: ${health.details.redis ? '✅ Connected' : '❌ Disconnected'}`)
      console.log(`   Elasticsearch: ${health.details.elasticsearch ? '✅ Connected' : '❌ Disconnected'}`)
      
      // Check migration status
      if (health.details.postgresql) {
        try {
          const migrationStatus = await getMigrationStatus()
          console.log(`\n📊 Migration Status:`)
          console.log(`   Total migrations: ${migrationStatus.total}`)
          console.log(`   Applied: ${migrationStatus.applied.length}`)
          console.log(`   Pending: ${migrationStatus.pending.length}`)
          
          if (migrationStatus.pending.length > 0) {
            console.log(`   ⚠️  ${migrationStatus.pending.length} migrations pending`)
          }
        } catch (error) {
          console.log(`   ❌ Could not check migration status: ${error}`)
        }
      }
      
      // Check Redis memory usage
      if (health.details.redis) {
        try {
          await ConnectionManager.initialize()
          const redis = ConnectionManager.getRedis()
          const info = await redis.info('memory')
          const lines = info.split('\r\n')
          const usedMemory = lines.find(line => line.startsWith('used_memory_human:'))?.split(':')[1] || 'Unknown'
          const peakMemory = lines.find(line => line.startsWith('used_memory_peak_human:'))?.split(':')[1] || 'Unknown'
          
          console.log(`\n💾 Redis Memory Usage:`)
          console.log(`   Current: ${usedMemory}`)
          console.log(`   Peak: ${peakMemory}`)
        } catch (error) {
          console.log(`   ❌ Could not check Redis memory: ${error}`)
        }
      }
      
      // Check Elasticsearch cluster health
      if (health.details.elasticsearch) {
        try {
          const es = ConnectionManager.getElasticsearch()
          const clusterHealth = await es.cluster.health()
          
          console.log(`\n🔍 Elasticsearch Cluster:`)
          console.log(`   Status: ${clusterHealth.status}`)
          console.log(`   Nodes: ${clusterHealth.number_of_nodes}`)
          console.log(`   Data nodes: ${clusterHealth.number_of_data_nodes}`)
          console.log(`   Active shards: ${clusterHealth.active_shards}`)
          
          if (clusterHealth.status === 'red') {
            console.log(`   ⚠️  Cluster status is RED - some data may be unavailable`)
          }
        } catch (error) {
          console.log(`   ❌ Could not check Elasticsearch cluster: ${error}`)
        }
      }
      
      if (!health.overall) {
        process.exit(1)
      }
      
    } catch (error) {
      console.error('❌ Failed to check database status:', error)
      process.exit(1)
    }
  })

program.parse()