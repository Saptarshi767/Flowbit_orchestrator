# Infrastructure Tests

This directory contains comprehensive tests for validating multi-cloud infrastructure deployment across AWS, Azure, and GCP.

## Test Suite Overview

### 1. Multi-Cloud Validation (`multi-cloud-validation.py`)
Comprehensive validation of multi-cloud deployment features including:
- Cross-cloud networking validation
- Disaster recovery configuration
- Cost optimization setup
- Security compliance checks

### 2. Integration Tests (`integration-test.py`)
End-to-end integration tests for:
- Infrastructure component health
- Database connectivity
- Kubernetes cluster functionality
- Storage and networking

### 3. Multi-Cloud Deployment Validator (`multi-cloud-deployment-validator.py`)
Advanced validation tool with:
- Detailed scoring system
- Comprehensive reporting
- Recommendations engine
- Production readiness assessment

### 4. Terraform Validation (`terraform-validate.sh`)
Infrastructure as Code validation:
- Terraform syntax validation
- Security scanning with tfsec
- Best practices compliance
- Module validation

## Prerequisites

### Required Python Packages
```bash
pip install -r requirements.txt
```

### Cloud Provider CLIs
- AWS CLI v2
- Azure CLI
- Google Cloud SDK

### Authentication Setup

#### AWS
```bash
aws configure
# or use environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-west-2
```

#### Azure
```bash
az login
# or use service principal
export AZURE_CLIENT_ID=your-client-id
export AZURE_CLIENT_SECRET=your-client-secret
export AZURE_TENANT_ID=your-tenant-id
export AZURE_SUBSCRIPTION_ID=your-subscription-id
```

#### GCP
```bash
gcloud auth application-default login
# or use service account
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
export GCP_PROJECT_ID=your-project-id
```

## Running Tests

### Quick Validation
```bash
# Run all multi-cloud validations
python multi-cloud-validation.py --config multi-cloud-test-config.json

# Run integration tests
python integration-test.py --environment prod --config multi-cloud-test-config.json

# Run Terraform validation
./terraform-validate.sh
```

### Comprehensive Validation
```bash
# Run the advanced deployment validator
python multi-cloud-deployment-validator.py \
  --config multi-cloud-test-config.json \
  --environment prod \
  --output validation-report.json \
  --verbose
```

## Configuration

### Test Configuration File
Copy and customize the test configuration:
```bash
cp multi-cloud-test-config.json my-test-config.json
# Edit my-test-config.json with your specific values
```

## Test Categories

### Infrastructure Tests
- ✅ VPC/VNet/Network creation
- ✅ Kubernetes cluster deployment
- ✅ Database instance setup
- ✅ Storage configuration
- ✅ Load balancer setup

### Security Tests
- ✅ Encryption at rest
- ✅ Encryption in transit
- ✅ Network security groups
- ✅ IAM roles and policies
- ✅ Key management services

### Cost Optimization Tests
- ✅ Budget configuration
- ✅ Cost anomaly detection
- ✅ Auto-scaling policies
- ✅ Spot instance usage
- ✅ Resource optimization

### Disaster Recovery Tests
- ✅ Backup configuration
- ✅ Cross-region replication
- ✅ Recovery procedures
- ✅ RTO/RPO compliance
- ✅ Automation functions

### Cross-Cloud Tests
- ✅ VPN connectivity
- ✅ Data replication
- ✅ Network routing
- ✅ Failover procedures
- ✅ Monitoring integration

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test logs in `multi-cloud-validation.log`
3. Consult cloud provider documentation
4. Contact the platform team