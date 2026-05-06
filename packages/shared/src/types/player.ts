import { StatPoints, StatType, createDefaultStatPoints } from './races';
import { JobId, SkillProficiencies, createDefaultSkillProficiencies, BaseClass } from './jobs';
import { BuffData, StatBonusBreakdown } from './status';
import { SkillCooldownEntry, ActiveCast } from './skills';
import { StatusEffect } from './status';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  magicAttack: number;
  level: number;
  experience: number;
  experienceToNext: number;
}

export interface PlayerSession {
  playerId: string;
  socketId: string;
  username: string;
  characterId: string;
  characterName: string;
  race: string;
  jobId: JobId;
  baseClass: BaseClass;
  stats: PlayerStats;
  statPoints: StatPoints;
  baseStats: { STA: number; STR: number; AGI: number; DEX: number; SPI: number; INT: number };
  unspentStatPoints: number;
  unspentSkillPoints: number;
  skillProficiencies: SkillProficiencies;
  skillAdeptness: SkillProficiencies;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  zoneId: string;
  targetId: string | null;
  lastAttackTime: number;
  lastRegenTick: number;
  invulnerableUntil: number;
  skillCooldowns: SkillCooldownEntry[];
  activeCast: ActiveCast | null;
  statusEffects: StatusEffect[];
  statBreakdown: StatBonusBreakdown | null;
  inventory: Array<{
    itemId: string;
    quantity: number;
    slot: number;
  }>;
  equipment: {
    weapon: any | null;
    armor: any | null;
    helmet: any | null;
    boots: any | null;
    accessory: any | null;
  };
  quests: Array<{
    questId: string;
    status: string;
    objectives: Array<{
      id: string;
      type: string;
      targetId: string;
      targetName: string;
      requiredCount: number;
      currentCount: number;
    }>;
    startedAt: number;
  }>;
}

export interface EnemyInstance {
  id: string;
  enemyType: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  maxHealth: number;
  level: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'return' | 'dead';
  targetId: string | null;
  spawnPosition: { x: number; y: number; z: number };
  lastAttackTime: number;
  deathTime: number;
  patrolPoints: Array<{ x: number; y: number; z: number }>;
  currentPatrolIndex: number;
  statusEffects: StatusEffect[];
}

export interface DamageInfo {
  attackerId: string;
  targetId: string;
  damage: number;
  isCritical: boolean;
  damageType: 'physical' | 'magical';
}
