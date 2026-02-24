#!/bin/bash

# Candidate Management App Infrastructure Deployment Script
# Deploys infrastructure assuming ECR repositories and images already exist
set -e

echo "🏗️ Deploying Candidate Management App infrastructure..."

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found. Please create one with your configuration."
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Please run 'aws configure' first."
    exit 1
fi

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-1}

echo "📋 Infrastructure Deployment Configuration:"
echo "   AWS Account: $AWS_ACCOUNT_ID"
echo "   AWS Region: $AWS_REGION"
echo "   S3 Bucket: $S3_BUCKET_NAME"

# Check if ECR repositories exist and have images
echo "🔍 Checking ECR repositories..."
BACKEND_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/pax-backend"
FRONTEND_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/pax-frontend"

# Check if repositories exist
if ! aws ecr describe-repositories --repository-names pax-backend --region $AWS_REGION > /dev/null 2>&1; then
    echo "❌ Backend ECR repository not found. Please run ./setup-ecr.sh first"
    exit 1
fi

if ! aws ecr describe-repositories --repository-names pax-frontend --region $AWS_REGION > /dev/null 2>&1; then
    echo "❌ Frontend ECR repository not found. Please run ./setup-ecr.sh first"
    exit 1
fi

# Check if images exist
if ! aws ecr describe-images --repository-name pax-backend --image-ids imageTag=latest --region $AWS_REGION > /dev/null 2>&1; then
    echo "❌ Backend image not found in ECR. Please run ./setup-ecr.sh first"
    exit 1
fi

if ! aws ecr describe-images --repository-name pax-frontend --image-ids imageTag=latest --region $AWS_REGION > /dev/null 2>&1; then
    echo "❌ Frontend image not found in ECR. Please run ./setup-ecr.sh first"
    exit 1
fi

echo "✅ ECR repositories and images found"

# Deploy CDK infrastructure
echo "🏗️ Deploying CDK infrastructure..."
cd ../infrastructure

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing CDK dependencies..."
    npm install
fi

# Bootstrap CDK if needed
echo "🎯 Bootstrapping CDK..."
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION

# Deploy the stack
echo "🚀 Deploying infrastructure..."
npx cdk deploy --require-approval never

# Get load balancer DNS
ALB_DNS=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" --output text --region $AWS_REGION)

echo "✅ Infrastructure deployment completed successfully!"
echo ""
echo "🌐 Your application will be available at: http://$ALB_DNS"
echo "📊 Monitor your services in the AWS Console:"
echo "   - ECS Cluster: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/pax-cluster"
echo "   - RDS Database: https://console.aws.amazon.com/rds/home?region=$AWS_REGION"
echo "   - Load Balancer: https://console.aws.amazon.com/ec2/v2/home?region=$AWS_REGION#LoadBalancers"
echo ""
echo "⏰ Note: It may take a few minutes for the services to become healthy."
