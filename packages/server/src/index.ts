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

    const networkServer = new NetworkServer(httpServer, {
      redis: db.redis,
      isRedisConnected: () => db.isRedisConnected(),
    });

    // B2: attach the Socket.IO Redis adapter when Redis is available so zone-room
    // broadcasts propagate across processes (enables future multi-shard). In
    // single-process / no-Redis mode the default in-memory adapter is used.
    let adapterPub: import('redis').RedisClientType | null = null;
    let adapterSub: import('redis').RedisClientType | null = null;
    if (db.isRedisConnected()) {
      try {
        adapterPub = db.createRedisClient();
        adapterSub = db.createRedisClient();
        await adapterPub.connect();
        await adapterSub.connect();
        networkServer.useRedisAdapter(adapterPub, adapterSub);
      } catch (err) {
        console.warn('Redis adapter disabled (continuing single-process):', err);
        adapterPub = null;
        adapterSub = null;
      }
    } else {
      console.log('Redis not connected — running with in-memory Socket.IO adapter (single-process)');
    }

    networkServer.getSpawnManager().initialize();
    networkServer.populateEnemySpatialHash();
    console.log('World spawned');

    const tickRate = networkServer.getTickRate();
    const tickInterval = 1000 / tickRate;
    let lastTick = process.hrtime.bigint();

    function tick() {
      const now = process.hrtime.bigint();
      const elapsedMs = Number(now - lastTick) / 1_000_000;
      lastTick = now;

      networkServer.gameLoop(Math.min(elapsedMs, 200));

      const nextDelay = Math.max(0, tickInterval - Number(process.hrtime.bigint() - now) / 1_000_000);
      setTimeout(tick, nextDelay);
    }
    setTimeout(tick, tickInterval);

    setInterval(() => {
      networkServer.saveAllCharacters().catch(err => console.error('Autosave error:', err));
    }, 60000);

    // B3: refresh presence TTLs so live players' entries don't expire while the
    // shard is healthy (entries auto-expire within 60s if the shard crashes).
    const presenceHeartbeat = setInterval(() => {
      networkServer.presence.heartbeat().catch(err => console.error('Presence heartbeat error:', err));
    }, 20000);
    presenceHeartbeat.unref();

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`WebSocket server ready`);
    });

    process.on('SIGINT', async () => {
      console.log('\nShutting down server...');
      await networkServer.saveAllCharacters();
      if (adapterPub) await adapterPub.quit().catch(() => {});
      if (adapterSub) await adapterSub.quit().catch(() => {});
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
