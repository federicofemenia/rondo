import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().url().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    // Read by the frontend build, not the backend; kept here only so
    // .env.example documents every variable a deployment needs to set.
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    FRONTEND_URL: z.string().url().optional(),
    // Primary bootstrap source for the initial Señor Pato admin: stable and
    // unique regardless of auth strategy. See users.service.ts.
    BOOTSTRAP_ADMIN_CLERK_USER_ID: z.string().optional(),
    // Dev-only convenience fallback; never the source of truth in beta/production.
    BOOTSTRAP_ADMIN_USERNAME: z.string().optional(),
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
    if (!data.CLERK_SECRET_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'CLERK_SECRET_KEY es obligatorio en producción.', path: ['CLERK_SECRET_KEY'] });
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
