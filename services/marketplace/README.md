# Marketplace Service

The Marketplace Service is a core component of the Robust AI Orchestrator that provides workflow sharing, discovery, and monetization capabilities. It enables users to publish, search, rate, and download workflows across different AI orchestration engines.

## Features

### Core Functionality
- **Workflow Publishing**: Publish workflows from different engines (Langflow, N8N, LangSmith) to the marketplace
- **Search & Discovery**: Advanced search with filters, facets, and full-text search capabilities
- **Rating & Reviews**: Community-driven rating and review system for workflows
- **Download Tracking**: Track workflow downloads and usage analytics
- **Categorization**: Organize workflows by categories and tags
- **Versioning**: Support for workflow versioning and change tracking

### Advanced Features
- **Recommendation Engine**: AI-powered recommendations based on user behavior and content similarity
- **Collections**: Curated collections of workflows for specific use cases
- **Premium Workflows**: Support for paid/premium workflow offerings
- **Analytics**: Comprehensive marketplace statistics and insights
- **Multi-tenancy**: Organization-based isolation and sharing controls

## Architecture

The service follows a layered architecture pattern:

```
┌─────────────────────────────────────┐
│           API Routes                │
├─────────────────────────────────────┤
│         Service Layer               │
│  ┌─────────────┐ ┌─────────────────┐│
│  │ Marketplace │ │   Collection    ││
│  │   Service   │ │    Service      ││
│  └─────────────┘ └─────────────────┘│
├─────────────────────────────────────┤
│        Repository Layer             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐│
│  │Workflow │ │ Rating  │ │Download ││
│  │  Repo   │ │  Repo   │ │  Repo   ││
│  └─────────┘ └─────────┘ └─────────┘│
├─────────────────────────────────────┤
│          Data Layer                 │
│     PostgreSQL + Redis              │
└─────────────────────────────────────┘
```

## API Endpoints

### Workflow Management
- `POST /api/v1/marketplace/workflows` - Publish workflow to marketplace
- `GET /api/v1/marketplace/workflows/search` - Search workflows with filters
- `GET /api/v1/marketplace/workflows/:id` - Get workflow details
- `PUT /api/v1/marketplace/workflows/:id` - Update marketplace workflow
- `DELETE /api/v1/marketplace/workflows/:id` - Unpublish workflow

### Discovery
- `GET /api/v1/marketplace/workflows/trending` - Get trending workflows
- `GET /api/v1/marketplace/workflows/popular` - Get popular workflows
- `GET /api/v1/marketplace/recommendations` - Get personalized recommendations

### Ratings & Reviews
- `POST /api/v1/marketplace/workflows/:id/ratings` - Rate a workflow
- `GET /api/v1/marketplace/workflows/:id/ratings` - Get workflow ratings

### Downloads
- `POST /api/v1/marketplace/workflows/:id/download` - Track workflow download

### Collections
- `POST /api/v1/collections` - Create workflow collection
- `GET /api/v1/collections/my` - Get user's collections
- `GET /api/v1/collections/public` - Get public collections

### Analytics
- `GET /api/v1/marketplace/stats` - Get marketplace statistics

## Data Models

### MarketplaceWorkflow
```typescript
interface MarketplaceWorkflow {
  id: string;
  workflowId: string; // Reference to original workflow
  name: string;
  description: string;
  engineType: EngineType;
  category: WorkflowCategory;
  tags: string[];
  publishedBy: string;
  organizationId: string;
  version: string;
  isPublic: boolean;
  isPremium: boolean;
  price?: number;
  downloadCount: number;
  averageRating: number;
  totalRatings: number;
  publishedAt: Date;
  updatedAt: Date;
  metadata: WorkflowMetadata;
}
```

### WorkflowRating
```typescript
interface WorkflowRating {
  id: string;
  workflowId: string;
  userId: string;
  rating: number; // 1-5 stars
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### WorkflowCollection
```typescript
interface WorkflowCollection {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  isPublic: boolean;
  workflowIds: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Database Schema

The service uses PostgreSQL with the following main tables:

- `marketplace_workflows` - Published workflows with metadata
- `workflow_ratings` - User ratings and reviews
- `workflow_downloads` - Download tracking
- `workflow_collections` - Curated workflow collections
- `user_workflow_interactions` - User behavior tracking for recommendations

See `migrations/001_create_marketplace_tables.sql` for the complete schema.

## Recommendation Engine

The service includes a sophisticated recommendation system that uses multiple strategies:

### Content-Based Filtering
- Recommends workflows similar to user's past interactions
- Based on categories, tags, and engine types
- Uses TF-IDF and cosine similarity for content matching

### Collaborative Filtering
- Finds users with similar preferences
- Recommends workflows liked by similar users
- Uses user-item interaction matrix

### Hybrid Approach
- Combines multiple recommendation strategies
- Weighted scoring based on:
  - Content similarity (40%)
  - Collaborative filtering (30%)
  - Organization popularity (20%)
  - Trending factor (10%)

## Search Capabilities

### Full-Text Search
- Search across workflow names and descriptions
- PostgreSQL full-text search with ranking
- Support for stemming and stop words

### Faceted Search
- Filter by categories, tags, engine types
- Price range filtering for premium workflows
- Rating-based filtering

### Advanced Filters
- Date range filtering
- Organization-specific filtering
- Premium/free workflow filtering
- Minimum rating requirements

## Configuration

### Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=marketplace
DB_USER=postgres
DB_PASSWORD=password
DB_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3003
NODE_ENV=development
LOG_LEVEL=info

# Security
CORS_ORIGIN=*
JWT_SECRET=your-jwt-secret

# Features
ENABLE_PREMIUM_WORKFLOWS=true
ENABLE_RECOMMENDATIONS=true
```

### Database Setup
1. Create PostgreSQL database
2. Run migrations: `psql -d marketplace -f migrations/001_create_marketplace_tables.sql`
3. Create indexes for optimal performance

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis 6+

### Installation
```bash
cd services/marketplace
npm install
```

### Running the Service
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Performance Considerations

### Database Optimization
- Comprehensive indexing strategy for search queries
- JSONB indexes for tags and metadata
- Partial indexes for filtered queries
- Connection pooling for high concurrency

### Caching Strategy
- Redis caching for frequently accessed data
- Search result caching with TTL
- User session and preference caching
- Rate limiting with Redis counters

### Scalability
- Horizontal scaling support
- Database read replicas for search queries
- Async processing for analytics
- CDN integration for static assets

## Security

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Organization-based multi-tenancy
- API rate limiting

### Data Protection
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CORS configuration

### Privacy
- User data anonymization in analytics
- GDPR compliance features
- Data retention policies
- Audit logging

## Monitoring & Observability

### Metrics
- Request/response metrics
- Database query performance
- Cache hit/miss rates
- Business metrics (downloads, ratings)

### Logging
- Structured logging with Winston
- Request correlation IDs
- Error tracking and alerting
- Performance monitoring

### Health Checks
- Database connectivity
- Redis connectivity
- Service health endpoints
- Dependency health monitoring

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3003
CMD ["npm", "start"]
```

### Kubernetes
- Deployment manifests included
- ConfigMap for environment variables
- Service and Ingress configuration
- Horizontal Pod Autoscaler

### CI/CD
- Automated testing pipeline
- Security scanning
- Performance testing
- Blue-green deployment support

## Contributing

1. Follow the established code style
2. Write comprehensive tests
3. Update documentation
4. Follow semantic versioning
5. Create detailed pull requests

## License

MIT License - see LICENSE file for details