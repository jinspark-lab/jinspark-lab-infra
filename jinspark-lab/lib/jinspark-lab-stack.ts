import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContainerStack } from './container-stack';
import { BucketStack } from './bucket-stack';
import { ServerStack } from './server-stack';
import { CICDStack } from './cicd-stack';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { ManagementEventSources } from 'aws-cdk-lib/aws-cloudtrail';

export class JinsparkLabStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    var bucketStack = new BucketStack(this, id + '-Bucket');
    var containerStack = new ContainerStack(this, id + '-Container');
    var server = new ServerStack(this, id + '-Server', containerStack.containerRepo);
    var cicd = new CICDStack(this, id + '-CICD', 
                                  bucketStack.storage, 
                                  containerStack.containerRepo, 
                                  server.service);
 }
}
