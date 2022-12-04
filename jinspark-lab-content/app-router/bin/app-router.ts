#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppRouterStack } from '../lib/app-router-stack';

/**
 * App Router is API GW, which plays role as a MSA Router
 */
const app = new cdk.App();
new AppRouterStack(app, 'JinsparkLabRouter', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});