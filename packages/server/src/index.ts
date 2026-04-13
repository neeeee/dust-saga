import express from 'express';
import { createServer } from 'http';
import { NetworkServer } from './core/network/NetworkServer';
import { DatabaseManager } from './core/database/DatabaseManager';
import { EntityManager, MovementSystem, CombatSystem } from './core/ecs/EntityManager';
import { WorldManager } from './core/world/WorldManager';

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

app.get('/api/players', async (req, res) => {
  try {
    const db = DatabaseManager.getInstance();
    if (!db.isPostgresConnected()) {
      return res.json([]);
    }
    const result = await db.postgres!.query('SELECT id, username, level, created_at FROM players LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

async function startServer() {
  try {
    console.log('Starting Dust Saga Server...');

    const db = DatabaseManager.getInstance();
    await db.connect();
    
    if (db.isPostgresConnected()) {
      await db.initializeSchema();
    } else {
      console.log('⚠️  Running in development mode without database');
    }

    const entityManager = new EntityManager();
    const worldManager = new WorldManager(entityManager);
    
    const movementSystem = new MovementSystem(entityManager);
    const combatSystem = new CombatSystem(entityManager);

    const networkServer = new NetworkServer(httpServer);

    worldManager.start();

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🗄️  Database connected`);
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      worldManager.stop();
      await db.disconnect();
      httpServer.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();