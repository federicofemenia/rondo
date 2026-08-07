import { hash, verify } from '@node-rs/argon2';
import type { PasswordHasher } from './passwordHasher.js';

/**
 * @node-rs/argon2's defaults already use the argon2id variant with
 * OWASP-aligned cost parameters -- deliberately not hand-tuned here, since
 * a beta-scale app has no reason to deviate from a well-reviewed default.
 */
export const argon2PasswordHasher: PasswordHasher = {
  hash: (plain: string) => hash(plain),
  verify: (passwordHash: string, plain: string) => verify(passwordHash, plain).catch(() => false),
};
