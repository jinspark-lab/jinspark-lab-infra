import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class AppRouterStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const routerLambdaRole = new iam.Role(this, id + '_Lambda_Role', {
            roleName: id + '_LambdaRole',
            description: 'Lambda Task Role for Router Lambda',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess')
            ]
        });

        var routerLambda = new lambda.Function(this, id + '_Lambda', {
            functionName: id + '_Lambda',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'router.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda')),
            timeout: cdk.Duration.seconds(300),
            role: routerLambdaRole
        });
        const routerLambdaIntegration = new apigateway.LambdaIntegration(routerLambda);

        var api = new apigateway.RestApi(this, id + '_Api', {
            restApiName: id + '_Api',
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
        const routerApi = api.root.addResource('content');
        const contentApi = routerApi.addResource('{contentId}');
        contentApi.addMethod('GET', routerLambdaIntegration);

        const tableName = this.node.tryGetContext('tableName');

        const table = new dynamodb.Table(this, id + '_DDB', {
            tableName,
            partitionKey: { name: 'UUID', type: dynamodb.AttributeType.STRING }
        });
    }
}
