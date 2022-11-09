import { NestedStackProps, NestedStack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import { EngineVersion } from 'aws-cdk-lib/aws-opensearchservice';
import { IVpc, Subnet, SubnetType } from 'aws-cdk-lib/aws-ec2';

export class ElasticsearchStack extends NestedStack {
    domainArn: string;
    domainSecurityGroup: string;
    domainSubnet: string;

    constructor(scope: Construct, id: string, vpc: IVpc, props?: NestedStackProps) {
        super(scope, id, props);

        const esSecurityGroup = new ec2.SecurityGroup(scope, 'JinsparkLabESSG', {
            vpc,
            allowAllOutbound: true,
            description: 'Jinsparklab Elasticsearch Security Group',
            securityGroupName: 'JinsparkLabESSG'
        });
        //Need to add Ingress Rule for server after creating the stack (Decoupling)
        esSecurityGroup.addIngressRule(esSecurityGroup, ec2.Port.allTraffic(), 'All from self');

        vpc.selectSubnets({
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            onePerAz: true
        });

        // Depends on Target Subnet, The number of ES would be fixed.
        const targetSubnet = vpc.selectSubnets({
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        }).subnets[0];

        // Just publish 1 Instance for Elasticsearch.
        const es = new opensearch.Domain(scope, 'EsDomain', {
            version: EngineVersion.OPENSEARCH_1_3,
            vpc,
            securityGroups: [
                esSecurityGroup
            ],
            vpcSubnets: [
                {
                    subnets: [targetSubnet]
                }
            ],
            capacity: {
                // masterNodes: 3,
                // masterNodeInstanceType: "t3.medium.search",
                // dataNodes: 3,
                // dataNodeInstanceType: "m5.large.search"
                masterNodeInstanceType: "t3.medium.search",
                dataNodeInstanceType: "m5.large.search"
            },
            // zoneAwareness: {
            //     enabled: true           // Replicates data node to multiple private AZs
            // },
            ebs: {
                volumeSize: 50
            },
            // useUnsignedBasicAuth: true,
            logging: {
                slowSearchLogEnabled: true,
                appLogEnabled: true,
                slowIndexLogEnabled: true
            },
            encryptionAtRest: {
                enabled: true
            },
            removalPolicy: RemovalPolicy.DESTROY
        });
        es.addAccessPolicies(
            new iam.PolicyStatement({
                actions: ['es:*'],
                effect: iam.Effect.ALLOW,
                principals: [new iam.AnyPrincipal()],
                resources: [es.domainArn, `${es.domainArn}/*`],
            })
        );

        this.domainArn = es.domainArn
        this.domainSecurityGroup = esSecurityGroup.securityGroupId;
        this.domainSubnet = targetSubnet.subnetId;
    }
}
