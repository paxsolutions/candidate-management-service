#!/bin/bash

# Deploy Candidate Management App to New AWS Account
set -e

echo "🚀 Candidate Management App Deployment to New AWS Account"
echo "========================================"

# Check .env file
if [ ! -f "../.env" ]; then
    echo "❌ .env file not found!"
    echo "Copy .env.new-account-template to .env and update values"
    exit 1
fi

# Load environment
export $(cat ../.env | grep -v '^#' | xargs)
echo "✅ Environment loaded"

# Verify AWS account
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account: $ACCOUNT"

echo "📋 Steps: Bootstrap CDK → Setup ECR → Deploy Infrastructure"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Bootstrap CDK if needed
echo "🔧 Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit > /dev/null 2>&1; then
    cd ../infrastructure && cdk bootstrap && cd ../scripts
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Setup ECR and deploy
echo "🐳 Setting up ECR..."
"$SCRIPT_DIR/setup-ecr.sh"

echo "🏗️ Deploying infrastructure..."
"$SCRIPT_DIR/deploy-infrastructure.sh"

# Get ALB DNS
ALB_DNS=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' --output text)
echo "✅ ALB DNS: $ALB_DNS"
echo "🎉 Deployment complete!"
