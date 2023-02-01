import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Handler } from 'aws-cdk-lib/aws-lambda';


export class AppGatewayStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        var profileLambdaIntegration = this.buildProfileApi();
        var blogLambdaIntegration = this.buildBlogApi();

        // API Gateway
        var api = new apigateway.RestApi(this, 'AppGatewayApi', {
            restApiName: 'JinsparkLabAppGatewayApi',
            endpointTypes: [apigateway.EndpointType.REGIONAL],
            defaultCorsPreflightOptions: {
                statusCode: 200,
                disableCache: true,
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['GET', 'OPTIONS', 'POST'],
                allowCredentials: true,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
            }
        });
        const profileResource = api.root.addResource('profile');
        const profileIdResource = profileResource.addResource('{contentId}');
        profileIdResource.addMethod('GET', profileLambdaIntegration);

        const blogResource = api.root.addResource('blog');
        const blogIdResource = blogResource.addResource('{contentId}');
        blogIdResource.addMethod('GET', blogLambdaIntegration);
    }

    buildProfileApi() {
        // Lambda Role
        const profileRole = new iam.Role(this, 'ProfileLambdaRole', {
            description: 'Lambda Task Role for UserProfile Lambda',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess')
            ]
        });
        
        // Lambda Function
        var profileLambda = new lambda.Function(this, 'ProfileLambda', {
            functionName: 'jinsparklab-app-userprofile',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'app.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '/../src/userprofile')),
            timeout: cdk.Duration.seconds(300),
            role: profileRole
        });

        // Database
        const tableName = this.node.tryGetContext('profileDatabase');
        const table = new dynamodb.Table(this, 'ProfileDDB', {
            tableName,
            partitionKey: { name: 'UUID', type: dynamodb.AttributeType.STRING }
        });
        return new apigateway.LambdaIntegration(profileLambda);
    }

    buildBlogApi() {
        // Lambda Role
        const blogRole = new iam.Role(this, 'BlogLambdaRole', {
            description: 'Lambda Task Role for Blog Lambda',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess')
            ]
        });
        
        // Lambda Function
        var blogLambda = new lambda.Function(this, 'BlogLambda', {
            functionName: 'jinsparklab-app-blog',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'app.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '/../src/blog')),
            timeout: cdk.Duration.seconds(300),
            role: blogRole
        });

        // Database
        const tableName = this.node.tryGetContext('blogDatabase');
        const table = new dynamodb.Table(this, 'BlogDDB', {
            tableName,
            partitionKey: { name: 'UUID', type: dynamodb.AttributeType.STRING }
        });
        return new apigateway.LambdaIntegration(blogLambda);

    }
}
