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
- Valkey (any version works)

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
```
```bash
# On Linux
sudo systemctl start valkey
```

```
# On Windows
use wsl.
```

## Development

Run both client and server in development mode:

```bash
npm run dev
```
The `dev` script requires an electron main.ts. You can build your own or paste this into `packages/client/electron/main.ts`
```typescript
import { app, BrowserWindow } from 'electron';
import { join } from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'Dust Saga',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
```
and this in `packages/client/electron/preload.mjs`
```javascript
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {});
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
- Quest system (DB-driven, KILL/COLLECT/TALK/EXPLORE/ESCORT objectives, party kill-credit, multi-stage dialog, world-grid waypoints)

### Planned Features
- Guild system
- PvP arenas
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

### Public
- `GET /health` — Health check (DB + Redis status)
- `GET /api/classes` — Class definitions
- `GET /api/players` — List players. Will have more to it when plugins can be made.

### WebSocket Events
- `packet` — All game packets
- Packet types defined in `packages/shared/src/types/packets.ts`

### Quest Admin API

CRUD over quest definitions stored in the `quests` table. Every route requires
the `ADMIN_TOKEN` env var to be set on the server — requests are authenticated
with either `Authorization: Bearer <token>` or `X-Admin-Token: <token>`. When
the token is unset, all admin routes return `503`.

| Method | Path                       | Description                                                        |
|--------|----------------------------|--------------------------------------------------------------------|
| GET    | `/api/admin/quests/schema` | Field reference for the quest definition body                      |
| GET    | `/api/admin/quests`        | List quests. Filters: `?npc=&type=&minLevel=&maxLevel=`            |
| GET    | `/api/admin/quests/:id`    | Get a single quest                                                 |
| POST   | `/api/admin/quests`        | Create a quest (validates shape, rejects duplicates)               |
| PUT    | `/api/admin/quests/:id`    | Upsert a quest by id (body id is ignored, path wins)               |
| DELETE | `/api/admin/quests/:id`    | Delete a quest                                                     |
| POST   | `/api/admin/quests/reload` | Reload the in-memory cache from the DB (needed on other shards)    |

Created/updated quests are written through to the DB and the local cache live,
so they are playable immediately on this shard without a restart. In a
multi-shard deployment, hit `reload` on the others.

**Example payload** (POST/PUT body):

```json
{
  "id": "scout_meadow",
  "title": "Scout the Meadow",
  "description": "Elder Miriam wants a report on the slime cluster.",
  "type": "explore",
  "requiredLevel": 1,
  "npcId": "elder_miriam",
  "objectives": [
    {
      "id": "find_slime_cluster",
      "type": "explore",
      "targetId": "l12",
      "targetName": "Slime Cluster",
      "requiredCount": 1,
      "cell": "L12",
      "zoneId": "starter_zone"
    }
  ],
  "rewards": { "experience": 30, "gold": 15, "items": [] },
  "offerDialog":     [{ "speaker": "Elder Miriam", "text": "Head east to the slime cluster." }],
  "inProgressDialog": [{ "text": "Follow the marker on your map." }],
  "turnInDialog":    [{ "text": "Then you know what we face. Thank you." }]
}
```

See `GET /api/admin/quests/schema` for the canonical field reference. Cell
labels follow the world grid (per-zone 8-unit cells, columns A–Z × rows 1–N).

## GM Roles

Accounts are tiered via `players.role`: `player` (default), `gm`, or `admin`.
Promote or demote from the server package:

```bash
cd packages/server
npm run gm -- <username> <player|gm|admin>
```

The role is loaded fresh at character select (never trusts JWT staleness) and
governs:

- **Chat commands** — debug/cheat commands (`/setlevel`, `/spawn_dummy`,
  `/killallenemies`, `/dummy_*`, etc.) require GM+. `/return` is available to
  everyone.
- **In-game indicator** — GM/Admin nameplates are prefixed `[GM]` / `[ADMIN]`
  in role color, and chat messages from GM/Admin accounts are prefixed
  likewise.
- **GM panel** — F12 only opens the panel for GM+ accounts.

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
