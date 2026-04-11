// dotenv MUST be first — populates process.env before any module reads it
import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './shared/middleware/errorHandler';
import authRouter from './modules/auth/auth.routes';
import inventoryRouter from './modules/inventory/inventory.routes';
import salesRouter from './modules/sales/sales.routes';
import repairRouter from './modules/repair/repair.routes';
import paymentRouter from './modules/payment/payment.routes';
import cashRouter from './modules/cash/cash.routes';
import transferRouter from './modules/transfer/transfer.routes';
import returnsRouter from './modules/returns/returns.routes';
import reportsRouter from './modules/reports/reports.routes';
import cashDrawerRouter from './modules/cash-drawer/cash-drawer.routes';
import { registerSwagger } from './docs/swagger';

const app = express();

const normalizeOrigin = (value: string) => value.trim().toLowerCase().replace(/\/$/, '');

const allowedOrigins = new Set(
  env.CORS_ORIGIN.split(',').map((o) => normalizeOrigin(o)).filter(Boolean),
);

// ---------------------------------------------------------------------------
// Security & transport middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin header) and explicitly whitelisted frontends.
      if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ---------------------------------------------------------------------------
// Health check — also tests database connectivity
// ---------------------------------------------------------------------------
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: 'unreachable',
    });
  }
});

// ---------------------------------------------------------------------------
// API routes — modules mounted here as they are built
// ---------------------------------------------------------------------------
app.use('/api/v1/auth',      authRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/sales',     salesRouter);
app.use('/api/v1/repairs',   repairRouter);
app.use('/api/v1/payments',  paymentRouter);
app.use('/api/v1/cash',      cashRouter);
app.use('/api/v1/transfers',  transferRouter);
app.use('/api/v1/returns',    returnsRouter);
app.use('/api/v1/reports',    reportsRouter);
app.use('/api/v1/cash-drawer', cashDrawerRouter);

app.get('/api/v1', (_req, res) => {
  res.json({ message: 'POS API v1' });
});

registerSwagger(app);

// ---------------------------------------------------------------------------
// 404 catch-all
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ---------------------------------------------------------------------------
// Global error handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const server = app.listen(env.PORT, () => {
  console.log(`\n🚀  Server started`);
  console.log(`   ├─ Port : ${env.PORT}`);
  console.log(`   ├─ Env  : ${env.NODE_ENV}`);
  console.log(`   ├─ CORS : ${Array.from(allowedOrigins).join(', ')}`);
  console.log(`   └─ Health: http://localhost:${env.PORT}/health\n`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database disconnected. Bye!');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
