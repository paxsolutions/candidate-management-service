#!/bin/bash

# App Destruction Script
set -e

echo "🗑️ Starting App infrastructure destruction..."

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
fi

# Get AWS region
AWS_REGION=${AWS_REGION:-us-east-1}

echo "⚠️  WARNING: This will destroy all AWS resources for the Candidate Management App!"
echo "   - ECS Cluster and Services"
echo "   - RDS Database (and all data)"
echo "   - Load Balancer"
echo "   - VPC and networking"
echo "   - ECR repositories (and all images)"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Destruction cancelled."
    exit 1
fi

echo "🔄 Stopping ECS services..."
aws ecs update-service --cluster pax-cluster --service pax-backend --desired-count 0 --region $AWS_REGION || true
aws ecs update-service --cluster pax-cluster --service pax-frontend --desired-count 0 --region $AWS_REGION || true

echo "⏳ Waiting for services to stop..."
sleep 30

echo "🏗️ Destroying CDK infrastructure..."
cd ../infrastructure

# Destroy the stack
npx cdk destroy --force

echo "✅ Infrastructure destroyed successfully!"
echo ""
echo "🧹 Manual cleanup (if needed):"
echo "   - Check S3 bucket: $S3_BUCKET_NAME"
echo "   - Verify all resources are deleted in AWS Console"
