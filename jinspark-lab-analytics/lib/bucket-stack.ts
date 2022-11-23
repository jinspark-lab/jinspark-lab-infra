import { NestedStackProps, NestedStack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class BucketStack extends NestedStack {
    firehoseBucketArn: string
    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        const firehoseBucket = new s3.Bucket(this, 'jinspark-lab-firehose-bucket', {
            bucketName: 'jinspark-lab-firehose-bucket',
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: RemovalPolicy.DESTROY, //Auto delete bucket when CFN destroyed.
            autoDeleteObjects: true,              //Auto delete objects when CFN destroyed.
            objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
        });
        firehoseBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: [
                's3:*'
            ],
            resources: [firehoseBucket.arnForObjects('*')],
            principals: [new iam.AccountRootPrincipal()]
        }));
        this.firehoseBucketArn = firehoseBucket.bucketArn;
    }
}
