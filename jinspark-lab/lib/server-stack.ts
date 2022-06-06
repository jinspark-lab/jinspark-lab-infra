import { NestedStack, NestedStackProps, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { FargateService } from 'aws-cdk-lib/aws-ecs';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';

export class ServerStack extends NestedStack {
  service:FargateService;

  constructor(scope: Construct, id: string, containerRepo: Repository, props?: NestedStackProps) {
    super(scope, id, props);

    // ECS Deployment
    const vpc = ec2.Vpc.fromLookup(scope, 'Default', { isDefault: true });
    const cluster = new ecs.Cluster(scope, 'Fargate', { vpc });

    const taskDefinitionRole = new iam.Role(this, 'MyFargateRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Jinspark-lab Fargate Task Definition Role',
      managedPolicies: [
        // ManagedPolicy.fromAwsManagedPolicyName('AmazonECSTaskExecutionRolePolicy')
        //arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
        ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
      ]
    });
    taskDefinitionRole.attachInlinePolicy(new iam.Policy(this, 'secretkey-policy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameters',
            'kms:Decrypt',
            'secretsmanager:GetSecretValue'
          ],
          resources: ['*']
        })
      ]
    }));

    // Policy that Task can pull images from ECR & Secret Key from SecretsManager.
    const taskDefinition = new ecs.FargateTaskDefinition(scope, "MyFargateDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: taskDefinitionRole
    });
    taskDefinition.addContainer('MyContainer', {
      containerName: 'jinspark-lab',
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample')    //Default Set Up
    }).addPortMappings({
      containerPort: 8080,
      // hostPort: 80,                 //awsvpc networkmode should use same port as container port.
      protocol: ecs.Protocol.TCP
    });

    const fargate = new ecs_patterns.ApplicationLoadBalancedFargateService(scope, "MyFargate", {
      cluster,
      taskDefinition,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
        onePerAz: true
      }
      // Empty Container 로 만들면 생성이 안되고, 이미지를 지정하자니 이미지가 CodeBuild 에서 만들어져서
      // CI/CD 파이프라인에 등록되어있지 않아서 구동이 안됨
    });
    fargate.targetGroup.configureHealthCheck({
      path: '/health'
    });
    const autoscaling = fargate.service.autoScaleTaskCount({
      minCapacity: 2,
      maxCapacity: 4
    });
    autoscaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60)
    });

    this.service = fargate.service;
    new cdk.CfnOutput(scope, 'LoadBalancerDns', { value: fargate.loadBalancer.loadBalancerDnsName });

    //
  }
}
