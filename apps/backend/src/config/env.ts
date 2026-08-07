import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().url().optional(),
    FRONTEND_URL: z.string().url().optional(),
    // Native session auth (see infrastructure/auth/*). No pepper var here by
    // design -- see sessionTokens.ts's doc comment for why one wouldn't add
    // meaningful defense-in-depth for a random, already-hashed session token.
    SESSION_COOKIE_NAME: z.string().default('rondo_session'),
    SESSION_TTL_DAYS: z.coerce.number().default(30),
    // Cloudflare R2 (S3-compatible) avatar storage -- see infrastructure/storage/r2AvatarStorage.ts.
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
    // Web Push (VAPID). Public key is also read by the frontend build
    // (VITE_VAPID_PUBLIC_KEY, a copy of the same value) -- see docs/WEB_PUSH.md
    // for how to generate this pair. Never rotate these without also
    // clearing every stored PushSubscription: existing browser subscriptions
    // are bound to the public key they were created with and will start
    // failing (410 Gone-equivalent) against a different key pair.
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    // mailto: or https: contact URI, required by the Web Push protocol itself
    // (not just Rondo) so a push service can reach the sender about abuse.
    VAPID_SUBJECT: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') {
      return;
    }
    if (!data.DATABASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'DATABASE_URL es obligatorio en producción.', path: ['DATABASE_URL'] });
    }
    if (!data.FRONTEND_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FRONTEND_URL es obligatorio en producción.', path: ['FRONTEND_URL'] });
    }
    if (!data.VAPID_PUBLIC_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'VAPID_PUBLIC_KEY es obligatorio en producción.', path: ['VAPID_PUBLIC_KEY'] });
    }
    if (!data.VAPID_PRIVATE_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'VAPID_PRIVATE_KEY es obligatorio en producción.', path: ['VAPID_PRIVATE_KEY'] });
    }
    if (!data.VAPID_SUBJECT) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'VAPID_SUBJECT es obligatorio en producción.', path: ['VAPID_SUBJECT'] });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}
