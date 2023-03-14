import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BucketStack } from './bucket-stack';
import { CICDStack } from './cicd-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { ClusterStack } from './cluster-stack';

export class JinsparkLabStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const vpc = ec2.Vpc.fromLookup(this, 'Default', { isDefault: true });
        var bucketStack = new BucketStack(this, id + '-Bucket');
        var cluster = new ClusterStack(this, id + '-Eks', vpc);
        var cicd = new CICDStack(this, id + '-CICD',
            vpc,
            cluster.containerRepo,
            cluster.cluster);
    }
}
