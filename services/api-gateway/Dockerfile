# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S apigateway -u 1001

# Copy built application
COPY --from=builder --chown=apigateway:nodejs /app/dist ./dist
COPY --from=builder --chown=apigateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=apigateway:nodejs /app/package.json ./

# Create logs directory
RUN mkdir -p logs && chown apigateway:nodejs logs

# Switch to non-root user
USER apigateway

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]