import { HmacSHA256, enc } from 'crypto-js';
import { config } from '../config';

export function verifySignature(payload: string, signature: string): boolean {
  const hash = HmacSHA256(payload, config.webhookSecret).toString(enc.Hex);
  return `sha256=${hash}` === signature;
}
