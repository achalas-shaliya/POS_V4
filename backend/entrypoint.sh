#!/bin/sh
set -e

echo "▶  Running database migrations…"
npx prisma migrate deploy

echo "▶  Checking if seed is needed…"
USER_COUNT=$(node -e "
const { PrismaClient } = require('./dist/generated/prisma');
const p = new PrismaClient();
p.user.count().then(n => { process.stdout.write(String(n)); p.\$disconnect(); }).catch(() => { process.stdout.write('0'); p.\$disconnect(); });
")

if [ "$USER_COUNT" = "0" ]; then
  echo "▶  Seeding database…"
  npx ts-node --transpile-only prisma/seed.ts
  echo "✓  Seed complete."
else
  echo "✓  Database already seeded (${USER_COUNT} users found), skipping."
fi

echo "▶  Starting POS backend…"
exec node dist/server.js
