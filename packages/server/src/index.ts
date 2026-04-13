import express from 'express';
import { createServer } from 'http';
import { NetworkServer } from './core/network/NetworkServer';
import { DatabaseManager } from './core/database/DatabaseManager';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  const db = DatabaseManager.getInstance();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db.isPostgresConnected() ? 'connected' : 'disconnected',
    redis: db.isRedisConnected() ? 'connected' : 'disconnected'
  });
});

app.get('/api/classes', (req, res) => {
  const { CLASS_DEFINITIONS } = require('@dust-saga/shared');
  res.json(CLASS_DEFINITIONS);
});

async function startServer() {
  try {
    console.log('Starting Dust Saga Server...');

    const db = DatabaseManager.getInstance();
    await db.connect();

    if (db.isPostgresConnected()) {
      await db.initializeSchema();
    } else {
      console.log('Running in development mode without database');
    }

    const networkServer = new NetworkServer(httpServer);

    networkServer.getSpawnManager().initialize();
    console.log('World spawned');

    const tickRate = networkServer.getTickRate();
    setInterval(() => {
      networkServer.gameLoop();
    }, 1000 / tickRate);

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`WebSocket server ready`);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await db.disconnect();
      httpServer.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
