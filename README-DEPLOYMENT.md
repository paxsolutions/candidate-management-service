# PAX App AWS Deployment Guide

This guide will help you deploy the Candidate Management Application to AWS using Infrastructure as Code (CDK).

## Prerequisites

1. **AWS CLI** installed and configured

   ```bash
   aws configure
   ```

2. **Docker** installed and running

3. **Node.js** (v18 or later) installed

4. **AWS CDK** installed globally
   ```bash
   npm install -g aws-cdk
   ```

## Quick Deployment

1. **Clone and setup**

   ```bash
   cd candidate-management-service
   ```

2. **Install CDK dependencies**

   ```bash
   cd infrastructure
   npm install
   ```

3. **Make deployment script executable**

   ```bash
   chmod +x ../scripts/deploy.sh
   chmod +x ../scripts/destroy.sh
   ```

4. **Deploy everything**
   ```bash
   cd ../scripts
   ./deploy.sh
   ```

## What Gets Deployed

### Infrastructure Components

- **VPC** with public/private subnets across 2 AZs
- **RDS MySQL** database in private subnets
- **ECS Fargate** cluster for containerized services
- **Application Load Balancer** for traffic distribution
- **ECR repositories** for Docker images
- **Secrets Manager** for secure credential storage
- **CloudWatch** for logging and monitoring

### Services

- **Backend Service**: Node.js/Express API with Google OAuth
- **Frontend Service**: React application with Nginx
- **Database**: MySQL 8.0 with automated backups

## Architecture

```
Internet → ALB → ECS Services → RDS Database
                ↓
            CloudWatch Logs
```

## Configuration

### Environment Variables

Ensure your `.env` file contains:

```bash
# Database
DB_USER=pax_user
DB_PASSWORD=pax_password
DB_NAME=pax_db
DB_PORT=3306

# AWS
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your_bucket_name

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_session_secret

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://your-alb-dns/auth/google/callback` (production)
   - `http://localhost:5000/auth/google/callback` (development)

## Deployment Commands

### Deploy Infrastructure

```bash
cd scripts
./deploy.sh
```

### Update Application Only

```bash
# After making code changes
cd scripts
./deploy.sh
```

### View Logs

```bash
# Backend logs
aws logs tail /ecs/pax-backend --follow

# Frontend logs
aws logs tail /ecs/pax-frontend --follow
```

### Scale Services

```bash
# Scale backend to 2 instances
aws ecs update-service --cluster pax-cluster --service pax-backend --desired-count 2

# Scale frontend to 2 instances
aws ecs update-service --cluster pax-cluster --service pax-frontend --desired-count 2
```

### Destroy Infrastructure

```bash
cd scripts
./destroy.sh
```

## Monitoring & Troubleshooting

### Health Checks

- Backend health: `http://your-alb-dns/api/health`
- Detailed health: `http://your-alb-dns/api/health/detailed`

### AWS Console Links

After deployment, check these services:

- **ECS**: Monitor service health and logs
- **RDS**: Database performance and connections
- **CloudWatch**: Application logs and metrics
- **Load Balancer**: Traffic distribution and health checks

### Common Issues

1. **Services not starting**
   - Check ECS service logs in CloudWatch
   - Verify environment variables in Secrets Manager
   - Ensure Docker images are pushed to ECR

2. **Database connection errors**
   - Verify RDS security group allows ECS access
   - Check database credentials in Secrets Manager
   - Ensure database is in available state

3. **Google OAuth not working**
   - Verify redirect URIs in Google Console
   - Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
   - Ensure ALB DNS is accessible

## Cost Optimization

### Development

- Use t3.micro instances
- Single AZ deployment
- Minimal log retention

### Production

- Use appropriate instance sizes
- Multi-AZ for high availability
- Enable deletion protection
- Set up automated backups

## Security Best Practices

1. **Secrets Management**
   - All sensitive data stored in Secrets Manager
   - No hardcoded credentials in code

2. **Network Security**
   - Database in private subnets
   - Security groups with minimal access
   - ALB with HTTPS (add SSL certificate)

3. **Access Control**
   - IAM roles with minimal permissions
   - ECS task roles for service-specific access

## Backup & Recovery

### Database Backups

- Automated daily backups (7-day retention)
- Point-in-time recovery available
- Manual snapshots for major releases

### Application Recovery

- Docker images stored in ECR
- Infrastructure defined as code
- Quick redeployment capability

## Support

For issues or questions:

1. Check CloudWatch logs first
2. Verify AWS service status
3. Review this documentation
4. Contact your AWS administrator
