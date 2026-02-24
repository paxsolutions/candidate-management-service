import * as cdk from "aws-cdk-lib";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as elbv2targets from "aws-cdk-lib/aws-elasticloadbalancingv2-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

import { Construct } from "constructs";

import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

export class CandidateAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets
    const vpc = new ec2.Vpc(this, "CandidateVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "Database",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Reference existing ECR repositories
    const backendRepo = ecr.Repository.fromRepositoryName(
      this,
      "CandidateBackendRepo",
      "candidate-backend",
    );
    // Frontend ECR repository removed - frontend now served from S3/CloudFront

    // Create application secrets
    const appSecret = new secretsmanager.Secret(this, "CandidateAppSecret", {
      secretName: "candidate-app-secrets",
      secretObjectValue: {
        GOOGLE_CLIENT_ID: cdk.SecretValue.unsafePlainText(
          process.env.GOOGLE_CLIENT_ID || "",
        ),
        GOOGLE_CLIENT_SECRET: cdk.SecretValue.unsafePlainText(
          process.env.GOOGLE_CLIENT_SECRET || "",
        ),
        SESSION_SECRET: cdk.SecretValue.unsafePlainText(
          process.env.SESSION_SECRET || "",
        ),
        AWS_ACCESS_KEY_ID: cdk.SecretValue.unsafePlainText(
          process.env.AWS_ACCESS_KEY_ID || "",
        ),
        AWS_SECRET_ACCESS_KEY: cdk.SecretValue.unsafePlainText(
          process.env.AWS_SECRET_ACCESS_KEY || "",
        ),
        S3_BUCKET_NAME: cdk.SecretValue.unsafePlainText(
          process.env.S3_BUCKET_NAME || "",
        ),
        EXTERNAL_API_KEY: cdk.SecretValue.unsafePlainText(
          process.env.EXTERNAL_API_KEY || "",
        ),
      },
    });

    // Create DynamoDB table for candidates
    const candidatesTable = new dynamodb.Table(this, "CandidatesTable", {
      tableName: process.env.DYNAMODB_TABLE_NAME || "",
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing (no cost when idle)
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      pointInTimeRecovery: true, // Enable backups
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, "CandidateCluster", {
      vpc,
      clusterName: "candidate-cluster",
      containerInsights: false,
    });

    // Domain configuration
    // TODO: Update CUSTOM_DOMAIN and ROOT_DOMAIN in your .env file to match your own domain
    const domainName =
      process.env.CUSTOM_DOMAIN || "your-subdomain.yourdomain.com";
    const rootDomain = process.env.ROOT_DOMAIN || "yourdomain.com";

    // Lookup existing hosted zone
    const hostedZone = route53.HostedZone.fromLookup(
      this,
      "CandidateHostedZone",
      {
        domainName: rootDomain,
      },
    );

    const certificate = new certificatemanager.Certificate(
      this,
      "CandidateCertificate",
      {
        domainName,
        validation:
          certificatemanager.CertificateValidation.fromDns(hostedZone),
      },
    );

    // Create Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(
      this,
      "CandidateLoadBalancer",
      {
        vpc,
        internetFacing: true,
        loadBalancerName: "candidate-alb",
      },
    );

    // Create security group for ALB
    const albSecurityGroup = new ec2.SecurityGroup(
      this,
      "CandidateAlbSecurityGroup",
      {
        vpc,
        description: "Security group for Candidate Application Load Balancer",
      },
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "Allow HTTP",
    );
    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "Allow HTTPS",
    );

    alb.addSecurityGroup(albSecurityGroup);

    // Create security group for ECS services
    const ecsSecurityGroup = new ec2.SecurityGroup(
      this,
      "CandidateEcsSecurityGroup",
      {
        vpc,
        description: "Security group for Candidate ECS services",
      },
    );
    ecsSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.allTcp(),
      "Allow traffic from ALB",
    );

    // Create task execution role
    const taskExecutionRole = new iam.Role(this, "CandidateTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
    });

    // Grant access to secrets
    appSecret.grantRead(taskExecutionRole);

    // Create task role
    const taskRole = new iam.Role(this, "CandidateTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    // Grant S3 access to task role
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ],
        resources: [
          `arn:aws:s3:::${process.env.S3_BUCKET_NAME || ""}`,
          `arn:aws:s3:::${process.env.S3_BUCKET_NAME || ""}/*`,
          `arn:aws:s3:::${process.env.S3_IMPORT_BUCKET || ""}`,
          `arn:aws:s3:::${process.env.S3_IMPORT_BUCKET || ""}/*`,
        ],
      }),
    );

    // Frontend now served from CloudFront/S3 - ECS frontend resources removed

    // Create Lambda function for backend API
    // NOTE: Lambda is NOT in VPC to allow internet access (OAuth, etc.) without NAT Gateway
    // RDS will be publicly accessible with security group restrictions
    const backendLambda = new lambda.Function(this, "CandidateBackendLambda", {
      functionName: "candidate-backend",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "lambda.handler",
      code: lambda.Code.fromAsset("../backend", {
        bundling: {
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            "bash",
            "-c",
            "cp -r . /asset-output && cd /asset-output && npm install --omit=dev",
          ],
        },
      }),
      // vpc: removed - Lambda needs internet access for OAuth
      // vpcSubnets: removed
      // allowPublicSubnet: removed
      // securityGroups: removed - not in VPC
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.THREE_DAYS,
      environment: {
        NODE_ENV: "production",
        FRONTEND_URL: process.env.FRONTEND_URL || "",
        API_BASE_URL: process.env.API_BASE_URL || "",
        GOOGLE_CLIENT_ID: appSecret
          .secretValueFromJson("GOOGLE_CLIENT_ID")
          .unsafeUnwrap(),
        GOOGLE_CLIENT_SECRET: appSecret
          .secretValueFromJson("GOOGLE_CLIENT_SECRET")
          .unsafeUnwrap(),
        SESSION_SECRET: appSecret
          .secretValueFromJson("SESSION_SECRET")
          .unsafeUnwrap(),
        S3_BUCKET_NAME: appSecret
          .secretValueFromJson("S3_BUCKET_NAME")
          .unsafeUnwrap(),
        EXTERNAL_API_KEY: appSecret
          .secretValueFromJson("EXTERNAL_API_KEY")
          .unsafeUnwrap(),
        FORCE_DEPLOY: "v6-bundled-deps", // Force CloudFormation to detect change
      },
    });

    // Grant Lambda access to DynamoDB
    candidatesTable.grantReadWriteData(backendLambda);

    // Grant Lambda access to S3
    backendLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ],
        resources: [
          `arn:aws:s3:::${process.env.S3_BUCKET_NAME || ""}`,
          `arn:aws:s3:::${process.env.S3_BUCKET_NAME || ""}/*`,
          `arn:aws:s3:::${process.env.S3_IMPORT_BUCKET || ""}`,
          `arn:aws:s3:::${process.env.S3_IMPORT_BUCKET || ""}/*`,
        ],
      }),
    );

    // Create HTTP listener - redirect all HTTP to HTTPS (frontend on CloudFront)
    const httpListener = alb.addListener("CandidateListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        permanent: true,
      }),
    });

    // HTTP listener routes all traffic to frontend (redirects to HTTPS at priority 200)

    // SSL and custom domain configuration (commented out until Route53 is set up)
    // Uncomment the following when you have Route53 hosted zone ready:
    //
    const httpsListener = alb.addListener("CandidateHttpsListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: "text/plain",
        messageBody: "Not Found - API endpoints are at /api/* and /auth/*",
      }),
    });

    // Add Lambda API routing to HTTPS listener
    httpsListener.addTargets("ApiRouting", {
      targets: [new elbv2targets.LambdaTarget(backendLambda)],
      priority: 100,
      conditions: [
        elbv2.ListenerCondition.pathPatterns([
          "/api/*",
          "/auth/*",
          "/external/*",
        ]),
      ],
      healthCheck: {
        enabled: true,
        path: "/api/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // HTTP to HTTPS redirect is now the default action on HTTP listener

    // Create S3 bucket for frontend static site
    const frontendBucket = new s3.Bucket(this, "CandidateFrontendBucket", {
      bucketName: `candidate-frontend-${cdk.Stack.of(this).account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(
      this,
      "CandidateFrontendOAI",
      {
        comment: "OAI for Candidate Frontend S3 bucket",
      },
    );

    // Grant CloudFront access to S3 bucket
    frontendBucket.grantRead(oai);

    // Create CloudFront distribution with multiple origins
    const distribution = new cloudfront.Distribution(
      this,
      "CandidateFrontendDistribution",
      {
        defaultBehavior: {
          origin: new cloudfrontOrigins.S3Origin(frontendBucket, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
          compress: true,
        },
        additionalBehaviors: {
          "/api/*": {
            origin: new cloudfrontOrigins.LoadBalancerV2Origin(alb, {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            }),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          },
          "/auth/*": {
            origin: new cloudfrontOrigins.LoadBalancerV2Origin(alb, {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            }),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          },
          "/external/*": {
            origin: new cloudfrontOrigins.LoadBalancerV2Origin(alb, {
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            }),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          },
        },
        domainNames: [domainName],
        certificate: certificate,
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
            ttl: cdk.Duration.seconds(0),
          },
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/index.html",
            ttl: cdk.Duration.seconds(0),
          },
        ],
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        comment: "Candidate Frontend Distribution",
      },
    );

    // Update Route 53 record to point to CloudFront instead of ALB
    new route53.ARecord(this, "CandidateAliasRecord", {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53targets.CloudFrontTarget(distribution),
      ),
    });

    // Output values
    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: distribution.distributionId,
      description: "CloudFront distribution ID",
    });

    new cdk.CfnOutput(this, "CloudFrontDomainName", {
      value: distribution.distributionDomainName,
      description: "CloudFront distribution domain name",
    });

    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: frontendBucket.bucketName,
      description: "S3 bucket name for frontend",
    });

    new cdk.CfnOutput(this, "ApplicationUrl", {
      value: `https://${domainName}`,
      description: "HTTPS URL of the application",
    });

    new cdk.CfnOutput(this, "DomainName", {
      value: domainName,
      description: "Custom domain name for the application",
    });

    new cdk.CfnOutput(this, "LoadBalancerUrl", {
      value: `http://${alb.loadBalancerDnsName}`,
      description: "Direct ALB URL (for reference)",
    });

    new cdk.CfnOutput(this, "BackendRepositoryUri", {
      value: backendRepo.repositoryUri,
      description: "Backend ECR repository URI",
    });

    // Frontend ECR repository output removed - frontend now on S3/CloudFront

    new cdk.CfnOutput(this, "DynamoDBTableName", {
      value: candidatesTable.tableName,
      description: "DynamoDB table name for candidates",
    });
  }
}
