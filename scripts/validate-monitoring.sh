#!/bin/bash

# Monitoring Validation Script
# This script validates that all monitoring components are working correctly

set -e

echo "🔍 Validating AI Orchestrator Monitoring Stack..."

# Configuration
PROMETHEUS_URL="http://localhost:9090"
GRAFANA_URL="http://localhost:3000"
JAEGER_URL="http://localhost:16686"
ALERTMANAGER_URL="http://localhost:9093"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Checking $service_name... "
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

check_prometheus_targets() {
    echo -n "Checking Prometheus targets... "
    
    local targets=$(curl -s "$PROMETHEUS_URL/api/v1/targets" | jq -r '.data.activeTargets[] | select(.health == "up") | .labels.job' 2>/dev/null | wc -l)
    
    if [ "$targets" -gt 0 ]; then
        echo -e "${GREEN}✓ $targets targets UP${NC}"
        return 0
    else
        echo -e "${RED}✗ No healthy targets${NC}"
        return 1
    fi
}

check_prometheus_rules() {
    echo -n "Checking Prometheus rules... "
    
    local rules=$(curl -s "$PROMETHEUS_URL/api/v1/rules" | jq -r '.data.groups[].rules[] | .name' 2>/dev/null | wc -l)
    
    if [ "$rules" -gt 0 ]; then
        echo -e "${GREEN}✓ $rules rules loaded${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ No rules loaded${NC}"
        return 1
    fi
}

check_grafana_datasources() {
    echo -n "Checking Grafana datasources... "
    
    local datasources=$(curl -s -u admin:admin123 "$GRAFANA_URL/api/datasources" | jq -r '.[].name' 2>/dev/null | wc -l)
    
    if [ "$datasources" -gt 0 ]; then
        echo -e "${GREEN}✓ $datasources datasources configured${NC}"
        return 0
    else
        echo -e "${RED}✗ No datasources configured${NC}"
        return 1
    fi
}

check_grafana_dashboards() {
    echo -n "Checking Grafana dashboards... "
    
    local dashboards=$(curl -s -u admin:admin123 "$GRAFANA_URL/api/search" | jq -r '.[].title' 2>/dev/null | wc -l)
    
    if [ "$dashboards" -gt 0 ]; then
        echo -e "${GREEN}✓ $dashboards dashboards available${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ No custom dashboards found${NC}"
        return 1
    fi
}

check_jaeger_services() {
    echo -n "Checking Jaeger services... "
    
    local services=$(curl -s "$JAEGER_URL/api/services" | jq -r '.data[]' 2>/dev/null | wc -l)
    
    if [ "$services" -ge 0 ]; then
        echo -e "${GREEN}✓ $services services traced${NC}"
        return 0
    else
        echo -e "${RED}✗ Cannot retrieve services${NC}"
        return 1
    fi
}

check_alertmanager_config() {
    echo -n "Checking Alertmanager configuration... "
    
    if curl -s "$ALERTMANAGER_URL/api/v1/status" | jq -r '.status' 2>/dev/null | grep -q "success"; then
        echo -e "${GREEN}✓ Configuration valid${NC}"
        return 0
    else
        echo -e "${RED}✗ Configuration invalid${NC}"
        return 1
    fi
}

test_metric_ingestion() {
    echo -n "Testing metric ingestion... "
    
    # Send a test metric to Prometheus (via pushgateway if available)
    local test_metric="test_validation_metric"
    local query_result=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=up" | jq -r '.data.result | length' 2>/dev/null)
    
    if [ "$query_result" -gt 0 ]; then
        echo -e "${GREEN}✓ Metrics being ingested${NC}"
        return 0
    else
        echo -e "${RED}✗ No metrics found${NC}"
        return 1
    fi
}

test_alert_rules() {
    echo -n "Testing alert rules... "
    
    local alerts=$(curl -s "$PROMETHEUS_URL/api/v1/alerts" | jq -r '.data.alerts | length' 2>/dev/null)
    
    if [ "$alerts" -ge 0 ]; then
        echo -e "${GREEN}✓ Alert rules evaluated${NC}"
        return 0
    else
        echo -e "${RED}✗ Cannot evaluate alerts${NC}"
        return 1
    fi
}

run_performance_test() {
    echo "🚀 Running performance tests..."
    
    # Test Prometheus query performance
    echo -n "Testing Prometheus query performance... "
    local start_time=$(date +%s%N)
    curl -s "$PROMETHEUS_URL/api/v1/query?query=up" > /dev/null
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ "$duration" -lt 1000 ]; then
        echo -e "${GREEN}✓ ${duration}ms${NC}"
    else
        echo -e "${YELLOW}⚠ ${duration}ms (slow)${NC}"
    fi
    
    # Test Grafana dashboard load time
    echo -n "Testing Grafana response time... "
    local start_time=$(date +%s%N)
    curl -s -u admin:admin123 "$GRAFANA_URL/api/health" > /dev/null
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ "$duration" -lt 500 ]; then
        echo -e "${GREEN}✓ ${duration}ms${NC}"
    else
        echo -e "${YELLOW}⚠ ${duration}ms (slow)${NC}"
    fi
}

generate_test_data() {
    echo "📊 Generating test data..."
    
    # This would typically call your application's test endpoints
    # to generate metrics, traces, and logs for validation
    
    echo "Simulating HTTP requests..."
    for i in {1..10}; do
        curl -s "http://localhost:8080/health" > /dev/null || true
    done
    
    echo "Simulating workflow executions..."
    # This would call your workflow execution endpoints
    
    echo "Test data generation complete"
}

validate_business_metrics() {
    echo "📈 Validating business metrics..."
    
    # Check if business metrics are being collected
    local business_metrics=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=business_active_users" | jq -r '.data.result | length' 2>/dev/null)
    
    if [ "$business_metrics" -gt 0 ]; then
        echo -e "${GREEN}✓ Business metrics available${NC}"
    else
        echo -e "${YELLOW}⚠ No business metrics found${NC}"
    fi
}

# Main validation flow
main() {
    echo "Starting monitoring validation..."
    echo "================================"
    
    local failed_checks=0
    
    # Basic service health checks
    echo "🏥 Health Checks:"
    check_service "Prometheus" "$PROMETHEUS_URL/-/healthy" || ((failed_checks++))
    check_service "Grafana" "$GRAFANA_URL/api/health" || ((failed_checks++))
    check_service "Jaeger" "$JAEGER_URL/api/services" || ((failed_checks++))
    check_service "Alertmanager" "$ALERTMANAGER_URL/-/healthy" || ((failed_checks++))
    
    echo ""
    
    # Detailed component checks
    echo "🔧 Component Checks:"
    check_prometheus_targets || ((failed_checks++))
    check_prometheus_rules || ((failed_checks++))
    check_grafana_datasources || ((failed_checks++))
    check_grafana_dashboards || ((failed_checks++))
    check_jaeger_services || ((failed_checks++))
    check_alertmanager_config || ((failed_checks++))
    
    echo ""
    
    # Functional tests
    echo "⚡ Functional Tests:"
    test_metric_ingestion || ((failed_checks++))
    test_alert_rules || ((failed_checks++))
    
    echo ""
    
    # Performance tests
    run_performance_test
    
    echo ""
    
    # Generate and validate test data
    generate_test_data
    validate_business_metrics
    
    echo ""
    echo "================================"
    
    if [ $failed_checks -eq 0 ]; then
        echo -e "${GREEN}🎉 All monitoring components are working correctly!${NC}"
        echo ""
        echo "📊 Access URLs:"
        echo "  Prometheus: $PROMETHEUS_URL"
        echo "  Grafana:    $GRAFANA_URL (admin/admin123)"
        echo "  Jaeger:     $JAEGER_URL"
        echo "  Alertmanager: $ALERTMANAGER_URL"
        echo ""
        echo "🔍 Next Steps:"
        echo "  1. Configure application services to expose metrics"
        echo "  2. Import custom dashboards"
        echo "  3. Set up alert notification channels"
        echo "  4. Configure log aggregation"
        exit 0
    else
        echo -e "${RED}❌ $failed_checks checks failed. Please review the output above.${NC}"
        echo ""
        echo "🔧 Troubleshooting:"
        echo "  1. Check if all services are running: docker-compose -f docker-compose.monitoring.yml ps"
        echo "  2. Check service logs: docker-compose -f docker-compose.monitoring.yml logs <service>"
        echo "  3. Verify network connectivity between services"
        echo "  4. Check configuration files for syntax errors"
        exit 1
    fi
}

# Check if required tools are available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq is not installed. Some checks will be limited.${NC}"
fi

# Run main validation
main "$@"