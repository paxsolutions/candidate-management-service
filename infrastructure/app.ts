import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { CandidateAppStack } from "./lib/candidate-app-stack";

import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const app = new cdk.App();

// Get environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

// Create the main stack
new CandidateAppStack(app, "CandidateAppStack", {
  env,
  description: "Candidate Application Infrastructure",
  tags: {
    Project: "Candidate",
    Environment: "production",
    ManagedBy: "CDK",
  },
});
