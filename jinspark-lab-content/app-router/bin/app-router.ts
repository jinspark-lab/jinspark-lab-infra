#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppRouterStack } from '../lib/app-router-stack';

const app = new cdk.App();
new AppRouterStack(app, 'AppRouterStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});