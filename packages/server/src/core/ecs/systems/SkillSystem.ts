import {
  PlayerSession, SkillDefinition, SkillCooldownEntry, ActiveCast,
  isPassiveSkill, meetsRequirements, getRequiredProficiency,
  COMBAT_CONFIG, StatusEffect, StatusEffectType, STATUS_EFFECT_DEFS,
  SKILL_TARGET_RULES, SkillTargetType,
  BuffData, resolveLapisMediowBuff, resolveGreenSongBuff,
  getEffectiveStats,
  recalculateCategoryTotals, calculateProficiencyGain, ProficiencyGainResult,
} from '@dust-saga/shared';
import { CLASS_SKILL_DATA } from '@dust-saga/shared';
import { CLASS_SPECIFIC_SKILLS, getClassSpecificSkillsForJob } from '@dust-saga/shared';

const SKILL_TO_SUBCATEGORY: Record<string, string> = {};
for (const category of Object.values(CLASS_SKILL_DATA)) {
  for (const subSkill of category.skills) {
    for (const skillName of Object.keys(subSkill.skills)) {
      SKILL_TO_SUBCATEGORY[skillName] = subSkill.name;
    }
  }
}

export interface TargetStats {
  defense: number;
  magicDefense: number;
  health: number;
  level: number;
  dodge: number;
}

export interface SkillUseResult {
  success: boolean;
  damage?: number;
  healing?: number;
  mpRestored?: number;
  maxHpIncrease?: number;
  isCritical?: boolean;
  missed?: boolean;
  damageType?: 'physical' | 'magical';
  statusEffects?: StatusEffect[];
  error?: string;
}

interface SkillClassification {
  dealsDamage: boolean;
  heals: boolean;
  restoresMp: boolean;
  drainsLife: boolean;
  increasesMaxHp: boolean;
  damageType: 'physical' | 'magical';
}

export class SkillSystem {
  private gcd: number = 1000;
  private globalCooldowns: Map<string, number> = new Map();
  lastBuffDebug: string | undefined;
  lastProficiencyGain: ProficiencyGainResult | undefined;

  gainProficiency(session: PlayerSession, skillName: string): ProficiencyGainResult | null {
    const subCategory = SKILL_TO_SUBCATEGORY[skillName];
    if (!subCategory) return null;

    const skill = this.findSkillDefinition(skillName);
    if (!skill) return null;

    const cap = session.skillProficiencies[subCategory] || 0;
    const current = session.skillAdeptness[subCategory] || 0;
    const hasCastTime = (skill.castTime || 0) > 0.1;

    const result = calculateProficiencyGain(current, cap, hasCastTime);
    if (!result) return null;

    session.skillAdeptness[subCategory] = result.newAdeptness;
    recalculateCategoryTotals(session.skillAdeptness);

    result.subCategory = subCategory;
    this.lastProficiencyGain = result;
    return result;
  }

  private classifySkill(skill: SkillDefinition): SkillClassification {
    const desc = skill.description.toLowerCase();
    const name = skill.name.toLowerCase();

    if (skill.isPassive || name.includes('(passive)')) {
      return { dealsDamage: false, heals: false, restoresMp: false, drainsLife: false, increasesMaxHp: false, damageType: 'physical' };
    }

    const restoresMp = /mp regen|restore mp|mana restore|increase mp|mp over time/i.test(desc)
      || name === 'tranquil mind' || name === 'mana restore';

    const increasesMaxHp = /increase lp|lp for|increase.*max.*hp|\+.*base lp|lp regen/i.test(desc);

    const heals = /restore hp|heal|first aid|regenerat|sacrifice self|healing aura|restoration/i.test(desc)
      || (desc.includes('restore') && desc.includes('hp'));

    const drainsLife = desc.includes('drain life') || (desc.includes('drain') && desc.includes('heal'));

    const damageWords = [
      'attack', 'damage', 'strike', 'hit', 'slash', 'thrust', 'cleave',
      'bash', 'stab', 'shoot', 'throw', 'hurl', 'explod', 'drain life',
      'skewer', 'slice', 'blast', 'bomb', 'bolt', 'beam', 'storm',
      'tempest', 'cremation', 'crash', 'smash', 'crush', 'knockback',
      'knockdown', 'trip', 'impale', 'ranged attack', 'deal ', 'dealing',
      'fire a bolt', 'rain holy', 'rain ', 'damage lp', 'damage mp',
      'poison the', 'burn ', 'wasteland', 'genocide', 'pure arrow',
      'psychic blade', 'dark frenzy', 'skewer', 'sins genocide',
      'ramkyado', 'dagger throw', 'backstab', 'pierce armor',
    ];

    const dealsDamage = !heals && !restoresMp && skill.mpCost > 0
      && (damageWords.some(w => desc.includes(w) || name.includes(w))
        || skill.damageType === 'magical'
        || skill.damageType === 'physical');

    const magicWords = [
      'magic', 'ice ', 'fire', 'lightning', 'dark ', 'holy', 'elemental',
      'spell', 'arcane', 'shadow', 'psionic', 'mental', 'mind venom',
      'darkness', 'abyss', 'meteor', 'thunder', 'cremation', 'holy rays',
      'delay bomb', 'mind venom', 'pestilence', 'wasteland', 'siren storm',
      'cursed bolt', 'twinkle extreme', 'ice spear', 'ice storm',
      'firestorm', 'dark frenzy', 'thunder ball', 'thunderstorm',
      'hailstone', 'ice tempest', 'glitter discharge', 'sandstorm',
    ];

    const isMagical = skill.damageType === 'magical'
      || magicWords.some(w => desc.includes(w) || name.includes(w));

    return { dealsDamage, heals, restoresMp, drainsLife, increasesMaxHp, damageType: isMagical ? 'magical' : 'physical' };
  }

  canUseSkill(
    session: PlayerSession,
    skillName: string,
    targetId: string | null
  ): { canUse: boolean; error?: string } {
    if (session.stats.health <= 0) {
      return { canUse: false, error: 'dead' };
    }

    if (session.activeCast) {
      return { canUse: false, error: 'casting' };
    }

    const now = Date.now();
    const gcdReady = this.globalCooldowns.get(session.characterId) || 0;
    if (now < gcdReady) {
      return { canUse: false, error: 'gcd' };
    }

    const cooldown = session.skillCooldowns?.find(
      c => c.skillName === skillName && now < c.readyAt
    );
    if (cooldown) {
      return { canUse: false, error: 'cooldown' };
    }

    const skill = this.findSkillDefinition(skillName);
    if (!skill) {
      return { canUse: false, error: 'not_found' };
    }

    if (isPassiveSkill(skill)) {
      return { canUse: false, error: 'passive' };
    }

    if (session.stats.mana < skill.mpCost) {
      return { canUse: false, error: 'no_mana' };
    }

    if (session.statusEffects?.some(e => e.type === StatusEffectType.SILENCE && skill.mpCost > 0)) {
      return { canUse: false, error: 'silenced' };
    }

    if (session.statusEffects?.some(e =>
      e.type === StatusEffectType.STUN ||
      e.type === StatusEffectType.SLEEP ||
      e.type === StatusEffectType.FREEZE
    )) {
      return { canUse: false, error: 'cc' };
    }

    const targetType = SKILL_TARGET_RULES[skillName];
    if (targetType) {
      if (targetType === SkillTargetType.SELF) {
        if (targetId !== null && targetId !== session.characterId) {
          return { canUse: false, error: 'self_only' };
        }
      } else if (targetType === SkillTargetType.OTHER_ONLY) {
        if (!targetId || targetId === session.characterId) {
          return { canUse: false, error: 'no_self_target' };
        }
      }
    }

    return { canUse: true };
  }

  beginCast(
    session: PlayerSession,
    skillName: string,
    targetId: string | null,
    aoePosition?: { x: number; y: number; z: number }
  ): { started: boolean; castTime: number } {
    const skill = this.findSkillDefinition(skillName);
    if (!skill) return { started: false, castTime: 0 };

    const baseCastTime = skill.castTime * 1000;
    if (baseCastTime <= 0) {
      return { started: true, castTime: 0 };
    }

    const castSpd = 100 + Math.floor(session.statPoints.DEX / 10) * 5;

    const effective = getEffectiveStats(
      session.stats,
      session.statPoints,
      session.statusEffects || []
    );
    const castTimeMultiplier = Math.max(0, 100 - effective.castTimeReduction * 100);

    const effectiveCastTime = Math.max(0, Math.floor(baseCastTime * (100 / castSpd) * (castTimeMultiplier / 100)));

    if (effectiveCastTime <= 0) {
      return { started: true, castTime: 0 };
    }

    session.activeCast = {
      skillName,
      startedAt: Date.now(),
      castTime: effectiveCastTime,
      targetId,
      aoePosition
    };

    return { started: true, castTime: effectiveCastTime };
  }

  executeSkill(
    session: PlayerSession,
    skillName: string,
    targetId: string | null,
    getTargetStats: (id: string) => TargetStats | null
  ): SkillUseResult {
    const skill = this.findSkillDefinition(skillName);
    if (!skill) return { success: false, error: 'not_found' };

    session.stats.mana -= skill.mpCost;

    const now = Date.now();
    if (!session.skillCooldowns) session.skillCooldowns = [];
    const cooldownMultiplier = Math.max(0, 100 - Math.floor(session.statPoints.INT / 10) * 2) / 100;
    const effectiveCooldown = Math.floor(skill.cooldown * 1000 * cooldownMultiplier);
    session.skillCooldowns.push({
      skillName,
      readyAt: now + effectiveCooldown
    });

    this.globalCooldowns.set(session.characterId, now + this.gcd);
    session.activeCast = null;

    this.gainProficiency(session, skillName);

    if (skill.duration > 0 && !isPassiveSkill(skill)) {
      const targetType = SKILL_TARGET_RULES[skillName];
      if (!targetType || targetType === SkillTargetType.SELF) {
        this.applyBuff(session, skill);
      } else if (targetType === SkillTargetType.PARTY) {
        this.applyBuff(session, skill);
      } else if (
        targetType === SkillTargetType.SELF_OR_TARGET
        && (!targetId || targetId === session.characterId)
      ) {
        this.applyBuff(session, skill);
      }
    }

    const classification = this.classifySkill(skill);

    if (classification.restoresMp) {
      const mpAmount = this.calculateMpRegen(session, skill);
      session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + mpAmount);
      return { success: true, mpRestored: mpAmount };
    }

    if (classification.heals && !classification.dealsDamage) {
      const healAmount = this.calculateHealing(session, skill);
      return { success: true, healing: healAmount };
    }

    if (classification.increasesMaxHp && (!targetId || targetId === session.characterId)) {
      const hpIncrease = this.calculateMaxHpBuff(session, skill);
      const healthRatio = session.stats.maxHealth > 0 ? session.stats.health / session.stats.maxHealth : 1;
      session.stats.maxHealth += hpIncrease;
      session.stats.health = Math.min(session.stats.maxHealth, Math.floor(session.stats.maxHealth * healthRatio) + hpIncrease);
      return { success: true, maxHpIncrease: hpIncrease, healing: hpIncrease };
    }

    if (classification.dealsDamage && targetId) {
      const target = getTargetStats(targetId);
      if (target) {
        const result = this.calculateSkillDamage(session, skill, target, classification.damageType);
        if (classification.drainsLife && result.damage && result.damage > 0 && !result.missed) {
          const drainHeal = Math.floor(result.damage * 0.3);
          return { ...result, healing: drainHeal };
        }
        return result;
      }
    }

    return { success: true };
  }

  calculateAOEDamage(
    session: PlayerSession,
    skillName: string,
    targetId: string,
    getTargetStats: (id: string) => TargetStats | null
  ): SkillUseResult {
    const skill = this.findSkillDefinition(skillName);
    if (!skill) return { success: false, error: 'not_found' };

    const classification = this.classifySkill(skill);
    if (!classification.dealsDamage) return { success: true };

    const target = getTargetStats(targetId);
    if (!target) return { success: true, missed: true };

    return this.calculateSkillDamageInternal(session, skill, target, classification.damageType);
  }

  private calculateSkillDamage(
    session: PlayerSession,
    skill: SkillDefinition,
    target: TargetStats,
    damageType: 'physical' | 'magical'
  ): SkillUseResult {
    return this.calculateSkillDamageInternal(session, skill, target, damageType);
  }

  private calculateSkillDamageInternal(
    session: PlayerSession,
    skill: SkillDefinition,
    target: TargetStats,
    damageType: 'physical' | 'magical'
  ): SkillUseResult {
    const isMagical = damageType === 'magical';

    const hitChance = this.calculateAccuracy(session, target);
    if (Math.random() > hitChance) {
      return { success: true, damage: 0, missed: true, damageType };
    }

    const effective = getEffectiveStats(
      session.stats,
      session.statPoints,
      session.statusEffects || []
    );
    let attackStat = isMagical ? effective.magicAttack : effective.attack;
    const attackBuff = session.statusEffects?.find(e => e.type === StatusEffectType.BUFF_ATTACK);
    if (attackBuff && !isMagical) {
      attackStat = Math.floor(attackStat * attackBuff.potency);
    }
    const defenseStat = isMagical ? target.magicDefense : target.defense;
    const primaryStat = isMagical ? session.statPoints.INT : session.statPoints.STR;
    const secondaryStat = isMagical ? session.statPoints.SPI : session.statPoints.DEX;

    const skillPower = 1.0 + (skill.mpCost / 50);

    let damage = Math.floor(
      (attackStat * 1.5 + primaryStat * 1.0 + secondaryStat * 0.3) * skillPower
      - defenseStat * 0.6
    );

    if (!isMagical && effective.physicalDamageReduction > 0) {
      damage = Math.floor(damage * (1 - Math.min(0.9, effective.physicalDamageReduction)));
    }

    const critChance = COMBAT_CONFIG.CRITICAL_CHANCE + session.statPoints.DEX * 0.002;
    const isCritical = Math.random() < critChance;
    if (isCritical) {
      damage = Math.floor(damage * COMBAT_CONFIG.CRITICAL_MULTIPLIER);
    }

    const levelDiff = session.stats.level - target.level;
    if (levelDiff > 0) {
      damage = Math.floor(damage * (1 + levelDiff * 0.03));
    } else if (levelDiff < 0) {
      damage = Math.floor(damage * Math.max(0.3, 1 + levelDiff * 0.02));
    }

    damage = Math.floor(damage * (0.9 + Math.random() * 0.2));
    damage = Math.max(COMBAT_CONFIG.MIN_DAMAGE, damage);

    const statusEffects = this.buildStatusEffects(session, skill, damage);

    return {
      success: true,
      damage,
      isCritical,
      damageType,
      statusEffects: statusEffects.length > 0 ? statusEffects : undefined
    };
  }

  private buildStatusEffects(session: PlayerSession, skill: SkillDefinition, damage: number): StatusEffect[] {
    const desc = skill.description.toLowerCase();
    const effects: StatusEffect[] = [];

    const addEffect = (type: StatusEffectType, potency: number) => {
      const def = STATUS_EFFECT_DEFS[type];
      if (def) {
        effects.push({
          id: `se_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type,
          sourceId: session.characterId,
          targetId: '',
          potency,
          appliedAt: Date.now(),
          duration: def.duration,
          tickInterval: def.tickInterval,
          lastTickAt: Date.now(),
          stacks: 1
        });
      }
    };

    if (desc.includes('poison')) addEffect(StatusEffectType.POISON, Math.floor(damage * 0.1));
    if (desc.includes('burn') || desc.includes('flaming')) addEffect(StatusEffectType.BURN, Math.floor(damage * 0.15));
    if (desc.includes('bleed')) addEffect(StatusEffectType.BLEED, Math.floor(damage * 0.08));
    if (desc.includes('stun') || desc.includes('knockdown') || desc.includes('knock out') || desc.includes('trip')) addEffect(StatusEffectType.STUN, 0);
    if (desc.includes('freeze') || desc.includes('frozen')) addEffect(StatusEffectType.FREEZE, 0.5);
    if (desc.includes('sleep') || (desc.includes('sandstorm') && desc.includes('sleep'))) addEffect(StatusEffectType.SLEEP, 0);
    if (desc.includes('root') || desc.includes('tangled') || (desc.includes('bind') && !desc.includes('bind criminal'))) addEffect(StatusEffectType.ROOT, 0);
    if (desc.includes('silence')) addEffect(StatusEffectType.SILENCE, 0);
    if (desc.includes('slow') && !desc.includes('freeze') && !desc.includes('frozen')) addEffect(StatusEffectType.SLOW, 0.3);

    return effects;
  }

  private calculateAccuracy(session: PlayerSession, target: TargetStats): number {
    const base = 0.85;
    const dexBonus = session.statPoints.DEX * 0.003;
    const levelBonus = (session.stats.level - target.level) * 0.015;
    const dodgePenalty = target.dodge * 0.002;
    return Math.min(0.99, Math.max(0.2, base + dexBonus + levelBonus - dodgePenalty));
  }

  private calculateHealing(session: PlayerSession, skill: SkillDefinition): number {
    const spi = session.statPoints.SPI;
    const int = session.statPoints.INT;
    const level = session.stats.level;
    const proficiencies = session.skillProficiencies || {};
    const grace = proficiencies['Grace'] || 0;
    const prayer = proficiencies['Grace'] || 0;
    const name = skill.name.toLowerCase();

    if (name === 'first aid') {
      return Math.floor(25 + (level * 2.5) + (prayer * 1.4) + int);
    }
    if (name === 'heal') {
      return Math.floor(50 + (level * 2) + (prayer * 3) + (int * 6));
    }
    if (name === 'regenerate' || name === 'restoration') {
      return Math.floor(15 + (spi / 10) + (prayer / 10));
    }

    const multiplier = 1.0 + (skill.mpCost / 30);
    return Math.floor((spi * 2.0 + int * 1.0 + level * 2) * multiplier);
  }

  private calculateMpRegen(session: PlayerSession, skill: SkillDefinition): number {
    const spi = session.statPoints.SPI;
    const level = session.stats.level;
    const multiplier = 1.0 + (skill.mpCost / 15);
    return Math.floor((spi * 1.5 + level * 1.5) * multiplier);
  }

  calculateMaxHpBuff(session: PlayerSession, skill: SkillDefinition): number {
    const desc = skill.description.toLowerCase();
    const baseHp = session.stats.maxHealth;
    let increase = 0;

    const percentMatch = desc.match(/(\d+)%.*(?:base lp|lp|hp)/);
    const flatMatch = desc.match(/\+\s*(\d+)/);

    if (percentMatch) {
      increase += Math.floor(baseHp * (parseInt(percentMatch[1]) / 100));
    }
    if (flatMatch) {
      increase += parseInt(flatMatch[1]);
    }

    if (increase === 0) {
      increase = Math.floor(baseHp * 0.1 + session.stats.level * 5);
    }

    return increase;
  }

  private applyBuff(session: PlayerSession, skill: SkillDefinition): void {
    this.applyBuffToTarget(session, session.characterId, skill, session);
  }

  applyBuffToTarget(
    target: PlayerSession,
    sourceId: string,
    skill: SkillDefinition,
    casterSession?: PlayerSession | null
  ): void {
    const now = Date.now();
    const duration = (skill.duration || 300) * 1000;
    const bt = skill.buffEffectTable;

    const effects: StatusEffect[] = [];
    const pushEffect = (type: StatusEffectType, potency: number, buffData?: BuffData) => {
      target.statusEffects = target.statusEffects.filter(e => !(e.skillName === skill.name && e.type === type));
      effects.push({
        id: `buff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${type}`,
        type,
        sourceId,
        targetId: target.characterId,
        potency,
        appliedAt: now,
        duration,
        tickInterval: 0,
        lastTickAt: now,
        stacks: 1,
        skillName: skill.name,
        buffData,
      });
    };

    if (!bt) {
      if (effects.length === 0) {
        const desc = skill.description.toLowerCase();
        let effectType = StatusEffectType.BUFF_GENERIC;
        if (desc.includes('defense')) effectType = StatusEffectType.BUFF_DEFENSE;
        pushEffect(effectType, 0);
      }
      target.statusEffects.push(...effects);
      return;
    }

    if (bt.attackPowerMultiplier) {
      pushEffect(StatusEffectType.BUFF_ATTACK, bt.attackPowerMultiplier);
    }

    if (bt.def) {
      pushEffect(StatusEffectType.BUFF_DEFENSE, 0, { flatDefense: bt.def });
    }

    if (bt.str || bt.agi || bt.int || bt.spi || bt.dex || bt.sta) {
      pushEffect(StatusEffectType.BUFF_STAT, 0, {
        flatStats: {
          str: bt.str || 0,
          agi: bt.agi || 0,
          int: bt.int || 0,
          spi: bt.spi || 0,
          dex: bt.dex || 0,
          sta: bt.sta || 0,
        },
      });
    }

    if (bt.castTime) {
      const reduction = Math.abs(bt.castTime) / 100;
      pushEffect(StatusEffectType.BUFF_CAST_SPEED, reduction);
    }

    if (bt.maxHp) {
      pushEffect(StatusEffectType.BUFF_MAX_HP, 0, { maxHpFlat: bt.maxHp });
    }

    if (bt.mpRegen) {
      pushEffect(StatusEffectType.BUFF_MP_REGEN, bt.mpRegen);
    }

    if (bt.physicalDamageReduction) {
      let reductionPercent = 0;
      if (bt.physicalDamageReduction.startsWith('formula:')) {
        const formula = bt.physicalDamageReduction.replace('formula:', '');
        const blessing = casterSession
          ? (casterSession.skillAdeptness?.['Blessing'] || 0)
          : (target.skillAdeptness?.['Blessing'] || 0);
        const expr = formula
          .replace(/blessing/g, String(blessing));
        try {
          reductionPercent = eval(expr);
        } catch {
          reductionPercent = 0.1;
        }
      } else {
        const parsed = parseFloat(bt.physicalDamageReduction);
        if (!isNaN(parsed)) reductionPercent = parsed;
      }
      pushEffect(StatusEffectType.BUFF_PHYSICAL_REDUC, reductionPercent);
    }

    if (bt.dodgeChance) {
      pushEffect(StatusEffectType.BUFF_DODGE, bt.dodgeChance);
    }

    if (bt.accuracy) {
      pushEffect(StatusEffectType.BUFF_ACCURACY, bt.accuracy);
    }

    if (bt.attackSpeed) {
      pushEffect(StatusEffectType.BUFF_ATTACK_SPEED, bt.attackSpeed / 100);
    }

    if (bt.spiValues) {
      const totalSpi = (casterSession?.baseStats?.SPI || 0) + (casterSession?.statPoints?.SPI || target.statPoints.SPI || 0);
      const totalTargetSpi = target.baseStats?.SPI + target.statPoints.SPI;
      const casterBlessing = casterSession
        ? (casterSession.skillAdeptness?.['Blessing'] || 0)
        : (target.skillAdeptness?.['Blessing'] || 0);
      const skillName = skill.name.toLowerCase();

      if (skillName === 'lapis mediow') {
        const result = resolveLapisMediowBuff(bt.spiValues, totalSpi, casterBlessing);
        if (result) {
          pushEffect(StatusEffectType.BUFF_DEFENSE, 0, { flatDefense: result.def });
          this.lastBuffDebug = `[Lapis Mediow] SPI=${totalSpi} (${casterSession?.baseStats?.SPI || 0} base + ${casterSession?.statPoints?.SPI || 0} alloc) Blessing=${casterBlessing}/${casterSession?.skillProficiencies?.['Blessing'] || 0} baseDef=${target.stats.defense} +${result.def} def`;
        }
      } else if (skillName === 'green song') {
        const result = resolveGreenSongBuff(bt.spiValues, totalSpi, casterBlessing);
        if (result) {
          pushEffect(StatusEffectType.BUFF_DODGE, result.dodgeChance);
        }
      }
    }

    if (effects.length === 0) {
      return;
    }

    target.statusEffects.push(...effects);
  }

  updateCooldowns(session: PlayerSession): void {
    if (!session.skillCooldowns) return;
    const now = Date.now();
    session.skillCooldowns = session.skillCooldowns.filter(c => now < c.readyAt);
  }

  checkCasting(session: PlayerSession): { completed: boolean; skillName: string; targetId: string | null; aoePosition?: { x: number; y: number; z: number } } | null {
    if (!session.activeCast) return null;

    const elapsed = Date.now() - session.activeCast.startedAt;
    if (elapsed >= session.activeCast.castTime) {
      return {
        completed: true,
        skillName: session.activeCast.skillName,
        targetId: session.activeCast.targetId,
        aoePosition: session.activeCast.aoePosition
      };
    }

    return null;
  }

  findSkillDefinition(skillName: string): SkillDefinition | null {
    for (const category of Object.values(CLASS_SKILL_DATA)) {
      for (const subSkill of category.skills) {
        if (subSkill.skills[skillName]) {
          const def = subSkill.skills[skillName];
          return { ...def, name: skillName };
        }
      }
    }

    for (const jobSkills of Object.values(CLASS_SPECIFIC_SKILLS)) {
      if (jobSkills[skillName]) {
        const s = jobSkills[skillName];
        return {
          name: skillName,
          reqPoints: s.reqPoints || 0,
          mpCost: s.mpCost,
          castTime: s.castTime,
          cooldown: s.cooldown,
          duration: s.duration,
          description: s.description,
          isPassive: s.isPassive,
          isAOE: s.isAOE,
          aoeTargetMode: s.aoeTargetMode,
          aoeRadius: s.aoeRadius,
          buffEffectTable: s.buffEffectTable,
        };
      }
    }

    return null;
  }

  getAvailableSkills(session: PlayerSession): string[] {
    const available: string[] = [];
    const proficiencies = session.skillProficiencies || {};

    for (const category of Object.values(CLASS_SKILL_DATA)) {
      for (const subSkill of category.skills) {
        const subPoints = proficiencies[subSkill.name] || 0;
        for (const [name, def] of Object.entries(subSkill.skills)) {
          if (isPassiveSkill(def)) continue;
          if (typeof def.reqPoints === 'number') {
            if (subPoints >= def.reqPoints) {
              available.push(name);
            }
          } else if (Array.isArray(def.reqPoints)) {
            if (meetsRequirements(def.reqPoints, (skillName: string) => proficiencies[skillName] || 0)) {
              available.push(name);
            }
          }
        }
      }
    }

    const jobSkills = getClassSpecificSkillsForJob(session.jobId, session.baseClass);
    for (const [name, def] of Object.entries(jobSkills)) {
      const skillDef = def as any;
      if (skillDef.isPassive) continue;
      if (skillDef.reqLevel && skillDef.reqLevel > session.stats.level) continue;
      if (skillDef.reqPoints && typeof skillDef.reqPoints === 'number') continue;
      if (skillDef.reqPoints && Array.isArray(skillDef.reqPoints)) {
        if (!meetsRequirements(skillDef.reqPoints, (skillName: string) => proficiencies[skillName] || 0)) continue;
      }
      available.push(name);
    }

    return available;
  }

  tickStatusEffects(session: PlayerSession, now: number): { damage: number; healed: number; expired: StatusEffect[] } {
    let damage = 0;
    let healed = 0;
    const expired: StatusEffect[] = [];

    if (!session.statusEffects) return { damage: 0, healed: 0, expired: [] };

    for (const effect of session.statusEffects) {
      if (now - effect.appliedAt >= effect.duration) {
        expired.push(effect);
        continue;
      }

      if (effect.tickInterval > 0 && now - effect.lastTickAt >= effect.tickInterval) {
        effect.lastTickAt = now;
        if (effect.type === StatusEffectType.POISON || effect.type === StatusEffectType.BURN || effect.type === StatusEffectType.BLEED) {
          damage += effect.potency;
        }
      }
    }

    session.statusEffects = session.statusEffects.filter(
      e => !expired.includes(e)
    );

    return { damage, healed, expired };
  }
}
