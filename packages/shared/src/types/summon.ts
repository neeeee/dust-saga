export enum SummonType {
  WALL = 'wall',
  PLANT = 'plant',
  WYVERN = 'wyvern',
  TURTLE = 'turtle',
}

export const COMBAT_SUMMON_TYPES: SummonType[] = [SummonType.PLANT, SummonType.WYVERN, SummonType.TURTLE];
export const MAX_PLANTS = 2;

export interface SummonInstance {
  id: string;
  ownerId: string;
  ownerName: string;
  summonType: SummonType;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  maxHealth: number;
  defense: number;
  element?: string;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  duration: number;
  spawnedAt: number;
  targetId: string | null;
  state: 'idle' | 'follow' | 'attack' | 'dead';
  zoneId: string;
}
