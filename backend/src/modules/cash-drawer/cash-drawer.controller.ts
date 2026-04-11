import { Request, Response } from 'express';
import { SerialPort } from 'serialport';
import { env } from '../../config/env';

// ESC/POS drawer-kick command: ESC p <pin> <t1> <t2>
// pin=0 → drawer port 1 (most common)
const DRAWER_OPEN_CMD = Buffer.from([0x1b, 0x70, 0x00, 0x32, 0xff]);

export async function openCashDrawer(req: Request, res: Response): Promise<void> {
  const portPath = env.CASH_DRAWER_PORT;

  if (!portPath) {
    res.status(503).json({ success: false, message: 'Cash drawer port not configured (CASH_DRAWER_PORT)' });
    return;
  }

  let port: SerialPort | null = null;

  try {
    port = new SerialPort({ path: portPath, baudRate: 9600, autoOpen: false });

    await new Promise<void>((resolve, reject) => {
      port!.open((err) => (err ? reject(err) : resolve()));
    });

    await new Promise<void>((resolve, reject) => {
      port!.write(DRAWER_OPEN_CMD, (err) => (err ? reject(err) : resolve()));
    });

    await new Promise<void>((resolve) => {
      port!.drain(() => resolve());
    });

    res.json({ success: true, message: 'Cash drawer opened' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message: `Failed to open cash drawer: ${message}` });
  } finally {
    if (port?.isOpen) {
      port.close();
    }
  }
}
