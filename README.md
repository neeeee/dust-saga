# Dust Saga - Low Poly 3D MMORPG
Work in Progress passion project.

A browser-based low poly 3D MMORPG built with Babylon.js, Node.js, and PostgreSQL.

## Architecture

- **Client**: Babylon.js 3D rendering with Vue.js UI overlay
- **Server**: Node.js with Express and Socket.io for real-time communication
- **Database**: PostgreSQL for persistent data, Valkey for caching
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

4. **Start Key/Value Store:**
```bash
# On macOS with Homebrew
brew services start valkey

# On Linux
sudo systemctl start valkey

# On Windows
I don't use Windows and neither should you.
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

### Current Features
- Basic 3D rendering with Babylon.js
- Player movement with WASD controls
- Basic map definition with JSON schema
- WebSocket networking
- Basic user/pass authentication system
- Real-time position synchronization
- Chat system
- Interpolation for smooth movement
    - No animations are forwarded to other clients yet. You will slide, not walk.
- Shop system
- NPC interaction framework
- Enemy AI with volatile enmity/hate/aggro calculated from actions
- Item drop tables
- Item enhancement

### Planned Features
- Guild system
- PvP arenas
- Quest lines and rewards
- Crafting
- Gathering
- Boss enemies

## Controls

- **WASD** - Move
- **Mouse** - Look around (right click to lock)
- **F** - Auto-Attack
- **Enter** - Open chat
- **ESC** - Close all visible windows/unfocus chat
- **I** - Inventory
- **K** - Skills
- **C** - Character Stats
- **J** - Quests (Journal)

## API Endpoints

**WIP** !! Not working on the API until the game is worth playing.

### Server
- `GET /health` - Health check
- `GET /api/players` - List players. Will have more to it when plugins can be made.

### WebSocket Events
- `packet` - All game packets
- Packet types defined in `packages/shared/src/types/packets.ts`

## Database Schema

See `packages/server/src/core/database/DatabaseManager.ts` for schema definition.

## Stack

### Client
- Babylon.js
- Vue.js 3
- Socket.io-client
- TypeScript
- Vite

### Server
- Node.js + Express
- Socket.io
- PostgreSQL
- Redis for Caching and sessions
- TypeScript

## License

ISC
