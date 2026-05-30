import {
  PlayerSession, SkillDefinition, SkillCooldownEntry, ActiveCast,
  isPassiveSkill, meetsRequirements, getRequiredProficiency,
  COMBAT_CONFIG, StatusEffect, StatusEffectType, STATUS_EFFECT_DEFS,
  SKILL_TARGET_RULES, SkillTargetType,
  BuffData, resolveSpiTieredValue, SONG_TYPES,
  getEffectiveStats,
  recalculateCategoryTotals, calculateProficiencyGain, ProficiencyGainResult,
  DebuffEffectTable,
  calculateWeaponElementalDamage,
  getMagicEnhancementBoost,
  calculateDodge,
  calculateAccuracy as calcSharedAccuracy,
  calculateHitChance,
  safeFormulaEval,
  SkillType, OnHitEffect, HealingEffect, getSkillTargetType,
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
  damageTakenMultiplier?: number;
  physicalDamageReduction?: number;
  fireResist?: number;
  iceResist?: number;
  lightningResist?: number;
  darkResist?: number;
  holyResist?: number;
  poisonResist?: number;
}

export interface SkillUseResult {
  success: boolean;
  damage?: number;
  healing?: number;
  mpRestored?: number;
  mpDamage?: number;
  maxHpIncrease?: number;
  isCritical?: boolean;
  missed?: boolean;
  damageType?: 'physical' | 'magical';
  statusEffects?: StatusEffect[];
  revived?: boolean;
  error?: string;
  debugCalc?: string;
  elementalDamage?: Array<{ element: string; damage: number }>;
  hits?: Array<{
    damage: number;
    isCritical: boolean;
    elementalDamage?: Array<{ element: string; damage: number }>;
  }>;
  createdItems?: Array<{ itemId: string; quantity: number; consumeItems?: Array<{ itemId: string; quantity: number }> }>;
  sacrificeHeal?: boolean;
  targetId?: string;
  dispelBuff?: boolean;
  dispelDebuff?: boolean;
  revealInvisible?: boolean;
  fear?: boolean;
  summonObject?: { objectType: string; duration: number; hp?: number; defense?: number; aoeDamage?: number };
  banishObject?: boolean;
  blockOnly?: boolean;
  songToggledOff?: boolean;
  defensiveMarchToggledOff?: boolean;
  guardianToggledOff?: boolean;
  guardianApplied?: string;
  guardianRemovedTarget?: string;
}

type DamageType = 'physical' | 'magical';

export class SkillSystem {
  private gcd: number = 1000;
  private globalCooldowns: Map<string, number> = new Map();
  lastBuffDebug: string | undefined;
  lastProficiencyGain: ProficiencyGainResult | undefined;
  lastCooldownDebug: { skillName: string; totalINT: number; cooldownReduction: number; baseCd: number; effective: number } | undefined;

  private createStatusEffect(
    type: StatusEffectType,
    potency: number,
    sourceId: string,
    targetId: string,
    overrides?: Partial<StatusEffect>
  ): StatusEffect | null {
    const def = STATUS_EFFECT_DEFS[type];
    if (!def) return null;
    const now = Date.now();
    return {
      id: `se_${now}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      sourceId,
      targetId,
      potency,
      appliedAt: now,
      duration: overrides?.duration ?? def.duration,
      tickInterval: overrides?.tickInterval ?? def.tickInterval,
      lastTickAt: now,
      stacks: 1,
      ...overrides,
    };
  }

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

  private inferSkillType(skill: SkillDefinition): SkillType | undefined {
    if (skill.isPassive) return SkillType.PASSIVE;
    if (skill.isRevive) return SkillType.REVIVE;
    if (skill.isSong) return SkillType.SONG;
    if (skill.sacrificeHeal) return SkillType.SACRIFICE_HEAL;
    if (skill.mpDamage) return SkillType.MP_DAMAGE;
    if (skill.isDebuff || skill.debuffEffectTable) return SkillType.DEBUFF;
    if (skill.healing) return SkillType.HEAL;
    if (skill.isBuff) return SkillType.BUFF;
    const isMagical = skill.damageType === 'magical'
      || (skill.damageSubType && ['fire','ice','lightning','dark','holy','poison'].includes(skill.damageSubType as string));
    if (isMagical) return SkillType.DAMAGE_MAGICAL;
    if (skill.basePower !== undefined || skill.damageType === 'physical') return SkillType.DAMAGE_PHYSICAL;
    if (skill.createItems) return SkillType.CRAFT;
    return undefined;
  }

  private getDamageType(st: SkillType | undefined, skill: SkillDefinition): DamageType {
    if (st === SkillType.DAMAGE_MAGICAL || st === SkillType.MP_DAMAGE) return 'magical';
    if (st === SkillType.DAMAGE_PHYSICAL || st === SkillType.DRAIN_LIFE) return 'physical';
    return skill.damageType === 'magical' ? 'magical' : 'physical';
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

    if (skill.blockOnly) {
      const hasBlockingStance = session.statusEffects?.some(e =>
        e.type === StatusEffectType.BUFF_BLOCKING_STANCE || e.buffData?.blockingStance || e.buffData?.defensiveMarch
      );
      if (!hasBlockingStance) {
        return { canUse: false, error: 'not_blocking' };
      }
    }

    const isBlockStancing = session.statusEffects?.some(e =>
      e.type === StatusEffectType.BUFF_BLOCKING_STANCE && e.buffData?.blockingStance
    );
    if (isBlockStancing) {
      const allowedWhileBlocking = ['Shield Bash', 'Shield Tackle', 'Auto-guard', 'Defensive March', 'Defender', 'Blocking'];
      if (!allowedWhileBlocking.includes(skillName)) {
        return { canUse: false, error: 'blocking' };
      }
    }

    if (skill.shieldRequired) {
      const hasShield = !!session.equipment?.shield;
      if (!hasShield) {
        return { canUse: false, error: 'no_shield' };
      }
    }

    if (skill.negateFieldSpells || skill.debuffEffectTable?.preventFieldSpells) {
      const hasPrevent = session.statusEffects?.some(e => e.type === StatusEffectType.PREVENT_FIELD_SPELLS);
      if (hasPrevent) {
        return { canUse: false, error: 'field_blocked' };
      }
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

    const targetType = getSkillTargetType(skill) || SKILL_TARGET_RULES[skillName];
    if (targetType) {
      if (targetType === SkillTargetType.OTHER_ONLY) {
        if (!targetId) {
          return { canUse: false, error: 'no_target' };
        }
        if (targetId === session.characterId) {
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

    const castSpd = session.stats.castSpeed || 100;

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
    const st = skill.skillType ?? this.inferSkillType(skill);

    session.stats.mana -= skill.mpCost;

    const now = Date.now();
    if (!session.skillCooldowns) session.skillCooldowns = [];
    const totalINT = (session.statPoints.INT || 0) + (session.baseStats?.INT || 0);
    const cooldownReduction = Math.floor(totalINT / 10) * 2;
    const cooldownMultiplier = Math.max(0, 100 - cooldownReduction) / 100;
    const effectiveCooldown = Math.floor(skill.cooldown * 1000 * cooldownMultiplier);
    if (cooldownReduction > 0) {
      this.lastCooldownDebug = { skillName, totalINT, cooldownReduction, baseCd: skill.cooldown, effective: effectiveCooldown / 1000 };
    }
    session.skillCooldowns.push({
      skillName,
      readyAt: now + effectiveCooldown
    });

    this.globalCooldowns.set(session.characterId, now + this.gcd);
    session.activeCast = null;

    this.gainProficiency(session, skillName);

    if (st === SkillType.REVIVE && targetId) {
      return { success: true, revived: true };
    }

    if (st === SkillType.DEBUFF || st === SkillType.FEAR || st === SkillType.DISPEL) {
      if (skill.debuffEffectTable) {
        const debuffEffects = this.buildDebuffEffects(session, skill);
        return { success: true, statusEffects: debuffEffects.length > 0 ? debuffEffects : undefined };
      }
      if (st === SkillType.FEAR) {
        return { success: true, fear: true };
      }
      if (st === SkillType.DISPEL) {
        return { success: true, dispelBuff: skill.dispelBuff, dispelDebuff: skill.dispelDebuff };
      }
      if (skill.onHitEffects && skill.onHitEffects.length > 0) {
        const statusEffects = this.buildStatusEffects(session, skill, 0);
        return { success: true, statusEffects: statusEffects.length > 0 ? statusEffects : undefined };
      }
      return { success: true };
    }

    if (st === SkillType.CRAFT && skill.createItems && skill.createItems.length > 0) {
      return { success: true, createdItems: skill.createItems };
    }

    if (st === SkillType.SACRIFICE_HEAL && targetId) {
      return { success: true, sacrificeHeal: true, targetId };
    }

    if (st === SkillType.MP_DAMAGE && targetId) {
      const basePower = skill.basePower ?? 1;
      const mpTotalINT = (session.statPoints.INT || 0) + (session.baseStats?.INT || 0);
      const mpTotalSPI = (session.statPoints.SPI || 0) + (session.baseStats?.SPI || 0);
      const mpDamageAmount = Math.floor(basePower * (mpTotalINT + mpTotalSPI * 0.3) * 0.5);
      return { success: true, mpDamage: mpDamageAmount, damageType: 'magical' };
    }

    const isBuffLike = st === SkillType.BUFF || st === SkillType.SONG
      || st === SkillType.HP_BUFF || st === SkillType.MP_RESTORE
      || st === SkillType.HEAL_OVER_TIME;
    if ((isBuffLike && skill.duration > 0) || (skill.buffEffectTable && skill.duration === 0)) {
      if (st === SkillType.SONG) {
        const songMap: Record<string, StatusEffectType> = {
          green: StatusEffectType.SONG_GREEN,
          blue: StatusEffectType.SONG_BLUE,
          yellow: StatusEffectType.SONG_YELLOW,
          red: StatusEffectType.SONG_RED,
        };
        const songType = skill.buffEffectTable?.songType as string | undefined;
        const songEffectType = songType ? songMap[songType] : undefined;
        if (songEffectType && session.statusEffects?.some(e => e.type === songEffectType)) {
          session.statusEffects = session.statusEffects.filter(e => e.type !== songEffectType && e.skillName !== skill.name);
          return { success: true, songToggledOff: true };
        }
      }

      if (skill.buffEffectTable?.defensiveMarch) {
        const existing = session.statusEffects?.find(e => e.type === StatusEffectType.BUFF_BLOCKING_STANCE && e.buffData?.defensiveMarch && e.skillName === skillName);
        if (existing) {
          session.statusEffects = session.statusEffects.filter(e => e !== existing);
          return { success: true, defensiveMarchToggledOff: true };
        }
      }

      if (skill.buffEffectTable?.damageRedirect && targetId) {
        const existing = session.statusEffects?.find(e => e.type === StatusEffectType.BUFF_DAMAGE_REDIRECT && e.skillName === skillName);
        if (existing) {
          const oldTarget = existing.buffData?.damageRedirectTargetId || existing.targetId;
          session.statusEffects = session.statusEffects.filter(e => e !== existing);
          return { success: true, guardianToggledOff: true, guardianRemovedTarget: oldTarget };
        }
        this.applyGuardianBuff(session, skill, targetId);
        return { success: true, guardianApplied: targetId };
      }

      this.applyBuff(session, skill);
    }

    if (st === SkillType.MP_RESTORE) {
      const mpAmount = this.calculateMpRegen(session, skill);
      session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + mpAmount);
      return { success: true, mpRestored: mpAmount };
    }

    if (st === SkillType.HEAL || st === SkillType.HEAL_OVER_TIME || st === SkillType.PARTY_HEAL) {
      const healAmount = this.calculateHealing(session, skill);
      return { success: true, healing: healAmount };
    }

    if (st === SkillType.HP_BUFF && (!targetId || targetId === session.characterId)) {
      const hpIncrease = this.calculateMaxHpBuff(session, skill);
      const healthRatio = session.stats.maxHealth > 0 ? session.stats.health / session.stats.maxHealth : 1;
      session.stats.maxHealth += hpIncrease;
      session.stats.health = Math.min(session.stats.maxHealth, Math.floor(session.stats.maxHealth * healthRatio) + hpIncrease);
      return { success: true, maxHpIncrease: hpIncrease, healing: hpIncrease };
    }

    if ((st === SkillType.DAMAGE_PHYSICAL || st === SkillType.DAMAGE_MAGICAL) && targetId) {
      const target = getTargetStats(targetId);
      if (target) {
        const dmgType = this.getDamageType(st, skill);
        return this.calculateSkillDamage(session, skill, target, dmgType);
      }
    }

    if (st === SkillType.DRAIN_LIFE && targetId) {
      const target = getTargetStats(targetId);
      if (target) {
        const result = this.calculateSkillDamage(session, skill, target, 'physical');
        if (result.damage && result.damage > 0 && !result.missed) {
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

    const st = skill.skillType ?? this.inferSkillType(skill);
    const isDamage = st === SkillType.DAMAGE_PHYSICAL || st === SkillType.DAMAGE_MAGICAL
      || st === SkillType.DRAIN_LIFE || st === SkillType.MP_DAMAGE;
    if (!isDamage) return { success: true };

    const target = getTargetStats(targetId);
    if (!target) return { success: true, missed: true };

    const dmgType = this.getDamageType(st, skill);
    return this.calculateSkillDamageInternal(session, skill, target, dmgType);
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
    const numHits = skill.baseHits || 1;
    const hitChance = this.calculateAccuracy(session, target);

    const basePower = skill.basePower ?? 1;
    const baseStats = session.baseStats || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
    const primaryStat = isMagical
      ? session.stats.magicAttack || ((session.statPoints.INT || 0) + (baseStats.INT || 0))
      : (session.statPoints.STR || 0) + (baseStats.STR || 0);
    const secondaryStat = isMagical
      ? (session.statPoints.SPI || 0) + (baseStats.SPI || 0)
      : (session.statPoints.DEX || 0) + (baseStats.DEX || 0);
    const defenseStat = isMagical ? target.magicDefense : target.defense;

    let attackMultiplier = 1;
    const attackBuff = session.statusEffects?.find(e => e.type === StatusEffectType.BUFF_ATTACK);
    if (attackBuff && !isMagical) {
      attackMultiplier = attackBuff.potency;
    }

    const baseDamage = Math.floor(
      basePower * (primaryStat + secondaryStat * 0.3) * attackMultiplier
      - defenseStat * 0.5
    );

    let elementalResistMultiplier = 1;
    if (isMagical && skill.damageSubType) {
      const resistMap: Record<string, number | undefined> = {
        fire: target.fireResist,
        ice: target.iceResist,
        lightning: target.lightningResist,
        dark: target.darkResist,
        holy: target.holyResist,
      };
      const resist = resistMap[skill.damageSubType] || 0;
      if (resist !== 0) {
        elementalResistMultiplier = resist > 0
          ? 1 - Math.min(0.75, resist / 100)
          : 1 + Math.min(1.0, Math.abs(resist) / 100);
      }
    }

    let physReduction = 0;
    if (!isMagical && target.physicalDamageReduction && target.physicalDamageReduction > 0) {
      physReduction = Math.min(0.9, target.physicalDamageReduction);
    }

    const totalDex = (session.statPoints.DEX || 0) + (session.baseStats?.DEX || 0);
    const critChance = COMBAT_CONFIG.CRITICAL_CHANCE + totalDex * 0.002;

    const levelDiff = session.stats.level - target.level;
    let levelMultiplier = 1;
    if (levelDiff > 0) {
      levelMultiplier = 1 + levelDiff * 0.03;
    } else if (levelDiff < 0) {
      const penalty = 1 - 0.5 * (1 - Math.exp(levelDiff * 0.03));
      levelMultiplier = Math.max(0.25, penalty);
    }

    const totalSPI = (session.statPoints.SPI || 0) + (baseStats.SPI || 0);
    const totalINT = (session.statPoints.INT || 0) + (baseStats.INT || 0);
    const targetResists: Record<string, number | undefined> = {
      fireResist: target.fireResist,
      iceResist: target.iceResist,
      lightningResist: target.lightningResist,
      darkResist: target.darkResist,
      holyResist: target.holyResist,
      poisonResist: target.poisonResist,
    };

    const steps: string[] = [];
    if (isMagical) {
      steps.push(`basePower=${basePower} magicAttack=${primaryStat}(INT=${session.statPoints.INT + baseStats.INT}) SPI=${secondaryStat}`);
    } else {
      steps.push(`basePower=${basePower} STR=${primaryStat}(base${baseStats.STR}+alloc${session.statPoints.STR}) DEX=${secondaryStat}`);
    }
    steps.push(`raw=${basePower}×(${primaryStat}+${secondaryStat}×0.3)×${attackMultiplier}-${defenseStat}×0.5=${baseDamage}`);

    const hits: Array<{ damage: number; isCritical: boolean; elementalDamage?: Array<{ element: string; damage: number }> }> = [];
    let totalDamage = 0;
    let anyCritical = false;

    for (let h = 0; h < numHits; h++) {
      if (Math.random() > hitChance) {
        hits.push({ damage: 0, isCritical: false });
        if (numHits > 1) steps.push(`hit${h + 1}: miss`);
        continue;
      }

      let damage = baseDamage;

      const weaponEnhElement = (session.equipment?.weapon as any)?.enhancementElement;
      const weaponEnhLevel = (session.equipment?.weapon as any)?.enhancementLevel;
      const magicBoost = getMagicEnhancementBoost(weaponEnhElement, weaponEnhLevel, skill.damageSubType);
      if (magicBoost > 1) {
        damage = Math.floor(damage * magicBoost);
      }

      if (elementalResistMultiplier !== 1) {
        damage = Math.floor(damage * elementalResistMultiplier);
      }

      if (physReduction > 0) {
        damage = Math.floor(damage * (1 - physReduction));
      }

      const isCrit = !isMagical && Math.random() < critChance;
      if (isCrit) {
        damage = Math.floor(damage * COMBAT_CONFIG.CRITICAL_MULTIPLIER);
        anyCritical = true;
      }

      damage = Math.floor(damage * levelMultiplier);

      const varianceRoll = 0.9 + Math.random() * 0.2;
      damage = Math.floor(damage * varianceRoll);
      damage = Math.max(COMBAT_CONFIG.MIN_DAMAGE, damage);

      if (target.damageTakenMultiplier && target.damageTakenMultiplier > 1) {
        damage = Math.floor(damage * target.damageTakenMultiplier);
      }

      const elementalDamage = calculateWeaponElementalDamage(
        session.equipment?.weapon?.itemId,
        session.statusEffects || [],
        totalSPI,
        totalINT,
        session.stats.level,
        targetResists,
        (session.equipment?.weapon as any)?.enhancementElement,
        (session.equipment?.weapon as any)?.enhancementLevel
      );

      hits.push({
        damage,
        isCritical: isCrit,
        elementalDamage: elementalDamage.length > 0 ? elementalDamage : undefined,
      });

      totalDamage += damage;
      if (numHits === 1) {
        if (isCrit) steps.push(`crit=${damage}`);
      } else {
        steps.push(`hit${h + 1}=${damage}${isCrit ? '(crit)' : ''}`);
      }
    }

    steps.push(`total=${totalDamage}`);

    const statusEffects = this.buildStatusEffects(session, skill, totalDamage);

    const result: SkillUseResult = {
      success: true,
      damage: totalDamage,
      isCritical: anyCritical,
      damageType,
      statusEffects: statusEffects.length > 0 ? statusEffects : undefined,
      debugCalc: `[${skill.name}] ${steps.join(' → ')} → final=${totalDamage}`,
    };

    if (numHits > 1) {
      result.hits = hits;
    } else if (hits.length > 0 && hits[0].elementalDamage) {
      result.elementalDamage = hits[0].elementalDamage;
    }

    return result;
  }

  private buildStatusEffects(session: PlayerSession, skill: SkillDefinition, damage: number): StatusEffect[] {
    if (!skill.onHitEffects || skill.onHitEffects.length === 0) return [];

    const effects: StatusEffect[] = [];
    const now = Date.now();

    for (const oh of skill.onHitEffects) {
      const chance = oh.chance ?? 1;
      if (Math.random() > chance) continue;

      let potency = oh.potency ?? 0;
      if (typeof potency === 'object' && potency !== null) {
        const base = potency.formula || '0';
        const statName = potency.stat || 'INT';
        const statValue = (session.statPoints[statName as keyof typeof session.statPoints] || 0)
          + (session.baseStats?.[statName as keyof typeof session.baseStats] || 0);
        const vars: Record<string, number> = { ...(potency as Record<string, number>), damage, [statName]: statValue };
        potency = safeFormulaEval(base, vars);
      }

      const effect = this.createStatusEffect(oh.type, potency, session.characterId, '', {
        duration: oh.duration,
      });
      if (effect) effects.push(effect);
    }

    return effects;
  }

  buildDebuffEffects(casterSession: PlayerSession, skill: SkillDefinition): StatusEffect[] {
    const dt = skill.debuffEffectTable!;
    const effects: StatusEffect[] = [];
    const now = Date.now();
    const duration = (skill.debuffDuration || skill.duration || 30) * 1000;
    const category = dt.debuffCategory;

    const addEffect = (type: StatusEffectType, potency: number, extra?: Partial<StatusEffect>) => {
      const def = STATUS_EFFECT_DEFS[type];
      if (def) {
        effects.push({
          id: `debuff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${type}`,
          type,
          sourceId: casterSession.characterId,
          targetId: '',
          potency,
          appliedAt: now,
          duration,
          tickInterval: def.tickInterval,
          lastTickAt: now,
          stacks: 1,
          skillName: skill.name,
          debuffCategory: category,
          ...extra,
        });
      }
    };

    if (dt.dot) {
      const tickInterval = dt.dotTickInterval || 2000;
      let statusType: StatusEffectType;

      switch (dt.dot) {
        case 'poison':
          statusType = StatusEffectType.POISON;
          break;
        case 'severe_poison':
          statusType = StatusEffectType.SEVERE_POISON;
          break;
        case 'bleed':
          statusType = StatusEffectType.BLEED;
          break;
        case 'mp_drain':
          statusType = StatusEffectType.MP_DRAIN;
          break;
        default:
          return effects;
      }

      let dotHPPercent = dt.dotHPPercent;
      if (dt.dotSPIBase !== undefined && dt.dotSPIMax !== undefined) {
        const casterSPI = casterSession.statPoints.SPI || 0;
        const cap = dt.dotSPICap || 110;
        const progress = Math.min(1, casterSPI / cap);
        dotHPPercent = dt.dotSPIBase + progress * (dt.dotSPIMax - dt.dotSPIBase);
      }

      addEffect(statusType, dt.dotPotency || 0, {
        tickInterval,
        dotMpDrain: dt.dotMpDrain,
        dotHPPercent,
      });
      return effects;
    }

    const DEBUFF_PROPERTY_MAP: Array<{ prop: keyof DebuffEffectTable; effectType: StatusEffectType; extra?: Partial<StatusEffect> }> = [
      { prop: 'attackDown', effectType: StatusEffectType.DEBUFF_DAMAGE_DOWN },
      { prop: 'defenseDown', effectType: StatusEffectType.DEBUFF_DEFENSE_DOWN },
      { prop: 'speedDown', effectType: StatusEffectType.DEBUFF_SPEED_DOWN },
      { prop: 'accuracyDown', effectType: StatusEffectType.DEBUFF_ACCURACY_DOWN },
      { prop: 'dodgeDown', effectType: StatusEffectType.DEBUFF_DODGE_DOWN },
      { prop: 'castSpeedDown', effectType: StatusEffectType.DEBUFF_CAST_SPEED_DOWN },
      { prop: 'damageTakenUp', effectType: StatusEffectType.DEBUFF_DAMAGE_TAKEN_UP, extra: { consumable: dt.consumable || false } },
      { prop: 'moveSpeedDown', effectType: StatusEffectType.SLOW },
      { prop: 'hasFreeze', effectType: StatusEffectType.FREEZE, extra: { duration: (dt.hasFreeze as any)?.duration * 1000 } },
      { prop: 'hasSleep', effectType: StatusEffectType.SLEEP, extra: { duration: (dt.hasSleep as any)?.duration * 1000 } },
      { prop: 'hasStun', effectType: StatusEffectType.STUN, extra: { duration: (dt.hasStun as any)?.duration * 1000 } },
      { prop: 'hasSilence', effectType: StatusEffectType.SILENCE, extra: { duration: (dt.hasSilence as any)?.duration * 1000 } },
      { prop: 'hasFear', effectType: StatusEffectType.FEAR },
      { prop: 'preventFieldSpells', effectType: StatusEffectType.PREVENT_FIELD_SPELLS },
      { prop: 'preventResurrect', effectType: StatusEffectType.PREVENT_RESSURECT },
      { prop: 'curse', effectType: StatusEffectType.CURSE },
      { prop: 'revealInvisible', effectType: StatusEffectType.BUFF_GENERIC },
    ];

    for (const mapping of DEBUFF_PROPERTY_MAP) {
      const value = dt[mapping.prop];
      if (value === undefined || value === null || value === false) continue;
      const potency = typeof value === 'number' ? value : 0;
      const extra = typeof value === 'object' && value !== null ? mapping.extra : undefined;
      const effect = this.createStatusEffect(mapping.effectType, potency, casterSession.characterId, '', {
        ...extra,
        skillName: skill.name,
        debuffCategory: category,
      });
      if (effect) effects.push(effect);
    }

    if (dt.mpDamage && dt.mpDamageDirect) {
      const effect = this.createStatusEffect(StatusEffectType.MP_DAMAGE_DEBUFF, dt.mpDamage, casterSession.characterId, '', { mpDamageDirect: dt.mpDamage });
      if (effect) effects.push(effect);
    }

    return effects;
  }

  private calculateAccuracy(session: PlayerSession, target: TargetStats): number {
    if (target.dodge === 0) return 0.99;
    const baseStats = session.baseStats || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
    const totalDex = (session.statPoints.DEX || 0) + (baseStats.DEX || 0);
    const attackerAccuracy = calcSharedAccuracy(session.stats.level, totalDex, 0);
    const hitChance = calculateHitChance(attackerAccuracy, target.dodge);
    return Math.min(0.99, Math.max(0.01, hitChance));
  }

  private calculateHealing(session: PlayerSession, skill: SkillDefinition): number {
    if (!skill.healing) {
      const spi = session.statPoints.SPI;
      const int = session.statPoints.INT;
      const level = session.stats.level;
      const multiplier = 1.0 + (skill.mpCost / 30);
      return Math.floor((spi * 2.0 + int * 1.0 + level * 2) * multiplier);
    }

    const h = skill.healing;
    const spi = session.statPoints.SPI;
    const int = session.statPoints.INT;
    const level = session.stats.level;
    const proficiencies = session.skillProficiencies || {};
    const profStat = h.proficiencyStat || 'Grace';
    const prof = proficiencies[profStat] || 0;

    if (h.statMultipliers) {
      const total = { spi, int, level, ...h.statMultipliers };
      const formula = h.baseAmount || 0;
      const vars: Record<string, number> = {};
      for (const [key, val] of Object.entries(total)) vars[key] = val;
      return Math.floor(safeFormulaEval(formula.toString(), vars));
    }

    const multiplier = h.mpCostScaling
      ? 1.0 + (skill.mpCost / h.mpCostScaling)
      : 1.0 + (skill.mpCost / 30);

    return Math.floor(((h.baseAmount || 0)
      + (spi * ((h.statMultipliers as Record<string, number> | undefined)?.SPI ?? 0.3))
      + (int * ((h.statMultipliers as Record<string, number> | undefined)?.INT ?? 0.6))
      + (prof * 0.5)) * multiplier);
  }

  private calculateMpRegen(session: PlayerSession, skill: SkillDefinition): number {
    const spi = session.statPoints.SPI;
    const level = session.stats.level;
    const multiplier = 1.0 + (skill.mpCost / 15);
    return Math.floor((spi * 1.5 + level * 1.5) * multiplier);
  }

  calculateMaxHpBuff(session: PlayerSession, skill: SkillDefinition): number {
    if (skill.healing && skill.healing.type === 'hp_buff') {
      const h = skill.healing;
      const baseHp = session.stats.maxHealth;
      let increase = 0;

      if (h.percentOfMaxHp) {
        increase += Math.floor(baseHp * (h.percentOfMaxHp / 100));
      }
      if (h.flatBonus) {
        increase += h.flatBonus;
      }

      if (increase === 0) {
        increase = Math.floor(baseHp * 0.1 + session.stats.level * 5);
      }

      return increase;
    }

    return 0;
  }

  private applyBuff(session: PlayerSession, skill: SkillDefinition): void {
    this.applyBuffToTarget(session, session.characterId, skill, session);
  }

  private applyGuardianBuff(session: PlayerSession, skill: SkillDefinition, targetCharacterId: string): void {
    const now = Date.now();
    const duration = (skill.duration || 300) * 1000;
    session.statusEffects = session.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_DAMAGE_REDIRECT);
    session.statusEffects.push({
      id: `buff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_guardian`,
      type: StatusEffectType.BUFF_DAMAGE_REDIRECT,
      sourceId: session.characterId,
      targetId: targetCharacterId,
      potency: 0,
      appliedAt: now,
      duration,
      tickInterval: 0,
      lastTickAt: now,
      stacks: 1,
      skillName: skill.name,
      buffData: { damageRedirectTargetId: targetCharacterId },
    });
  }

  applyBuffToTarget(
    target: PlayerSession,
    sourceId: string,
    skill: SkillDefinition,
    casterSession?: PlayerSession | null
  ): void {
    const now = Date.now();
    const duration = skill.isSong ? 5000 : (skill.duration || 300) * 1000;
    const bt = skill.buffEffectTable;

    const effects: StatusEffect[] = [];
    const pushEffect = (type: StatusEffectType, potency: number, buffData?: BuffData, extra?: Partial<StatusEffect>) => {
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
        ...extra,
      });
    };

    if (!bt) {
      if (skill.skillType === SkillType.HP_BUFF) {
        const baseMaxHp = target.stats.maxHealth;
        const hpIncrease = Math.floor(baseMaxHp * 0.15) + 250;
        pushEffect(StatusEffectType.BUFF_MAX_HP, 0, { maxHpFlat: hpIncrease, maxHpPercent: 0.15 });
      } else if (effects.length === 0) {
        pushEffect(StatusEffectType.BUFF_GENERIC, 0);
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
        reductionPercent = safeFormulaEval(expr, { blessing });
      } else {
        const parsed = parseFloat(bt.physicalDamageReduction);
        if (!isNaN(parsed)) reductionPercent = parsed;
      }
      pushEffect(StatusEffectType.BUFF_PHYSICAL_REDUC, reductionPercent);
    }

    if (bt.dodgeChance) {
      pushEffect(StatusEffectType.BUFF_DODGE, bt.dodgeChance);
    }

    if (bt.weaponAura) {
      const aura = bt.weaponAura;
      const caster = casterSession || target;
      const subCategory = SKILL_TO_SUBCATEGORY[skill.name];
      const proficiency = subCategory ? (caster.skillProficiencies?.[subCategory] || 0) : 0;
      const casterBaseSPI = (caster.baseStats?.SPI || 0) + (caster.statPoints?.SPI || 0);

      if (aura.spiTiers) {
        const lookupValue = casterBaseSPI + proficiency;
        let matchedTier = aura.spiTiers[0];
        for (const tier of aura.spiTiers) {
          if (lookupValue >= tier.spi) {
            matchedTier = tier;
          } else {
            break;
          }
        }
        pushEffect(StatusEffectType.WEAPON_AURA, 0, {
          weaponAura: { element: aura.element, minDamage: matchedTier.min, maxDamage: matchedTier.max },
        });
      } else if (aura.formula === 'toxify') {
        const level = caster.stats?.level || 1;
        const auraDamage = Math.floor(level * (100 + proficiency) / 100);
        pushEffect(StatusEffectType.WEAPON_AURA, 0, {
          weaponAura: { element: aura.element, minDamage: auraDamage, maxDamage: auraDamage },
        });
      }
    }

    if (bt.accuracy) {
      pushEffect(StatusEffectType.BUFF_ACCURACY, bt.accuracy);
    }

    if (bt.attackSpeed) {
      pushEffect(StatusEffectType.BUFF_ATTACK_SPEED, bt.attackSpeed / 100);
    }

    if (bt.resistMods) {
      target.statusEffects = target.statusEffects.filter(e => e.exclusiveGroup !== 'resist_element');
      pushEffect(StatusEffectType.BUFF_RESIST, 0, { resistMods: bt.resistMods }, { exclusiveGroup: 'resist_element' });
    }

    if (bt.moveSpeed) {
      pushEffect(StatusEffectType.BUFF_MOVE_SPEED, bt.moveSpeed, { moveSpeedFlat: bt.moveSpeed });
    }

    if (bt.critResist) {
      pushEffect(StatusEffectType.BUFF_CRIT_RESIST, bt.critResist, { critResistPercent: bt.critResist });
    }

    if (bt.critDamageReduce) {
      pushEffect(StatusEffectType.BUFF_CRIT_DAMAGE_REDUCE, bt.critDamageReduce, { critDamageReducePercent: bt.critDamageReduce });
    }

    if (bt.auraDamageReduce) {
      pushEffect(StatusEffectType.BUFF_AURA_DAMAGE_REDUCE, bt.auraDamageReduce, { auraDamageReducePercent: bt.auraDamageReduce });
    }

    if (bt.manaShield) {
      target.statusEffects = target.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_MANA_SHIELD);
      pushEffect(StatusEffectType.BUFF_MANA_SHIELD, 0, { manaShield: true });
    }

    if (bt.spellInterruptResist) {
      pushEffect(StatusEffectType.BUFF_SPELL_INTERRUPT_RESIST, bt.spellInterruptResist, { spellInterruptResistPercent: bt.spellInterruptResist });
    }

    if (bt.debuffResist) {
      pushEffect(StatusEffectType.BUFF_DEBUFF_RESIST, bt.debuffResist, { debuffResistPercent: bt.debuffResist });
    }

    if (bt.blockingStance) {
      target.statusEffects = target.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_BLOCKING_STANCE);
      const clearOnBlock = [StatusEffectType.STUN, StatusEffectType.SLEEP, StatusEffectType.KNOCKDOWN];
      target.statusEffects = target.statusEffects.filter(e => !clearOnBlock.includes(e.type));
      pushEffect(StatusEffectType.BUFF_BLOCKING_STANCE, 0, { blockingStance: true, blockingRange: bt.blockingRange || 6 });
    }

    if (bt.defensiveMarch) {
      target.statusEffects = target.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_BLOCKING_STANCE);
      pushEffect(StatusEffectType.BUFF_BLOCKING_STANCE, 0, { blockingStance: true, blockingRange: bt.blockingRange || 7, defensiveMarch: true });
    }

    if (bt.shieldCharge) {
      pushEffect(StatusEffectType.BUFF_MOVE_SPEED, 2, { moveSpeedFlat: 2, shieldCharge: true });
    }

    if (bt.blockChance) {
      pushEffect(StatusEffectType.BUFF_BLOCK_CHANCE, bt.blockChance, { blockChancePercent: bt.blockChance });
    }

    if (bt.consumableOnAttack) {
      pushEffect(StatusEffectType.BUFF_CONSUMABLE_ON_ATTACK, bt.accuracy || 50, { consumableOnAttack: true, accuracyBonusFlat: bt.accuracy || 50 });
    }

    if (bt.dodgeReduction) {
      pushEffect(StatusEffectType.BUFF_GENERIC, 0, { dodgeReductionFlat: bt.dodgeReduction });
    }

    if (bt.healingOverTime) {
      const hot = bt.healingOverTime;
      const prof = hot.proficiencyStat ? (casterSession?.skillProficiencies?.[hot.proficiencyStat] || 0) : 0;
      const spi = (casterSession?.statPoints?.SPI || 0) + (casterSession?.baseStats?.SPI || 0);
      const hpPerTick = Math.floor(hot.base + spi * hot.spiScale + prof * 0.5);
      pushEffect(StatusEffectType.BUFF_GENERIC, 0, { healOverTime: { hpPerTick, tickInterval: 3000 } });
    }

    if (bt.partyHeal) {
      const healAmount = bt.partyHeal;
      const spi = (casterSession?.statPoints?.SPI || 0) + (casterSession?.baseStats?.SPI || 0);
      const finalHeal = Math.floor(healAmount + spi * 0.5);
      target.stats.health = Math.min(target.stats.maxHealth, target.stats.health + finalHeal);
    }

    if (bt.dispelDebuff) {
      target.statusEffects = target.statusEffects.filter(e => !e.debuffCategory);
    }

    if (bt.dispelBuff) {
      target.statusEffects = target.statusEffects.filter(e => !e.buffData);
    }

    if (bt.attackPowerMultiplierProficiency) {
      const prof = bt.attackPowerMultiplierProficiency;
      const profValue = casterSession?.skillProficiencies?.[prof.proficiencyStat] || 0;
      const multiplier = 1 + profValue * prof.perProficiency;
      pushEffect(StatusEffectType.BUFF_ATTACK, multiplier);
    }

    if (bt.cooldownReduction) {
      pushEffect(StatusEffectType.BUFF_GENERIC, 0, { cooldownReductionPercent: bt.cooldownReduction });
    }

    if (bt.magicalDamageBonus) {
      pushEffect(StatusEffectType.BUFF_GENERIC, 0, { magicalDamageBonusPercent: bt.magicalDamageBonus });
    }

    if (bt.songType) {
      const songMap: Record<string, StatusEffectType> = {
        green: StatusEffectType.SONG_GREEN,
        blue: StatusEffectType.SONG_BLUE,
        yellow: StatusEffectType.SONG_YELLOW,
        red: StatusEffectType.SONG_RED,
      };
      const songEffectType = songMap[bt.songType];
      if (songEffectType) {
        target.statusEffects = target.statusEffects.filter(e => ![StatusEffectType.SONG_GREEN, StatusEffectType.SONG_BLUE, StatusEffectType.SONG_YELLOW, StatusEffectType.SONG_RED].includes(e.type));
        pushEffect(songEffectType, 0, { songType: bt.songType, songRadius: 3 });
        effects[effects.length - 1].duration = 999999999;
        effects[effects.length - 1].lastPulseAt = 0;
        target.statusEffects.push(...effects);
        return;
      }
    }

    if (bt.delayExplosion) {
      const delayMs = bt.delayExplosion.minSeconds * 1000 + Math.random() * (bt.delayExplosion.maxSeconds - bt.delayExplosion.minSeconds) * 1000;
      pushEffect(StatusEffectType.BUFF_GENERIC, 0, { delayExplosion: { minMs: delayMs, maxMs: delayMs } });
      if (effects.length > 0) {
        const lastEffect = effects[effects.length - 1];
        lastEffect.delayExplosionAt = Date.now() + delayMs;
      }
    }

    if (bt.spiValues) {
      const totalSpi = (casterSession?.baseStats?.SPI || 0) + (casterSession?.statPoints?.SPI || target.statPoints.SPI || 0);
      const totalTargetSpi = target.baseStats?.SPI + target.statPoints.SPI;
      const casterBlessing = casterSession
        ? (casterSession.skillAdeptness?.['Blessing'] || 0)
        : (target.skillAdeptness?.['Blessing'] || 0);
      const skillName = skill.name.toLowerCase();

      if (skillName === 'lapis mediow') {
        const result = resolveSpiTieredValue(bt.spiValues, totalSpi, casterBlessing, 'def');
        if (result) {
          pushEffect(StatusEffectType.BUFF_DEFENSE, 0, { flatDefense: result.def });
          this.lastBuffDebug = `[Lapis Mediow] SPI=${totalSpi} (${casterSession?.baseStats?.SPI || 0} base + ${casterSession?.statPoints?.SPI || 0} alloc) Blessing=${casterBlessing}/${casterSession?.skillProficiencies?.['Blessing'] || 0} baseDef=${target.stats.defense} +${result.def} def`;
        }
      } else if (skillName === 'green song' || skillName === 'speedy gale') {
        const result = resolveSpiTieredValue(bt.spiValues, totalSpi, casterBlessing, 'dodgeChance');
        if (result) {
          pushEffect(StatusEffectType.BUFF_DODGE, result.dodgeChance ?? 0);
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
          skillType: s.skillType,
          isAOE: s.isAOE,
          aoeTargetMode: s.aoeTargetMode,
          aoeRadius: s.aoeRadius,
          buffEffectTable: s.buffEffectTable,
          debuffEffectTable: s.debuffEffectTable,
          debuffDuration: s.debuffDuration,
          damageType: s.damageType,
          damageSubType: s.damageSubType,
          basePower: s.basePower,
          pulseCount: s.pulseCount,
          pulseInterval: s.pulseInterval,
          onHitEffects: s.onHitEffects,
          healing: s.healing,
        };
      }
    }

    return null;
  }

  getSubCategoryForSkill(skillName: string): string | null {
    return SKILL_TO_SUBCATEGORY[skillName] || null;
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
      if (isPassiveSkill(skillDef)) continue;
      if (skillDef.reqLevel && skillDef.reqLevel > session.stats.level) continue;
      if (skillDef.reqPoints && typeof skillDef.reqPoints === 'number') continue;
      if (skillDef.reqPoints && Array.isArray(skillDef.reqPoints)) {
        if (!meetsRequirements(skillDef.reqPoints, (skillName: string) => proficiencies[skillName] || 0)) continue;
      }
      available.push(name);
    }

    return available;
  }

  tickStatusEffects(session: PlayerSession, now: number): { damage: number; mpDamage: number; healed: number; expired: StatusEffect[] } {
    let damage = 0;
    let mpDamage = 0;
    let healed = 0;
    const expired: StatusEffect[] = [];

    if (!session.statusEffects) return { damage: 0, mpDamage: 0, healed: 0, expired: [] };

    for (const effect of session.statusEffects) {
      if (effect.songProximityBuff && effect.lastInRangeAt && now - effect.lastInRangeAt > 5000) {
        expired.push(effect);
        continue;
      }

      if (now - effect.appliedAt >= effect.duration) {
        expired.push(effect);
        continue;
      }

      if (effect.tickInterval > 0 && now - effect.lastTickAt >= effect.tickInterval) {
        effect.lastTickAt = now;
        if (effect.dotHPPercent && effect.dotHPPercent > 0) {
          damage += Math.floor(session.stats.maxHealth * effect.dotHPPercent);
        } else if (effect.potency > 0) {
          damage += effect.potency;
        }
        if (effect.dotMpDrain) {
          mpDamage += effect.dotMpDrain;
        }
      }

      if (effect.buffData?.healOverTime && now - effect.lastTickAt >= effect.buffData.healOverTime.tickInterval) {
        effect.lastTickAt = now;
        healed += effect.buffData.healOverTime.hpPerTick;
      }

      const songTypes = SONG_TYPES;
      if (songTypes.includes(effect.type) && effect.tickInterval > 0 && now - effect.lastTickAt >= effect.tickInterval) {
        effect.lastTickAt = now;
        if (effect.type === StatusEffectType.SONG_RED) {
          const basePower = 2;
          const totalINT = (session.statPoints.INT || 0) + (session.baseStats?.INT || 0);
          const totalSPI = (session.statPoints.SPI || 0) + (session.baseStats?.SPI || 0);
          damage += Math.floor(basePower * (totalINT + totalSPI * 0.3));
          mpDamage += Math.floor(basePower * (totalINT + totalSPI * 0.3) * 0.3);
        }
      }
    }

    session.statusEffects = session.statusEffects.filter(
      e => !expired.includes(e)
    );

    return { damage, mpDamage, healed, expired };
  }
}
