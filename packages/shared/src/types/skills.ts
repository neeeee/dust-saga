import type { BuffEffectTable } from './status';
import type { DebuffEffectTable } from '../constants/debuffs';

export enum SkillCategoryId {
  MELEE = 0,
  TECHNIQUE = 6,
  PRAYER = 12,
  MAGIC = 17,
  SPECIAL = 22
}

export enum DamageType {
  PHYSICAL = 'physical',
  MAGICAL = 'magical'
}

export enum PhysicalDamageSubType {
  SLASH = 'slash',
  THRUST = 'thrust',
  CLEAVE = 'cleave',
  BASH = 'bash'
}

export enum MagicalDamageSubType {
  FIRE = 'fire',
  ICE = 'ice',
  LIGHTNING = 'lightning',
  DARK = 'dark',
  HOLY = 'holy'
}

export type DamageSubType = PhysicalDamageSubType | MagicalDamageSubType;

export interface SkillRequirement {
  skillName: string;
  points: number;
}

export type SkillReqPoints = number | SkillRequirement[];

export enum AOETargetMode {
  SELF_CENTERED = 'self_centered',
  TARGET_CENTERED = 'target_centered',
  GROUND_TARGETED = 'ground_targeted',
}

export interface SkillDefinition {
  name: string;
  reqPoints: SkillReqPoints;
  mpCost: number;
  castTime: number;
  cooldown: number;
  duration: number;
  description: string;
  damageType?: DamageType;
  damageSubType?: DamageSubType;
  isPassive?: boolean;
  isAOE?: boolean;
  aoeTargetMode?: AOETargetMode;
  aoeRadius?: number;
  range?: number;
  isBuff?: boolean;
  isDebuff?: boolean;
  hasDebuff?: boolean;
  selfBuffOnly?: boolean;
  buffEffectTable?: BuffEffectTable;
  debuffEffectTable?: DebuffEffectTable;
  debuffDuration?: number;
}

export interface SkillSubCategory {
  id: number;
  name: string;
  skills: Record<string, SkillDefinition>;
}

export interface SkillCategoryData {
  name: string;
  skills: SkillSubCategory[];
}

export interface ClassSpecificSkill {
  reqLevel?: number;
  reqPoints?: SkillReqPoints;
  mpCost: number;
  castTime: number;
  cooldown: number;
  duration: number;
  description: string;
  damageType?: DamageType;
  damageSubType?: DamageSubType;
  isPassive?: boolean;
  isAOE?: boolean;
  aoeTargetMode?: AOETargetMode;
  aoeRadius?: number;
  range?: number;
  isBuff?: boolean;
  isDebuff?: boolean;
  hasDebuff?: boolean;
  selfBuffOnly?: boolean;
  buffEffectTable?: BuffEffectTable;
  debuffEffectTable?: DebuffEffectTable;
  debuffDuration?: number;
}

export type ClassSpecificSkills = Record<string, ClassSpecificSkill>;

export interface SkillCooldownEntry {
  skillName: string;
  readyAt: number;
}

export interface ActiveCast {
  skillName: string;
  startedAt: number;
  castTime: number;
  targetId: string | null;
  aoePosition?: { x: number; y: number; z: number };
}

export interface SkillAllocation {
  skillId: number;
  points: number;
}

export type SkillAllocations = SkillAllocation[];

export enum SkillTargetType {
  SELF = 'self',
  SELF_OR_TARGET = 'self_or_target',
  PARTY = 'party',
  OTHER_ONLY = 'other_only'
}

export const SKILL_TARGET_RULES: Record<string, SkillTargetType> = {
  'Ossify': SkillTargetType.SELF,
  'Concentration': SkillTargetType.SELF,
  'Parapet': SkillTargetType.SELF,
  'Auto-guard': SkillTargetType.SELF,
  'Defensive March': SkillTargetType.SELF,
  'Toxify': SkillTargetType.SELF,
  'Rush': SkillTargetType.SELF,
  'Quick Step': SkillTargetType.SELF,
  'Avoidance': SkillTargetType.SELF,
  'Elemental Absorption': SkillTargetType.SELF,
  'Green Song': SkillTargetType.SELF,
  'Blue Song': SkillTargetType.SELF,
  'Red Song': SkillTargetType.SELF,
  'Yellow Song': SkillTargetType.SELF,
  'Mana Shield': SkillTargetType.SELF,
  'Clear Mind': SkillTargetType.SELF,
  'Gloom': SkillTargetType.SELF,
  'Raging Soul': SkillTargetType.SELF,
  'War Cry': SkillTargetType.SELF,
  'Lunge': SkillTargetType.SELF,
  'Desperado': SkillTargetType.SELF,
  'Skill Focus': SkillTargetType.SELF,
  'Invigorate': SkillTargetType.SELF,
  'Hide': SkillTargetType.SELF,
  'Snipers Nest': SkillTargetType.SELF,
  'Watchful Eye': SkillTargetType.SELF,
  'Horse Archer': SkillTargetType.SELF,
  'Cloak': SkillTargetType.SELF,
  'Magical Aid': SkillTargetType.SELF,

  'Mental Aid': SkillTargetType.SELF_OR_TARGET,
  'Physical Barrier': SkillTargetType.SELF_OR_TARGET,
  'Magical Barrier': SkillTargetType.SELF_OR_TARGET,
  'Regenerate': SkillTargetType.SELF_OR_TARGET,
  'Velox': SkillTargetType.SELF_OR_TARGET,
  'Battle Prayer': SkillTargetType.SELF_OR_TARGET,
  'Enchantment': SkillTargetType.SELF_OR_TARGET,
  'Locomitigation': SkillTargetType.SELF_OR_TARGET,
  'Spirit Protection': SkillTargetType.SELF_OR_TARGET,
  'Bless Weapon': SkillTargetType.SELF_OR_TARGET,
  'Resist Fire': SkillTargetType.SELF_OR_TARGET,
  'Resist Ice': SkillTargetType.SELF_OR_TARGET,
  'Resist Lightning': SkillTargetType.SELF_OR_TARGET,
  'Resist Malice': SkillTargetType.SELF_OR_TARGET,
  'Resist Charm': SkillTargetType.SELF_OR_TARGET,
  'Accelerate': SkillTargetType.SELF_OR_TARGET,
  'Mana Restore': SkillTargetType.SELF_OR_TARGET,

  'Providence': SkillTargetType.PARTY,
  'Lapis Mediow': SkillTargetType.PARTY,
  'Group Barrier': SkillTargetType.PARTY,
  'Third Eye': SkillTargetType.PARTY,
  'Tranquil Mind': SkillTargetType.PARTY,
  'Divine Aid': SkillTargetType.PARTY,
  'Speedy Gale': SkillTargetType.PARTY,
  'Restoration': SkillTargetType.PARTY,

  'Saltio': SkillTargetType.OTHER_ONLY,
  'Devotion': SkillTargetType.OTHER_ONLY,
  'Poison': SkillTargetType.OTHER_ONLY,
  'Mind Venom': SkillTargetType.OTHER_ONLY,
  'Weakness': SkillTargetType.OTHER_ONLY,
  'Weaken': SkillTargetType.OTHER_ONLY,
  'Undermine': SkillTargetType.OTHER_ONLY,
  'Impedimentia': SkillTargetType.OTHER_ONLY,
  'Tangled Fingers': SkillTargetType.OTHER_ONLY,
  'Befuddle': SkillTargetType.OTHER_ONLY,
};

export function isPassiveSkill(skill: SkillDefinition): boolean {
  return skill.isPassive || skill.name.includes('(Passive)');
}

export function meetsRequirements(
  reqPoints: SkillReqPoints,
  getSkillPoints: (skillName: string) => number
): boolean {
  if (typeof reqPoints === 'number') return true;
  return (reqPoints as SkillRequirement[]).every(
    r => getSkillPoints(r.skillName) >= r.points
  );
}

export function getRequiredProficiency(reqPoints: SkillReqPoints): number {
  if (typeof reqPoints === 'number') return reqPoints;
  return Math.max(...(reqPoints as SkillRequirement[]).map(r => r.points));
}
