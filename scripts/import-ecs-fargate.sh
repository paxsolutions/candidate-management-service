#!/bin/bash
set -e

SQL_S3_PATH="database.sql"
S3_BUCKET="pax-legacy-db-import"

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

# Get backend ECS service network config
BACKEND_NETWORK=$(aws ecs describe-services \
    --cluster pax-cluster \
    --services pax-backend \
    --query "services[0].networkConfiguration.awsvpcConfiguration" \
    --output json \
    --region us-east-1)
SUBNETS=$(echo $BACKEND_NETWORK | jq -r '.subnets | join(",")')
SECURITY_GROUPS=$(echo $BACKEND_NETWORK | jq -r '.securityGroups | join(",")')

# Get backend task roles
TASK_DEF=$(aws ecs describe-services --cluster pax-cluster --services pax-backend --query "services[0].taskDefinition" --output text --region us-east-1)
TASK_ROLE=$(aws ecs describe-task-definition --task-definition "$TASK_DEF" --query "taskDefinition.taskRoleArn" --output text --region us-east-1)
EXEC_ROLE=$(aws ecs describe-task-definition --task-definition "$TASK_DEF" --query "taskDefinition.executionRoleArn" --output text --region us-east-1)

# Get DB endpoint
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name CandidateAppStack --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text --region us-east-1)

# Create ECS task definition JSON
cat > /tmp/import-ecs-task.json <<EOF
{
  "family": "pax-import-ecs",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$EXEC_ROLE",
  "taskRoleArn": "$TASK_ROLE",
  "containerDefinitions": [
    {
      "name": "import",
      "image": "ubuntu:20.04",
      "essential": true,
      "command": [
        "sh", "-c",
        "export DEBIAN_FRONTEND=noninteractive && apt-get update && apt-get install -y mysql-client awscli && echo 'Container is ready for ECS Exec. Connect to this container to test MySQL or run your import.' && tail -f /dev/null"
      ],
      "environment": [
        {"name": "AWS_DEFAULT_REGION", "value": "us-east-1"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/pax-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "import"
        }
      }
    }
  ]
}
EOF

# Register and run the ECS task
aws ecs register-task-definition --cli-input-json file:///tmp/import-ecs-task.json --region us-east-1 > /dev/null

TASK_ARN=$(aws ecs run-task \
    --cluster pax-cluster \
    --task-definition pax-import-ecs \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=ENABLED}" \
    --query "tasks[0].taskArn" \
    --output text \
    --enable-execute-command \
    --region us-east-1)

echo "TASK_ARN: $TASK_ARN"

if [ -z "$TASK_ARN" ] || [[ "$TASK_ARN" != arn:* ]]; then
  echo "❌ ERROR: Failed to start ECS task. Check previous output for errors."
  exit 1
fi

echo "⏳ Waiting for import task to complete..."
aws ecs wait tasks-stopped --cluster pax-cluster --tasks $TASK_ARN --region us-east-1

EXIT_CODE=$(aws ecs describe-tasks --cluster pax-cluster --tasks $TASK_ARN --query "tasks[0].containers[0].exitCode" --output text --region us-east-1)

if [ "$EXIT_CODE" = "0" ]; then
    echo "✅ SUCCESS: Database import completed!"
else
    echo "❌ FAILED: Import failed with exit code $EXIT_CODE"
    echo "Check CloudWatch logs: /ecs/pax-backend for details"
    exit 1
fi