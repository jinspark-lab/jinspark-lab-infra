import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContainerStack } from './container-stack';
import { ServerStack } from './server-stack';
import { CICDStack } from './cicd-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class JinsparkLabStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'Default', { isDefault: true });
    // var bucketStack = new BucketStack(this, id + '-Bucket');
    var containerStack = new ContainerStack(this, id + '-Container');
    var server = new ServerStack(this, id + '-Server', vpc);
    var cicd = new CICDStack(this, id + '-CICD',
                                  vpc,
                                  containerStack.containerRepo, 
                                  server.service);
 }
}
