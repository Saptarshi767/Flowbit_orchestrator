#!/bin/bash

# Performance Optimization Script for Robust AI Orchestrator
# This script runs performance tests and applies optimizations

set -e

echo "=== Performance Optimization Suite ==="
echo "Starting performance analysis and optimization..."

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:3000"}
RESULTS_DIR="./performance-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to run performance tests
run_performance_tests() {
    log "Running K6 performance tests..."
    
    # Basic load test
    k6 run --out json="$RESULTS_DIR/load_test_$TIMESTAMP.json" \
           --env BASE_URL="$BASE_URL" \
           tests/performance/performance-test-suite.js
    
    # Stress test
    log "Running stress test..."
    k6 run --out json="$RESULTS_DIR/stress_test_$TIMESTAMP.json" \
           --env BASE_URL="$BASE_URL" \
           --stage "2m:100,5m:200,2m:300,5m:300,2m:0" \
           tests/performance/performance-test-suite.js
    
    # Spike test
    log "Running spike test..."
    k6 run --out json="$RESULTS_DIR/spike_test_$TIMESTAMP.json" \
           --env BASE_URL="$BASE_URL" \
           --stage "1m:10,30s:500,1m:10,30s:0" \
           tests/performance/performance-test-suite.js
}

# Function to analyze database performance
analyze_database_performance() {
    log "Analyzing database performance..."
    
    # Check for slow queries
    docker exec postgres-container psql -U postgres -d orchestrator -c "
        SELECT query, mean_time, calls, total_time
        FROM pg_stat_statements
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 10;
    " > "$RESULTS_DIR/slow_queries_$TIMESTAMP.txt"
    
    # Check index usage
    docker exec postgres-container psql -U postgres -d orchestrator -c "
        SELECT schemaname, tablename, attname, n_distinct, correlation
        FROM pg_stats
        WHERE schemaname = 'public'
        ORDER BY n_distinct DESC;
    " > "$RESULTS_DIR/index_stats_$TIMESTAMP.txt"
    
    # Check table sizes
    docker exec postgres-container psql -U postgres -d orchestrator -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " > "$RESULTS_DIR/table_sizes_$TIMESTAMP.txt"
}

# Function to optimize database
optimize_database() {
    log "Applying database optimizations..."
    
    # Update statistics
    docker exec postgres-container psql -U postgres -d orchestrator -c "ANALYZE;"
    
    # Vacuum tables
    docker exec postgres-container psql -U postgres -d orchestrator -c "VACUUM ANALYZE;"
    
    # Create missing indexes based on slow queries
    docker exec postgres-container psql -U postgres -d orchestrator -c "
        -- Index for workflow queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflows_user_created 
        ON workflows(created_by, created_at);
        
        -- Index for execution queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_workflow_status 
        ON executions(workflow_id, status, created_at);
        
        -- Index for user queries
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_organization_role 
        ON users(organization_id, role);
        
        -- Partial index for active executions
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_active 
        ON executions(created_at) WHERE status IN ('pending', 'running');
    "
    
    log "Database optimization completed"
}

# Function to optimize Redis cache
optimize_redis() {
    log "Optimizing Redis cache..."
    
    # Get Redis info
    docker exec redis-container redis-cli INFO memory > "$RESULTS_DIR/redis_memory_$TIMESTAMP.txt"
    docker exec redis-container redis-cli INFO stats > "$RESULTS_DIR/redis_stats_$TIMESTAMP.txt"
    
    # Optimize Redis configuration
    docker exec redis-container redis-cli CONFIG SET maxmemory-policy allkeys-lru
    docker exec redis-container redis-cli CONFIG SET maxmemory 1gb
    docker exec redis-container redis-cli CONFIG SET save "900 1 300 10 60 10000"
    
    log "Redis optimization completed"
}

# Function to analyze application performance
analyze_application_performance() {
    log "Analyzing application performance..."
    
    # Check Node.js memory usage
    curl -s "$BASE_URL/api/health/memory" > "$RESULTS_DIR/memory_usage_$TIMESTAMP.json"
    
    # Check response times for key endpoints
    endpoints=(
        "/api/workflows"
        "/api/executions"
        "/api/health"
        "/api/metrics"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log "Testing endpoint: $endpoint"
        curl -w "@curl-format.txt" -o /dev/null -s "$BASE_URL$endpoint" >> "$RESULTS_DIR/endpoint_times_$TIMESTAMP.txt"
        echo "Endpoint: $endpoint" >> "$RESULTS_DIR/endpoint_times_$TIMESTAMP.txt"
    done
}

# Function to optimize application settings
optimize_application() {
    log "Applying application optimizations..."
    
    # Update Node.js settings
    export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"
    
    # Update connection pool settings
    export DB_POOL_SIZE=20
    export DB_POOL_TIMEOUT=30000
    
    # Update cache settings
    export CACHE_TTL=3600
    export CACHE_MAX_SIZE=1000
    
    log "Application optimization completed"
}

# Function to generate performance report
generate_performance_report() {
    log "Generating performance report..."
    
    cat > "$RESULTS_DIR/performance_report_$TIMESTAMP.md" << EOF
# Performance Test Report - $TIMESTAMP

## Test Summary
- Test Date: $(date)
- Base URL: $BASE_URL
- Test Duration: Load test, Stress test, Spike test

## Key Metrics
- Response Time P95: Check load_test_$TIMESTAMP.json
- Error Rate: Check load_test_$TIMESTAMP.json
- Throughput: Check load_test_$TIMESTAMP.json

## Database Performance
- Slow Queries: See slow_queries_$TIMESTAMP.txt
- Index Usage: See index_stats_$TIMESTAMP.txt
- Table Sizes: See table_sizes_$TIMESTAMP.txt

## Redis Performance
- Memory Usage: See redis_memory_$TIMESTAMP.txt
- Cache Stats: See redis_stats_$TIMESTAMP.txt

## Recommendations
1. Monitor slow queries and add indexes as needed
2. Implement connection pooling optimizations
3. Configure Redis memory policies
4. Set up application-level caching
5. Monitor memory usage and garbage collection

## Files Generated
- load_test_$TIMESTAMP.json
- stress_test_$TIMESTAMP.json
- spike_test_$TIMESTAMP.json
- slow_queries_$TIMESTAMP.txt
- index_stats_$TIMESTAMP.txt
- table_sizes_$TIMESTAMP.txt
- redis_memory_$TIMESTAMP.txt
- redis_stats_$TIMESTAMP.txt
- endpoint_times_$TIMESTAMP.txt
EOF

    log "Performance report generated: $RESULTS_DIR/performance_report_$TIMESTAMP.md"
}

# Create curl format file for timing
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
EOF

# Main execution
main() {
    log "Starting performance optimization suite..."
    
    # Check if services are running
    if ! curl -s "$BASE_URL/api/health" > /dev/null; then
        log "ERROR: Application is not running at $BASE_URL"
        exit 1
    fi
    
    # Run performance tests
    run_performance_tests
    
    # Analyze current performance
    analyze_database_performance
    analyze_application_performance
    
    # Apply optimizations
    optimize_database
    optimize_redis
    optimize_application
    
    # Generate report
    generate_performance_report
    
    log "Performance optimization completed!"
    log "Results available in: $RESULTS_DIR"
}

# Cleanup function
cleanup() {
    rm -f curl-format.txt
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"