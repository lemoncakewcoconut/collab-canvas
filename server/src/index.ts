import { createApplication } from './server.js';
import { PORT } from './config.js';

const { server } = createApplication();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[CollabCanvas] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[CollabCanvas] WebSocket endpoint active at ws://0.0.0.0:${PORT}/ws/:roomId`);
});
