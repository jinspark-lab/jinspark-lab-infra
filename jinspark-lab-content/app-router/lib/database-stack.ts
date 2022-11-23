import * as cdk from 'aws-cdk-lib';
import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DatabaseStack extends NestedStack {
    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        const tableName = this.node.tryGetContext('tableName');

        const table = new dynamodb.Table(scope, id + '_DDB', {
            tableName,
            partitionKey: { name: 'UUID', type: dynamodb.AttributeType.STRING }
        });
        
    }
}
