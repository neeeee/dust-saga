export enum StatusEffectType {
  POISON = 'poison',
  BURN = 'burn',
  FREEZE = 'freeze',
  STUN = 'stun',
  SILENCE = 'silence',
  SLEEP = 'sleep',
  KNOCKDOWN = 'knockdown',
  CHARM = 'charm',
  BLEED = 'bleed',
  ROOT = 'root',
  SLOW = 'slow',
  HASTE = 'haste',
  BUFF_DEFENSE = 'buff_defense',
  BUFF_CAST_SPEED = 'buff_cast_speed',
  BUFF_MAX_HP = 'buff_max_hp',
  BUFF_MP_REGEN = 'buff_mp_regen',
  BUFF_GENERIC = 'buff_generic',
}

export interface StatusEffect {
  id: string;
  type: StatusEffectType;
  sourceId: string;
  targetId: string;
  potency: number;
  appliedAt: number;
  duration: number;
  tickInterval: number;
  lastTickAt: number;
  stacks: number;
  skillName?: string;
}

export interface StatusEffectDefinition {
  type: StatusEffectType;
  duration: number;
  tickInterval: number;
  potency: number;
  isDoT: boolean;
  isCC: boolean;
}

export const STATUS_EFFECT_DEFS: Partial<Record<StatusEffectType, StatusEffectDefinition>> = {
  [StatusEffectType.POISON]: { type: StatusEffectType.POISON, duration: 10000, tickInterval: 2000, potency: 0, isDoT: true, isCC: false },
  [StatusEffectType.BURN]: { type: StatusEffectType.BURN, duration: 5000, tickInterval: 1000, potency: 0, isDoT: true, isCC: false },
  [StatusEffectType.FREEZE]: { type: StatusEffectType.FREEZE, duration: 3000, tickInterval: 0, potency: 0.5, isDoT: false, isCC: true },
  [StatusEffectType.STUN]: { type: StatusEffectType.STUN, duration: 2000, tickInterval: 0, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.SILENCE]: { type: StatusEffectType.SILENCE, duration: 5000, tickInterval: 0, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.SLEEP]: { type: StatusEffectType.SLEEP, duration: 8000, tickInterval: 0, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.KNOCKDOWN]: { type: StatusEffectType.KNOCKDOWN, duration: 2000, tickInterval: 0, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.CHARM]: { type: StatusEffectType.CHARM, duration: 5000, tickInterval: 0, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.BLEED]: { type: StatusEffectType.BLEED, duration: 8000, tickInterval: 2000, potency: 0, isDoT: true, isCC: false },
  [StatusEffectType.ROOT]: { type: StatusEffectType.ROOT, duration: 3000, tickInterval: 0, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.SLOW]: { type: StatusEffectType.SLOW, duration: 5000, tickInterval: 0, potency: 0.3, isDoT: false, isCC: false },
  [StatusEffectType.HASTE]: { type: StatusEffectType.HASTE, duration: 10000, tickInterval: 0, potency: 0.3, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_DEFENSE]: { type: StatusEffectType.BUFF_DEFENSE, duration: 480000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_CAST_SPEED]: { type: StatusEffectType.BUFF_CAST_SPEED, duration: 90000, tickInterval: 0, potency: 0.5, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_MAX_HP]: { type: StatusEffectType.BUFF_MAX_HP, duration: 480000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_MP_REGEN]: { type: StatusEffectType.BUFF_MP_REGEN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_GENERIC]: { type: StatusEffectType.BUFF_GENERIC, duration: 300000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
};

export function isCCImmune(activeEffects: StatusEffect[]): boolean {
  return activeEffects.some(e => e.type === StatusEffectType.STUN || e.type === StatusEffectType.FREEZE);
}

export function isSilenced(activeEffects: StatusEffect[]): boolean {
  return activeEffects.some(e => e.type === StatusEffectType.SILENCE);
}

export function isRooted(activeEffects: StatusEffect[]): boolean {
  return activeEffects.some(e => e.type === StatusEffectType.ROOT || e.type === StatusEffectType.FREEZE || e.type === StatusEffectType.STUN);
}
