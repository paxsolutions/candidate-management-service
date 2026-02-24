#!/bin/bash

# Deploy frontend to S3 and invalidate CloudFront cache

set -e

echo "🏗️ Building and deploying frontend to S3..."

# Change to frontend directory
cd ../frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Build the React app
echo "🔨 Building React application..."
npm run build

# Get the S3 bucket name and CloudFront distribution ID from CDK outputs
echo "📋 Getting deployment configuration..."
cd ../infrastructure

BUCKET_NAME=$(npx ts-node --prefer-ts-exts -e "
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env', debug: false });
console.log(\`pax-frontend-\${process.env.AWS_ACCOUNT_ID || 'MISSING_ACCOUNT_ID'}\`);
" 2>/dev/null | tail -n 1)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name CandidateAppStack \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text \
  --region us-east-1)

echo "📦 S3 Bucket: $BUCKET_NAME"
echo "🌐 CloudFront Distribution: $DISTRIBUTION_ID"

# Upload to S3
echo "⬆️  Uploading to S3..."
aws s3 sync ../frontend/build/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "asset-manifest.json" \
  --exclude "manifest.json" \
  --region us-east-1

# Upload index.html with no-cache (for SPA routing)
aws s3 cp ../frontend/build/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "public,max-age=0,must-revalidate" \
  --region us-east-1

# Upload manifests with short cache
aws s3 cp ../frontend/build/asset-manifest.json s3://$BUCKET_NAME/asset-manifest.json \
  --cache-control "public,max-age=0,must-revalidate" \
  --region us-east-1 2>/dev/null || true

aws s3 cp ../frontend/build/manifest.json s3://$BUCKET_NAME/manifest.json \
  --cache-control "public,max-age=86400" \
  --region us-east-1 2>/dev/null || true

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✅ Frontend deployed successfully!"
echo "🌐 CloudFront URL: https://$(aws cloudformation describe-stacks \
  --stack-name CandidateAppStack \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text \
  --region us-east-1)"
echo "🔄 Cache invalidation: $INVALIDATION_ID"
echo ""
echo "⏰ Note: CloudFront cache invalidation may take 5-10 minutes to complete."
