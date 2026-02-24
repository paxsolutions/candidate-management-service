#!/bin/bash

# PAX App Status Check Script
set -e

echo "📊 Checking PAX App status..."

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

AWS_REGION=${AWS_REGION:-us-east-1}

echo "🔍 ECS Services Status:"
aws ecs describe-services --cluster pax-cluster --services pax-backend pax-frontend --region $AWS_REGION --query "services[*].{Name:serviceName,Status:status,Running:runningCount,Desired:desiredCount,PendingCount:pendingCount}" --output table

echo ""
echo "🏥 Service Health:"
aws ecs describe-services --cluster pax-cluster --services pax-backend pax-frontend --region $AWS_REGION --query "services[*].{Name:serviceName,HealthyPercent:deploymentConfiguration.maximumPercent,MinHealthyPercent:deploymentConfiguration.minimumHealthyPercent}" --output table

echo ""
echo "📋 Load Balancer:"
ALB_DNS=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" --output text --region $AWS_REGION 2>/dev/null || echo "Not found")
echo "   DNS: $ALB_DNS"

if [ "$ALB_DNS" != "Not found" ]; then
    echo ""
    echo "🌐 Testing endpoints:"
    echo "   Frontend: curl -I http://$ALB_DNS/"
    curl -I "http://$ALB_DNS/" 2>/dev/null | head -1 || echo "   Frontend: Not responding"

    echo "   Backend Health: curl -I http://$ALB_DNS/api/health"
    curl -I "http://$ALB_DNS/api/health" 2>/dev/null | head -1 || echo "   Backend: Not responding"
fi

echo ""
echo "📝 Recent ECS Events (last 5):"
aws ecs describe-services --cluster pax-cluster --services pax-frontend --region $AWS_REGION --query "services[0].events[:5].{Time:createdAt,Message:message}" --output table
