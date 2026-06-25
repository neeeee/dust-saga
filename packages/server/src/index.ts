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

function adminGuard(req: express.Request, res: express.Response): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return true;
  const provided = req.headers['authorization'];
  const token = typeof provided === 'string' && provided.startsWith('Bearer ')
    ? provided.slice(7)
    : (req.headers['x-admin-token'] as string);
  if (token !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

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

    await networkServer.questSys.initialize(db);

    // ── Quest admin API (creation tool) ────────────────────────────────────
    // Create / list / delete quest definitions stored in the DB. Secured by an
    // optional ADMIN_TOKEN env var (open in dev when unset). Quest definitions
    // created here are persisted to the `quests` table and the in-memory cache
    // is updated live, so they become available immediately without a restart.
    app.get('/api/admin/quests', (req, res) => {
      if (!adminGuard(req, res)) return;
      res.json(networkServer.questSys.getAllQuestDefinitions());
    });

    app.post('/api/admin/quests', async (req, res) => {
      if (!adminGuard(req, res)) return;
      const result = await networkServer.questSys.createQuest(req.body);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(201).json({ success: true, id: req.body.id });
    });

    app.delete('/api/admin/quests/:id', async (req, res) => {
      if (!adminGuard(req, res)) return;
      const result = await networkServer.questSys.deleteQuest(req.params.id);
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }
      res.json({ success: true });
    });

    app.post('/api/admin/quests/reload', async (req, res) => {
      if (!adminGuard(req, res)) return;
      await networkServer.questSys.reload();
      res.json({ success: true, count: networkServer.questSys.getAllQuestDefinitions().length });
    });

    // B2: attach the Socket.IO Redis adapter when Redis is available so zone-room
    // broadcasts propagate across processes (enables future multi-shard). In
    // single-process / no-Redis mode the default in-memory adapter is used.
    let adapterPub: import('redis').RedisClientType | null = null;
    let adapterSub: import('redis').RedisClientType | null = null;
    // B5: dedicated subscribe client for the packet relay (sendToPlayer routing).
    let relaySub: import('redis').RedisClientType | null = null;
    // B4: dedicated subscribe client for cross-shard party state sync.
    let partySub: import('redis').RedisClientType | null = null;
    if (db.isRedisConnected()) {
      try {
        adapterPub = db.createRedisClient();
        adapterSub = db.createRedisClient();
        await adapterPub.connect();
        await adapterSub.connect();
        networkServer.useRedisAdapter(adapterPub, adapterSub);

        relaySub = db.createRedisClient();
        await relaySub.connect();
        await networkServer.usePacketRelay(relaySub);

        partySub = db.createRedisClient();
        await partySub.connect();
        await networkServer.usePartySync(partySub);
      } catch (err) {
        console.warn('Redis adapter/relay/party-sync disabled (continuing single-process):', err);
        if (adapterPub) await adapterPub.quit().catch(() => {});
        if (adapterSub) await adapterSub.quit().catch(() => {});
        if (relaySub) await relaySub.quit().catch(() => {});
        if (partySub) await partySub.quit().catch(() => {});
        adapterPub = null;
        adapterSub = null;
        relaySub = null;
        partySub = null;
      }
    } else {
      console.log('Redis not connected — running with in-memory Socket.IO adapter (single-process)');
    }

    networkServer.getSpawnManager().initialize();
    networkServer.populateEnemySpatialHash();
    console.log('World spawned');

    // B6: claim this shard's zones in Redis so cross-shard handoff can route
    // zone transitions to the owning shard. In single-process mode (no
    // ZONE_OWNERSHIP env) all zones are claimed; the handoff branch in
    // handleEnterZone is never taken because getOwner() returns the local shard.
    const { ZONE_DATABASE } = require('@dust-saga/shared');
    const allZoneIds = Object.keys(ZONE_DATABASE);
    await networkServer.zoneOwnership.claimZones(allZoneIds).catch(() => {});

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
      await networkServer.zoneOwnership.releaseZones().catch(() => {});
      await networkServer.stopPacketRelay().catch(() => {});
      await networkServer.stopPartySync().catch(() => {});
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
