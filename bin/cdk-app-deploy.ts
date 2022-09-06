#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Ec2AutoscaleWebappStack } from '../archive/aws-cdk-ec2-autoscale-webapp-stack';
import { EcsAutoscaleAPIStack } from '../archive/aws-cdk-ecs-autoscale-api-stack';
import {EcsAutoscaleWebappStack} from '../lib/aws-cdk-ecs-autoscale-webapp-stack'

const aws_region = 'us-east-2'
const environment = 'dev'
const solutionName = "videoextractor"
const costcenter = "technetcentral"

const app = new cdk.App();
new EcsAutoscaleWebappStack(app, 'ecs-webapp',
{
  stackName: "ecs-autoscaling-webapp",
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region || process.env.CDK_DEFAULT_REGION
  },
  environment, 
  solutionName, 
  serviceName: "ecs-infrastructure",
  costcenter,
  ALBPort: 80,
  AppPort: 80,
  testingLocation: "104.8.80.40/32",
  HealthCheckPort: "80",
  HealthCheckPath: "/health",
  HealthCheckHttpCodes: "200"
});

/* 
new EcsAutoscaleAPIStack(app, 'ecs-api',
{
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  // env: { account: '123456789012', region: 'us-east-1' },
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-west-2' },
  stackName: "ab3-prep-ecs-api", 
  solutionName: "awesomebuilder",
  //zonename: "awesomebuilder.local",
  VpcId: "",
  Port: 3030,
 // HealthCheckPath: "/",
 // HealthCheckPort: "80",
 // HealthCheckHttpCodes: "200"
});
 */
/* new Ec2AutoscaleWebappStack(app, 'ec2-webapp',
{
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  // env: { account: '123456789012', region: 'us-east-1' },
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-west-2' },
  stackName: "ab3Ec2", 
  solutionName: "awesomebuilder",
  zonename: "awesomebuilder.local",
  InstanceType: "t3.micro",
  InstancePort: 80,
  HealthCheckPath: "/",
  HealthCheckPort: "80",
  HealthCheckHttpCodes: "200"
});
 */

cdk.Tags.of(app).add("environment", "dev")
cdk. Tags.of(app).add("solution", "awesomebuilder")
cdk.Tags.of(app).add("costcenter", "training")