import { NestedStackProps, NestedStack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class KinesisStack extends NestedStack {
    constructor(scope: Construct, id: string, 
        bucketArn: string, 
        elasticsearchDomain: string, 
        vpcSecurityGroupIds: string[],
        vpcSubnetIds: string[],
        props?: NestedStackProps) {
        super(scope, id, props);

        const firehoseRole = new iam.Role(scope, 'Jinsparklab-Firehose-Role', {
            roleName: 'Jinsparklab-Firehose-Role',
            assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
        });
        firehoseRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: [
                    'es:ESHttpPost',
                    'es:ESHttpPut',
                    'es:ESHttpGet',
                    'es:DescribeElasticsearchDomain',
                    'es:DescribeElasticsearchDomains',
                    'es:DescribeElasticsearchDomainConfig'
                ]
            })
        );
        firehoseRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: [
                    's3:AbortMultipartUpload',
                    's3:GetBucketLocation',
                    's3:GetObject',
                    's3:ListBucket',
                    's3:ListBucketMultipartUploads',
                    's3:PutObject'
                ]
            })
        );
        firehoseRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: [
                    'logs:PutLogEvents'
                ]
            })
        );
        firehoseRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: [
                    'ec2:DescribeVpcs',
                    'ec2:DescribeVpcAttribute',
                    'ec2:DescribeSubnets',
                    'ec2:DescribeSecurityGroups',
                    'ec2:DescribeNetworkInterfaces',
                    'ec2:CreateNetworkInterface',
                    'ec2:CreateNetworkInterfacePermission',
                    'ec2:DeleteNetworkInterface'
                ]
            })
        );

        const deliveryStream = new firehose.CfnDeliveryStream(scope, 'Jinsparklab-Backend-Stream', {
            deliveryStreamName: 'JinsparkLabFirehose',
            amazonopensearchserviceDestinationConfiguration: {
                indexName: 'backend_logs',
                domainArn: elasticsearchDomain,
                roleArn: firehoseRole.roleArn,
                bufferingHints: {
                    intervalInSeconds: 60,
                    sizeInMBs: 5
                },
                s3BackupMode: 'FailedDocumentsOnly',
                s3Configuration: {
                    bucketArn: bucketArn,
                    roleArn: firehoseRole.roleArn,
                    prefix: 'backend_backup'
                },
                vpcConfiguration: {
                    roleArn: firehoseRole.roleArn,
                    subnetIds: vpcSubnetIds,
                    securityGroupIds: vpcSecurityGroupIds
                }
            }
        });

    }
}
