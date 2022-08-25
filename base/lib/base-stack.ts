import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class BaseStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Change bucket name global unique.
    const bucket = new s3.Bucket(this, 'jinspark-lab-infra-artifact-bucket', {
      bucketName: 'jinspark-lab-infra-artifact-bucket',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: new s3.BlockPublicAccess({
          blockPublicPolicy: true
      }),
      removalPolicy: RemovalPolicy.DESTROY, //Auto delete bucket when CFN destroyed.
      autoDeleteObjects: true,              //Auto delete objects when CFN destroyed.
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
      });
      bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [
          's3:*'
      ],
      resources: [bucket.arnForObjects('*')],
      principals: [new iam.AccountRootPrincipal()]
      }));
  //
  }
}
