import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env } from './env';

// ---------------------------------------------------------------------------
// Parse the DATABASE_URL into individual connection parameters.
// Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
// ---------------------------------------------------------------------------
function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: u.username,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    database: u.pathname.replace(/^\//, ''),
  };
}

const dbConfig = parseDbUrl(env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Driver adapter (Rust-free Prisma 7 approach)
// @prisma/adapter-mariadb → wraps the `mariadb` npm driver (MySQL 5.7 compat)
// ---------------------------------------------------------------------------
const adapter = new PrismaMariaDb({
  ...dbConfig,
  connectionLimit: 10,
  connectTimeout: 10_000,
  // MySQL 5.7 compatibility
  allowPublicKeyRetrieval: true,
});

// ---------------------------------------------------------------------------
// Prisma client singleton
// Uses globalThis to avoid creating extra instances during hot-reloads in dev.
// ---------------------------------------------------------------------------
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'stdout', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
