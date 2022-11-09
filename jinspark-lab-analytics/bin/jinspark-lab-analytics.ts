#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JinsparkLabAnalyticsStack } from '../lib/jinspark-lab-analytics-stack';

const app = new cdk.App();
new JinsparkLabAnalyticsStack(app, 'JinsparkLabAnalyticsStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});