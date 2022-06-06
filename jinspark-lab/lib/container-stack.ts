import { NestedStackProps, NestedStack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Repository } from 'aws-cdk-lib/aws-ecr';

export class ContainerStack extends NestedStack {
  containerRepo:Repository;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    this.containerRepo = new ecr.Repository(scope, 'JinsparkLabRepo', {
      repositoryName: 'jinspark-lab-ecr',
      removalPolicy: RemovalPolicy.DESTROY
    });
    //
  }
}
