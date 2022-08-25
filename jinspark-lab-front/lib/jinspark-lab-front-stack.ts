import { aws_cloudfront_origins, Duration, SecretValue, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';
import { CfnDisk } from 'aws-cdk-lib/aws-lightsail';

export class JinsparkLabFrontStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // jinspark-lab (Backend) infra should be deployed precendently.
    // jinspark-lab project contains code to deploy the artifact bucket.
    const pipeline = new codepipeline.Pipeline(this, 'JinsparkLabFrontendPipeline', {
      pipelineName: 'JinsparkLabFrontendPipeline',
      restartExecutionOnUpdate: true,
      artifactBucket: s3.Bucket.fromBucketName(this, 'JinsparkLabFrontendArtifactBucket', 'jinspark-lab-infra-artifact-bucket')
    });

    // Source
    const repository = new codecommit.Repository(this, 'JinsparkLabFrontendRepo', {
      repositoryName: 'JinsparkLabFrontendRepo',
      description: 'JinsparkLab Frontend Repository'
    });

    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipelineActions.GitHubSourceAction({
      actionName: 'GithubSource',
      owner: 'jinspark-lab',
      repo: 'jinspark-lab-front',
      oauthToken: SecretValue.secretsManager('github-token'),   //Secret Key should not be stored in Key-Value format.
      output: sourceOutput,
      branch: 'main'
    });
    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction]
    });
    //

    const githubSource = codebuild.Source.gitHub({
      owner: 'jinspark-lab',
      repo: 'jinspark-lab-front'
      // webhook: true,
      // webhookFilters: [
      //   codebuild.FilterGroup
      //                       .inEventOf(codebuild.EventAction.PULL_REQUEST_MERGED)
      //                       .andBranchIs('main')
      // ]
    });

    // Build
    const project = new codebuild.Project(this, 'JinsparkLabFrontendBuild', {
      source: githubSource,
      buildSpec: codebuild.BuildSpec.fromSourceFilename('./buildspec.yaml'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        privileged: true
      },
      environmentVariables: {
        tag: {
          value: 'cdk'
        }
      }
    });

    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipelineActions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: project,
      input: sourceOutput,
      outputs: [buildOutput],
      // executeBatchBuild: true,
      // combineBatchBuildArtifacts: true
    });
    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // Change bucket name global unique.
    const bucket = new s3.Bucket(this, 'jinsparklab-frontend', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicPolicy: true
      }),
      removalPolicy: RemovalPolicy.DESTROY, //Auto delete bucket when CFN destroyed.
      autoDeleteObjects: true,              //Auto delete objects when CFN destroyed.
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
    });
    bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
        's3:*'
      ],
      resources: [bucket.arnForObjects('*')],
      principals: [new iam.AccountRootPrincipal()]
    }));

    const deployAction = new codepipelineActions.S3DeployAction({
      actionName: 'S3Deploy',
      bucket: bucket,
      input: buildOutput
    });
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction]
    });

    // CodePipeline does not natively support CF Invalidation after S3 deployment
    // You should put CodeBuild on Deployment stage and run invalidation CLI script if you want to automate
    // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-codepipeline-actions-readme.html#aws-s3-deployment
    const cf = new cloudfront.Distribution(this, 'JinsparkLabFrontendCF', {
      defaultBehavior: {
        origin: new aws_cloudfront_origins.S3Origin(bucket),    //Automatically Put OAI for S3 Bucket
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'JinsparkLabCachePolicy', {
          cachePolicyName: 'JinsparkLabCachePolicy',
          comment: 'Default cache policy for web-frontend',
          defaultTtl: Duration.days(1),
          maxTtl: Duration.days(7),
          cookieBehavior: cloudfront.CacheCookieBehavior.all(),
          // headerBehavior: cloudfront.CacheHeaderBehavior.allowList('X-CustomHeader'),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true
        }),
      },
      comment: 'Jinsparklab CDN'
    });

    new cdk.CfnOutput(this, 'CloudFrontDns', { value: cf.domainName });
  }
}
