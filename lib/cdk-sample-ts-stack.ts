import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import { truncate } from 'fs';


const vpcenv = ( process.env.vpcenv === undefined ) ? 'test' : process.env.vpcenv;
const corp = (process.env.corpname === undefined ) ? 'samcorp' : process.env.corpname;
const servicename = (process.env.servicename === undefined ) ? 'albtest' : process.env.servicename;
const elemPrefix = `${vpcenv}-${corp}-${servicename}-`;
const ec2keypair = ( process.env.keypair === undefined ) ? 'sample_keypair' : process.env.keypair;

export class CdkSampleTsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, `${elemPrefix}-vpc`, 
    {
      cidr : '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 3,
      // This subnet is configured for the IGW. 
      // VPC class won't import new Subnet class instances declared in the code. 
      // And no subnet can make trouble for VPC to make IGW in the initialization.
      subnetConfiguration: []
    });

    // Subnets
    const privateSubnetA = new ec2.PrivateSubnet(this, 'privatesubneta', {
      availabilityZone : 'ap-northeast-2a',
      cidrBlock: '10.0.10.0/24',
      vpcId: vpc.vpcId,
      mapPublicIpOnLaunch: false
    });

    const privateSubnetC = new ec2.PrivateSubnet(this, 'privatesubnetc', {
      availabilityZone : 'ap-northeast-2c',
      cidrBlock: '10.0.20.0/24',
      vpcId: vpc.vpcId,
      mapPublicIpOnLaunch: false
    });

    const publicSubnetA = new ec2.PublicSubnet(this, 'publicsubneta', {
      availabilityZone: 'ap-northeast-2a',
      cidrBlock: '10.0.30.0/24',
      vpcId: vpc.vpcId,
      mapPublicIpOnLaunch : true
    });

    const publicSubnetC = new ec2.PublicSubnet(this, 'publicsubnetc', {
      availabilityZone: 'ap-northeast-2c',
      cidrBlock: '10.0.40.0/24',
      vpcId: vpc.vpcId,
      mapPublicIpOnLaunch: true
    });

    const igw = new ec2.CfnInternetGateway(this, 'cdksample-igw');
    const igwattachment = new ec2.CfnVPCGatewayAttachment(this, 'cdksample-igw-attachment', {
      internetGatewayId: igw.ref,
      vpcId: vpc.vpcId
    });

    publicSubnetA.addDefaultInternetRoute(igw.ref, igwattachment);
    publicSubnetC.addDefaultInternetRoute(igw.ref, igwattachment);

    // yum update need internet connectvity. 
    // we should make connection between private subnet and at least one nat gateway.
    const ngw = publicSubnetA.addNatGateway();
    privateSubnetA.addDefaultNatRoute(ngw.ref);
    privateSubnetC.addDefaultNatRoute(ngw.ref);

    const sshandhttpsg = new ec2.SecurityGroup(this, 'sshandhttpsg', {
      vpc: vpc,
      securityGroupName: 'test-alb-sg-ssh-http',
      description: 'alb test security group. It will allow ssh & http port',
      allowAllOutbound: true
    });

    sshandhttpsg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow public ssh');
    sshandhttpsg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'allow public http');

    const amznImage = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE
    });

    const httpsg = new ec2.SecurityGroup(this, 'httpsg', {
      vpc: vpc, 
      securityGroupName: 'test-alb-sg-http',
      description: 'alb test security group.It will allow http port only.',
      allowAllOutbound: true
    });

    httpsg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow public http');

    /**
     * '''shell
      #!/bin/bash -ex
      exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
      echo BEGIN_USERSCRIPT
      date '+%Y-%m-%d %H:%M:%S'
      sudo yum update -y
      sudo yum install -y httpd php php-mysqld 
      sudo chkconfig httpd on
      sudo groupadd www
      sudo usermod -a -G www ec2-user
      sudo chgrp -R www /var/www
      sudo echo `ifconfig | grep inet` >> /var/www/html/index.html
      sudo chmod 2775 /var/www
      sudo service httpd start
      echo END_USERSCRIPT
     * '''shell
     */
    const userdata = ec2.UserData.forLinux({
      shebang: `#!/bin/bash -ex
      exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
      echo BEGIN_USERSCRIPT
      date '+%Y-%m-%d %H:%M:%S'
      sudo yum update -y
      sudo yum install -y httpd php php-mysqld 
      sudo chkconfig httpd on
      sudo groupadd www
      sudo usermod -a -G www ec2-user
      sudo chgrp -R www /var/www
      sudo echo \`ifconfig | grep inet\` >> /var/www/html/index.html
      sudo chmod 2775 /var/www
      sudo service httpd start
      echo END_USERSCRIPT
      `
    });

    const ec2insta = new ec2.Instance(this, 'insta', {
      instanceType : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: amznImage,
      vpc: vpc,
      userData: userdata,
      allowAllOutbound: true,
      instanceName: `${elemPrefix}-instanceA`,
      keyName: ec2keypair,
      securityGroup: sshandhttpsg,
      vpcSubnets: {
        subnets: [privateSubnetA]
      }
    });

    const ec2instc = new ec2.Instance(this, 'instc', {
      instanceType : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: amznImage,
      vpc: vpc,
      userData: userdata,
      allowAllOutbound: true,
      instanceName: `${elemPrefix}-instanceC`,
      keyName: ec2keypair,
      securityGroup: sshandhttpsg,
      vpcSubnets: {
        subnets: [privateSubnetC]
      }
    });

    // add ALB and alb target class
    const albtarget = new elbv2.ApplicationTargetGroup(this, `${elemPrefix}-albtg1`, {
      targetGroupName: `${elemPrefix}-albtg1`,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      targets: [ new elbv2.InstanceTarget(ec2insta.instanceId), new elbv2.InstanceTarget(ec2instc.instanceId)],
      healthCheck : {
        // 5 seconds could make troubles in future.
        timeout: cdk.Duration.seconds(10)
      },
      vpc: vpc
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, `${elemPrefix}-alb1`, {
      vpc: vpc, 
      internetFacing: true, 
      vpcSubnets: {
        subnets: [publicSubnetA, publicSubnetC]
      },
      securityGroup: httpsg
    });

    const listener = alb.addListener(`${elemPrefix}-httplistener`, {
      port: 80
    });

    listener.addTargetGroups(`${elemPrefix}-attachedtg1`, {
      targetGroups: [albtarget]
    });

    listener.connections.allowDefaultPortFromAnyIpv4('open to the world.');

  }
}
