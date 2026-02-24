# Candidate Management App Deployment Scripts

This directory contains scripts for deploying and managing the Candidate Management Application on AWS.

## Main Deployment Scripts

### `deploy-infrastructure.sh`

Deploys the AWS infrastructure using CDK:

- VPC, subnets, security groups
- RDS MySQL database
- Application Load Balancer with SSL
- ECS cluster and services
- ECR repositories

### `setup-ecr.sh`

Sets up ECR repositories and builds initial Docker images:

- Creates ECR repositories if they don't exist
- Builds and pushes initial backend and frontend images

### `update-images.sh`

Primary script for code updates

- Updates application images and redeploys services:
- Builds new Docker images with latest code (clean build with --no-cache)
- Uses HTTPS URLs for production
- Pushes to ECR
- Forces ECS service redeployment

### `deploy-infrastructure.sh`

deploy-infrastructure.sh

- Main infrastructure deployment

### `setup-ecr.sh`

setup-ecr.sh

- Initial ECR setup and image builds

### `update-images.sh`

update-images.sh

- Primary script for code updates (now always clean builds with HTTPS)

### `deploy-complete.sh`

deploy-complete.sh

- Complete deployment workflow

### `deploy-new-account.sh`

deploy-new-account.sh

- New account setup

### `deploy-with-ssl.sh`

deploy-with-ssl.sh

- SSL-enabled deployment

### `setup-ssl-domain.sh`

setup-ssl-domain.sh

- SSL certificate setup

## Database Import via ECS Fargate

This project uses a secure, production-grade workflow to import MySQL dumps into the AWS RDS instance using a temporary ECS Fargate task running inside the VPC. This approach ensures network security, IAM least privilege, and repeatability.

### Prerequisites

- AWS CLI and Session Manager plugin installed locally
- Proper AWS credentials configured (`aws configure`)
- Your MySQL dump file uploaded to an S3 bucket accessible by the ECS task (see S3/IAM setup below)
- Database credentials managed by AWS Secrets Manager (the source of truth for the app and imports)

### Step-by-Step Usage

1. **Upload your SQL file to S3:**
   ```bash
   aws s3 cp /path/to/database.sql s3://<S3_BUCKET>/<SQL_S3_PATH> --region us-east-1
   ```
2. **Run the import script:**

   ```bash
   cd scripts
   ./import-ecs-fargate.sh
   ```

   - The script will launch a temporary Fargate task in the correct VPC/subnets with IAM permissions to access S3 and RDS.
   - By default, the task starts a shell and waits (using `tail -f /dev/null`).

3. **Connect interactively (optional for testing):**
   - Find the running task ARN (the script will print it).
   - Connect via ECS Exec:
     ```bash
     aws ecs execute-command \
       --cluster pax-cluster \
       --task <TASK_ARN> \
       --container import \
       --command bash \
       --interactive
     ```
   - From inside the container, test MySQL connectivity:
     ```bash
     mysql -h <RDS_ENDPOINT> -u <DB_USER> -p<DB_PASSWORD> <DB_NAME>
     ```
   - Download and import the SQL file manually if desired:
     ```bash
     aws s3 cp s3://<S3_BUCKET>/<SQL_S3_PATH> /tmp/database.sql
     mysql -h <RDS_ENDPOINT> -u <DB_USER> -p<DB_PASSWORD> <DB_NAME> < /tmp/database.sql
     ```

4. **Automated import:**
   - For automated, non-interactive imports, modify the script to run the import command directly in the container definition.

### Troubleshooting

- **403 Forbidden from S3:** Ensure the ECS task role has S3 access to the chosen bucket/object. Update IAM policies and redeploy if needed.
- **Access denied for MySQL user:** Ensure you use the password from AWS Secrets Manager, and that the MySQL user has host permissions for `%` or your VPC subnet.
- **ECS Exec not working:** Ensure `enableExecuteCommand: true` is set for the service or use `--enable-execute-command` for one-off tasks. Force new deployments to pick up the setting.
- **Task stuck or failing:** Check CloudWatch logs for `/ecs/pax-backend` or `/ecs/import` for detailed errors.

### Security Notes

- **Never hardcode DB credentials.** Always use AWS Secrets Manager as the source of truth.
- **RDS should remain in PRIVATE_ISOLATED subnets** for production. Only import from within the VPC.
- **Temporary Fargate tasks** are ephemeral, isolated, and follow least-privilege IAM.
- **Clean up S3 SQL files** after import to avoid sensitive data exposure.

---

## Utility Scripts

### `check-status.sh`

Checks the status of deployed services and infrastructure

### `check-backend-logs.sh`

Retrieves recent backend logs for debugging

### `destroy.sh`

Destroys the entire infrastructure (use with caution)

## Authentication System

The app uses a hybrid authentication system:

- **Token-based auth**: OAuth callback generates secure token in URL redirect
- **MySQL session store**: Replaces MemoryStore for ECS persistence
- **localStorage persistence**: 24-hour client-side storage for page refresh persistence
- **HTTPS enforcement**: All API calls use HTTPS to prevent mixed content errors

## Usage

1. First time deployment:

   ```bash
   ./deploy-infrastructure.sh
   ./setup-ecr.sh
   ```

2. Update application code:

   ```bash
   ./update-images.sh
   ```

3. Check deployment status:

   ```bash
   ./check-status.sh
   ```

4. Debug backend issues:

   ```bash
   ./check-backend-logs.sh
   ```

5. Clean up (destroys everything)
   ```bash
   ./destroy.sh
   ```

## New AWS Account Deployment

To deploy to a new AWS account:

1. **Copy S3 buckets** (if needed):

   ```bash
   # Edit the script to set DEST_PROFILE
   ./copy-s3-cross-account.sh
   ```

2. **Configure environment**:

   ```bash
   # Copy template and update with new account values
   cp ../.env.new-account-template ../.env
   # Edit .env with your new account credentials
   ```

3. **Deploy to new account**:
   ```bash
   ./deploy-new-account.sh
   ```

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed and running
- CDK installed (`npm install -g aws-cdk`)
- Environment variables configured in `../.env`
