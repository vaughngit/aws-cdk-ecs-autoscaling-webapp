import { RemovalPolicy, Stack, StackProps, Tags, custom_resources as cr, CustomResource, CfnOutput, Duration, } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from 'path';

//const hostname = "foo.example.com";

interface IStackProps extends StackProps {
  ALBPort: number,
  AppPort: number,
  testingLocation: string; 
  HealthCheckPath: string;
  HealthCheckPort: string;
  HealthCheckHttpCodes: string;
  //env: object; 
  environment: string; 
  solutionName: string; 
  serviceName: string; 
  costcenter: string; 
}


export class EcsAutoscaleWebappStack extends Stack {

  constructor(scope: Construct, id: string, props: IStackProps) {
    super(scope, id, props);


  // const vpc = ec2.Vpc.fromLookup(this, "VPC", {
  //   isDefault: true,
  // });

  // const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
  //     vpcId: props.VpcId
  //   })

  const natGatewayProvider = ec2.NatProvider.instance({
    //instanceType: new ec2.InstanceType('t3.small'),
    //instanceType: new ec2.InstanceType('t3.micro'),
    instanceType: new ec2.InstanceType('t3.nano'),
    //instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.LARGE),
    // machineImage: new ec2.AmazonLinuxImage({
    //   generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
    //   cpuType: ec2.AmazonLinuxCpuType.ARM_64
    // }),
  })


  // Create new VPC
  const vpc = new ec2.Vpc(this, `createNewVPC`, { 
    vpcName: `${props.solutionName}-vpc`,
    maxAzs: 2,
    cidr: "172.16.0.0/16",
    natGatewayProvider: natGatewayProvider,
    natGateways: 2,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    subnetConfiguration: [
      {
        cidrMask: 24,
        name: `${props.solutionName}-ingress-1`,
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,

      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-ingress-2`,
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-application-1`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-application-2`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      }
    ]
  });

  const cloudMapNamespace = new servicediscovery.PrivateDnsNamespace(this, `ServiceDiscoveryNamespace`, {
    name: `${props.solutionName}.local`, // The domain your want to use in the DNS lookup
    vpc,
  });

    //task execution role ― is a general role that grants permissions to start the containers defined in a task. 
   //Those permissions are granted to the ECS agent so it can call AWS APIs on your behalf.
   const generalExecutionRole = new iam.Role(this, `General-Task-ExecutionRole`, {
    roleName: `${props.solutionName}-ECS-Task-ExecutionRole`,
    description: "A general role that grants permissions to start the containers defined in a task.",
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")
    ]
  });


// task role ― grants permissions to the actual application once the containers are started.
  const generalTaskRole = new iam.Role(this, "ecsContainerRole", {
    roleName: `${props.solutionName}-ECS-Container-TaskRole`,
    description: "Grants permissions to the actual application once the containers are started.",
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryPowerUser"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess")
    ]
  });


    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'FargateTask', {
      taskRole: generalTaskRole,
      executionRole: generalExecutionRole,
    });

    // add container to taskdef 
    fargateTaskDefinition.addContainer('WFEContainer', {
      //image: ecs.ContainerImage.fromAsset('./SampleApp'),
      //image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      //image: ecs.ContainerImage.fromAsset('./SourceCode/reactServer'),
     // image: ecs.ContainerImage.fromAsset('./SourceCode/pythonWebApp_Api'),
      image: ecs.ContainerImage.fromAsset('./SourceCode/react-node-combined-app'),
      portMappings: [{ containerPort: props.AppPort}],
      memoryReservationMiB: 256,
      cpu : 256,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: `${props.solutionName}-wfe-service` }),
    });


  //Create ECS Container Security Group 
  const ecsSG = new ec2.SecurityGroup(this, `ECS-Service-SG`, { 
    vpc,
    securityGroupName: `${props.solutionName}-ecs-sg`,  
    description: `${props.solutionName} ecs cluster securitygroup`,
  });

  const cluster = new ecs.Cluster(this, 'create cluster', {
    vpc: vpc,
    clusterName: `${props.solutionName}-ecscluster`,
    containerInsights: true,
    enableFargateCapacityProviders: true,
  });   
  cluster.connections.addSecurityGroup(ecsSG) 

  const albSG = new ec2.SecurityGroup(this, `ALB-SecurityGroup`, { 
    vpc,
    securityGroupName: `${props.solutionName}-albsg`,  
    description: `${props.solutionName}-alb security group`,
  }); 


  //allow traffic on any port from the ALB security group
  ecsSG.connections.allowFrom(
    new ec2.Connections({
      securityGroups: [albSG],
    }),
    ec2.Port.allTraffic(),
    `allow traffic on any port from the ALB security group`,
  )


  const fargateService = new ecs.FargateService(this, 'Service', {
    serviceName: `${props.solutionName}-webapp`,    
    cluster,
    taskDefinition: fargateTaskDefinition,
    desiredCount: 2,
    assignPublicIp: false,
    securityGroups: [albSG]
  });


    // Setup AutoScaling policy
    const fargatescaling = fargateService.autoScaleTaskCount({ maxCapacity: 3, minCapacity: 1 });

  
    fargatescaling.scaleOnCpuUtilization('fargate_autoscale_cpu', {
      policyName: `${props.solutionName}-asg-cpu-scaling-policy`,
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60)  
    });


    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      loadBalancerName: `${props.solutionName}-alb`,
      internetFacing: true,
      securityGroup: albSG, 
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }
    });

    const alblistener = alb.addListener('Listener', {
      port: props.ALBPort,
      open: false 
    });

    alblistener.addTargets('Target', {
      port: props.AppPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetGroupName: `${props.solutionName}-tg`,
      targets: [fargateService],
      //healthCheck: { path: '/api/' }
      healthCheck: { 
        path: props.HealthCheckPath,
        healthyHttpCodes: props.HealthCheckHttpCodes,
        port: props.HealthCheckPort,
        protocol: elbv2.Protocol.HTTP,
       }
    });

       //allow ingress from test location only 
      albSG.addIngressRule(ec2.Peer.ipv4(props.testingLocation), ec2.Port.tcp(props.ALBPort), 'allow HTTP traffic from test location only' ); 
   // alblistener.connections.allowDefaultPortFromAnyIpv4('Open to the world');

   // Create Custom Resouce Assets to destroy NatGateway Instances Permissions and tag Interface endpoints 
   const sdk3layer = new lambda.LayerVersion(this, 'HelperLayer', {
    code: lambda.Code.fromAsset('SourceCode/lambda-layer/aws-sdk-3-layer'),
    description: 'AWS JS SDK v3',
    compatibleRuntimes: [lambda.Runtime.NODEJS_12_X,lambda.Runtime.NODEJS_14_X],
    removalPolicy: RemovalPolicy.DESTROY,
  });


  const crLambda = new NodejsFunction(this, "DeployFunction", {
    functionName: `${props.solutionName}-${props.serviceName}-update-infrastructure-${props.environment}`,
    entry: path.join(__dirname, `/../SourceCode/customResourceLambda/index.ts`),
    runtime: lambda.Runtime.NODEJS_14_X,
    handler: 'handler',
    timeout: Duration.minutes(10),
    layers: [sdk3layer],
    environment: {
      REGION: this.region
    },
    bundling: {
      minify: true,
      externalModules: ['aws-sdk','@aws-sdk/client-iam','@aws-sdk/client-ec2'],
    },
  });

  const provider = new cr.Provider(this, "Provider", {
    onEventHandler: crLambda,
  });

  provider.onEventHandler.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["iam:*", "ec2:*"],
      effect: iam.Effect.ALLOW,
      resources: [ `*`],
    })
  );


  new CustomResource(this, "CustomResource", {
    serviceToken: provider.serviceToken,
    properties: {
      natGateways: natGatewayProvider.configuredGateways,
      vpcId: vpc.vpcId,
      tags:[  {Key: "service", Value: props.serviceName},{Key: "environment", Value: props.environment}, {Key: "solution", Value: props.solutionName},{Key: "costcenter", Value: props.costcenter}    ]
      
    },
  });

   Tags.of(this).add("service", `${props.serviceName}`,{
    includeResourceTypes: []
  })
  Tags.of(this).add("environment", props.environment)
  Tags.of(this).add("solution", props.solutionName)
  Tags.of(this).add("costcenter", props.costcenter)
  //Tags.of(this).add("ShutdownPolicy", "NoShutdown")
    
    new CfnOutput(this, 'LoadBalancerDNS', { value: 'http://'+alb.loadBalancerDnsName, });
    new CfnOutput(this, 'VPCIP', { value: vpc.vpcId, exportName: `${props.solutionName}-vpcip` });
    new CfnOutput(this, 'CloudMapNamespaceArn', { value: cloudMapNamespace.namespaceArn, exportName: `${props.solutionName}-nsarn` });
    new CfnOutput(this, 'CloudMapNamespaceId', { value: cloudMapNamespace.namespaceId, exportName: `${props.solutionName}-nsId` });
    new CfnOutput(this, 'CloudMapNamespaceName', { value: cloudMapNamespace.namespaceName, exportName: `${props.solutionName}-nsName` });
    new CfnOutput(this, 'ECS Cluster Name', { value: cluster.clusterName, exportName: `${props.solutionName}-ecsClusterName` });
    new CfnOutput(this, 'ECS Cluster Arn', { value: cluster.clusterArn, exportName: `${props.solutionName}-ecsClusterArn` });
    new CfnOutput(this, 'ECS Security Group Id', { value: ecsSG.securityGroupId, exportName: `${props.solutionName}-ecsSgId` });
  }
}
