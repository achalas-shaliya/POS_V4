import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

const normalizeOrigin = (value: string) => value.trim().toLowerCase().replace(/\/$/, '');

export const initRepairRealtime = (server: HttpServer, allowedOrigins: string[]) => {
  if (io) return;

  const allowed = new Set(allowedOrigins.map((origin) => normalizeOrigin(origin)));

  io = new SocketIOServer(server, {
    path: '/api/v1/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowed.has(normalizeOrigin(origin))) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.emit('realtime:connected', { ok: true });
  });
};

export const notifyRepairJobCreated = (payload: {
  repairId: string;
  jobNo: string;
  outletId: string;
}) => {
  if (!io) return;

  io.emit('repair:job-created', payload);
};

export const notifyRepairJobChanged = (payload: {
  repairId: string;
  jobNo: string;
  outletId: string;
  action:
    | 'UPDATED'
    | 'STATUS_CHANGED'
    | 'PART_ADDED'
    | 'PART_REMOVED'
    | 'PAYMENT_ADDED'
    | 'SETTLED';
}) => {
  if (!io) return;

  io.emit('repair:job-changed', payload);
};

export const shutdownRepairRealtime = async () => {
  if (!io) return;

  await new Promise<void>((resolve) => {
    io!.close(() => resolve());
  });

  io = null;
};
