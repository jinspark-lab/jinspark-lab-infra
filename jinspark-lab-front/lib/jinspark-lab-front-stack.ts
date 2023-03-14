import { aws_cloudfront_origins, Duration, SecretValue, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { OriginAccessIdentity, OriginSslPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { LoadBalancerV2Origin } from 'aws-cdk-lib/aws-cloudfront-origins';

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
            bucketName: 'jinspark-lab-frontend-stack',
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

        const frontendCachePolicy = new cloudfront.CachePolicy(this, 'JinsparkLabCachePolicy', {
            cachePolicyName: 'JinsparkLabCachePolicy',
            comment: 'Default cache policy for jinspark-lab frontend',
            defaultTtl: Duration.days(1),
            maxTtl: Duration.days(7),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            //   headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
            //   queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true
        });
        const backendCachePolicy = new cloudfront.CachePolicy(this, 'JinsparkLabBackendCachePolicy', {
            cachePolicyName: 'JinsparkLabBackendCachePolicy',
            comment: 'Backend cache policy for jinspark-lab backend',
            defaultTtl: Duration.seconds(0),
            cookieBehavior: cloudfront.CacheCookieBehavior.all(),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
        });

        // SSL Certificate
        const certificate = acm.Certificate.fromCertificateArn(this, 'JinsparkLabAcm', 
                        'arn:aws:acm:us-east-1:486403792456:certificate/ff25a67e-dcb9-439a-9759-72c03197406d');

        // CodePipeline does not natively support CF Invalidation after S3 deployment
        // You should put CodeBuild on Deployment stage and run invalidation CLI script if you want to automate
        // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-codepipeline-actions-readme.html#aws-s3-deployment
        const s3Origin = new aws_cloudfront_origins.S3Origin(bucket);

        const cf = new cloudfront.Distribution(this, 'JinsparkLabFrontendCF', {
            defaultBehavior: {
                origin: s3Origin,    //Automatically Put OAI for S3 Bucket
                originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: frontendCachePolicy
            },
            certificate,
            domainNames: ['www.jinsparklab.com'],
            defaultRootObject: 'index.html',
            errorResponses: [
              {
                httpStatus: 400,
                responseHttpStatus: 200,
                responsePagePath: '/index.html',
                ttl: cdk.Duration.minutes(1)
              },
              {
                httpStatus: 403,
                responseHttpStatus: 200,
                responsePagePath: '/index.html',
                ttl: cdk.Duration.minutes(1)
              }
            ],
            comment: 'Jinsparklab CDN'
        });

        const alb = elb.ApplicationLoadBalancer.fromLookup(this, 'ALBOrigin', {
            loadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:486403792456:loadbalancer/app/JinsparkLabALB/2a6cd73a7767cc2a'
        });
        const albOrigin = new LoadBalancerV2Origin(alb);

        // Change Cache Policy as required (JinsparkLabBackendCachePolicy)
        cf.addBehavior('/api*', albOrigin, {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            cachePolicy: backendCachePolicy,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER
        });
        cf.addBehavior('/login/*', albOrigin, {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            cachePolicy: backendCachePolicy,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER
        });

        // Keep Cache Policy as CachingDisabled
        cf.addBehavior('/health', albOrigin, {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER
        });

        // Sharable -> S3 Frontend
        cf.addBehavior('/share/*', s3Origin, {
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        });

        new cdk.CfnOutput(this, 'CloudFrontDns', { value: cf.domainName });
    }
}
