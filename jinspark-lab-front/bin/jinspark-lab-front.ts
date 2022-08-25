#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JinsparkLabFrontStack } from '../lib/jinspark-lab-front-stack';

const app = new cdk.App();
new JinsparkLabFrontStack(app, 'JinsparkLabFrontStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});