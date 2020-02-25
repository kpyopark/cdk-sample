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

    const privateSubnetB = new ec2.PrivateSubnet(this, 'privatesubnetc', {
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

  }
}
