# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Build tools required by @serialport/bindings-cpp native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Generate Prisma client → src/generated/prisma
RUN npx prisma generate

# Compile TypeScript → dist/  (also compiles dist/generated/prisma)
RUN npm run build

# ─── Stage 2: production image ───────────────────────────────────────────────
FROM node:20-slim AS runner

# openssl is required by Prisma at runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Copy all node_modules from builder (includes native serialport binaries
# built for linux-x64 and the prisma CLI needed for migrate deploy)
COPY --from=builder /app/node_modules  ./node_modules

# Compiled application (includes dist/generated/prisma)
COPY --from=builder /app/dist          ./dist

# Prisma migrations + config (needed for `prisma migrate deploy` at startup)
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json  ./package.json

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 5000
ENTRYPOINT ["./entrypoint.sh"]
