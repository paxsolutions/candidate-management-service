#!/bin/bash

# Candidate Management App Image Update Script
# Use this to update just the Docker images without redeploying infrastructure
set -e

echo "🔄 Updating Candidate Management App Docker images..."

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

echo "📋 Update Configuration:"
echo "   AWS Account: $AWS_ACCOUNT_ID"
echo "   AWS Region: $AWS_REGION"

# Get ECR repository URIs from CloudFormation stack
echo "📋 Getting ECR repository URIs..."
BACKEND_REPO_URI=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query "Stacks[0].Outputs[?OutputKey=='BackendRepositoryUri'].OutputValue" --output text --region $AWS_REGION)
FRONTEND_REPO_URI=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query "Stacks[0].Outputs[?OutputKey=='FrontendRepositoryUri'].OutputValue" --output text --region $AWS_REGION)

echo "Backend ECR: $BACKEND_REPO_URI"
echo "Frontend ECR: $FRONTEND_REPO_URI"

# Validate ECR repositories exist
if [ -z "$BACKEND_REPO_URI" ] || [ -z "$FRONTEND_REPO_URI" ]; then
    echo "❌ Error: Could not get ECR repository URIs from CloudFormation stack"
    echo "Please make sure the infrastructure is deployed first using ./deploy.sh"
    exit 1
fi

# Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build and push backend image
echo "🔨 Building backend image..."
cd ../backend
docker build -t pax-backend .
docker tag pax-backend:latest $BACKEND_REPO_URI:latest

echo "📤 Pushing backend image to ECR..."
docker push $BACKEND_REPO_URI:latest

# Use custom domain for frontend API URL
# NOTE: CUSTOM_DOMAIN must be set in your .env file (e.g. app.yourdomain.com)
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:?ERROR: CUSTOM_DOMAIN not set in .env. Please set it to your domain.}"
API_URL="https://$CUSTOM_DOMAIN"
echo "🌐 Using custom domain for frontend: $CUSTOM_DOMAIN"

# Build and push frontend image with API URL
echo "🔨 Building frontend image with API URL: $API_URL"
cd ../frontend
docker build --no-cache --build-arg REACT_APP_API_URL=$API_URL -t pax-frontend .
docker tag pax-frontend:latest $FRONTEND_REPO_URI:latest

echo "📤 Pushing frontend image to ECR..."
docker push $FRONTEND_REPO_URI:latest

# Update ECS services to use new images
echo "🔄 Updating ECS services..."
aws ecs update-service --cluster pax-cluster --service pax-backend --force-new-deployment --region $AWS_REGION
aws ecs update-service --cluster pax-cluster --service pax-frontend --force-new-deployment --region $AWS_REGION

echo "✅ Image update completed successfully!"
echo ""
echo "⏰ Note: It may take a few minutes for the services to update with the new images."
echo "📊 Monitor the deployment in the AWS Console:"
echo "   - ECS Services: https://console.aws.amazon.com/ecs/home?region=$AWS_REGION#/clusters/pax-cluster"
