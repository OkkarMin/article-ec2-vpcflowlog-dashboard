import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ArticleEc2VpcflowlogDashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'ArticleEc2VpcflowlogDashboardQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
