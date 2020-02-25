#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkSampleTsStack } from '../lib/cdk-sample-ts-stack';

const app = new cdk.App();
new CdkSampleTsStack(app, 'CdkSampleTsStack');
