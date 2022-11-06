import { NestedStackProps, NestedStack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class BucketStack extends NestedStack {
    constructor(scope: Construct, id: string, props?: NestedStackProps) {
        super(scope, id, props);

        try {
            s3.Bucket.validateBucketName('jinspark-lab-static-resource-bucket');
            const staticBucket = new s3.Bucket(this, 'jinspark-lab-static-resource-bucket', {
                bucketName: 'jinspark-lab-static-resource-bucket',
                encryption: s3.BucketEncryption.S3_MANAGED,
                blockPublicAccess: new s3.BlockPublicAccess({
                    blockPublicPolicy: true
                }),
                removalPolicy: RemovalPolicy.DESTROY, //Auto delete bucket when CFN destroyed.
                autoDeleteObjects: true,              //Auto delete objects when CFN destroyed.
                objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED
            });
            staticBucket.addToResourcePolicy(new iam.PolicyStatement({
                actions: [
                    's3:*'
                ],
                resources: [staticBucket.arnForObjects('*')],
                principals: [new iam.AccountRootPrincipal()]
            }));

        } catch (e) {
            console.log(e);
        }
    }
}
