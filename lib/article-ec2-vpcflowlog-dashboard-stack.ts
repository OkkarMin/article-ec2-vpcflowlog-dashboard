import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_ec2 as ec2, aws_s3 as s3 } from "aws-cdk-lib";

export class ArticleEc2VpcflowlogDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const s3Bucket = new s3.Bucket(this, "S3Bucket", {
      bucketName: "article-ec2-vpcflowlog-dashboard-s3bucket",
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
  }
}
