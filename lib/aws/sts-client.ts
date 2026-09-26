import { STSClient } from '@aws-sdk/client-sts';

let stsClient: STSClient | null = null;

export function getSTSClient(): STSClient {
  if (!stsClient) {
    stsClient = new STSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return stsClient;
}
