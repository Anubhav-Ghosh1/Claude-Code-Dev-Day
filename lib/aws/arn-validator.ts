const ARN_REGEX = /^arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:[a-zA-Z0-9-]*:\d{0,12}:[\w+\/:.@*-]+$/;

export interface ParsedArn {
  partition: string;
  service: string;
  region: string;
  accountId: string;
  resource: string;
}

export function parseArn(arn: string): ParsedArn | null {
  const parts = arn.split(':');
  if (parts.length < 6) return null;

  const [, partition, service, region, accountId, ...rest] = parts;
  if (!partition || !service) return null;

  return {
    partition,
    service,
    region: region || '',
    accountId: accountId || '',
    resource: rest.join(':'),
  };
}

export function isValidArn(arn: string): boolean {
  return ARN_REGEX.test(arn);
}

export function arnMatchesPattern(arn: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(arn);
}
