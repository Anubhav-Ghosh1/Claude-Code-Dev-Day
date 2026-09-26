import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { API_KEY_BCRYPT_ROUNDS, API_KEY_LIVE_PREFIX, API_KEY_PREFIX_LENGTH } from '@/lib/utils/constants';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toBase62(buffer: Buffer): string {
  let result = '';
  for (const byte of buffer) {
    result += BASE62[byte % 62];
  }
  return result;
}

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  const body = toBase62(randomBytes);
  return `${API_KEY_LIVE_PREFIX}${body}`;
}

export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, API_KEY_BCRYPT_ROUNDS);
}

export async function verifyApiKey(apiKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, hash);
}

export function extractPrefix(apiKey: string): string {
  return apiKey.substring(0, API_KEY_PREFIX_LENGTH);
}
