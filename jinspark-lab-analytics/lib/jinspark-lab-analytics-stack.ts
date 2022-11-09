import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BucketStack } from './bucket-stack';
import { KinesisStack } from './kinesis-stack';
import { ElasticsearchStack } from './elasticsearch-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class JinsparkLabAnalyticsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // props?.env?.account

        const vpc = ec2.Vpc.fromLookup(this, 'Default', { isDefault: true });
        var bucketStack = new BucketStack(this, id + '_bucket');
        var elasticsearchStack = new ElasticsearchStack(this, id + '_elasticsearch', vpc);
        var kinesisStack = new KinesisStack(this, id + '_kinesis',
            bucketStack.firehoseBucketArn,
            elasticsearchStack.domainArn,
            [elasticsearchStack.domainSecurityGroup],
            [elasticsearchStack.domainSubnet]
        );

    }
}
