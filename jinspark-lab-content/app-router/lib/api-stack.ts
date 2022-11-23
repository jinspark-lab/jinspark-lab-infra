import * as cdk from 'aws-cdk-lib';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';


export class ApiStack extends NestedStack {
    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        const routerLambdaRole = new iam.Role(scope, id + '_RouterLambda Role', {
            description: 'Lambda Task Role for Router Lambda',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess')
            ]
        });

        var routerLambda = new lambda.Function(scope, id + '_RouterLambda', {
            functionName: id + '_RouterLambda',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'router.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '/../lambda')),
            timeout: cdk.Duration.seconds(300),
            role: routerLambdaRole
        });
        const routerLambdaIntegration = new apigateway.LambdaIntegration(routerLambda);

        var api = new apigateway.RestApi(scope, id + '_RouterApi', {
            restApiName: id + '_RouterApi',
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
        const routerApi = api.root.addResource('{contentId}');
        routerApi.addMethod('GET', routerLambdaIntegration);
    }
}
