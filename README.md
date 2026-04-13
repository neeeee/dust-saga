# Dust Saga - Low Poly 3D MMORPG

A browser-based low poly 3D MMORPG built with Babylon.js, Node.js, and PostgreSQL.

## Architecture

- **Client**: Babylon.js 3D rendering with Vue.js UI overlay
- **Server**: Node.js with Express and Socket.io for real-time communication
- **Database**: PostgreSQL for persistent data, Redis for caching
- **Shared**: TypeScript types and utilities shared between client and server

## Project Structure

```
dust-saga/
├── packages/
│   ├── client/          # Babylon.js game client
│   ├── server/          # Node.js game server
│   └── shared/          # Shared types and utilities
├── database/            # Database schemas and migrations
├── deployment/          # Docker and deployment configs
└── docs/               # Documentation
```

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 7+

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp packages/server/.env.example packages/server/.env
# Edit packages/server/.env with your configuration
```

3. **Set up PostgreSQL database:**
```bash
# Create database
createdb dust_saga

# The server will automatically initialize the schema on first run
```

4. **Start Redis:**
```bash
# On macOS with Homebrew
brew services start redis

# On Linux
sudo systemctl start redis

# On Windows
redis-server
```

## Development

Run both client and server in development mode:

```bash
npm run dev
```

Or run individually:

```bash
# Terminal 1 - Server
npm run dev:server

# Terminal 2 - Client  
npm run dev:client
```

## Building

Build all packages:

```bash
npm run build
```

## Features

### Current Features (Phase 1)
- ✅ Basic 3D rendering with Babylon.js
- ✅ Player movement with WASD controls
- ✅ Low poly environment (trees, rocks, ground)
- ✅ WebSocket networking setup
- ✅ Basic authentication system
- ✅ Real-time position synchronization
- ✅ Chat system
- ✅ Interpolation for smooth movement

### Planned Features (Phase 2+)
- Server-authoritative movement
- Combat system
- Inventory system
- Quest system
- Multiple zones
- Enemy AI
- Character classes
- Guild system
- PvP arenas

## Controls

- **WASD** - Move
- **Mouse** - Look around (click to lock)
- **Shift** - Sprint
- **F** - Attack
- **Enter** - Open chat
- **ESC** - Unlock mouse

## API Endpoints

### Server
- `GET /health` - Health check
- `GET /api/players` - List players

### WebSocket Events
- `packet` - All game packets
- Packet types defined in `packages/shared/src/types/packets.ts`

## Database Schema

See `packages/server/src/core/database/DatabaseManager.ts` for schema definition.

## Technologies

### Client
- Babylon.js - 3D rendering engine
- Vue.js 3 - UI framework
- Socket.io-client - WebSocket client
- TypeScript - Type safety
- Vite - Build tool

### Server
- Node.js + Express - Web server
- Socket.io - WebSocket server
- PostgreSQL - Primary database
- Redis - Caching and sessions
- TypeScript - Type safety

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC

## Roadmap

See [MMORPG_ARCHITECTURE.md](../MMORPG_ARCHITECTURE.md) for detailed development roadmap.