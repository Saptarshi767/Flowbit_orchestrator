# Database Implementation

This directory contains the complete database implementation for the Robust AI Orchestrator, including PostgreSQL schema, Redis caching, Elasticsearch search, and migration management.

## Architecture Overview

The database layer consists of three main components:

1. **PostgreSQL** - Primary relational database for core application data
2. **Redis** - In-memory cache and session store
3. **Elasticsearch** - Search engine and analytics data store

## Directory Structure

```
lib/database/
├── README.md                 # This file
├── config.ts                 # Database configuration
├── connection.ts             # Connection management
├── init.ts                   # Database initialization
├── migrations.ts             # Migration management
├── seed.ts                   # Data seeding
├── redis-schema.ts           # Redis schema and operations
├── elasticsearch-mappings.ts # Elasticsearch mappings
├── scripts/                  # CLI management scripts
│   ├── init-db.ts           # Initialize databases
│   ├── migrate.ts           # Run migrations
│   ├── seed.ts              # Seed data
│   ├── status.ts            # Check status
│   └── reset.ts             # Reset databases
├── sql/                     # SQL scripts
│   └── init.sql             # PostgreSQL initialization
└── redis/                   # Redis configuration
    └── redis.conf           # Redis configuration file
```

## Quick Start

### 1. Environment Setup

Copy the environment template and configure your database connections:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your database connection details.

**For Neon PostgreSQL (Cloud):**
The project is configured to work with Neon PostgreSQL. Your DATABASE_URL should look like:
```
DATABASE_URL='postgresql://username:password@ep-xxx-pooler.region.neon.tech/dbname?sslmode=require&channel_binding=require'
```

**For Local Development:**
If using local PostgreSQL, Redis, and Elasticsearch:
```
DATABASE_URL="postgresql://username:password@localhost:5432/orchestrator"
REDIS_URL="redis://localhost:6379"
ELASTICSEARCH_URL="http://localhost:9200"
```

### 2. Start Database Services

Using Docker Compose (recommended for development):

```bash
# Start all database services
docker-compose -f docker-compose.db.yml up -d

# Check service health
docker-compose -f docker-compose.db.yml ps
```

### 3. Initialize Databases

```bash
# Install dependencies
npm install

# Initialize all database schemas
npm run db:init

# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 4. Verify Setup

```bash
# Check database status
npm run db:status
```

## Database Management Commands

### Connection Testing
```bash
# Test database connection (especially useful for Neon setup)
npm run db:test
```

### Initialization
```bash
# Initialize all databases
npm run db:init

# Initialize with options
npm run db:init -- --skip-redis --verbose
```

### Migrations
```bash
# Run pending migrations
npm run db:migrate up

# Check migration status
npm run db:migrate status

# Rollback a migration
npm run db:migrate rollback <migration-id>
```

### Seeding
```bash
# Seed development data
npm run db:seed run

# Seed for specific environment
npm run db:seed run --environment testing

# Clean all data
npm run db:seed clean --confirm
```

### Status and Health
```bash
# Check overall database health
npm run db:status

# Reset everything (development only)
npm run db:reset --confirm
```

## PostgreSQL Schema

### Core Tables

- **organizations** - Multi-tenant organization data
- **users** - User accounts and profiles
- **workflows** - Workflow definitions and metadata
- **workflow_versions** - Version history for workflows
- **executions** - Workflow execution records
- **marketplace_items** - Shared workflow marketplace

### Key Features

- **Multi-tenancy** - Organization-based data isolation
- **Versioning** - Complete workflow version history
- **RBAC** - Role-based access control
- **Audit Trail** - Complete audit logging
- **Performance** - Optimized indexes and queries

### Indexes

The schema includes optimized indexes for:
- User lookups by organization
- Workflow searches by engine type
- Execution queries by status and time
- Full-text search capabilities

## Redis Schema

### Key Patterns

- **Sessions**: `session:{sessionId}`
- **Cache**: `cache:{type}:{id}`
- **Rate Limiting**: `rate_limit:{identifier}:{window}`
- **Execution State**: `execution:status:{executionId}`
- **Queues**: `queue:{type}`

### Features

- **Session Management** - User session storage
- **Caching** - Application data caching
- **Rate Limiting** - API rate limiting
- **Real-time State** - Execution progress tracking
- **Pub/Sub** - Real-time notifications

## Elasticsearch Mappings

### Indices

- **workflows** - Workflow search and discovery
- **executions** - Execution logs and analytics
- **audit_logs** - Security and compliance logging
- **system_metrics** - Performance monitoring
- **marketplace** - Marketplace search

### Features

- **Full-text Search** - Advanced search capabilities
- **Analytics** - Performance and usage analytics
- **Log Aggregation** - Centralized logging
- **ILM Policies** - Automated data lifecycle management

## Connection Management

### Connection Pooling

The system uses connection pooling for optimal performance:

- **PostgreSQL**: Prisma connection pooling
- **Redis**: Built-in connection management
- **Elasticsearch**: HTTP connection pooling

### Health Checks

Automated health checks monitor:
- Database connectivity
- Query performance
- Memory usage
- Disk space

### Failover

The system includes failover mechanisms:
- Automatic reconnection
- Circuit breaker patterns
- Graceful degradation

## Migration System

### Features

- **Version Control** - Track applied migrations
- **Rollback Support** - Safe rollback capabilities
- **Checksum Validation** - Ensure migration integrity
- **Parallel Execution** - Safe concurrent migrations

### Migration Files

Migrations are stored in `prisma/migrations/` and managed by:
- Prisma for schema changes
- Custom scripts for data migrations
- Version tracking in `_migration_history`

## Performance Optimization

### Database Optimization

- **Indexes** - Strategic index placement
- **Query Optimization** - Efficient query patterns
- **Connection Pooling** - Optimal connection management
- **Partitioning** - Large table partitioning (future)

### Caching Strategy

- **Application Cache** - Frequently accessed data
- **Query Cache** - Database query results
- **Session Cache** - User session data
- **CDN Integration** - Static asset caching

### Monitoring

- **Query Performance** - Slow query monitoring
- **Connection Metrics** - Pool utilization
- **Cache Hit Rates** - Cache effectiveness
- **Error Tracking** - Database error monitoring

## Security

### Access Control

- **Database Users** - Separate users for different services
- **Connection Encryption** - TLS for all connections
- **Password Policies** - Strong password requirements
- **Network Security** - VPC and firewall rules

### Data Protection

- **Encryption at Rest** - Database encryption
- **Encryption in Transit** - TLS connections
- **Backup Encryption** - Encrypted backups
- **Key Management** - Secure key storage

### Compliance

- **Audit Logging** - Complete audit trail
- **Data Retention** - Configurable retention policies
- **GDPR Compliance** - Data export and deletion
- **SOC2 Compliance** - Security controls

## Backup and Recovery

### Backup Strategy

- **Automated Backups** - Daily automated backups
- **Point-in-time Recovery** - Transaction log backups
- **Cross-region Replication** - Geographic redundancy
- **Backup Validation** - Regular restore testing

### Disaster Recovery

- **RTO/RPO Targets** - Recovery time objectives
- **Failover Procedures** - Automated failover
- **Data Replication** - Real-time replication
- **Recovery Testing** - Regular DR testing

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   ```bash
   # Check connection pool settings
   npm run db:status
   ```

2. **Migration Failures**
   ```bash
   # Check migration status
   npm run db:migrate status
   ```

3. **Performance Issues**
   ```bash
   # Monitor slow queries
   # Check index usage
   # Review connection pool metrics
   ```

### Debugging

- **Log Analysis** - Database and application logs
- **Performance Monitoring** - Query performance metrics
- **Connection Monitoring** - Pool utilization
- **Error Tracking** - Database error patterns

## Development

### Local Development

1. Start database services with Docker Compose
2. Run migrations and seeding
3. Use database GUIs for inspection:
   - pgAdmin: http://localhost:8080
   - Redis Commander: http://localhost:8081
   - Kibana: http://localhost:5601

### Testing

- **Unit Tests** - Database layer testing
- **Integration Tests** - End-to-end database testing
- **Performance Tests** - Load testing
- **Migration Tests** - Migration validation

### Contributing

1. Follow the established patterns
2. Add appropriate indexes
3. Include migration scripts
4. Update documentation
5. Add tests for new features

## Production Deployment

### Requirements

- PostgreSQL 16+
- Redis 7+
- Elasticsearch 8.11+
- Sufficient memory and storage
- Network connectivity

### Configuration

- Review all environment variables
- Configure connection pools
- Set up monitoring
- Configure backups
- Implement security measures

### Monitoring

- Database performance metrics
- Connection pool utilization
- Query performance
- Error rates and patterns
- Backup success/failure

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review database logs
3. Check service health status
4. Consult the team documentation
5. Create an issue in the project repository