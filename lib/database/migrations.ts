import { PrismaClient } from '@prisma/client'
import { ConnectionManager } from './connection'
import { redisSchema } from './redis-schema'
import { elasticsearchSchema } from './elasticsearch-mappings'
import fs from 'fs/promises'
import path from 'path'

export interface MigrationInfo {
  id: string
  name: string
  appliedAt: Date
  checksum: string
}

export interface MigrationScript {
  id: string
  name: string
  up: () => Promise<void>
  down: () => Promise<void>
  checksum: string
}

// Database Migration Manager
export class DatabaseMigrationManager {
  private prisma: PrismaClient
  private migrationsPath: string
  
  constructor() {
    this.prisma = ConnectionManager.getDatabase()
    this.migrationsPath = path.join(process.cwd(), 'prisma', 'migrations')
  }
  
  async ensureMigrationTable(): Promise<void> {
    // Create migration tracking table if it doesn't exist
    await this.prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS _migration_history (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(255) NOT NULL,
        execution_time_ms INTEGER,
        success BOOLEAN DEFAULT TRUE
      )
    `
  }
  
  async getAppliedMigrations(): Promise<MigrationInfo[]> {
    await this.ensureMigrationTable()
    
    const migrations = await this.prisma.$queryRaw<MigrationInfo[]>`
      SELECT id, name, applied_at as "appliedAt", checksum 
      FROM _migration_history 
      WHERE success = TRUE
      ORDER BY applied_at ASC
    `
    
    return migrations
  }
  
  async recordMigration(migration: MigrationScript, executionTimeMs: number): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO _migration_history (id, name, applied_at, checksum, execution_time_ms, success)
      VALUES (${migration.id}, ${migration.name}, CURRENT_TIMESTAMP, ${migration.checksum}, ${executionTimeMs}, TRUE)
    `
  }
  
  async removeMigrationRecord(migrationId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM _migration_history WHERE id = ${migrationId}
    `
  }
  
  async calculateChecksum(content: string): Promise<string> {
    const crypto = await import('crypto')
    return crypto.createHash('sha256').update(content).digest('hex')
  }
  
  async loadMigrationScripts(): Promise<MigrationScript[]> {
    const migrations: MigrationScript[] = []
    
    try {
      const migrationDirs = await fs.readdir(this.migrationsPath)
      
      for (const dir of migrationDirs) {
        if (dir === 'migration_lock.toml') continue
        
        const migrationPath = path.join(this.migrationsPath, dir)
        const stat = await fs.stat(migrationPath)
        
        if (stat.isDirectory()) {
          const sqlFile = path.join(migrationPath, 'migration.sql')
          
          try {
            const sqlContent = await fs.readFile(sqlFile, 'utf-8')
            const checksum = await this.calculateChecksum(sqlContent)
            
            migrations.push({
              id: dir,
              name: dir.replace(/^\d+_/, ''),
              checksum,
              up: async () => {
                // Execute the SQL migration
                const statements = sqlContent
                  .split(';')
                  .map(s => s.trim())
                  .filter(s => s.length > 0)
                
                for (const statement of statements) {
                  await this.prisma.$executeRawUnsafe(statement)
                }
              },
              down: async () => {
                // For now, we don't support automatic rollbacks
                // This would require storing rollback scripts
                throw new Error(`Rollback not implemented for migration ${dir}`)
              }
            })
          } catch (error) {
            console.warn(`Could not load migration ${dir}:`, error)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load migration scripts:', error)
    }
    
    return migrations.sort((a, b) => a.id.localeCompare(b.id))
  }
  
  async runMigrations(): Promise<void> {
    console.log('Starting database migrations...')
    
    const appliedMigrations = await this.getAppliedMigrations()
    const availableMigrations = await this.loadMigrationScripts()
    
    const appliedIds = new Set(appliedMigrations.map(m => m.id))
    const pendingMigrations = availableMigrations.filter(m => !appliedIds.has(m.id))
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations found')
      return
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations`)
    
    for (const migration of pendingMigrations) {
      const startTime = Date.now()
      
      try {
        console.log(`Applying migration: ${migration.name}`)
        await migration.up()
        
        const executionTime = Date.now() - startTime
        await this.recordMigration(migration, executionTime)
        
        console.log(`✓ Migration ${migration.name} applied successfully (${executionTime}ms)`)
      } catch (error) {
        console.error(`✗ Migration ${migration.name} failed:`, error)
        
        // Record failed migration
        await this.prisma.$executeRaw`
          INSERT INTO _migration_history (id, name, applied_at, checksum, execution_time_ms, success)
          VALUES (${migration.id}, ${migration.name}, CURRENT_TIMESTAMP, ${migration.checksum}, ${Date.now() - startTime}, FALSE)
        `
        
        throw error
      }
    }
    
    console.log('All migrations completed successfully')
  }
  
  async rollbackMigration(migrationId: string): Promise<void> {
    const migrations = await this.loadMigrationScripts()
    const migration = migrations.find(m => m.id === migrationId)
    
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`)
    }
    
    try {
      console.log(`Rolling back migration: ${migration.name}`)
      await migration.down()
      await this.removeMigrationRecord(migrationId)
      console.log(`✓ Migration ${migration.name} rolled back successfully`)
    } catch (error) {
      console.error(`✗ Rollback failed for ${migration.name}:`, error)
      throw error
    }
  }
  
  async getMigrationStatus(): Promise<{
    applied: MigrationInfo[]
    pending: string[]
    total: number
  }> {
    const applied = await this.getAppliedMigrations()
    const available = await this.loadMigrationScripts()
    const appliedIds = new Set(applied.map(m => m.id))
    const pending = available.filter(m => !appliedIds.has(m.id)).map(m => m.id)
    
    return {
      applied,
      pending,
      total: available.length
    }
  }
}

// Schema Initialization Manager
export class SchemaInitializationManager {
  private migrationManager: DatabaseMigrationManager
  
  constructor() {
    this.migrationManager = new DatabaseMigrationManager()
  }
  
  async initializeAllSchemas(): Promise<void> {
    console.log('Initializing all database schemas...')
    
    try {
      // 1. Initialize database connections
      await ConnectionManager.initialize()
      
      // 2. Run PostgreSQL migrations
      await this.migrationManager.runMigrations()
      
      // 3. Initialize Redis schema (no migration needed, just validation)
      await this.initializeRedisSchema()
      
      // 4. Initialize Elasticsearch schema
      await this.initializeElasticsearchSchema()
      
      console.log('All database schemas initialized successfully')
    } catch (error) {
      console.error('Schema initialization failed:', error)
      throw error
    }
  }
  
  private async initializeRedisSchema(): Promise<void> {
    console.log('Initializing Redis schema...')
    
    try {
      const redis = ConnectionManager.getRedis()
      
      // Test Redis connection
      await redis.ping()
      
      // Set up any required Redis configurations
      await redis.config('SET', 'maxmemory-policy', 'allkeys-lru')
      
      // Clean up any expired sessions on startup
      await redisSchema.cleanupExpiredSessions()
      
      console.log('Redis schema initialized successfully')
    } catch (error) {
      console.error('Redis schema initialization failed:', error)
      throw error
    }
  }
  
  private async initializeElasticsearchSchema(): Promise<void> {
    console.log('Initializing Elasticsearch schema...')
    
    try {
      await elasticsearchSchema.initializeSchema()
      console.log('Elasticsearch schema initialized successfully')
    } catch (error) {
      console.error('Elasticsearch schema initialization failed:', error)
      throw error
    }
  }
}

// CLI utilities for migration management
export async function runMigrations(): Promise<void> {
  const manager = new DatabaseMigrationManager()
  await manager.runMigrations()
}

export async function getMigrationStatus(): Promise<{
  applied: MigrationInfo[]
  pending: string[]
  total: number
}> {
  const manager = new DatabaseMigrationManager()
  return await manager.getMigrationStatus()
}

export async function rollbackMigration(migrationId: string): Promise<void> {
  const manager = new DatabaseMigrationManager()
  await manager.rollbackMigration(migrationId)
}

// Initialize all schemas
export async function initializeAllSchemas(): Promise<void> {
  const manager = new SchemaInitializationManager()
  await manager.initializeAllSchemas()
}