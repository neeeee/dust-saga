import { LootTable } from '../types/items';

export interface EnemyDefinition {
  id: string;
  name: string;
  modelFile: string;
  level: number;
  health: number;
  attack: number;
  defense: number;
  speed: number;
  experience: number;
  aggroRange: number;
  attackRange: number;
  leashRange: number;
  respawnTime: number;
  lootTable: LootTable;
  patrolSpeed: number;
}

export const ENEMY_DATABASE: Record<string, EnemyDefinition> = {
  'green_slime': {
    id: 'green_slime',
    name: 'Green Slime',
    modelFile: 'Enemy Small.glb',
    level: 1,
    health: 40,
    attack: 5,
    defense: 1,
    speed: 2,
    experience: 15,
    aggroRange: 8,
    attackRange: 1.5,
    leashRange: 20,
    respawnTime: 10000,
    patrolSpeed: 1,
    lootTable: {
      rolls: 1,
      drops: [
        { itemId: 'health_potion', quantity: 1, chance: 0.3 },
        { itemId: 'wolf_pelt', quantity: 1, chance: 0.2 }
      ]
    }
  },
  'dire_wolf': {
    id: 'dire_wolf',
    name: 'Dire Wolf',
    modelFile: 'Enemy Small.glb',
    level: 3,
    health: 80,
    attack: 12,
    defense: 3,
    speed: 4,
    experience: 35,
    aggroRange: 12,
    attackRange: 1.8,
    leashRange: 25,
    respawnTime: 15000,
    patrolSpeed: 2,
    lootTable: {
      rolls: 2,
      drops: [
        { itemId: 'wolf_pelt', quantity: 1, chance: 0.5 },
        { itemId: 'health_potion', quantity: 1, chance: 0.2 },
        { itemId: 'leather_boots', quantity: 1, chance: 0.05 }
      ]
    }
  },
  'goblin_scout': {
    id: 'goblin_scout',
    name: 'Goblin Scout',
    modelFile: 'Enemy Small.glb',
    level: 5,
    health: 120,
    attack: 18,
    defense: 5,
    speed: 3.5,
    experience: 60,
    aggroRange: 10,
    attackRange: 2,
    leashRange: 25,
    respawnTime: 20000,
    patrolSpeed: 1.5,
    lootTable: {
      rolls: 2,
      drops: [
        { itemId: 'goblin_ear', quantity: 1, chance: 0.6 },
        { itemId: 'iron_sword', quantity: 1, chance: 0.03 },
        { itemId: 'health_potion', quantity: 1, chance: 0.3 },
        { itemId: 'mana_potion', quantity: 1, chance: 0.2 }
      ]
    }
  },
  'forest_troll': {
    id: 'forest_troll',
    name: 'Forest Troll',
    modelFile: 'Enemy Small.glb',
    level: 8,
    health: 200,
    attack: 28,
    defense: 10,
    speed: 2.5,
    experience: 120,
    aggroRange: 10,
    attackRange: 2.5,
    leashRange: 30,
    respawnTime: 30000,
    patrolSpeed: 1,
    lootTable: {
      rolls: 2,
      drops: [
        { itemId: 'chainmail', quantity: 1, chance: 0.05 },
        { itemId: 'steel_blade', quantity: 1, chance: 0.03 },
        { itemId: 'health_potion', quantity: 2, chance: 0.4 },
        { itemId: 'ancient_scroll', quantity: 1, chance: 0.1 }
      ]
    }
  },
  'shadow_wraith': {
    id: 'shadow_wraith',
    name: 'Shadow Wraith',
    modelFile: 'Enemy Small.glb',
    level: 12,
    health: 350,
    attack: 40,
    defense: 8,
    speed: 3,
    experience: 250,
    aggroRange: 15,
    attackRange: 2,
    leashRange: 35,
    respawnTime: 45000,
    patrolSpeed: 1.5,
    lootTable: {
      rolls: 3,
      drops: [
        { itemId: 'plate_armor', quantity: 1, chance: 0.04 },
        { itemId: 'swift_boots', quantity: 1, chance: 0.03 },
        { itemId: 'ancient_scroll', quantity: 1, chance: 0.2 },
        { itemId: 'health_potion', quantity: 3, chance: 0.5 },
        { itemId: 'mana_potion', quantity: 2, chance: 0.4 }
      ]
    }
  }
};

export function getEnemyDefinition(id: string): EnemyDefinition | undefined {
  return ENEMY_DATABASE[id];
}
