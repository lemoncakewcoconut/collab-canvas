import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express, { Express } from 'express';
import cors from 'cors';
import { initDirectories, PORT } from './config.js';
import { CRDTServer } from './crdt.js';
import { createRoomsRouter } from './routes/rooms.js';
import { createAssetsRouter } from './routes/assets.js';

export function createApplication(): { app: Express; server: http.Server; crdtServer: CRDTServer } {
  initDirectories();

  const app = express();
  const server = http.createServer(app);
  const crdtServer = new CRDTServer(server);

  app.use(cors());
  app.use(express.json());

  // Health check endpoint (for docker healthcheck)
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
  });

  // REST API routes
  app.use('/api/rooms', createRoomsRouter(crdtServer));
  app.use('/api/assets', createAssetsRouter());

  // In production, locate and serve built client assets
  const candidatePaths = [
    path.resolve(process.cwd(), 'client', 'dist'),
    path.resolve(process.cwd(), '..', 'client', 'dist'),
    path.resolve('/app', 'client', 'dist'),
  ];

  let resolvedClientDist: string | null = null;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      resolvedClientDist = candidate;
      break;
    }
  }

  if (resolvedClientDist) {
    app.use(express.static(resolvedClientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(resolvedClientDist!, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>CollabCanvas Backend Online</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
            .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 480px; text-align: center; }
            h2 { color: #2563eb; margin-top: 0; }
            .info { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; text-align: left; font-size: 13px; margin: 16px 0; }
            code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>CollabCanvas Server is Online</h2>
            <p style="color: #64748b; font-size: 14px;">The REST API and real-time CRDT WebSocket engine are active on port 8080.</p>
            <div class="info">
              <p><b>If you are running in Dev Mode:</b><br/>Open the Vite frontend on <b>port 3000</b>:<br/><a href="http://${req.hostname}:3000" style="color: #2563eb; font-weight: bold;">http://${req.hostname}:3000</a></p>
              <hr style="border: none; border-top: 1px solid #dbeafe; margin: 10px 0;"/>
              <p><b>To serve frontend directly on port 8080:</b><br/>Run <code>npm run build</code> in the project root, then restart the server.</p>
            </div>
          </div>
        </body>
        </html>
      `);
    });
  }

  return { app, server, crdtServer };
}
