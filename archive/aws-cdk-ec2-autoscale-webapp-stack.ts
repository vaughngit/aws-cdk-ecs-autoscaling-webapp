import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets'
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import { PlacementStrategy } from 'aws-cdk-lib/aws-ecs';

//const hostname = "foo.example.com";

interface IEc2Props extends StackProps {
  solutionName: string; 
//  VpcId: string;
 // ImageName: string;
 // CertificateArn: string;
  zonename: string; 
  InstanceType: string;
  //InstanceIAMRoleArn: string;
  InstancePort: number;
  HealthCheckPath: string;
  HealthCheckPort: string;
  HealthCheckHttpCodes: string;
  env: object; 
}


export class Ec2AutoscaleWebappStack extends Stack {

  readonly loadBalancer: elbv2.ApplicationLoadBalancer

  constructor(scope: Construct, id: string, props: IEc2Props) {
    super(scope, id, props);

  // const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
  //     vpcId: props.VpcId
  //   })

  const natGatewayProvider = ec2.NatProvider.instance({
    instanceType: new ec2.InstanceType('t3.nano'),
  })
  // Create new VPC
  const vpc = new ec2.Vpc(this, `createNewVPC`, { 
    vpcName: `${props.solutionName}-vpc`,
    natGatewayProvider: natGatewayProvider,
    maxAzs: 2,
    cidr: "172.16.0.0/16",
    natGateways: 2,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    subnetConfiguration: [
      {
        cidrMask: 24,
        name: 'ingress-1',
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,

      },
      {
        cidrMask: 24,
        name: 'ingress-2',
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: 24,
        name: 'application-1',
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      },
      {
        cidrMask: 24,
        name: 'application-2',
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      }
    ]
  });

    // const ami = ec2.MachineImage.lookup({
    //   name: props.ImageName
    // })

    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
    })

    const albSG = new ec2.SecurityGroup(this, `ALB-SecurityGroup`, { 
      vpc,
      description: `${props.solutionName}-alb security group`,
      securityGroupName: `${props.solutionName}-albsg`,  
    }); 

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, `ApplicationLoadBalancerPublic`, {
      vpc,
      securityGroup: albSG, 
      internetFacing: true,
      loadBalancerName: `${props.solutionName}-alb`,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, onePerAz: true },
    })

          // Create the Route 53 Hosted Zone
      const zone = new route53.HostedZone(this, "HostedZone", {
        zoneName: props.zonename,
        comment: `${props.solutionName}-hostedzone`
      });



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
    const httpListener = this.loadBalancer.addListener('alb listner', { 
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP, 
    });  

        // Create new Security Group for EC2 Instance: 
        const webserverSG = new ec2.SecurityGroup(this, 'webserver-sg', {
          vpc,
        });
    
        //allow traffic on any port from the ALB security group
        webserverSG.connections.allowFrom(
            new ec2.Connections({
              securityGroups: [albSG],
            }),
            ec2.Port.allTraffic(),
            `allow traffic on any port from the ALB security group`,
          )

        //Define ingress rule for security group 
         //  OPtion 1:
        // webserverSG.addIngressRule(
        //   ec2.Peer.anyIpv4(),
        //   ec2.Port.tcp(80),
        //   'allow HTTP traffic from anywhere',
        // ); 
      
/*        // Option 2:
        webserverSG.addIngressRule(
          ec2.Peer.ipv4(testLocationIp),
          ec2.Port.tcp(parseInt(appPort)),
          'allow HTTP traffic from specific location',
        ); */
    
      // Define EC2 Instance Role:  
      const role =  new iam.Role(this, 'ec2-role', {
        roleName: `${props.solutionName}_ec2-role`,
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        description: 'SSM EC2 role',
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            "AmazonSSMManagedInstanceCore",
          ),
        ],
      })

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      autoScalingGroupName: `${props.solutionName}_autoscaler`,
      vpc, 
      securityGroup: webserverSG, 
      instanceType: new ec2.InstanceType(props.InstanceType),
      // instanceType: ec2.InstanceType.of(
      //   ec2.InstanceClass.T3,
      //   ec2.InstanceSize.NANO,
      //  // ec2.InstanceSize.MEDIUM,
      // ),
      machineImage: ami, 
      allowAllOutbound: true,
      role: role,
      healthCheck: autoscaling.HealthCheck.ec2(),
      minCapacity: 2,
      maxCapacity: 3
    })

    // 👇 add scaling policy for the Auto Scaling Group
    autoScalingGroup.scaleOnCpuUtilization('cpu-util-scaling', {
      targetUtilizationPercent: 50
    });


    autoScalingGroup.addUserData('sudo yum install -y https://s3.region.amazonaws.com/amazon-ssm-region/latest/linux_amd64/amazon-ssm-agent.rpm')
    autoScalingGroup.addUserData('sudo systemctl enable amazon-ssm-agent')
    autoScalingGroup.addUserData('sudo systemctl start amazon-ssm-agent')
   
    autoScalingGroup.addUserData('echo "Hello World" > /var/www/html/index.html')

  
    httpListener.addTargets('TargetGroup', {
      targetGroupName: `${props.solutionName}-tg`,
      port: props.InstancePort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [autoScalingGroup], 
      healthCheck: {
        path: props.HealthCheckPath,
        port: props.HealthCheckPort,
        healthyHttpCodes: props.HealthCheckHttpCodes
      }
    })
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
    new CfnOutput(this, 'LoadBalancerDNS', { value: 'http://'+this.loadBalancer.loadBalancerDnsName, });
  }
}
