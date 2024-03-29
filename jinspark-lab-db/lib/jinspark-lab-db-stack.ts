import { Stack, StackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { aws_elasticache as elasticache } from 'aws-cdk-lib';
import { IpAddressType } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class JinsparkLabDbStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'Default', { isDefault: true });
    const securityGroup = new ec2.SecurityGroup(this, 'JinsparkLabDBSG', {
      vpc,
      allowAllOutbound: true,
      description: 'JinsparkLab Backend Database Security Group',
      securityGroupName: 'JinsparkLabDBSG'
    });
    
    //Need to add Ingress Rule for server after creating the stack (Decoupling)
    securityGroup.addIngressRule(securityGroup, ec2.Port.allTraffic(), 'All from self');
    securityGroup.addEgressRule(ec2.Peer.ipv4('0.0.0.0/0'), ec2.Port.allTraffic(), 'All outbound traffic');

    const rdb = new rds.DatabaseInstance(this, 'JinsparkLabDB', {      
      instanceIdentifier: 'JinsparkLabDB',
      engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0_28
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      },
      maxAllocatedStorage: 200,
      securityGroups: [
        securityGroup
      ],
      credentials: rds.Credentials.fromGeneratedSecret('admin', {
        secretName: 'jinsparklab-rdb-secret'
      })
    });

    // NOTE : Currently L1 Constructor only supports default VPC deployment. 
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_elasticache-readme.html
    const redis = new elasticache.CfnCacheCluster(this, 'JinsparkLabRedis', {
      cacheNodeType: 'cache.t4g.medium',
      engine: 'redis',
      numCacheNodes: 1,
      vpcSecurityGroupIds: [
        securityGroup.securityGroupId
      ],
      clusterName: 'jinspark-redis'
    });
  }
}
