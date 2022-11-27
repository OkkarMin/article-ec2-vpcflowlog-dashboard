import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_ec2 as ec2,
  aws_s3 as s3,
  aws_lambda as lambda,
  aws_lambda_event_sources as lambdaEventSources,
  aws_opensearchservice as opensearch,
} from "aws-cdk-lib";

import * as path from "path";

const OPENSEARCH_USER = process.env.OPENSEARCH_USER as string;
const OPENSEARCH_PASSWORD = process.env.OPENSEARCH_PASSWORD as string;
if (!OPENSEARCH_USER || !OPENSEARCH_PASSWORD) {
  throw new Error("OPENSEARCH_USER and OPENSEARCH_PASSWORD must be set");
}

export class ArticleEc2VpcflowlogDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpcFlowLogs3Bucket = new s3.Bucket(this, "S3Bucket", {
      bucketName: "article-ec2-vpcflowlog-dashboard-s3bucket",
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const vpc = new ec2.Vpc(this, "ArticleEc2VpcflowlogDashboardVpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        { cidrMask: 24, name: "public", subnetType: ec2.SubnetType.PUBLIC },
      ],
      flowLogs: {
        defaultFlowLogDestination: {
          destination: ec2.FlowLogDestination.toS3(),
        },
      },
    });

    const securityGroup = new ec2.SecurityGroup(
      this,
      "ArticleEc2VpcflowlogDashboardSecurityGroup",
      {
        vpc,
        allowAllOutbound: true,
      }
    );
    securityGroup.connections.allowFromAnyIpv4(ec2.Port.allTraffic());

    const instance = new ec2.Instance(
      this,
      "ArticleEc2VpcflowlogDashboardInstance",
      {
        vpc,
        securityGroup,
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T3,
          ec2.InstanceSize.MICRO
        ),
        machineImage: ec2.MachineImage.latestAmazonLinux(),
        userData: ec2.UserData.custom(
          `#!/bin/bash
          yum update -y
          yum install -y httpd
          service httpd start
          echo “Hello World from $(hostname -f)” > /var/www/html/index.html
          `
        ),
      }
    );

    const opensearchDomain = new opensearch.Domain(this, "Domain", {
      version: opensearch.EngineVersion.OPENSEARCH_1_3,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceHttps: true,
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true,
      },
      fineGrainedAccessControl: {
        masterUserName: OPENSEARCH_USER,
        masterUserPassword:
          cdk.SecretValue.unsafePlainText(OPENSEARCH_PASSWORD),
      },
    });

    const gzipToCSVFunction = new lambda.Function(
      this,
      "ArticleEc2VpcflowlogDashboardGzipToCSVFunction",
      {
        code: lambda.Code.fromAsset(path.join(__dirname, "lambda"), {
          bundling: {
            image: lambda.Runtime.PYTHON_3_9.bundlingImage,
            user: "root",
            command: [
              "bash",
              "-c",
              "pip install -r requirements.txt -t . && cp -r . /asset-output",
            ],
          },
        }),
        runtime: lambda.Runtime.PYTHON_3_9,
        handler: "gzip_to_csv.handler",
        environment: {
          OPENSEARCH_HOST: opensearchDomain.domainEndpoint,
          OPENSEARCH_INDEX: "vpcflowlog",
          OPENSEARCH_USER,
          OPENSEARCH_PASSWORD,
        },
      }
    );

    const s3PutEventSource = new lambdaEventSources.S3EventSource(
      vpcFlowLogs3Bucket,
      {
        events: [s3.EventType.OBJECT_CREATED],
      }
    );
    vpcFlowLogs3Bucket.grantRead(gzipToCSVFunction);
    gzipToCSVFunction.addEventSource(s3PutEventSource);
    opensearchDomain.grantWrite(gzipToCSVFunction);
  }
}
