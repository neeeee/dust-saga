export interface ZoneSpawn {
  enemyType: string;
  count: number;
  spawnArea: { centerX: number; centerZ: number; radius: number };
  patrolPoints?: Array<{ x: number; y: number; z: number }>;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  description: string;
  levelRange: [number, number];
  groundColor: { r: number; g: number; b: number };
  fogColor: { r: number; g: number; b: number };
  fogDensity: number;
  size: number;
  playerSpawn: { x: number; y: number; z: number };
  spawns: ZoneSpawn[];
  connections: string[];
  environmentObjects: Array<{
    type: 'tree' | 'rock' | 'bush' | 'house';
    positions: Array<{ x: number; y: number; z: number; scale?: number; rotation?: number }>;
  }>;
}

export const ZONE_DATABASE: Record<string, ZoneDefinition> = {
  'starter_zone': {
    id: 'starter_zone',
    name: 'Meadow of Beginnings',
    description: 'A peaceful meadow where new adventurers begin their journey.',
    levelRange: [1, 3],
    groundColor: { r: 0.35, g: 0.55, b: 0.25 },
    fogColor: { r: 0.7, g: 0.85, b: 0.95 },
    fogDensity: 0.003,
    size: 120,
    playerSpawn: { x: 0, y: 0, z: -50 },
    connections: ['forest_zone'],
    spawns: [
      {
        enemyType: 'green_slime',
        count: 8,
        spawnArea: { centerX: 30, centerZ: 30, radius: 25 }
      },
      {
        enemyType: 'dire_wolf',
        count: 4,
        spawnArea: { centerX: -20, centerZ: 25, radius: 15 }
      }
    ],
    environmentObjects: []
  },
  'forest_zone': {
    id: 'forest_zone',
    name: 'Whispering Woods',
    description: 'A dense forest filled with dangerous creatures and hidden treasures.',
    levelRange: [3, 8],
    groundColor: { r: 0.2, g: 0.35, b: 0.15 },
    fogColor: { r: 0.5, g: 0.65, b: 0.45 },
    fogDensity: 0.008,
    size: 150,
    playerSpawn: { x: 0, y: 0, z: -60 },
    connections: ['starter_zone', 'dungeon_zone'],
    spawns: [
      {
        enemyType: 'dire_wolf',
        count: 6,
        spawnArea: { centerX: 0, centerZ: 0, radius: 40 }
      },
      {
        enemyType: 'goblin_scout',
        count: 5,
        spawnArea: { centerX: 30, centerZ: 20, radius: 25 }
      },
      {
        enemyType: 'forest_troll',
        count: 3,
        spawnArea: { centerX: -30, centerZ: 30, radius: 20 }
      }
    ],
    environmentObjects: [
      {
        type: 'tree',
        positions: [
          { x: -10, y: 0, z: -10, scale: 1.5 },
          { x: 8, y: 0, z: -25, scale: 1.3 },
          { x: -25, y: 0, z: 5, scale: 1.6 },
          { x: 15, y: 0, z: 10, scale: 1.2 },
          { x: -5, y: 0, z: 20, scale: 1.4 },
          { x: 30, y: 0, z: -5, scale: 1.1 },
          { x: -35, y: 0, z: -15, scale: 1.5 },
          { x: 20, y: 0, z: 30, scale: 1.3 },
          { x: -15, y: 0, z: 35, scale: 1.6 },
          { x: 40, y: 0, z: 15, scale: 1.2 },
          { x: -40, y: 0, z: 25, scale: 1.4 },
          { x: 5, y: 0, z: -45, scale: 1.5 },
          { x: -20, y: 0, z: -40, scale: 1.3 },
          { x: 25, y: 0, z: -35, scale: 1.1 },
          { x: -30, y: 0, z: 40, scale: 1.6 },
          { x: 35, y: 0, z: -20, scale: 1.2 },
          { x: -45, y: 0, z: 5, scale: 1.4 },
          { x: 45, y: 0, z: 30, scale: 1.3 },
          { x: -50, y: 0, z: -30, scale: 1.5 },
          { x: 50, y: 0, z: 0, scale: 1.1 }
        ]
      },
      {
        type: 'rock',
        positions: [
          { x: 12, y: 0, z: 5, scale: 1.2 },
          { x: -18, y: 0, z: 15, scale: 1.0 },
          { x: 25, y: 0, z: -15, scale: 1.5 },
          { x: -8, y: 0, z: -30, scale: 0.8 },
          { x: 35, y: 0, z: 25, scale: 1.3 },
          { x: -30, y: 0, z: -20, scale: 1.1 },
          { x: 40, y: 0, z: -10, scale: 0.9 },
          { x: -45, y: 0, z: 15, scale: 1.4 }
        ]
      }
    ]
  },
  'dungeon_zone': {
    id: 'dungeon_zone',
    name: 'Crypt of Shadows',
    description: 'A dark dungeon filled with undead creatures and ancient evil.',
    levelRange: [8, 15],
    groundColor: { r: 0.15, g: 0.15, b: 0.2 },
    fogColor: { r: 0.2, g: 0.15, b: 0.3 },
    fogDensity: 0.015,
    size: 80,
    playerSpawn: { x: 0, y: 0, z: 35 },
    connections: ['forest_zone'],
    spawns: [
      {
        enemyType: 'forest_troll',
        count: 4,
        spawnArea: { centerX: 0, centerZ: 0, radius: 25 }
      },
      {
        enemyType: 'shadow_wraith',
        count: 3,
        spawnArea: { centerX: 10, centerZ: -15, radius: 20 }
      }
    ],
    environmentObjects: [
      {
        type: 'rock',
        positions: [
          { x: -15, y: 0, z: -15, scale: 2.0 },
          { x: 15, y: 0, z: -10, scale: 1.8 },
          { x: 0, y: 0, z: -25, scale: 2.2 },
          { x: -20, y: 0, z: 5, scale: 1.5 },
          { x: 20, y: 0, z: 10, scale: 1.7 },
          { x: -10, y: 0, z: 20, scale: 1.3 },
          { x: 10, y: 0, z: 25, scale: 1.6 }
        ]
      }
    ]
  }
};

export function getZoneDefinition(id: string): ZoneDefinition | undefined {
  return ZONE_DATABASE[id];
}
