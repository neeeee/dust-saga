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
  BUFF_ATTACK = 'buff_attack',
  BUFF_PHYSICAL_REDUC = 'buff_physical_reduc',
  BUFF_STAT = 'buff_stat',
  BUFF_DODGE = 'buff_dodge',
  BUFF_ACCURACY = 'buff_accuracy',
  BUFF_ATTACK_SPEED = 'buff_attack_speed',
  BUFF_GENERIC = 'buff_generic',
}

export interface SpiValueTier {
  value: number;
  Blessing?: Array<{ value: number; def?: number; dodgeChance?: number }>;
}

export interface BuffEffectTable {
  attackPowerMultiplier?: number;
  def?: number;
  str?: number;
  agi?: number;
  int?: number;
  spi?: number;
  dex?: number;
  sta?: number;
  castTime?: number;
  maxHp?: number;
  mpRegen?: number;
  physicalDamageReduction?: string;
  dodgeChance?: number;
  accuracy?: number;
  attackSpeed?: number;
  spiValues?: SpiValueTier[];
}

export interface BuffData {
  flatStats?: Partial<{ str: number; agi: number; int: number; spi: number; dex: number; sta: number }>;
  flatDefense?: number;
  defenseMultiplier?: number;
  attackMultiplier?: number;
  castTimeReductionPercent?: number;
  maxHpFlat?: number;
  mpRegenFlat?: number;
  physicalDamageReductionPercent?: number;
  dodgeFlat?: number;
  accuracyFlat?: number;
  attackSpeedPercent?: number;
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
  buffData?: BuffData;
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
  [StatusEffectType.BUFF_ATTACK]: { type: StatusEffectType.BUFF_ATTACK, duration: 480000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_PHYSICAL_REDUC]: { type: StatusEffectType.BUFF_PHYSICAL_REDUC, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_STAT]: { type: StatusEffectType.BUFF_STAT, duration: 480000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_DODGE]: { type: StatusEffectType.BUFF_DODGE, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_ACCURACY]: { type: StatusEffectType.BUFF_ACCURACY, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_ATTACK_SPEED]: { type: StatusEffectType.BUFF_ATTACK_SPEED, duration: 480000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
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

export function getEffectiveStats(
  baseStats: { attack: number; defense: number; magicAttack: number; maxHealth: number; maxMana: number; speed: number },
  statPoints: { STR: number; AGI: number; INT: number; SPI: number; DEX: number; STA: number },
  statusEffects: StatusEffect[]
): { attack: number; defense: number; magicAttack: number; maxHealth: number; maxMana: number; speed: number; physicalDamageReduction: number; dodgeBonus: number; accuracyBonus: number; castTimeReduction: number; attackSpeedMultiplier: number } {
  let attack = baseStats.attack;
  let defense = baseStats.defense;
  let magicAttack = baseStats.magicAttack;
  let maxHealth = baseStats.maxHealth;
  let maxMana = baseStats.maxMana;
  let speed = baseStats.speed;
  let physicalDamageReduction = 0;
  let dodgeBonus = 0;
  let accuracyBonus = 0;
  let castTimeReduction = 0;
  let attackSpeedMultiplier = 1.0;

  const bonusSTR = statPoints.STR;
  const bonusAGI = statPoints.AGI;
  const bonusINT = statPoints.INT;
  const bonusSPI = statPoints.SPI;
  const bonusDEX = statPoints.DEX;
  const bonusSTA = statPoints.STA;

  for (const effect of statusEffects) {
    if (effect.type === StatusEffectType.BUFF_ATTACK) {
      attack = Math.floor(attack * effect.potency);
    }
    if (effect.type === StatusEffectType.BUFF_DEFENSE) {
      if (effect.buffData?.flatDefense) {
        defense += effect.buffData.flatDefense;
      }
      if (effect.buffData?.defenseMultiplier) {
        defense = Math.floor(defense * effect.buffData.defenseMultiplier);
      }
    }
    if (effect.type === StatusEffectType.BUFF_MAX_HP) {
      if (effect.buffData?.maxHpFlat) {
        maxHealth += effect.buffData.maxHpFlat;
      }
    }
    if (effect.type === StatusEffectType.BUFF_CAST_SPEED) {
      castTimeReduction += effect.potency;
    }
    if (effect.type === StatusEffectType.BUFF_PHYSICAL_REDUC) {
      physicalDamageReduction += effect.potency;
    }
    if (effect.type === StatusEffectType.BUFF_DODGE) {
      dodgeBonus += effect.potency;
    }
    if (effect.type === StatusEffectType.BUFF_ACCURACY) {
      accuracyBonus += effect.potency;
    }
    if (effect.type === StatusEffectType.BUFF_ATTACK_SPEED) {
      attackSpeedMultiplier *= (1 + effect.potency);
    }
    if (effect.type === StatusEffectType.BUFF_STAT && effect.buffData?.flatStats) {
      const s = effect.buffData.flatStats;
      if (s.str) attack += Math.floor(s.str * 1.5);
      if (s.int) magicAttack += Math.floor(s.int * 1.5);
      if (s.sta) maxHealth += Math.floor(s.sta * 0.8);
      if (s.spi) maxMana += Math.floor(s.spi * 0.8);
      if (s.agi) speed += Math.floor(s.agi * 0.5);
    }
    if (effect.type === StatusEffectType.BUFF_GENERIC && effect.buffData) {
      const bd = effect.buffData;
      if (bd.flatDefense) defense += bd.flatDefense;
      if (bd.defenseMultiplier) defense = Math.floor(defense * bd.defenseMultiplier);
      if (bd.flatStats) {
        const s = bd.flatStats;
        if (s.str) attack += Math.floor(s.str * 1.5);
        if (s.int) magicAttack += Math.floor(s.int * 1.5);
        if (s.sta) maxHealth += Math.floor(s.sta * 0.8);
        if (s.spi) maxMana += Math.floor(s.spi * 0.8);
        if (s.agi) speed += Math.floor(s.agi * 0.5);
      }
      if (bd.physicalDamageReductionPercent) physicalDamageReduction += bd.physicalDamageReductionPercent;
      if (bd.dodgeFlat) dodgeBonus += bd.dodgeFlat;
      if (bd.accuracyFlat) accuracyBonus += bd.accuracyFlat;
      if (bd.castTimeReductionPercent) castTimeReduction += bd.castTimeReductionPercent;
      if (bd.attackSpeedPercent) attackSpeedMultiplier *= (1 + bd.attackSpeedPercent);
    }
  }

  return { attack, defense, magicAttack, maxHealth, maxMana, speed, physicalDamageReduction, dodgeBonus, accuracyBonus, castTimeReduction, attackSpeedMultiplier };
}

export function resolveLapisMediowBuff(
  spiValues: SpiValueTier[],
  casterSpi: number,
  casterBlessing: number
): { def: number } | null {
  const firstTier = spiValues[0];
  if (!firstTier?.Blessing?.length) return null;
  const firstDef = firstTier.Blessing[0].def;
  if (firstDef === undefined) return null;

  let matchedSpiTier: SpiValueTier | null = null;
  for (const tier of spiValues) {
    if (casterSpi >= tier.value) {
      matchedSpiTier = tier;
    } else {
      break;
    }
  }

  if (!matchedSpiTier || !matchedSpiTier.Blessing) return { def: firstDef };

  let matchedBlessing = matchedSpiTier.Blessing[0];
  for (const bt of matchedSpiTier.Blessing) {
    if (casterBlessing >= bt.value) {
      matchedBlessing = bt;
    } else {
      break;
    }
  }

  return { def: matchedBlessing.def ?? firstDef };
}

export function resolveGreenSongBuff(
  spiValues: SpiValueTier[],
  casterSpi: number,
  casterBlessing: number
): { dodgeChance: number } | null {
  const firstTier = spiValues[0];
  if (!firstTier?.Blessing?.length) return null;
  const firstDodge = firstTier.Blessing[0].dodgeChance;
  if (firstDodge === undefined) return null;

  let matchedSpiTier: SpiValueTier | null = null;
  for (const tier of spiValues) {
    if (casterSpi >= tier.value) {
      matchedSpiTier = tier;
    } else {
      break;
    }
  }

  if (!matchedSpiTier || !matchedSpiTier.Blessing) return { dodgeChance: firstDodge };

  let matchedBlessing = firstTier.Blessing[0];
  for (const bt of matchedSpiTier.Blessing) {
    if (casterBlessing >= bt.value) {
      matchedBlessing = bt;
    } else {
      break;
    }
  }

  return { dodgeChance: matchedBlessing.dodgeChance ?? firstDodge };
}
