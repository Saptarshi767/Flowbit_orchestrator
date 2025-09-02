#!/bin/bash

# Package Lambda function for deployment
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Packaging Lambda function..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cp resource_optimizer.py "$TEMP_DIR/index.py"

# Create zip file
cd "$TEMP_DIR"
zip -r "$SCRIPT_DIR/resource_optimizer.zip" .

# Cleanup
rm -rf "$TEMP_DIR"

echo "Lambda function packaged successfully: resource_optimizer.zip"