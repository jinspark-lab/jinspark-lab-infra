import * as cdk from 'aws-cdk-lib';
import { NestedStack, NestedStackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

export class ClusterStack extends NestedStack {
    cluster: eks.Cluster
    containerRepo: Repository

    constructor(scope: Construct, id: string, vpc: IVpc, props?: NestedStackProps) {
        super(scope, id, props);

        // TODO: Tag default VPC Manually or Create another VPC
        // Tags.of(vpc).add('kubernetes.io/role/elb', '1');

        this.containerRepo = new ecr.Repository(scope, 'JinsparkLabRepo', {
            repositoryName: 'jinspark-lab-ecr',
            removalPolicy: RemovalPolicy.DESTROY
        });

        // UserAdmin Role
        // FIXME: Change this to use Kube Admin
        const kubeAdminRole = iam.Role.fromRoleArn(scope, 'kubeAdminRole', 
                                            'arn:aws:iam::486403792456:role/UserAdmin');
        const nodeRole = new iam.Role(scope, 'kubeClusterRole', {
            roleName: 'jinsparklab-eks-cluster-role',
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
            description: 'EKS Cluster Role',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFirehoseFullAccess'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
                // iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy')
            ]
        });

        // example resource
        const cluster = new eks.Cluster(scope, 'jinsparklab-eks', {
            clusterName: 'JinsparkLabEks',
            version: eks.KubernetesVersion.V1_24,
            vpc,
            vpcSubnets: [{
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            }],
            albController: {
                version: eks.AlbControllerVersion.V2_4_1
            },
            // defaultCapacityInstance: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.XLARGE),
            defaultCapacity: 0,
            clusterLogging: [eks.ClusterLoggingTypes.API],
            mastersRole: kubeAdminRole
        });
        cluster.addNodegroupCapacity('jinsparklab-eks-node', {
            nodegroupName: 'jinsparklab-node',
            desiredSize: 2,
            minSize: 1,
            maxSize: 4,
            instanceTypes: [ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.XLARGE)],
            nodeRole,
            tags: {
                "Name": "jinsparklab-eks-node"
            }
        });
        this.cluster = cluster;

        const deploy = fs.readFileSync(path.join(__dirname, '/../k8s/deployment.yaml'), 'utf-8');
        const deploy_manifest = yaml.loadAll(deploy) as Record<string, any>[];
        const svc = fs.readFileSync(path.join(__dirname, '/../k8s/service.yaml'), 'utf-8');
        const svc_manifest = yaml.loadAll(svc) as Record<string, any>[];
        const ing = fs.readFileSync(path.join(__dirname, '/../k8s/ingress.yaml'), 'utf-8');
        const ing_manifest = yaml.loadAll(ing) as Record<string, any>[];

        const kubeDeploy = new eks.KubernetesManifest(scope, 'k8s-deploy', {
            cluster,
            manifest: deploy_manifest,
            prune: false
        });
        const kubeSvc = new eks.KubernetesManifest(scope, 'k8s-svc', {
            cluster,
            manifest: svc_manifest,
            prune: false
        });
        const kubeIng = new eks.KubernetesManifest(scope, 'k8s-ing', {
            cluster,
            manifest: ing_manifest,
            prune: false
        });
    }
}
