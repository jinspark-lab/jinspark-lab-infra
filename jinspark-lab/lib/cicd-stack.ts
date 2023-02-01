import { Duration, NestedStack, NestedStackProps, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { FargateService } from 'aws-cdk-lib/aws-ecs';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

export class CICDStack extends NestedStack {
    constructor(scope: Construct, id: string, vpc: IVpc, containerRepo: Repository, service: FargateService, props?: NestedStackProps) {
        super(scope, id, props);

        const pipeline = new codepipeline.Pipeline(scope, 'JinsparkLabPipeline', {
            pipelineName: 'jinspark-lab-pipeline',
            restartExecutionOnUpdate: true,
            artifactBucket: s3.Bucket.fromBucketName(this, 'JinsparkLabFrontendArtifactBucket', 'jinspark-lab-infra-artifact-bucket')
        });

        const sourceOutput = new codepipeline.Artifact();
        const sourceAction = new codepipelineActions.GitHubSourceAction({
            actionName: 'GithubSource',
            owner: 'jinspark-lab',
            repo: 'jinspark-lab',
            oauthToken: SecretValue.secretsManager('github-token'),   //Secret Key should not be stored in Key-Value format.
            output: sourceOutput,
            branch: 'main'
        });
        pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction]
        });

        const githubSource = codebuild.Source.gitHub({
            owner: 'jinspark-lab',
            repo: 'jinspark-lab'
            // webhook: true,
            // webhookFilters: [
            //   codebuild.FilterGroup
            //                       .inEventOf(codebuild.EventAction.PULL_REQUEST_MERGED)
            //                       .andBranchIs('main')
            // ]
        });
        const project = new codebuild.Project(scope, 'JinsparkLabBuild', {
            projectName: 'jinspark-lab-build',
            source: githubSource,
            buildSpec: codebuild.BuildSpec.fromSourceFilename('./buildspec.yaml'),
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
                privileged: true
            },
            vpc,
            environmentVariables: {
                ecr: {
                    value: containerRepo.repositoryUri
                },
                tag: {
                    value: '1.0'
                }
            }
        });
        containerRepo.grantPullPush(project);
        project.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    'secretsmanager:DescribeSecret',
                    'secretsmanager:GetSecretValue',
                    "s3:ListAllMyBuckets",
                    "s3:ListBucket",
                    "dynamodb:GetItem",
                    "dynamodb:List*",
                    "dynamodb:Describe*",
                    "dynamodb:PutItem",
                    "sqs:SendMessage"
                ],
                resources: ['*'],
                effect: iam.Effect.ALLOW
            })
        );

        const buildOutput = new codepipeline.Artifact();
        const buildAction = new codepipelineActions.CodeBuildAction({
            actionName: 'SpringBuild',
            project,
            input: sourceOutput,
            outputs: [buildOutput]
        });
        pipeline.addStage({
            stageName: 'Build',
            actions: [buildAction]
        });

        const deployAction = new codepipelineActions.EcsDeployAction({
            actionName: 'EcsDeploy',
            service: service,
            input: buildOutput,
            deploymentTimeout: Duration.minutes(60)
        });
        pipeline.addStage({
            stageName: 'Deploy',
            actions: [
                deployAction
            ]
        });
    }
}
