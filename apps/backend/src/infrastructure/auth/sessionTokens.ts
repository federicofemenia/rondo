import { randomBytes, createHash } from 'node:crypto';

const TOKEN_BYTES = 32;

/** 256 bits of randomness, sent to the client as the raw cookie value -- never stored anywhere. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * sha256, deliberately not Argon2: the token is already a uniformly random
 * 256-bit value, not a guessable secret like a password -- brute-forcing
 * this hash is exactly as hard as guessing the token itself either way, so
 * a slow/salted hash would only add latency with zero security benefit. A
 * fast deterministic hash is what makes an O(1) unique-index lookup by
 * tokenHash possible.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
