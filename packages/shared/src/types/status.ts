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
  BUFF_MOVE_SPEED = 'buff_move_speed',
  BUFF_GENERIC = 'buff_generic',
  SEVERE_POISON = 'severe_poison',
  MP_DRAIN = 'mp_drain',
  DEBUFF_DAMAGE_DOWN = 'debuff_damage_down',
  DEBUFF_DEFENSE_DOWN = 'debuff_defense_down',
  DEBUFF_SPEED_DOWN = 'debuff_speed_down',
  DEBUFF_ACCURACY_DOWN = 'debuff_accuracy_down',
  DEBUFF_DODGE_DOWN = 'debuff_dodge_down',
  DEBUFF_CAST_SPEED_DOWN = 'debuff_cast_speed_down',
  DEBUFF_DAMAGE_TAKEN_UP = 'debuff_damage_taken_up',
  WEAPON_AURA = 'weapon_aura',
  BUFF_RESIST = 'buff_resist',
  BUFF_CRIT_RESIST = 'buff_crit_resist',
  BUFF_CRIT_DAMAGE_REDUCE = 'buff_crit_damage_reduce',
  BUFF_AURA_DAMAGE_REDUCE = 'buff_aura_damage_reduce',
  BUFF_MANA_SHIELD = 'buff_mana_shield',
  BUFF_SPELL_INTERRUPT_RESIST = 'buff_spell_interrupt_resist',
  BUFF_DEBUFF_RESIST = 'buff_debuff_resist',
  BUFF_DAMAGE_REDIRECT = 'buff_damage_redirect',
  BUFF_BLOCK_CHANCE = 'buff_block_chance',
  BUFF_BLOCKING_STANCE = 'buff_blocking_stance',
  BUFF_CONSUMABLE_ON_ATTACK = 'buff_consumable_on_attack',
  SONG_ACTIVE = 'song_active',
  SONG_GREEN = 'song_green',
  SONG_BLUE = 'song_blue',
  SONG_YELLOW = 'song_yellow',
  SONG_RED = 'song_red',
  FEAR = 'fear',
  CURSE = 'curse',
  PREVENT_FIELD_SPELLS = 'prevent_field_spells',
  PREVENT_RESSURECT = 'prevent_resurrect',
  MP_DAMAGE_DEBUFF = 'mp_damage_debuff',
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
  moveSpeed?: number;
  critResist?: number;
  critDamageReduce?: number;
  auraDamageReduce?: number;
  manaShield?: boolean;
  spellInterruptResist?: number;
  debuffResist?: number;
  damageRedirect?: { targetId: string };
  blockChance?: number;
  consumableOnAttack?: boolean;
  cooldownReduction?: number;
  magicalDamageBonus?: number;
  damageNegation?: { base: number; spiScale: number; proficiencyCap: number; proficiencyStat: string };
  dodgeReduction?: number;
  accuracyBonus?: number;
  healingOverTime?: { base: number; spiScale: number; proficiencyStat: string };
  partyHeal?: number;
  healPercent?: number;
  mpDamage?: number;
  mpDamageAOE?: boolean;
  attackPowerMultiplierProficiency?: { baseStat: string; perProficiency: number; proficiencyStat: string };
  fear?: boolean;
  fearAOE?: boolean;
  songType?: 'green' | 'blue' | 'yellow' | 'red';
  delayExplosion?: { minSeconds: number; maxSeconds: number };
  preventResurrect?: boolean;
  preventFieldSpells?: boolean;
  consumableItem?: { itemId: string; quantity: number };
  createItems?: Array<{ itemId: string; quantity: number; consumeItems?: Array<{ itemId: string; quantity: number }> }>;
  sacrificeHeal?: boolean;
  dispelBuff?: boolean;
  dispelDebuff?: boolean;
  revealInvisible?: boolean;
  summonObject?: { objectType: string; duration: number; hp?: number; defense?: number; aoeDamage?: number };
  banishObject?: boolean;
  negateFieldSpells?: boolean;
  fieldSpellNegationRadius?: number;
  blockingStance?: boolean;
  blockingRange?: number;
  shieldCharge?: boolean;
  defensiveMarch?: boolean;
  skillDisableAOE?: boolean;
  damageVsLowDefense?: boolean;
  songRadius?: number;
  songCooldownReduction?: number;
  songMagicalDamageBonus?: number;
  songDamageNegation?: { base: number; spiScale: number; proficiencyCap: number };
  spiValues?: SpiValueTier[];
  weaponAura?: {
    element: string;
    spiTiers?: Array<{ spi: number; min: number; max: number }>;
    formula?: 'toxify';
  };
  resistMods?: Record<string, number>;
}

export interface BuffData {
  flatStats?: Partial<{ str: number; agi: number; int: number; spi: number; dex: number; sta: number }>;
  flatDefense?: number;
  defenseMultiplier?: number;
  attackMultiplier?: number;
  castTimeReductionPercent?: number;
  maxHpFlat?: number;
  maxHpPercent?: number;
  mpRegenFlat?: number;
  physicalDamageReductionPercent?: number;
  dodgeFlat?: number;
  accuracyFlat?: number;
  attackSpeedPercent?: number;
  moveSpeedFlat?: number;
  moveSpeedMultiplier?: number;
  weaponAura?: { element: string; minDamage: number; maxDamage: number };
  resistMods?: Record<string, number>;
  critResistPercent?: number;
  critDamageReducePercent?: number;
  auraDamageReducePercent?: number;
  manaShield?: boolean;
  spellInterruptResistPercent?: number;
  debuffResistPercent?: number;
  damageRedirectTargetId?: string;
  blockChancePercent?: number;
  consumableOnAttack?: boolean;
  cooldownReductionPercent?: number;
  magicalDamageBonusPercent?: number;
  dodgeReductionFlat?: number;
  accuracyBonusFlat?: number;
  healOverTime?: { hpPerTick: number; tickInterval: number };
  fear?: boolean;
  delayExplosion?: { minMs: number; maxMs: number };
  preventResurrect?: boolean;
  preventFieldSpells?: boolean;
  blockingStance?: boolean;
  blockingRange?: number;
  defensiveMarch?: boolean;
  shieldCharge?: boolean;
  songType?: 'green' | 'blue' | 'yellow' | 'red';
  songRadius?: number;
  damageNegation?: { base: number; spiScale: number; proficiencyCap: number };
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
  dotMpDrain?: number;
  dotHPPercent?: number;
  consumable?: boolean;
  debuffCategory?: 'ailment' | 'disorder' | 'stun' | 'trip' | 'freeze' | 'burn' | 'curse' | 'bleed' | 'sleep' | 'weakness' | 'weaken' | 'knockdown' | 'knockback';
  exclusiveGroup?: string;
  mpDamageDirect?: number;
  summonObjectId?: string;
  summonObjectType?: string;
  delayExplosionAt?: number;
  delayExplosionTargetId?: string;
  preventResurrect?: boolean;
  preventFieldSpells?: boolean;
  fearDirection?: { x: number; y: number; z: number };
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
  [StatusEffectType.SILENCE]: { type: StatusEffectType.SILENCE, duration: 5000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
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
  [StatusEffectType.SEVERE_POISON]: { type: StatusEffectType.SEVERE_POISON, duration: 30000, tickInterval: 3000, potency: 0, isDoT: true, isCC: false },
  [StatusEffectType.MP_DRAIN]: { type: StatusEffectType.MP_DRAIN, duration: 30000, tickInterval: 3000, potency: 0, isDoT: true, isCC: false },
  [StatusEffectType.DEBUFF_DAMAGE_DOWN]: { type: StatusEffectType.DEBUFF_DAMAGE_DOWN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.DEBUFF_DEFENSE_DOWN]: { type: StatusEffectType.DEBUFF_DEFENSE_DOWN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.DEBUFF_SPEED_DOWN]: { type: StatusEffectType.DEBUFF_SPEED_DOWN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.DEBUFF_ACCURACY_DOWN]: { type: StatusEffectType.DEBUFF_ACCURACY_DOWN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.DEBUFF_DODGE_DOWN]: { type: StatusEffectType.DEBUFF_DODGE_DOWN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.DEBUFF_CAST_SPEED_DOWN]: { type: StatusEffectType.DEBUFF_CAST_SPEED_DOWN, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.DEBUFF_DAMAGE_TAKEN_UP]: { type: StatusEffectType.DEBUFF_DAMAGE_TAKEN_UP, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.WEAPON_AURA]: { type: StatusEffectType.WEAPON_AURA, duration: 480000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_RESIST]: { type: StatusEffectType.BUFF_RESIST, duration: 30000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_CRIT_RESIST]: { type: StatusEffectType.BUFF_CRIT_RESIST, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_CRIT_DAMAGE_REDUCE]: { type: StatusEffectType.BUFF_CRIT_DAMAGE_REDUCE, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_AURA_DAMAGE_REDUCE]: { type: StatusEffectType.BUFF_AURA_DAMAGE_REDUCE, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_MANA_SHIELD]: { type: StatusEffectType.BUFF_MANA_SHIELD, duration: 999999999, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_SPELL_INTERRUPT_RESIST]: { type: StatusEffectType.BUFF_SPELL_INTERRUPT_RESIST, duration: 80000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_DEBUFF_RESIST]: { type: StatusEffectType.BUFF_DEBUFF_RESIST, duration: 15000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_DAMAGE_REDIRECT]: { type: StatusEffectType.BUFF_DAMAGE_REDIRECT, duration: 300000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_BLOCK_CHANCE]: { type: StatusEffectType.BUFF_BLOCK_CHANCE, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_BLOCKING_STANCE]: { type: StatusEffectType.BUFF_BLOCKING_STANCE, duration: 999999999, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_CONSUMABLE_ON_ATTACK]: { type: StatusEffectType.BUFF_CONSUMABLE_ON_ATTACK, duration: 120000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.BUFF_MOVE_SPEED]: { type: StatusEffectType.BUFF_MOVE_SPEED, duration: 2000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.SONG_GREEN]: { type: StatusEffectType.SONG_GREEN, duration: 999999999, tickInterval: 3000, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.SONG_BLUE]: { type: StatusEffectType.SONG_BLUE, duration: 999999999, tickInterval: 3000, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.SONG_YELLOW]: { type: StatusEffectType.SONG_YELLOW, duration: 999999999, tickInterval: 3000, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.SONG_RED]: { type: StatusEffectType.SONG_RED, duration: 999999999, tickInterval: 3000, potency: 0, isDoT: false, isCC: true },
  [StatusEffectType.SONG_ACTIVE]: { type: StatusEffectType.SONG_ACTIVE, duration: 999999999, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.FEAR]: { type: StatusEffectType.FEAR, duration: 5000, tickInterval: 0, potency: 0, isDoT: true, isCC: true },
  [StatusEffectType.CURSE]: { type: StatusEffectType.CURSE, duration: 60000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.PREVENT_FIELD_SPELLS]: { type: StatusEffectType.PREVENT_FIELD_SPELLS, duration: 60000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.PREVENT_RESSURECT]: { type: StatusEffectType.PREVENT_RESSURECT, duration: 60000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
  [StatusEffectType.MP_DAMAGE_DEBUFF]: { type: StatusEffectType.MP_DAMAGE_DEBUFF, duration: 10000, tickInterval: 0, potency: 0, isDoT: false, isCC: false },
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
): { attack: number; defense: number; magicAttack: number; maxHealth: number; maxMana: number; speed: number; physicalDamageReduction: number; dodgeBonus: number; accuracyBonus: number; castTimeReduction: number; attackSpeedMultiplier: number; damageTakenMultiplier: number; castSpeedPenalty: number } {
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
  let damageTakenMultiplier = 1.0;
  let castSpeedPenalty = 0;

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
      if (effect.buffData?.maxHpPercent) {
        maxHealth += Math.floor(baseStats.maxHealth * effect.buffData.maxHpPercent);
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

  for (const effect of statusEffects) {
    if (effect.type === StatusEffectType.DEBUFF_DAMAGE_DOWN) {
      const reduction = effect.potency || 0;
      attack = Math.floor(attack * (1 - reduction));
    }
    if (effect.type === StatusEffectType.DEBUFF_DEFENSE_DOWN) {
      const reduction = effect.potency || 0;
      defense = Math.floor(defense * (1 - reduction));
    }
    if (effect.type === StatusEffectType.DEBUFF_SPEED_DOWN) {
      const reduction = effect.potency || 0;
      speed = Math.floor(speed * (1 - reduction));
    }
    if (effect.type === StatusEffectType.DEBUFF_ACCURACY_DOWN) {
      const reduction = effect.potency || 0;
      accuracyBonus -= Math.floor(100 * reduction);
    }
    if (effect.type === StatusEffectType.DEBUFF_DODGE_DOWN) {
      const reduction = effect.potency || 0;
      dodgeBonus = Math.floor(dodgeBonus * (1 - reduction));
    }
    if (effect.type === StatusEffectType.DEBUFF_CAST_SPEED_DOWN) {
      const penalty = effect.potency || 0;
      castSpeedPenalty += penalty;
    }
    if (effect.type === StatusEffectType.DEBUFF_DAMAGE_TAKEN_UP) {
      const increase = effect.potency || 0;
      damageTakenMultiplier *= (1 + increase);
    }
  }

  return { attack, defense, magicAttack, maxHealth, maxMana, speed, physicalDamageReduction, dodgeBonus, accuracyBonus, castTimeReduction, attackSpeedMultiplier, damageTakenMultiplier, castSpeedPenalty };
}

export interface EnhancementBonus {
  attack: number;
  defense: number;
  health: number;
  magicAttackPercent: number;
  dodge: number;
}

export interface StatBonusBreakdown {
  gear: { STA: number; STR: number; AGI: number; DEX: number; SPI: number; INT: number };
  buffs: { STA: number; STR: number; AGI: number; DEX: number; SPI: number; INT: number };
  gearCombat?: {
    accuracy: number;
    dodge: number;
    attackSpeed: number;
    fireResist: number;
    iceResist: number;
    lightningResist: number;
    poisonResist: number;
    darkResist: number;
    holyResist: number;
    ailmentResist: number;
    disorderResist: number;
    stunResist: number;
    tripResist: number;
    freezeResist: number;
    burnResist: number;
    curseResist: number;
    bleedResist: number;
    sleepResist: number;
    weaknessResist: number;
    weakenResist: number;
    knockdownResist: number;
    knockbackResist: number;
  };
  enhancement?: EnhancementBonus;
  totalAccuracy?: number;
  totalDodge?: number;
  totalAilmentResist?: number;
  totalDisorderResist?: number;
}

export function computeStatBreakdown(
  statPoints: { STA: number; STR: number; AGI: number; DEX: number; SPI: number; INT: number },
  statusEffects: StatusEffect[],
  gearBonuses: { STA: number; STR: number; AGI: number; DEX: number; SPI: number; INT: number },
  gearCombat?: { accuracy: number; dodge: number; attackSpeed: number; fireResist: number; iceResist: number; lightningResist: number; poisonResist: number; darkResist: number; holyResist: number; ailmentResist: number; disorderResist: number; stunResist: number; tripResist: number; freezeResist: number; burnResist: number; curseResist: number; bleedResist: number; sleepResist: number; weaknessResist: number; weakenResist: number; knockdownResist: number; knockbackResist: number }
): StatBonusBreakdown {
  const buffs = { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };

  for (const effect of statusEffects) {
    const bd = effect.buffData;
    if (!bd?.flatStats) continue;
    if (bd.flatStats.sta) buffs.STA += bd.flatStats.sta;
    if (bd.flatStats.str) buffs.STR += bd.flatStats.str;
    if (bd.flatStats.agi) buffs.AGI += bd.flatStats.agi;
    if (bd.flatStats.spi) buffs.SPI += bd.flatStats.spi;
    if (bd.flatStats.int) buffs.INT += bd.flatStats.int;
    if (bd.flatStats.dex) buffs.DEX += bd.flatStats.dex;
  }

  return { gear: { ...gearBonuses }, buffs, gearCombat: gearCombat || undefined };
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
