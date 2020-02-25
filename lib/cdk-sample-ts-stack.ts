import * as cdk from '@aws-cdk/core';
import ec2 = require('@aws-cdk/aws-ec2');
import { truncate } from 'fs';

export class CdkSampleTsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    const vpc = new ec2.Vpc(this, 'test-curly-alb-vpc', 
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

    const userdata = ec2.UserData.custom("sudo yum update -y \nsudo yum install -y httpd24 php56 php56-mysqld \nsudo chkconfig httpd on\nsudo groupadd www\nsudo usermod -a -G www ec2-user\nsudo chgrp -R www /var/www\nsudo chmod 2775 /var/www\n");

    const ec2insta = new ec2.Instance(this, 'insta', {
      instanceType : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: amznImage,
      vpc: vpc,
      userData: userdata,
      allowAllOutbound: true,
      instanceName: 'insta',
      keyName: 'sample_keypair',
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
      instanceName: 'insta',
      keyName: 'sample_keypair',
      securityGroup: sshandhttpsg,
      vpcSubnets: {
        subnets: [privateSubnetC]
      }
    });

  }
}
