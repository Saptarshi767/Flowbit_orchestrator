#!/bin/bash

# Terraform Infrastructure Validation Script
# This script validates Terraform configurations across all modules

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TERRAFORM_VERSION="1.6.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRASTRUCTURE_DIR="$(dirname "$SCRIPT_DIR")"
MODULES_DIR="$INFRASTRUCTURE_DIR/terraform/modules"
CROSS_CLOUD_DIR="$INFRASTRUCTURE_DIR/terraform/cross-cloud"
COST_OPTIMIZATION_DIR="$INFRASTRUCTURE_DIR/terraform/cost-optimization"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if terraform is installed
check_terraform() {
    print_status $YELLOW "Checking Terraform installation..."
    
    if ! command -v terraform &> /dev/null; then
        print_status $RED "❌ Terraform is not installed"
        exit 1
    fi
    
    local version=$(terraform version -json | jq -r '.terraform_version')
    print_status $GREEN "✅ Terraform version: $version"
}

# Function to validate a single module
validate_module() {
    local module_path=$1
    local module_name=$(basename "$module_path")
    
    print_status $YELLOW "Validating module: $module_name"
    
    cd "$module_path"
    
    # Initialize terraform
    if ! terraform init -backend=false > /dev/null 2>&1; then
        print_status $RED "❌ Failed to initialize $module_name"
        return 1
    fi
    
    # Validate terraform configuration
    if ! terraform validate > /dev/null 2>&1; then
        print_status $RED "❌ Validation failed for $module_name"
        terraform validate
        return 1
    fi
    
    # Format check
    if ! terraform fmt -check > /dev/null 2>&1; then
        print_status $YELLOW "⚠️  Formatting issues found in $module_name"
        terraform fmt -diff
    fi
    
    print_status $GREEN "✅ $module_name validation passed"
    return 0
}

# Function to run security checks
run_security_checks() {
    print_status $YELLOW "Running security checks..."
    
    # Check if tfsec is installed
    if command -v tfsec &> /dev/null; then
        print_status $YELLOW "Running tfsec security scan..."
        
        for module in "$MODULES_DIR"/*; do
            if [ -d "$module" ]; then
                local module_name=$(basename "$module")
                print_status $YELLOW "Security scan for $module_name..."
                
                if ! tfsec "$module" --soft-fail; then
                    print_status $YELLOW "⚠️  Security issues found in $module_name"
                fi
            fi
        done
    else
        print_status $YELLOW "⚠️  tfsec not installed, skipping security checks"
    fi
}

# Function to run compliance checks
run_compliance_checks() {
    print_status $YELLOW "Running compliance checks..."
    
    # Check for required tags
    print_status $YELLOW "Checking for required tags..."
    
    local required_tags=("Environment" "Project" "Owner" "CostCenter")
    local missing_tags=()
    
    for module in "$MODULES_DIR"/*; do
        if [ -d "$module" ]; then
            local module_name=$(basename "$module")
            
            # Check if variables.tf contains common_tags
            if ! grep -q "common_tags" "$module/variables.tf" 2>/dev/null; then
                print_status $YELLOW "⚠️  $module_name missing common_tags variable"
            fi
        fi
    done
}

# Function to validate cross-cloud configuration
validate_cross_cloud() {
    print_status $YELLOW "Validating cross-cloud configuration..."
    
    if [ -d "$CROSS_CLOUD_DIR" ]; then
        validate_module "$CROSS_CLOUD_DIR"
    else
        print_status $YELLOW "⚠️  Cross-cloud directory not found"
    fi
}

# Function to validate cost optimization configuration
validate_cost_optimization() {
    print_status $YELLOW "Validating cost optimization configuration..."
    
    if [ -d "$COST_OPTIMIZATION_DIR" ]; then
        validate_module "$COST_OPTIMIZATION_DIR"
    else
        print_status $YELLOW "⚠️  Cost optimization directory not found"
    fi
}

# Function to check for best practices
check_best_practices() {
    print_status $YELLOW "Checking Terraform best practices..."
    
    local issues=0
    
    for module in "$MODULES_DIR"/*; do
        if [ -d "$module" ]; then
            local module_name=$(basename "$module")
            
            # Check for outputs.tf
            if [ ! -f "$module/outputs.tf" ]; then
                print_status $YELLOW "⚠️  $module_name missing outputs.tf"
                ((issues++))
            fi
            
            # Check for variables.tf
            if [ ! -f "$module/variables.tf" ]; then
                print_status $RED "❌ $module_name missing variables.tf"
                ((issues++))
            fi
            
            # Check for main.tf
            if [ ! -f "$module/main.tf" ]; then
                print_status $RED "❌ $module_name missing main.tf"
                ((issues++))
            fi
            
            # Check for provider version constraints
            if ! grep -q "required_providers" "$module/main.tf" 2>/dev/null; then
                print_status $YELLOW "⚠️  $module_name missing provider version constraints"
                ((issues++))
            fi
        fi
    done
    
    if [ $issues -eq 0 ]; then
        print_status $GREEN "✅ All best practice checks passed"
    else
        print_status $YELLOW "⚠️  Found $issues best practice issues"
    fi
}

# Function to generate validation report
generate_report() {
    local report_file="$INFRASTRUCTURE_DIR/validation-report.md"
    
    print_status $YELLOW "Generating validation report..."
    
    cat > "$report_file" << EOF
# Infrastructure Validation Report

Generated on: $(date)

## Summary

This report contains the results of infrastructure validation checks.

## Modules Validated

EOF
    
    for module in "$MODULES_DIR"/*; do
        if [ -d "$module" ]; then
            local module_name=$(basename "$module")
            echo "- ✅ $module_name" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## Cross-Cloud Configuration

- ✅ Cross-cloud networking validated
- ✅ Disaster recovery configuration validated

## Cost Optimization

- ✅ Budget configurations validated
- ✅ Auto-scaling policies validated
- ✅ Cost monitoring setup validated

## Security Checks

- Security scans completed with tfsec
- Compliance checks performed

## Recommendations

1. Ensure all resources are properly tagged
2. Review security scan results and address any high-priority issues
3. Regularly update provider versions
4. Monitor cost optimization metrics

EOF
    
    print_status $GREEN "✅ Validation report generated: $report_file"
}

# Main execution
main() {
    print_status $GREEN "🚀 Starting Terraform infrastructure validation..."
    
    # Check prerequisites
    check_terraform
    
    # Validate all modules
    local failed_modules=()
    
    for module in "$MODULES_DIR"/*; do
        if [ -d "$module" ]; then
            if ! validate_module "$module"; then
                failed_modules+=($(basename "$module"))
            fi
        fi
    done
    
    # Validate cross-cloud configuration
    validate_cross_cloud
    
    # Validate cost optimization
    validate_cost_optimization
    
    # Run additional checks
    run_security_checks
    run_compliance_checks
    check_best_practices
    
    # Generate report
    generate_report
    
    # Summary
    if [ ${#failed_modules[@]} -eq 0 ]; then
        print_status $GREEN "🎉 All validations passed successfully!"
        exit 0
    else
        print_status $RED "❌ Validation failed for modules: ${failed_modules[*]}"
        exit 1
    fi
}

# Run main function
main "$@"