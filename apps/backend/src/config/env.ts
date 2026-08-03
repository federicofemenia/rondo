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
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}
