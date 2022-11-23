import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './api-stack';
import { DatabaseStack } from './database-stack';

export class AppRouterStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        var apiStack = new ApiStack(this, id + "_Api");
        var databaseStack = new DatabaseStack(this, id + "_Db");
        
    }
}
