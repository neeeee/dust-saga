import { StatPoints, StatType } from './races';

export enum BaseClass {
  WARRIOR = 'warrior',
  SCOUT = 'scout',
  ACOLYTE = 'acolyte',
  MAGE = 'mage'
}

export enum JobId {
  WARRIOR = 'warrior',
  GLADIATOR = 'gladiator',
  KNIGHT = 'knight',
  JUGGERNAUT = 'juggernaut',
  DRAGOON = 'dragoon',
  PALADIN = 'paladin',
  SCOUT = 'scout',
  HUNTER = 'hunter',
  THIEF = 'thief',
  RANGER = 'ranger',
  ASSASSIN = 'assassin',
  SHADOWBLADE = 'shadowblade',
  ACOLYTE = 'acolyte',
  PRIEST = 'priest',
  MONK = 'monk',
  BISHOP = 'bishop',
  CHAMPION = 'champion',
  DRUID = 'druid',
  MAGE = 'mage',
  WIZARD = 'wizard',
  SORCERER = 'sorcerer',
  WARLOCK = 'warlock',
  SAGE = 'sage',
  NECROMANCER = 'necromancer'
}

export interface JobDefinition {
  id: JobId;
  name: string;
  baseClass: BaseClass;
  tier: 1 | 2 | 3;
  parentJob: JobId | null;
  description: string;
  modelFile: string;
  baseStatModifiers: Partial<Record<StatType, number>>;
  lpBase: number;
  lpPerLevel: number;
  lpPerSta: number;
  mpBase: number;
  mpPerLevel: number;
  mpPerSpi: number;
}

export interface SkillProficiencies {
  melee: number;
  technique: number;
  prayer: number;
  magic: number;
  special: number;
}

export function createDefaultSkillProficiencies(): SkillProficiencies {
  return { melee: 0, technique: 0, prayer: 0, magic: 0, special: 0 };
}

export interface CharacterInfo {
  id: string;
  name: string;
  race: string;
  jobId: JobId;
  level: number;
  experience: number;
  experienceToNext: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  zoneId: string;
}

export function getBaseClassForJob(jobId: JobId): BaseClass {
  const job = JOB_DEFINITIONS[jobId];
  return job ? job.baseClass : BaseClass.WARRIOR;
}

export function getAvailableJobs(baseClass: BaseClass, tier: 1 | 2 | 3): JobId[] {
  return Object.values(JOB_DEFINITIONS)
    .filter(j => j.baseClass === baseClass && j.tier === tier)
    .map(j => j.id);
}

export function getAdvancementOptions(currentJob: JobId): JobId[] {
  const current = JOB_DEFINITIONS[currentJob];
  if (!current) return [];
  if (current.tier === 3) return [];
  return Object.values(JOB_DEFINITIONS)
    .filter(j => j.parentJob === currentJob)
    .map(j => j.id);
}

export const JOB_DEFINITIONS: Record<JobId, JobDefinition> = {
  [JobId.WARRIOR]: {
    id: JobId.WARRIOR,
    name: 'Warrior',
    baseClass: BaseClass.WARRIOR,
    tier: 1,
    parentJob: null,
    description: 'A mighty fighter with high health and physical power.',
    modelFile: 'Adventurer.glb',
    baseStatModifiers: { STR: 3, STA: 2 },
    lpBase: 150, lpPerLevel: 15, lpPerSta: 8,
    mpBase: 30, mpPerLevel: 3, mpPerSpi: 2
  },
  [JobId.GLADIATOR]: {
    id: JobId.GLADIATOR,
    name: 'Gladiator',
    baseClass: BaseClass.WARRIOR,
    tier: 2,
    parentJob: JobId.WARRIOR,
    description: 'An offensive warrior specializing in two-handed weapons and raw damage.',
    modelFile: 'Adventurer.glb',
    baseStatModifiers: { STR: 4, STA: 2, DEX: 1 },
    lpBase: 200, lpPerLevel: 20, lpPerSta: 10,
    mpBase: 35, mpPerLevel: 4, mpPerSpi: 2
  },
  [JobId.KNIGHT]: {
    id: JobId.KNIGHT,
    name: 'Knight',
    baseClass: BaseClass.WARRIOR,
    tier: 2,
    parentJob: JobId.WARRIOR,
    description: 'A defensive warrior specializing in shields and party protection.',
    modelFile: 'King.glb',
    baseStatModifiers: { STR: 2, STA: 4, SPI: 1 },
    lpBase: 220, lpPerLevel: 22, lpPerSta: 12,
    mpBase: 45, mpPerLevel: 5, mpPerSpi: 3
  },
  [JobId.JUGGERNAUT]: {
    id: JobId.JUGGERNAUT,
    name: 'Juggernaut',
    baseClass: BaseClass.WARRIOR,
    tier: 3,
    parentJob: JobId.GLADIATOR,
    description: 'An unstoppable force of destruction with devastating power.',
    modelFile: 'Adventurer.glb',
    baseStatModifiers: { STR: 6, STA: 3, DEX: 2 },
    lpBase: 280, lpPerLevel: 28, lpPerSta: 14,
    mpBase: 40, mpPerLevel: 5, mpPerSpi: 3
  },
  [JobId.DRAGOON]: {
    id: JobId.DRAGOON,
    name: 'Dragoon',
    baseClass: BaseClass.WARRIOR,
    tier: 3,
    parentJob: JobId.GLADIATOR,
    description: 'A lance-wielding warrior with superior mounted combat abilities.',
    modelFile: 'Adventurer.glb',
    baseStatModifiers: { STR: 5, STA: 3, AGI: 2 },
    lpBase: 260, lpPerLevel: 26, lpPerSta: 13,
    mpBase: 45, mpPerLevel: 5, mpPerSpi: 3
  },
  [JobId.PALADIN]: {
    id: JobId.PALADIN,
    name: 'Paladin',
    baseClass: BaseClass.WARRIOR,
    tier: 3,
    parentJob: JobId.KNIGHT,
    description: 'A holy knight combining strong defense with healing abilities.',
    modelFile: 'King.glb',
    baseStatModifiers: { STR: 3, STA: 5, SPI: 3 },
    lpBase: 300, lpPerLevel: 30, lpPerSta: 15,
    mpBase: 80, mpPerLevel: 8, mpPerSpi: 5
  },
  [JobId.SCOUT]: {
    id: JobId.SCOUT,
    name: 'Scout',
    baseClass: BaseClass.SCOUT,
    tier: 1,
    parentJob: null,
    description: 'A swift hunter with ranged attacks and survival skills.',
    modelFile: 'Farmer.glb',
    baseStatModifiers: { AGI: 3, DEX: 2 },
    lpBase: 100, lpPerLevel: 8, lpPerSta: 5,
    mpBase: 50, mpPerLevel: 5, mpPerSpi: 3
  },
  [JobId.HUNTER]: {
    id: JobId.HUNTER,
    name: 'Hunter',
    baseClass: BaseClass.SCOUT,
    tier: 2,
    parentJob: JobId.SCOUT,
    description: 'A ranged specialist with mastery of bows and traps.',
    modelFile: 'Farmer.glb',
    baseStatModifiers: { AGI: 4, DEX: 3, STR: 1 },
    lpBase: 130, lpPerLevel: 10, lpPerSta: 6,
    mpBase: 60, mpPerLevel: 6, mpPerSpi: 4
  },
  [JobId.THIEF]: {
    id: JobId.THIEF,
    name: 'Thief',
    baseClass: BaseClass.SCOUT,
    tier: 2,
    parentJob: JobId.SCOUT,
    description: 'A stealthy rogue specializing in critical strikes and evasion.',
    modelFile: 'Punk.glb',
    baseStatModifiers: { AGI: 5, DEX: 2 },
    lpBase: 110, lpPerLevel: 9, lpPerSta: 5,
    mpBase: 45, mpPerLevel: 4, mpPerSpi: 3
  },
  [JobId.RANGER]: {
    id: JobId.RANGER,
    name: 'Ranger',
    baseClass: BaseClass.SCOUT,
    tier: 3,
    parentJob: JobId.HUNTER,
    description: 'An elite marksman with nature magic and superior archery.',
    modelFile: 'Farmer.glb',
    baseStatModifiers: { AGI: 5, DEX: 4, STR: 2 },
    lpBase: 160, lpPerLevel: 13, lpPerSta: 7,
    mpBase: 80, mpPerLevel: 8, mpPerSpi: 5
  },
  [JobId.ASSASSIN]: {
    id: JobId.ASSASSIN,
    name: 'Assassin',
    baseClass: BaseClass.SCOUT,
    tier: 3,
    parentJob: JobId.THIEF,
    description: 'A deadly shadow operative with lethal critical hits.',
    modelFile: 'Punk.glb',
    baseStatModifiers: { AGI: 7, DEX: 3, STR: 2 },
    lpBase: 140, lpPerLevel: 11, lpPerSta: 6,
    mpBase: 60, mpPerLevel: 6, mpPerSpi: 4
  },
  [JobId.SHADOWBLADE]: {
    id: JobId.SHADOWBLADE,
    name: 'Shadowblade',
    baseClass: BaseClass.SCOUT,
    tier: 3,
    parentJob: JobId.THIEF,
    description: 'A hybrid of shadow magic and blade arts.',
    modelFile: 'Punk.glb',
    baseStatModifiers: { AGI: 5, DEX: 3, INT: 3 },
    lpBase: 135, lpPerLevel: 11, lpPerSta: 6,
    mpBase: 90, mpPerLevel: 9, mpPerSpi: 5
  },
  [JobId.ACOLYTE]: {
    id: JobId.ACOLYTE,
    name: 'Acolyte',
    baseClass: BaseClass.ACOLYTE,
    tier: 1,
    parentJob: null,
    description: 'A devout healer with holy magic and support abilities.',
    modelFile: 'Beach Character.glb',
    baseStatModifiers: { SPI: 3, INT: 2 },
    lpBase: 90, lpPerLevel: 7, lpPerSta: 4,
    mpBase: 100, mpPerLevel: 10, mpPerSpi: 6
  },
  [JobId.PRIEST]: {
    id: JobId.PRIEST,
    name: 'Priest',
    baseClass: BaseClass.ACOLYTE,
    tier: 2,
    parentJob: JobId.ACOLYTE,
    description: 'A holy healer with powerful restoration and blessing magic.',
    modelFile: 'Beach Character.glb',
    baseStatModifiers: { SPI: 5, INT: 3 },
    lpBase: 110, lpPerLevel: 9, lpPerSta: 5,
    mpBase: 140, mpPerLevel: 14, mpPerSpi: 8
  },
  [JobId.MONK]: {
    id: JobId.MONK,
    name: 'Monk',
    baseClass: BaseClass.ACOLYTE,
    tier: 2,
    parentJob: JobId.ACOLYTE,
    description: 'A martial artist combining physical power with spiritual energy.',
    modelFile: 'Beach Character.glb',
    baseStatModifiers: { SPI: 3, STR: 3, AGI: 2 },
    lpBase: 130, lpPerLevel: 10, lpPerSta: 7,
    mpBase: 80, mpPerLevel: 8, mpPerSpi: 5
  },
  [JobId.BISHOP]: {
    id: JobId.BISHOP,
    name: 'Bishop',
    baseClass: BaseClass.ACOLYTE,
    tier: 3,
    parentJob: JobId.PRIEST,
    description: 'A supreme healer with divine resurrection and protection magic.',
    modelFile: 'Beach Character.glb',
    baseStatModifiers: { SPI: 7, INT: 5 },
    lpBase: 140, lpPerLevel: 11, lpPerSta: 6,
    mpBase: 200, mpPerLevel: 20, mpPerSpi: 12
  },
  [JobId.CHAMPION]: {
    id: JobId.CHAMPION,
    name: 'Champion',
    baseClass: BaseClass.ACOLYTE,
    tier: 3,
    parentJob: JobId.MONK,
    description: 'An ascetic warrior with devastating chi-enhanced strikes.',
    modelFile: 'Beach Character.glb',
    baseStatModifiers: { SPI: 4, STR: 5, AGI: 3 },
    lpBase: 180, lpPerLevel: 14, lpPerSta: 9,
    mpBase: 100, mpPerLevel: 10, mpPerSpi: 6
  },
  [JobId.DRUID]: {
    id: JobId.DRUID,
    name: 'Druid',
    baseClass: BaseClass.ACOLYTE,
    tier: 3,
    parentJob: JobId.PRIEST,
    description: 'A nature mystic with healing and elemental nature magic.',
    modelFile: 'Beach Character.glb',
    baseStatModifiers: { SPI: 5, INT: 4, DEX: 2 },
    lpBase: 130, lpPerLevel: 10, lpPerSta: 6,
    mpBase: 180, mpPerLevel: 18, mpPerSpi: 10
  },
  [JobId.MAGE]: {
    id: JobId.MAGE,
    name: 'Mage',
    baseClass: BaseClass.MAGE,
    tier: 1,
    parentJob: null,
    description: 'A powerful spellcaster with devastating magical abilities.',
    modelFile: 'Witch.glb',
    baseStatModifiers: { INT: 3, SPI: 2 },
    lpBase: 80, lpPerLevel: 6, lpPerSta: 3,
    mpBase: 120, mpPerLevel: 12, mpPerSpi: 7
  },
  [JobId.WIZARD]: {
    id: JobId.WIZARD,
    name: 'Wizard',
    baseClass: BaseClass.MAGE,
    tier: 2,
    parentJob: JobId.MAGE,
    description: 'A master of elemental magic with devastating area spells.',
    modelFile: 'Witch.glb',
    baseStatModifiers: { INT: 5, SPI: 3 },
    lpBase: 95, lpPerLevel: 7, lpPerSta: 4,
    mpBase: 170, mpPerLevel: 17, mpPerSpi: 10
  },
  [JobId.SORCERER]: {
    id: JobId.SORCERER,
    name: 'Sorcerer',
    baseClass: BaseClass.MAGE,
    tier: 2,
    parentJob: JobId.MAGE,
    description: 'A dark caster wielding forbidden arcane powers.',
    modelFile: 'Witch.glb',
    baseStatModifiers: { INT: 4, SPI: 2, AGI: 2 },
    lpBase: 90, lpPerLevel: 7, lpPerSta: 4,
    mpBase: 160, mpPerLevel: 16, mpPerSpi: 9
  },
  [JobId.WARLOCK]: {
    id: JobId.WARLOCK,
    name: 'Warlock',
    baseClass: BaseClass.MAGE,
    tier: 3,
    parentJob: JobId.WIZARD,
    description: 'An arcane supreme with mastery over all elements.',
    modelFile: 'Witch.glb',
    baseStatModifiers: { INT: 7, SPI: 5 },
    lpBase: 110, lpPerLevel: 9, lpPerSta: 5,
    mpBase: 240, mpPerLevel: 24, mpPerSpi: 14
  },
  [JobId.SAGE]: {
    id: JobId.SAGE,
    name: 'Sage',
    baseClass: BaseClass.MAGE,
    tier: 3,
    parentJob: JobId.WIZARD,
    description: 'A wise scholar combining magic with support enchantments.',
    modelFile: 'Witch.glb',
    baseStatModifiers: { INT: 6, SPI: 6, DEX: 2 },
    lpBase: 105, mpBase: 220, mpPerLevel: 22, mpPerSpi: 12,
    lpPerLevel: 8, lpPerSta: 5
  },
  [JobId.NECROMANCER]: {
    id: JobId.NECROMANCER,
    name: 'Necromancer',
    baseClass: BaseClass.MAGE,
    tier: 3,
    parentJob: JobId.SORCERER,
    description: 'A dark summoner raising the dead to fight.',
    modelFile: 'Witch.glb',
    baseStatModifiers: { INT: 6, SPI: 4, AGI: 2 },
    lpBase: 100, lpPerLevel: 8, lpPerSta: 4,
    mpBase: 200, mpPerLevel: 20, mpPerSpi: 11
  }
};
