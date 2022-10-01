import { NestedStack, NestedStackProps, } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import { FargateService } from 'aws-cdk-lib/aws-ecs';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

export class ServerStack extends NestedStack {
    service: FargateService;

    constructor(scope: Construct, id: string, vpc: IVpc, props?: NestedStackProps) {
        super(scope, id, props);

        // ECS Deployment
        // const vpc = ec2.Vpc.fromLookup(scope, 'Default', { isDefault: true });
        const cluster = new ecs.Cluster(scope, 'Fargate', { vpc });

        const taskDefinitionRole = new iam.Role(scope, 'MyFargateExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'Jinspark-lab Fargate Task Definition Role',
            managedPolicies: [
                // ManagedPolicy.fromAwsManagedPolicyName('AmazonECSTaskExecutionRolePolicy')
                //arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
            ]
        });
        taskDefinitionRole.attachInlinePolicy(new iam.Policy(scope, 'secretkey-policy', {
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
        const taskRole = new iam.Role(scope, 'MyFargateTaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
            description: 'Jinspark-lab Fargate Task Role',
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess')
            ]
        });

        // Policy that Task can pull images from ECR & Secret Key from SecretsManager.
        const taskDefinition = new ecs.FargateTaskDefinition(scope, "MyFargateDef", {
            memoryLimitMiB: 512,
            cpu: 256,
            executionRole: taskDefinitionRole,    // TaskExecutionRole : Makes ECS agent permission to call AWS API (Authentication & Get ECR & CW Logs)
            taskRole: taskRole                    // TaskRole : Make ECS containers call AWS API via this permission
        });
        taskDefinition.addContainer('MyContainer', {
            containerName: 'jinspark-lab',
            image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),    //Initial Set Up
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'jinspark-lab-fargate-logs', logRetention: 30 })
        }).addPortMappings({
            containerPort: 8080,
            // hostPort: 80,                 //awsvpc networkmode should use same port as container port.
            protocol: ecs.Protocol.TCP
        });

        const alb = new elb.ApplicationLoadBalancer(scope, 'JinsparkLabAlb', {
            loadBalancerName: 'JinsparkLab-ALB',
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC,
                onePerAz: true
            },
            internetFacing: true
        });

        const fargate = new ecs_patterns.ApplicationLoadBalancedFargateService(scope, "JinsparkLabFargate", {
            cluster,
            taskDefinition,
            taskSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_NAT,
                onePerAz: true      // Due to this configuration, it is recommended to set all Public/Private Subnets in AZs
            },
            loadBalancer: alb,
            publicLoadBalancer: true
        });
        fargate.targetGroup.configureHealthCheck({
            path: '/health',
            timeout: cdk.Duration.seconds(10),
            interval: cdk.Duration.seconds(60)
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
