#!/bin/bash

# Check Backend Logs for Debugging
echo "🔍 Checking Backend Logs"
echo "======================="

# Load environment
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
else
    echo "❌ .env file not found"
    exit 1
fi

# Get the latest backend logs
echo "📋 Recent backend logs:"
aws logs tail /ecs/pax-backend --since 10m --region $AWS_REGION --follow
