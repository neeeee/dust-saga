import { PlayerSession, SkillDefinition, SkillCooldownEntry, ActiveCast, isPassiveSkill, meetsRequirements, getRequiredProficiency, COMBAT_CONFIG, StatusEffect, StatusEffectType, STATUS_EFFECT_DEFS } from '@dust-saga/shared';
import { CLASS_SKILL_DATA } from '@dust-saga/shared';
import { CLASS_SPECIFIC_SKILLS } from '@dust-saga/shared';

export interface SkillUseResult {
  success: boolean;
  damage?: number;
  healing?: number;
  isCritical?: boolean;
  damageType?: 'physical' | 'magical';
  statusEffects?: StatusEffect[];
  error?: string;
}

export class SkillSystem {
  private gcd: number = 1000;
  private globalCooldowns: Map<string, number> = new Map();

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

    return { canUse: true };
  }

  beginCast(
    session: PlayerSession,
    skillName: string,
    targetId: string | null
  ): { started: boolean; castTime: number } {
    const skill = this.findSkillDefinition(skillName);
    if (!skill) return { started: false, castTime: 0 };

    const castTime = skill.castTime * 1000;

    if (castTime <= 0) {
      return { started: true, castTime: 0 };
    }

    session.activeCast = {
      skillName,
      startedAt: Date.now(),
      castTime,
      targetId
    };

    return { started: true, castTime };
  }

  executeSkill(
    session: PlayerSession,
    skillName: string,
    targetId: string | null,
    getTargetStats: (id: string) => { defense: number; magicDefense: number; health: number } | null
  ): SkillUseResult {
    const skill = this.findSkillDefinition(skillName);
    if (!skill) return { success: false, error: 'not_found' };

    session.stats.mana -= skill.mpCost;

    const now = Date.now();
    if (!session.skillCooldowns) session.skillCooldowns = [];
    session.skillCooldowns.push({
      skillName,
      readyAt: now + skill.cooldown * 1000
    });

    this.globalCooldowns.set(session.characterId, now + this.gcd);

    session.activeCast = null;

    if (skill.duration > 0 && !isPassiveSkill(skill)) {
      this.applyBuff(session, skill);
    }

    const isAttack = skill.mpCost > 0 && !isPassiveSkill(skill) &&
      !skill.description.toLowerCase().includes('restore') &&
      !skill.description.toLowerCase().includes('heal') &&
      !skill.description.toLowerCase().includes('cure') &&
      !skill.description.toLowerCase().includes('increase') &&
      !skill.description.toLowerCase().includes('reduce') === false;

    if (targetId && isAttack) {
      const target = getTargetStats(targetId);
      if (target) {
        return this.calculateSkillDamage(session, skill, target);
      }
    }

    if (skill.description.toLowerCase().includes('restore') ||
        skill.description.toLowerCase().includes('heal')) {
      const healAmount = this.calculateHealing(session, skill);
      return { success: true, healing: healAmount };
    }

    return { success: true };
  }

  private calculateSkillDamage(
    session: PlayerSession,
    skill: SkillDefinition,
    target: { defense: number; magicDefense: number; health: number }
  ): SkillUseResult {
    const isMagical = skill.damageType === 'magical' ||
      skill.description.toLowerCase().includes('magic') ||
      skill.description.toLowerCase().includes('ice') ||
      skill.description.toLowerCase().includes('fire') ||
      skill.description.toLowerCase().includes('lightning') ||
      skill.description.toLowerCase().includes('dark') ||
      skill.description.toLowerCase().includes('holy');

    const attackStat = isMagical ? (session.stats as any).magicAttack || session.stats.attack : session.stats.attack;
    const defenseStat = isMagical ? target.magicDefense : target.defense;

    let damage = Math.max(
      COMBAT_CONFIG.MIN_DAMAGE,
      Math.floor(attackStat * 1.5 + skill.mpCost * 0.3 - defenseStat * 0.5)
    );

    const critChance = COMBAT_CONFIG.CRITICAL_CHANCE;
    const isCritical = Math.random() < critChance;
    if (isCritical) {
      damage = Math.floor(damage * COMBAT_CONFIG.CRITICAL_MULTIPLIER);
    }

    damage = Math.floor(damage * (0.9 + Math.random() * 0.2));

    const statusEffects: StatusEffect[] = [];
    if (skill.description.toLowerCase().includes('poison')) {
      const def = STATUS_EFFECT_DEFS[StatusEffectType.POISON];
      if (def) {
        statusEffects.push({
          id: `se_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: StatusEffectType.POISON,
          sourceId: session.characterId,
          targetId: '',
          potency: damage * 0.1,
          appliedAt: Date.now(),
          duration: def.duration,
          tickInterval: def.tickInterval,
          lastTickAt: Date.now(),
          stacks: 1
        });
      }
    }
    if (skill.description.toLowerCase().includes('stun')) {
      const def = STATUS_EFFECT_DEFS[StatusEffectType.STUN];
      if (def) {
        statusEffects.push({
          id: `se_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: StatusEffectType.STUN,
          sourceId: session.characterId,
          targetId: '',
          potency: 0,
          appliedAt: Date.now(),
          duration: def.duration,
          tickInterval: 0,
          lastTickAt: Date.now(),
          stacks: 1
        });
      }
    }
    if (skill.description.toLowerCase().includes('burn')) {
      const def = STATUS_EFFECT_DEFS[StatusEffectType.BURN];
      if (def) {
        statusEffects.push({
          id: `se_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: StatusEffectType.BURN,
          sourceId: session.characterId,
          targetId: '',
          potency: damage * 0.15,
          appliedAt: Date.now(),
          duration: def.duration,
          tickInterval: def.tickInterval,
          lastTickAt: Date.now(),
          stacks: 1
        });
      }
    }

    return {
      success: true,
      damage,
      isCritical,
      damageType: isMagical ? 'magical' : 'physical',
      statusEffects: statusEffects.length > 0 ? statusEffects : undefined
    };
  }

  private calculateHealing(session: PlayerSession, skill: SkillDefinition): number {
    const baseHeal = skill.mpCost * 2;
    const spi = (session as any).statPoints?.SPI || 0;
    return Math.floor(baseHeal + spi * 0.5);
  }

  private applyBuff(session: PlayerSession, skill: SkillDefinition): void {
    // Buff tracking handled via status effects system
  }

  updateCooldowns(session: PlayerSession): void {
    if (!session.skillCooldowns) return;
    const now = Date.now();
    session.skillCooldowns = session.skillCooldowns.filter(c => now < c.readyAt);
  }

  checkCasting(session: PlayerSession): { completed: boolean; skillName: string; targetId: string | null } | null {
    if (!session.activeCast) return null;

    const elapsed = Date.now() - session.activeCast.startedAt;
    if (elapsed >= session.activeCast.castTime) {
      return {
        completed: true,
        skillName: session.activeCast.skillName,
        targetId: session.activeCast.targetId
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
          isPassive: s.isPassive
        };
      }
    }

    return null;
  }

  getAvailableSkills(session: PlayerSession): string[] {
    const available: string[] = [];

    for (const category of Object.values(CLASS_SKILL_DATA)) {
      for (const subSkill of category.skills) {
        for (const [name, def] of Object.entries(subSkill.skills)) {
          if (typeof def.reqPoints === 'number') {
            available.push(name);
          }
        }
      }
    }

    const jobSkills = CLASS_SPECIFIC_SKILLS[0]; // TODO: map jobId to numeric ID
    if (jobSkills) {
      for (const [name, def] of Object.entries(jobSkills)) {
        if (!def.reqLevel || def.reqLevel <= session.stats.level) {
          available.push(name);
        }
      }
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
