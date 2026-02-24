#!/bin/bash

# Complete Deployment with SSL and Custom Domain
set -e

echo "🚀 Complete Candidate Management App Deployment with SSL"
echo "=================================="

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env file not found. Please create one with your configuration."
    exit 1
fi

echo ""
echo "🗑️  Destroying existing stack (if any)..."
cd ../infrastructure

if command -v cdk > /dev/null 2>&1; then
    CDK_CMD="cdk"
elif command -v npx > /dev/null 2>&1; then
    CDK_CMD="npx cdk"
else
    echo "❌ CDK not found. Please install with: npm install -g aws-cdk"
    exit 1
fi

# Destroy existing stack
echo "Destroying existing stack..."
$CDK_CMD destroy --force || echo "No existing stack to destroy"

echo ""
echo "🏗️  Deploying new stack with SSL..."
$CDK_CMD deploy --require-approval never

echo ""
echo "📋 Getting deployment outputs..."
OUTPUTS=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query "Stacks[0].Outputs" --region $AWS_REGION)

DOMAIN_NAME=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="DomainName") | .OutputValue')
APP_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="ApplicationUrl") | .OutputValue')

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "✅ Domain: $DOMAIN_NAME"
echo "✅ Application URL: $APP_URL"
echo ""
echo "✅ SSL certificate will auto-validate via DNS"
echo "✅ Route 53 A record created for: $DOMAIN_NAME"
echo ""
echo "🚀 Next Steps:"
echo "1. Wait for SSL certificate validation (5-10 minutes)"
echo "2. Run './update-frontend-url.sh' to rebuild frontend with HTTPS"
echo "3. Your app will be available at: $APP_URL"
echo ""
echo "📝 Check certificate status in AWS Certificate Manager console"

cd ../scripts
