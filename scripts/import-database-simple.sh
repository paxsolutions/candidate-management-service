#!/bin/bash
set -e

echo "🗄️  MySQL Database Import to AWS RDS"
echo "===================================="

# Configuration
SQL_FILE="database.sql"
S3_BUCKET="pax-legacy-db-import"

# Load environment variables - safer parsing for .env files
if [ -f "../.env" ]; then
    # Export each line that looks like KEY=VALUE (ignore comments and empty lines)
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        # Remove quotes from value if present
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        # Export the variable
        export "$key=$value"
    done < <(grep -v '^#' ../.env | grep -v '^$')

    echo "✅ Environment variables loaded"

    # Verify critical variables are set
    if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
        echo "❌ ERROR: Required database variables not set in .env file"
        echo "Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
        exit 1
    fi

    echo "✓ DB Host: $DB_HOST"
    echo "✓ DB User: $DB_USER"
    echo "✓ DB Name: $DB_NAME"
else
    echo "❌ .env file not found. Please create one with your configuration."
    exit 1
fi

# # Check if SQL file exists locally
# if [ ! -f "../${SQL_FILE}" ] && [ ! -f "${SQL_FILE}" ]; then
#     echo "❌ ${SQL_FILE} not found in current or parent directory"
#     echo "Please create a MySQL dump first:"
#     echo "  mysqldump -u root -p LegacyPAXDB > ${SQL_FILE}"
#     exit 1
# fi
#
# # Upload SQL file to S3
# echo ""
# echo "📤 Uploading SQL file to S3..."
# if [ -f "../${SQL_FILE}" ]; then
#     SQL_PATH="../${SQL_FILE}"
# else
#     SQL_PATH="${SQL_FILE}"
# fi
#
# aws s3 cp "${SQL_PATH}" "s3://${S3_BUCKET}/${SQL_FILE}" --region us-east-1
# echo "✅ SQL file uploaded to s3://${S3_BUCKET}/${SQL_FILE}"

# Get backend ECS service network config
echo ""
echo "🔍 Getting ECS network configuration..."
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

# Create import script that uses environment variables (no embedded credentials)
cat > /tmp/import-script.sh <<'SCRIPT_EOF'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive

echo "📦 Installing dependencies..."
apt-get update -qq
apt-get install -y -qq mysql-client awscli

echo "✅ Dependencies installed"
echo "📥 Downloading SQL file from S3..."
aws s3 cp s3://pax-legacy-db-import/database.sql /tmp/database.sql --region us-east-1

echo "✅ SQL file downloaded"
ls -lh /tmp/database.sql

echo "🗄️ Importing to MySQL..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < /tmp/database.sql

echo "✅ Import completed successfully"
SCRIPT_EOF

# Verify script was created
if [ ! -f /tmp/import-script.sh ]; then
    echo "❌ ERROR: Failed to create import script"
    exit 1
fi

# Base64 encode the script to pass it safely
IMPORT_SCRIPT_B64=$(base64 < /tmp/import-script.sh)

# Create ECS task definition JSON with properly escaped environment variables
echo "📝 Creating ECS task definition..."
cat > /tmp/import-task.json <<TASK_EOF
{
  "family": "pax-db-import",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "${EXEC_ROLE}",
  "taskRoleArn": "${TASK_ROLE}",
  "containerDefinitions": [
    {
      "name": "import",
      "image": "ubuntu:20.04",
      "essential": true,
      "command": ["sh", "-c", "echo '${IMPORT_SCRIPT_B64}' | base64 -d > /tmp/run.sh && chmod +x /tmp/run.sh && /tmp/run.sh"],
      "environment": [
        {"name": "AWS_DEFAULT_REGION", "value": "us-east-1"},
        {"name": "DB_HOST", "value": "${DB_HOST}"},
        {"name": "DB_USER", "value": "${DB_USER}"},
        {"name": "DB_PASSWORD", "value": "${DB_PASSWORD}"},
        {"name": "DB_NAME", "value": "${DB_NAME}"}
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
TASK_EOF

# Register and run the ECS task
echo "🚀 Registering task definition..."
aws ecs register-task-definition --cli-input-json file:///tmp/import-task.json --region us-east-1 > /dev/null

echo "🏃 Running import task..."
TASK_ARN=$(aws ecs run-task \
    --cluster pax-cluster \
    --task-definition pax-db-import \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=ENABLED}" \
    --query "tasks[0].taskArn" \
    --output text \
    --region us-east-1)

echo "Task ARN: $TASK_ARN"

if [ -z "$TASK_ARN" ] || [[ "$TASK_ARN" != arn:* ]]; then
  echo "❌ ERROR: Failed to start ECS task. Check previous output for errors."
  exit 1
fi

echo ""
echo "⏳ Waiting for import task to complete (this may take several minutes)..."
aws ecs wait tasks-stopped --cluster pax-cluster --tasks $TASK_ARN --region us-east-1

EXIT_CODE=$(aws ecs describe-tasks --cluster pax-cluster --tasks $TASK_ARN --query "tasks[0].containers[0].exitCode" --output text --region us-east-1)

echo ""
if [ "$EXIT_CODE" = "0" ]; then
    echo "✅ SUCCESS: Database import completed!"
    echo ""
    echo "🎉 Your data has been imported to AWS RDS"
    echo "You can now access your application with the imported data"
else
    echo "❌ FAILED: Import failed with exit code $EXIT_CODE"
    echo ""
    echo "📋 To see detailed logs, run:"
    echo "  ./check-backend-logs.sh"
    echo ""
    echo "Or view logs in CloudWatch: /ecs/pax-backend"
    exit 1
fi

# Cleanup
rm -f /tmp/import-task.json
echo ""
echo "🧹 Cleaned up temporary files"
