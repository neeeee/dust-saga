# MMORPG Project Organization Guide

## 🎯 Architecture Overview

### Client-Server Model
```
┌─────────────────┐         ┌─────────────────┐
│     Client      │◄────────►│    Server       │
│  (Babylon.js)   │  WebSocket│  (Node.js)      │
│                 │  / HTTP  │                 │
└─────────────────┘         └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    Database     │
                         │ (PostgreSQL +   │
                         │  Redis Cache)   │
                         └─────────────────┘
```

## 📦 Package Structure

### 1. Client Package (`packages/client/`)
**Purpose**: Babylon.js game client

**Key Modules**:
- `core/ecs/` - Entity Component System for client-side game objects
- `core/network/` - WebSocket client, packet handling, interpolation
- `core/ui/` - GUI system, HUD, menus
- `entities/` - Player, NPC, items, effects
- `systems/` - Movement, combat, rendering, input
- `assets/` - 3D models, textures, sounds, animations
- `world/` - Chunk loading, zone management

**Technologies**:
- Babylon.js for 3D rendering
- Socket.io-client for networking
- React/Vue for UI overlay
- TypeScript for type safety

### 2. Server Package (`packages/server/`)
**Purpose**: Game logic server and API

**Key Modules**:
- `core/network/` - WebSocket server, packet handling
- `core/auth/` - JWT authentication, session management
- `core/database/` - PostgreSQL, Redis connections
- `entities/` - Server-side entities (authority)
- `systems/` - Movement, combat, physics, AI
- `world/` - Zone management, persistence, spawning
- `api/` - REST API for auth, leaderboards, shop

**Technologies**:
- Node.js + Express for HTTP
- Socket.io for real-time communication
- PostgreSQL for persistent data
- Redis for caching and sessions
- Docker for containerization

### 3. Shared Package (`packages/shared/`)
**Purpose**: Shared code between client and server

**Key Modules**:
- `types/` - TypeScript interfaces (must match!)
- `protocols/` - Network packet definitions
- `constants/` - Game balance, configuration
- `utils/` - Shared utilities (math, validation)

## 🗄️ Database Design

### PostgreSQL (Persistent Data)
```sql
-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  level INTEGER DEFAULT 1,
  experience BIGINT DEFAULT 0
);

-- Characters
CREATE TABLE characters (
  id UUID PRIMARY KEY,
  player_id UUID REFERENCES players(id),
  name VARCHAR(50) NOT NULL,
  class VARCHAR(20) NOT NULL,
  level INTEGER DEFAULT 1,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  position_z FLOAT DEFAULT 0,
  rotation FLOAT DEFAULT 0,
  zone_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, name)
);

-- Items
CREATE TABLE items (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  stats JSONB NOT NULL,
  icon_url VARCHAR(255)
);

-- Inventories
CREATE TABLE inventories (
  id UUID PRIMARY KEY,
  character_id UUID REFERENCES characters(id),
  item_id UUID REFERENCES items(id),
  quantity INTEGER DEFAULT 1,
  slot INTEGER,
  UNIQUE(character_id, slot)
);

-- Quests
CREATE TABLE quests (
  id UUID PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  requirements JSONB NOT NULL,
  rewards JSONB NOT NULL
);

-- Character Quests
CREATE TABLE character_quests (
  id UUID PRIMARY KEY,
  character_id UUID REFERENCES characters(id),
  quest_id UUID REFERENCES quests(id),
  status VARCHAR(20) DEFAULT 'in_progress',
  progress JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  UNIQUE(character_id, quest_id)
);
```

### Redis (Caching & Sessions)
```
sessions:{userId} -> player session data
player_positions:{zoneId} -> Hash of player positions
chat_history:{channelId} -> Recent chat messages
leaderboard:{type} -> Ranked leaderboards
cooldowns:{playerId} -> Skill cooldowns
```

## 🌐 Network Protocol

### Packet Structure
```typescript
// shared/protocols/packets.ts
export enum PacketType {
  // Connection
  CONNECT = 0,
  DISCONNECT = 1,
  HEARTBEAT = 2,

  // Authentication
  LOGIN = 10,
  REGISTER = 11,
  AUTH_SUCCESS = 12,
  AUTH_FAILURE = 13,

  // Movement
  PLAYER_MOVE = 20,
  PLAYER_POSITION_UPDATE = 21,
  PLAYER_ROTATION_UPDATE = 22,

  // Combat
  ATTACK = 30,
  DAMAGE = 31,
  HEAL = 32,
  DEATH = 33,

  // Chat
  CHAT_MESSAGE = 40,

  // World
  ENTER_ZONE = 50,
  LEAVE_ZONE = 51,
  ENTITY_SPAWN = 52,
  ENTITY_DESPAWN = 53,
}

export interface Packet {
  type: PacketType;
  timestamp: number;
  data: any;
}
```

### Client-Server Communication
```typescript
// client/src/core/network/NetworkClient.ts
export class NetworkClient {
  private socket: Socket;
  private packetHandlers: Map<PacketType, Function>;

  connect(serverUrl: string): void {
    this.socket = io(serverUrl);
    this.setupEventHandlers();
  }

  sendPacket(packet: Packet): void {
    this.socket.emit('packet', packet);
  }

  onPacket(type: PacketType, handler: Function): void {
    this.packetHandlers.set(type, handler);
  }
}
```

## 🎮 Game Systems Architecture

### Entity Component System (ECS)
```typescript
// shared/types/ecs.ts
export interface Entity {
  id: string;
  components: Map<string, Component>;
}

export interface Component {
  type: string;
  data: any;
}

// Example components
export interface PositionComponent extends Component {
  type: 'position';
  data: { x: number; y: number; z: number };
}

export interface HealthComponent extends Component {
  type: 'health';
  data: { current: number; max: number };
}
```

### System Example
```typescript
// server/src/systems/MovementSystem.ts
export class MovementSystem {
  update(entities: Entity[], deltaTime: number): void {
    entities.forEach(entity => {
      const movement = entity.components.get('movement');
      const position = entity.components.get('position');

      if (movement && position) {
        // Update position based on velocity
        position.data.x += movement.data.velocityX * deltaTime;
        position.data.z += movement.data.velocityZ * deltaTime;
      }
    });
  }
}
```

## 🔒 Security Considerations

### Client-Side Validation
```typescript
// client/src/core/validation/Validator.ts
export class GameValidator {
  static validateMovement(input: MovementInput): boolean {
    // Basic client-side validation
    return (
      input.speed >= 0 &&
      input.speed <= MAX_SPEED &&
      !isNaN(input.direction) &&
      Math.abs(input.direction) <= Math.PI * 2
    );
  }
}
```

### Server-Side Validation
```typescript
// server/src/core/validation/ServerValidator.ts
export class ServerValidator {
  static validatePlayerAction(player: Player, action: PlayerAction): boolean {
    // Validate player can perform action
    if (player.cooldowns[action.type] > Date.now()) {
      return false; // Action on cooldown
    }

    if (player.position.distanceTo(action.target) > action.range) {
      return false; // Target out of range
    }

    return true;
  }
}
```

## 📊 Performance Optimization

### Client-Side
- **Object Pooling**: Reuse objects instead of creating/destroying
- **Level of Detail (LOD)**: Reduce detail for distant objects
- **Frustum Culling**: Only render visible objects
- **Asset Streaming**: Load assets on-demand
- **Octree/Spatial Partitioning**: Efficient spatial queries

### Server-Side
- **Zone Instancing**: Multiple instances of popular zones
- **Interest Management**: Only send relevant data to each player
- **Rate Limiting**: Prevent spam and DDoS
- **Database Connection Pooling**: Reuse database connections
- **Caching**: Cache frequently accessed data in Redis

## 🚀 Deployment Strategy

### Development
```bash
# Local development with hot reload
npm run dev:client
npm run dev:server
```

### Production
```yaml
# docker-compose.yml
version: '3.8'
services:
  client:
    build: ./packages/client
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production

  server:
    build: ./packages/server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379

  postgres:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis_data:/data
```

### Kubernetes (Scale)
```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mmorpg-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mmorpg-server
  template:
    metadata:
      labels:
        app: mmorpg-server
    spec:
      containers:
      - name: server
        image: mmorpg-server:latest
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

## 📈 Development Roadmap

### Phase 1: Foundation (Current)
- ✅ Basic 3D rendering
- ✅ Player movement
- ✅ NPC display
- ✅ Networking setup
- ✅ Basic authentication

### Phase 2: Core Systems
- ✅ Server-authoritative movement
- ✅ Combat system
- ✅ Chat system
- ✅ Inventory system
- ✅ Quest system

### Phase 3: Content
- ✅ Multiple zones (Meadow of Beginnings, Whispering Woods, Crypt of Shadows)
- ✅ Enemy AI (patrol, aggro, chase, attack, return)
- ✅ Item drops and loot system
- ✅ Player progression (levels, experience, stats)
- ✅ Character classes (Warrior, Mage, Ranger, Rogue, Paladin)
- ✅ NPC interactions (merchants, quest givers, healers)
- ✅ Equipment system
- ⬜ Additional enemy variety
- ⬜ Character class abilities

### Phase 4: Advanced Features
- ⬜ Guild system
- ⬜ PvP arenas
- ⬜ Raids
- ⬜ Crafting
- ⬜ Player housing

### Phase 5: Launch
- ⬜ Load testing
- ⬜ Security audit
- ⬜ Beta testing
- ⬜ Marketing
- 🚀 Launch!

## 🛠️ Development Tools

### Essential Packages
```json
{
  "devDependencies": {
    "lerna": "^8.0.0",
    "@nrwl/workspace": "^16.0.0",
    "typescript": "^5.3.0",
    "eslint": "^8.50.0",
    "prettier": "^3.0.0",
    "jest": "^29.7.0",
    "cypress": "^13.0.0"
  }
}
```

### Build Scripts
```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean"
  }
}
```

## 📚 Next Steps

1. **Immediate**: Convert to monorepo structure
2. **Week 1-2**: Set up shared types and basic networking
3. **Week 3-4**: Implement server-authoritative movement
4. **Week 5-8**: Build combat and inventory systems
5. **Month 3-6**: Add content and advanced features
6. **Month 6-12**: Testing, optimization, and launch preparation

This structure provides a solid foundation for scaling to a full MMORPG while maintaining code quality, performance, and security.