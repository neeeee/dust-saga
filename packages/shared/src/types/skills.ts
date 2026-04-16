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
  range?: number;
  buffEffectTable?: Record<string, any>;
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
  isPassive?: boolean;
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
}

export interface SkillAllocation {
  skillId: number;
  points: number;
}

export type SkillAllocations = SkillAllocation[];

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
