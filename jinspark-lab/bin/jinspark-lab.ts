#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JinsparkLabStack } from '../lib/jinspark-lab-stack';

const app = new cdk.App();
new JinsparkLabStack(app, 'JinsparkLabStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }

});