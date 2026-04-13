# Quick Start Guide

## Current Status

✅ **Server**: Running on http://localhost:3001 (dev mode, no database)
✅ **Client**: Running on http://localhost:3002 (dev mode)

## Access the Game

Open your browser and navigate to: **http://localhost:3002**

## Controls

Once in the game:
- **Click anywhere** to lock the mouse pointer
- **WASD** - Move around
- **Mouse** - Look around (when pointer is locked)
- **Shift** - Sprint
- **F** - Attack
- **Enter** - Type in chat
- **ESC** - Unlock mouse pointer

## Development Mode

The server is currently running in development mode without PostgreSQL or Redis. This is fine for testing the base functionality.

### To stop the servers:

```bash
# Stop server
pkill -f "npm run dev:server" or pkill -f "tsx watch"

# Stop client
pkill -f "npm run dev:client" or pkill -f "vite"
```

### To restart:

```bash
# Terminal 1
cd packages/server && npm run dev

# Terminal 2
cd packages/client && npm run dev
```

## Project Structure

```
dust-saga/
├── packages/
│   ├── client/          # Babylon.js + Vue.js game client
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── engine/       # Babylon.js engine wrapper
│   │   │   │   ├── network/      # Socket.io client
│   │   │   │   ├── input/        # Mouse & keyboard handling
│   │   │   │   ├── ecs/          # Entity Component System
│   │   │   │   └── GameClient.ts # Main game client
│   │   │   ├── App.vue           # Vue UI component
│   │   │   └── main.ts           # Entry point
│   │   └── package.json
│   │
│   ├── server/          # Node.js game server
│   │   ├── src/
│   │   │   ├── core/
│   │   │   │   ├── database/     # PostgreSQL & Redis manager
│   │   │   │   ├── network/      # Socket.io server
│   │   │   │   ├── ecs/          # Entity Component System
│   │   │   │   └── world/        # Zone & world management
│   │   │   └── index.ts          # Server entry point
│   │   ├── .env.example          # Environment variables template
│   │   └── package.json
│   │
│   └── shared/          # Shared TypeScript code
│       ├── src/
│       │   ├── types/            # Packet types, ECS types
│       │   ├── constants/        # Game configuration
│       │   └── utils/            # Math, validators
│       └── package.json
│
├── docker-compose.yml  # Docker setup for full stack
├── turbo.json         # Turborepo configuration
└── package.json       # Root package.json
```

## Features Implemented

### ✅ Phase 1 Features
- [x] 3D rendering with Babylon.js
- [x] Low poly environment (ground, trees, rocks)
- [x] Player movement with WASD controls
- [x] Mouse look with pointer lock
- [x] WebSocket networking setup
- [x] Basic authentication (mock mode)
- [x] Real-time position synchronization
- [x] Interpolation for smooth movement
- [x] Chat system
- [x] HUD with health, level display
- [x] Login/Register UI

### 🚧 Phase 2 Features (To be implemented)
- [ ] Server-authoritative movement validation
- [ ] Combat system with damage calculations
- [ ] Inventory system
- [ ] Quest system
- [ ] Entity spawning/despawning
- [ ] Multiple zones

## Testing

1. Open http://localhost:3002 in your browser
2. Register a new account (or just login - mock mode accepts anything)
3. Click to lock the mouse
4. Move around with WASD
5. Try the chat system
6. Open multiple browser tabs to see multiple players

## Next Steps

1. **Set up PostgreSQL and Redis** for persistent data
2. **Implement server-authoritative movement** for security
3. **Add combat system** with attacks and damage
4. **Create more 3D assets** for players, NPCs, enemies
5. **Implement character classes** with different abilities
6. **Add multiple zones** with teleportation

## Troubleshooting

### Port already in use
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Kill process using port 3002
lsof -ti:3002 | xargs kill -9
```

### Build errors
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Database connection errors
The server runs fine without the database in development mode. To enable full database features:

```bash
# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Start Redis
brew services start redis  # macOS
sudo systemctl start redis  # Linux

# Create database
createdb dust_saga

# Copy .env file
cp packages/server/.env.example packages/server/.env

# Edit .env with your credentials
```