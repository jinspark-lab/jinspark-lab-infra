import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as stepfunction from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunction_task from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';


export class AppGatewayStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        var profileLambdaIntegration = this.buildProfileApi();
        var blogLambdaIntegration = this.buildBlogApi();
        var loadGeneratorIntegration = this.buildLoadGenApi();

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

        // Profile App
        const profileResource = api.root.addResource('profile');
        const profileIdResource = profileResource.addResource('{contentId}');
        profileIdResource.addMethod('GET', profileLambdaIntegration);

        // Blog App
        const blogResource = api.root.addResource('blog');
        const blogIdResource = blogResource.addResource('{contentId}');
        blogIdResource.addMethod('GET', blogLambdaIntegration);

        // UserApp
        const appResource = api.root.addResource('app');

        // Load Generator
        const loadGeneratorAppResource = appResource.addResource('loadgen');
        loadGeneratorAppResource.addMethod('POST', loadGeneratorIntegration);

    }

    buildProfileApi() {
        // Lambda Role
        const profileRole = new iam.Role(this, 'ProfileLambdaRole', {
            roleName: 'jinsparklab-profilelambda-role',
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
            roleName: 'jinsparklab-bloglambda-role',
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

    buildLoadGenApi() {
        const loadGenRole = new iam.Role(this, 'LoadGenLambdaRole', {
            roleName: 'jinsparklab-loadgenlambda-role',
            description: '',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaRole'),
                ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess')
            ]
        });

        var loadGenLambda = new lambda.Function(this, 'LoadGenLambda', {
            functionName: 'jinsparklab-loadgen',
            runtime: lambda.Runtime.NODEJS_16_X,
            handler: 'app.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '/../src/loadgen')),
            timeout: cdk.Duration.seconds(60),
            role: loadGenRole
        });

        const lambdaTask = new stepfunction_task.LambdaInvoke(this, 'InvokeState', {
            lambdaFunction: loadGenLambda
        });

        /*  
            Input JSON example (as API Gateway RequestBody).
            {
              "dataset": [
                  {
                      "url": "https://9hip8j4pfh.execute-api.us-east-1.amazonaws.com/prod/test",
                      "method": "GET"
                  },
                  {
                      "url": "https://9hip8j4pfh.execute-api.us-east-1.amazonaws.com/prod/test",
                      "method": "POST",
                      "body": {
                          "key1": "value1",
                          "key2": "value2"
                      }
                  }
              ]
            }
        */
        // Map State runs concurrent Lambda function simultaneously up to 10.
        // This concurrency based on the length of dataset
        const mapState = new stepfunction.Map(this, 'LoadGenMap', {
            maxConcurrency: 10,
            itemsPath: stepfunction.JsonPath.stringAt('$.body.dataset')
        });
        mapState.iterator(lambdaTask);

        const stateMachine = new stepfunction.StateMachine(this, 'JinsparkLoadGenStateMachine', {
            stateMachineName: 'jinsparklab-loadgen-statemachine',
            stateMachineType: stepfunction.StateMachineType.EXPRESS,
            definition: stepfunction.Chain.start(mapState)
        });

        return apigateway.StepFunctionsIntegration.startExecution(stateMachine);
    }
}
