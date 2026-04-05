import { z } from 'zod';

// ---------------------------------------------------------------------------
// Environment schema — fails fast at startup with a clear error if any
// required variable is missing or has the wrong type.
// ---------------------------------------------------------------------------
const envSchema = z.object({
  // App
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // JWT (populated when Auth module is added)
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n');
  const formatted = parsed.error.format();
  Object.entries(formatted).forEach(([key, val]) => {
    if (key !== '_errors' && typeof val === 'object' && '_errors' in val) {
      console.error(`  ${key}: ${(val as { _errors: string[] })._errors.join(', ')}`);
    }
  });
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
