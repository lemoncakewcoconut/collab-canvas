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

  // In production, serve the built client assets
  const clientDist = path.resolve(process.cwd(), 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return { app, server, crdtServer };
}
