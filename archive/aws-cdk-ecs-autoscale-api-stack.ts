import { Stack, StackProps, Duration, CfnOutput, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import { PlacementStrategy } from 'aws-cdk-lib/aws-ecs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';

//const hostname = "foo.example.com";

interface IecsApiProps extends StackProps {
  solutionName: string; 
  VpcId: string;
  Port: number;
 // HealthCheckPath: string;
 // HealthCheckPort: string;
 // HealthCheckHttpCodes: string;
  env: object; 
}


export class EcsAutoscaleAPIStack extends Stack {

//  readonly loadBalancer: elbv2.ApplicationLoadBalancer

  constructor(scope: Construct, id: string, props: IecsApiProps) {
    super(scope, id, props);

  // const natGatewayProvider = ec2.NatProvider.instance({
  //   instanceType: new ec2.InstanceType('t3.nano'),
  // })

  // const vpc = ec2.Vpc.fromLookup(this, "VPC", {
  //   isDefault: true,
  // });

  const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
      //vpcId: Fn.importValue(`${props.solutionName}-vpcip`).toString()
      vpcId: props.VpcId
    })



// import cloudmap services
const cloudMapNamespace  = servicediscovery.PrivateDnsNamespace.fromPrivateDnsNamespaceAttributes(this, "import cloudmap namespace", {
  namespaceName: Fn.importValue(`${props.solutionName}-nsName`).toString(),
  namespaceId: Fn.importValue(`${props.solutionName}-nsId`).toString(),
  namespaceArn: Fn.importValue(`${props.solutionName}-nsarn`).toString()
})

  const cloudMapService = new servicediscovery.Service(this, `api ServiceDiscovery`, {
    namespace: cloudMapNamespace,
    // healthCheck: {
    //   type: servicediscovery.HealthCheckType.HTTP,
    //   resourcePath: '/health', 
    // },
    dnsRecordType: servicediscovery.DnsRecordType.A,
    dnsTtl: Duration.seconds(300),
    name: `${props.solutionName}-api`, // will be used as a subdomain of the domain set in the namespace
    routingPolicy: servicediscovery.RoutingPolicy.WEIGHTED, //WEIGHTED: Route 53 returns the applicable value from one randomly selected instance from among the instances that you registered using the same service.
    loadBalancer: true // Important! If you choose WEIGHTED but don't set this, the routing policy will default to MULTIVALUE instead
   })
  
/* 
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
 */

// task role ― grants permissions to the actual application once the containers are started.
  const generalTaskRole = new iam.Role(this, "ecsContainerRole", {
    roleName: `${props.solutionName}-API-Container-TaskRole`,
    description: "Grants permissions to the actual application once the containers are started.",
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryPowerUser"),
      //iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess")
    ]
  });


    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'ApiFargateTask', {
      taskRole: generalTaskRole,
      //executionRole: generalExecutionRole,
    });

    // add container to taskdef 
    fargateTaskDefinition.addContainer('APIContainer', {
      //image: ecs.ContainerImage.fromAsset('./SampleApp'),
      //image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      image: ecs.ContainerImage.fromAsset('./SourceCode/faker-api'),
      portMappings: [{ containerPort: props.Port}],
      memoryReservationMiB: 256,
      cpu : 256,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: `${props.solutionName}-api-service` }),
    });


/*   //Create ECS Container Security Group 
  const ecsSG = new ec2.SecurityGroup(this, `ECS-Service-SG`, { 
    vpc,
    securityGroupName: `${props.solutionName}-ecs-sg`,  
    description: `${props.solutionName} ecs cluster securitygroup`,
  }); */

  

  const ecsSG = ec2.SecurityGroup.fromSecurityGroupId(this, "import ecs security group", Fn.importValue(`${props.solutionName}-ecsSgId`).toString())


/*   const cluster = new ecs.Cluster(this, 'create cluster', {
    vpc: vpc,
    clusterName: `${props.solutionName}-ecscluster`,
    containerInsights: true,
    enableFargateCapacityProviders: true,
  });   
  cluster.connections.addSecurityGroup(ecsSG) 
 */

  
  //const cluster = ecs.Cluster.fromClusterArn(this, "import clustomer", Fn.importValue(`${props.solutionName}-ecsClusterArn`).toString() )
  const cluster = ecs.Cluster.fromClusterAttributes(this, "import clustomer",  {
    clusterName: Fn.importValue(`${props.solutionName}-ecsClusterName`).toString(),
    vpc, 
    clusterArn: Fn.importValue(`${props.solutionName}-ecsClusterArn`).toString() ,
    securityGroups: [ecsSG]
  })
/* 
  const albSG = new ec2.SecurityGroup(this, `ALB-SecurityGroup`, { 
    vpc,
    securityGroupName: `${props.solutionName}-albsg`,  
    description: `${props.solutionName}-alb security group`,
  }); 
 */
/* 
  //allow traffic on any port from the ALB security group
  ecsSG.connections.allowFrom(
    new ec2.Connections({
      securityGroups: [albSG],
    }),
    ec2.Port.allTraffic(),
    `allow traffic on any port from the ALB security group`,
  )

 */
  const fargateService = new ecs.FargateService(this, 'Api Service', {
    serviceName: `${props.solutionName}-api`,    
    cluster,
    taskDefinition: fargateTaskDefinition,
    desiredCount: 2,
    assignPublicIp: false,
    securityGroups: [ecsSG],
    propagateTags: ecs.PropagatedTagSource.TASK_DEFINITION,
    enableECSManagedTags: true,  
  });


  fargateService.associateCloudMapService({  service: cloudMapService, containerPort: props.Port  })
  // Setup AutoScaling policy
  const fargatescaling = fargateService.autoScaleTaskCount({ maxCapacity: 3, minCapacity: 1 });

  

    fargatescaling.scaleOnCpuUtilization('api_fargate_autoscale_cpu', {
      policyName: `${props.solutionName}-api-asg-cpu-scaling-policy`,
      targetUtilizationPercent: 25,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60)  
    });

/* 
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      loadBalancerName: `${props.solutionName}-alb`,
      internetFacing: true,
      securityGroup: albSG, 
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }
    });

    const alblistener = alb.addListener('Listener', {
      port: 80
    });

    alblistener.addTargets('Target', {
      port: 3000,
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

    alblistener.connections.allowDefaultPortFromAnyIpv4('Open to the world');
 */
    // Create the Route 53 Hosted Zone
    // const zone = new route53.HostedZone(this, "HostedZone", {
    //   zoneName: props.zonename,
    //   comment: `${props.solutionName}-hostedzone`
    // });



    // const acmcert =  new acm.Certificate(this, 'AcmCertificate', {
    //   //https://docs.aws.amazon.com/cdk/api/v1/docs/aws-certificatemanager-readme.html
    //     domainName: `${hostName}.${hostedZoneName}`,
    //     validation: acm.CertificateValidation.fromDns(hostedZone),
    //   });
/* 
    // Create a new SSL certificate in ACM
    const acmcert = new acm.Certificate(this, "Certificate", {
      domainName: props.zonename,
      validation: acm.CertificateValidation.fromDns(zone),
    });
  
 */

/*     const httpsListener = this.loadBalancer.addListener('ALBListenerHttps', {
      //certificates: elbv2.ListenerCertificate.fromArn(props.CertificateArn),
      certificates: [elbv2.ListenerCertificate.fromCertificateManager(acmcert)],
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: 443,
      //sslPolicy: elbv2.SslPolicy.TLS12
      sslPolicy: elbv2.SslPolicy.RECOMMENDED,

    }) */
    // const httpListener = this.loadBalancer.addListener('alb listner', { 
    //   port: 80,
    //   protocol: elbv2.ApplicationProtocol.HTTP, 
    // });  


    
  
/* 

    // Add a Route 53 alias with the Load Balancer as the target
    new route53.ARecord(this, "AliasRecord", {
      zone: zone,
      target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(this.loadBalancer)),
      recordName: "pocrecord1",
      comment: "CDK Proof of concept"
    });

    const cnameRecord = new route53.CnameRecord(this, 'MyCnameRecord', {
      domainName: this.loadBalancer.loadBalancerDnsName,
      zone: zone ,
      comment: 'proof of concept',
      recordName: "pocrecord2",
      ttl: Duration.minutes(30),
    }); 
 */
    //new CfnOutput(this, 'LoadBalancerDNS', { value: 'http://'+alb.loadBalancerDnsName, });
  }
}
