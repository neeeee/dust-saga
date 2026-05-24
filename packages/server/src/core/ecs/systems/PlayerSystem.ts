import { EntityManager, System } from '../EntityManager';
import { PlayerSession, JobId, BaseClass, StatType, InventoryItem } from '@dust-saga/shared';
import {
  calculateDerivedStats,
  getExperienceToNextLevel,
  getStatPointsGainedAtLevel,
  getSkillPointsGainedAtLevel,
  getBaseClassForJob,
  JOB_DEFINITIONS,
  ITEM_DATABASE,
  EquipmentSlot,
  GAME_CONFIG,
  MAX_LEVEL,
  getValidSubCategoryNames,
  recalculateCategoryTotals,
  getStatPointCost,
  getDesignJobId,
  getMinAdeptness,
  createDefaultSkillProficiencies,
  createDefaultSkillAdeptness,
  getEffectiveStats,
  computeStatBreakdown,
  calculateDodge,
  calculateAccuracy,
  getDodgeAgiBonus,
} from '@dust-saga/shared';

export class PlayerSystem extends System {
  private levelUpCallbacks: Array<(playerId: string, newLevel: number) => void> = [];

  private getGearBonuses(session: PlayerSession) {
    const bonuses = { attack: 0, defense: 0, health: 0, mana: 0, speed: 0, STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0, accuracy: 0, dodge: 0, attackSpeed: 0, castSpeed: 0, fireResist: 0, iceResist: 0, lightningResist: 0, poisonResist: 0, darkResist: 0, holyResist: 0, magicAttackPercent: 0, ailmentResist: 0, disorderResist: 0, criticalChance: 0 };
    for (const slot of Object.values(session.equipment)) {
      if (!slot) continue;
      const def = ITEM_DATABASE[slot.itemId];
      if (!def) continue;
      const s = def.stats;
      if (s.attack) bonuses.attack += s.attack;
      if (s.defense) bonuses.defense += s.defense;
      if (s.health) bonuses.health += s.health;
      if (s.mana) bonuses.mana += s.mana;
      if (s.speed) bonuses.speed += s.speed;
      if (s.STA) bonuses.STA += s.STA;
      if (s.STR) bonuses.STR += s.STR;
      if (s.AGI) bonuses.AGI += s.AGI;
      if (s.DEX) bonuses.DEX += s.DEX;
      if (s.SPI) bonuses.SPI += s.SPI;
      if (s.INT) bonuses.INT += s.INT;
      if (s.accuracy) bonuses.accuracy += s.accuracy;
      if (s.dodge) bonuses.dodge += s.dodge;
      if (s.attackSpeed) bonuses.attackSpeed += s.attackSpeed;
      if (s.castSpeed) bonuses.castSpeed += s.castSpeed;
      if (s.fireResist) bonuses.fireResist += s.fireResist;
      if (s.iceResist) bonuses.iceResist += s.iceResist;
      if (s.lightningResist) bonuses.lightningResist += s.lightningResist;
      if (s.poisonResist) bonuses.poisonResist += s.poisonResist;
      if (s.darkResist) bonuses.darkResist += s.darkResist;
      if (s.holyResist) bonuses.holyResist += s.holyResist;
      if (s.magicAttack) bonuses.magicAttackPercent += s.magicAttack;
      if (s.ailmentResist) bonuses.ailmentResist += s.ailmentResist;
      if (s.disorderResist) bonuses.disorderResist += s.disorderResist;
      if (s.criticalChance) bonuses.criticalChance += s.criticalChance;

      const enhanceLevel = slot.enhancementLevel || 0;
      if (enhanceLevel > 0) {
        const eqSlot = def.equipmentSlot;
        if (eqSlot === EquipmentSlot.WEAPON) {
          const isMagicWeapon = (s.magicAttack && s.magicAttack > 0) || (s.INT && s.INT > 0) || (s.SPI && s.SPI > 0);
          if (!isMagicWeapon) {
            bonuses.attack += enhanceLevel * 3;
          }
          if (isMagicWeapon) {
            bonuses.magicAttackPercent += enhanceLevel * 0.02;
          }
        } else if (eqSlot === EquipmentSlot.ARMOR || eqSlot === EquipmentSlot.HELMET || eqSlot === EquipmentSlot.GLOVES || eqSlot === EquipmentSlot.LEGS || eqSlot === EquipmentSlot.SHIELD) {
          bonuses.defense += enhanceLevel * 3;
          bonuses.health += enhanceLevel * 15;
        } else if (eqSlot === EquipmentSlot.BOOTS) {
          bonuses.defense += enhanceLevel * 2;
          bonuses.dodge += enhanceLevel * 1;
        }
      }
    }
    return bonuses;
  }

  constructor(entityManager: EntityManager) {
    super(entityManager);
  }

  onLevelUp(callback: (playerId: string, newLevel: number) => void): void {
    this.levelUpCallbacks.push(callback);
  }

  createSession(
    playerId: string,
    socketId: string,
    username: string,
    characterId: string,
    characterName: string,
    race: string,
    jobId: JobId,
    level: number,
    statPoints: any,
    unspentStatPoints: number,
    unspentSkillPoints: number,
    skillProficiencies: any,
    skillAdeptness: any,
    experience: number = 0
  ): PlayerSession {
    const baseClass = getBaseClassForJob(jobId);
    const stats = calculateDerivedStats(race as any, jobId, level, statPoints);
    const xpToNext = getExperienceToNextLevel(level);

    const designJobId = getDesignJobId(jobId);
    const adeptness = skillAdeptness
      ? (typeof skillAdeptness === 'string' ? JSON.parse(skillAdeptness) : skillAdeptness)
      : createDefaultSkillAdeptness(designJobId);

    return {
      playerId,
      socketId,
      username,
      characterId,
      characterName,
      race,
      jobId,
      baseClass,
      stats: {
        health: stats.maxHealth,
        maxHealth: stats.maxHealth,
        mana: stats.maxMana,
        maxMana: stats.maxMana,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        speedMultiplier: 1,
        magicAttack: stats.magicAttack,
        critChance: stats.critChance,
        castSpeed: 100,
        level,
        experience: typeof experience === 'string' ? parseInt(experience, 10) : (experience || 0),
        experienceToNext: xpToNext
      },
      statPoints,
      baseStats: stats.baseStats,
      unspentStatPoints,
      unspentSkillPoints,
      skillProficiencies,
      skillAdeptness: adeptness,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      zoneId: 'starter_zone',
      targetId: null,
      lastAttackTime: 0,
      lastManualAttackTime: 0,
      lastRegenTick: Date.now(),
      invulnerableUntil: Date.now() + 3000,
      isDead: false,
      deathTime: 0,
      nation: null,
      lastSafeZoneId: 'starter_zone',
      skillCooldowns: [],
      activeCast: null,
      statusEffects: [],
      statBreakdown: null,
      inventory: [],
      gold: 100,
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        gloves: null,
        legs: null,
        shield: null,
        earring_1: null,
        earring_2: null,
        necklace: null,
        belt: null,
        ring_1: null,
        ring_2: null,
      },
      quests: []
    };
  }

  grantExperience(session: PlayerSession, amount: number): boolean {
    if (session.stats.level >= MAX_LEVEL) return false;

    session.stats.experience += amount;

    let leveledUp = false;
    while (session.stats.experience >= session.stats.experienceToNext && session.stats.level < MAX_LEVEL) {
      session.stats.experience -= session.stats.experienceToNext;
      session.stats.level++;
      session.stats.experienceToNext = getExperienceToNextLevel(session.stats.level);

      const gainedStatPoints = getStatPointsGainedAtLevel(session.stats.level);
      session.unspentStatPoints += gainedStatPoints;
      session.unspentSkillPoints += getSkillPointsGainedAtLevel(session.stats.level);

      this.recalcStats(session);

      leveledUp = true;
      this.levelUpCallbacks.forEach(cb => cb(session.characterId, session.stats.level));
    }

    return leveledUp;
  }

  allocateStatPoint(session: PlayerSession, stat: StatType): boolean {
    const currentValue = session.statPoints[stat] + (session.baseStats?.[stat as keyof typeof session.baseStats] || 0);
    const [cost] = getStatPointCost(currentValue);

    if (session.unspentStatPoints < cost) return false;
    if (currentValue >= 99) return false;

    session.statPoints[stat] += 1;
    session.unspentStatPoints -= cost;

    this.recalcStats(session);
    return true;
  }

  allocateSkillPoint(session: PlayerSession, subCategoryName: string, count: number = 1): boolean {
    const validNames = getValidSubCategoryNames();
    if (!validNames.includes(subCategoryName)) return false;
    if (count <= 0 || !Number.isFinite(count)) return false;
    if (session.unspentSkillPoints < count) return false;

    session.skillProficiencies[subCategoryName] = (session.skillProficiencies[subCategoryName] || 0) + count;
    session.unspentSkillPoints -= count;

    if (session.skillAdeptness[subCategoryName] > session.skillProficiencies[subCategoryName]) {
      session.skillAdeptness[subCategoryName] = session.skillProficiencies[subCategoryName];
    }

    recalculateCategoryTotals(session.skillProficiencies);
    return true;
  }

  advanceJob(session: PlayerSession, newJobId: JobId): boolean {
    const currentJob = JOB_DEFINITIONS[session.jobId];
    const newJob = JOB_DEFINITIONS[newJobId];
    if (!currentJob || !newJob) return false;

    if (newJob.parentJob !== session.jobId) return false;

    const requiredLevel = newJob.tier === 2 ? 20 : newJob.tier === 3 ? 40 : 1;
    if (session.stats.level < requiredLevel) return false;

    session.jobId = newJobId;
    session.baseClass = newJob.baseClass;
    this.recalcStats(session);
    return true;
  }

  private getEnhancementBonuses(session: PlayerSession) {
    const enh = { attack: 0, defense: 0, health: 0, magicAttackPercent: 0, dodge: 0 };
    for (const slot of Object.values(session.equipment)) {
      if (!slot) continue;
      const level = slot.enhancementLevel || 0;
      if (level <= 0) continue;
      const def = ITEM_DATABASE[slot.itemId];
      if (!def) continue;
      const eqSlot = def.equipmentSlot;
      if (eqSlot === EquipmentSlot.WEAPON) {
        const s = def?.stats;
        const isMagicWeapon = (s?.magicAttack && s.magicAttack > 0) || (s?.INT && s.INT > 0) || (s?.SPI && s.SPI > 0);
        if (!isMagicWeapon) {
          enh.attack += level * 3;
        }
        if (isMagicWeapon) {
          enh.magicAttackPercent += level * 0.02;
        }
      } else if (eqSlot === EquipmentSlot.ARMOR || eqSlot === EquipmentSlot.HELMET || eqSlot === EquipmentSlot.GLOVES || eqSlot === EquipmentSlot.LEGS || eqSlot === EquipmentSlot.SHIELD) {
        enh.defense += level * 3;
        enh.health += level * 15;
      } else if (eqSlot === EquipmentSlot.BOOTS) {
        enh.defense += level * 2;
        enh.dodge += level * 1;
      }
    }
    return enh;
  }

  recalcStats(session: PlayerSession): void {
    const gear = this.getGearBonuses(session);

    const effectiveStatPoints = {
      STA: session.statPoints.STA + gear.STA,
      STR: session.statPoints.STR + gear.STR,
      AGI: session.statPoints.AGI + gear.AGI,
      DEX: session.statPoints.DEX + gear.DEX,
      SPI: session.statPoints.SPI + gear.SPI,
      INT: session.statPoints.INT + gear.INT,
    };

    const derived = calculateDerivedStats(
      session.race as any,
      session.jobId,
      session.stats.level,
      effectiveStatPoints
    );
    session.baseStats = derived.baseStats;
    const healthRatio = session.stats.maxHealth > 0 ? session.stats.health / session.stats.maxHealth : 1;
    const manaRatio = session.stats.maxMana > 0 ? session.stats.mana / session.stats.maxMana : 1;

    const oldMaxHealth = session.stats.maxHealth;
    const oldMaxMana = session.stats.maxMana;

    session.stats.maxHealth = derived.maxHealth + gear.health;
    session.stats.maxMana = derived.maxMana + gear.mana;
    session.stats.attack = derived.attack + gear.attack;
    session.stats.defense = derived.defense + gear.defense;
    session.stats.speed = derived.speed;
    session.stats.speedMultiplier = 1 + gear.speed;
    session.stats.magicAttack = Math.floor(derived.magicAttack * (1 + gear.magicAttackPercent));
    session.stats.critChance = derived.critChance + gear.criticalChance;
    session.stats.castSpeed = 100 + Math.floor((session.statPoints.DEX + gear.DEX) / 10) * 5 + Math.floor(gear.castSpeed * 100);

    const effective = getEffectiveStats(
      session.stats,
      effectiveStatPoints,
      session.statusEffects || []
    );
    session.stats.attack = effective.attack;
    session.stats.defense = effective.defense;
    session.stats.magicAttack = effective.magicAttack;
    session.stats.maxHealth = effective.maxHealth;
    session.stats.maxMana = effective.maxMana;
    session.stats.speed = effective.speed;

    if (session.stats.maxHealth !== oldMaxHealth) {
      session.stats.health = Math.floor(effective.maxHealth * healthRatio);
    }
    if (session.stats.maxMana !== oldMaxMana) {
      session.stats.mana = Math.floor(effective.maxMana * manaRatio);
    }

    const { STA, STR, AGI, DEX, SPI, INT, accuracy, dodge, attackSpeed, fireResist, iceResist, lightningResist, poisonResist, darkResist, holyResist, ailmentResist, disorderResist, ...flatGear } = gear;

    let buffFireResist = 0, buffIceResist = 0, buffLightningResist = 0, buffPoisonResist = 0, buffDarkResist = 0, buffHolyResist = 0;
    for (const effect of session.statusEffects || []) {
      if (effect.buffData?.resistMods) {
        const mods = effect.buffData.resistMods;
        if (mods.fire) buffFireResist += mods.fire;
        if (mods.ice) buffIceResist += mods.ice;
        if (mods.lightning) buffLightningResist += mods.lightning;
        if (mods.poison) buffPoisonResist += mods.poison;
        if (mods.dark) buffDarkResist += mods.dark;
        if (mods.holy) buffHolyResist += mods.holy;
      }
    }

    session.statBreakdown = computeStatBreakdown(session.statPoints, session.statusEffects || [], { STA, STR, AGI, DEX, SPI, INT }, { accuracy, dodge, attackSpeed, fireResist: fireResist + buffFireResist, iceResist: iceResist + buffIceResist, lightningResist: lightningResist + buffLightningResist, poisonResist: poisonResist + buffPoisonResist, darkResist: darkResist + buffDarkResist, holyResist: holyResist + buffHolyResist, ailmentResist, disorderResist });

    const enhBonuses = this.getEnhancementBonuses(session);
    session.statBreakdown.enhancement = enhBonuses;

    const baseStats = session.baseStats || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
    const totalAgi = (session.statPoints.AGI || 0) + baseStats.AGI + AGI + (session.statBreakdown.buffs?.AGI || 0);
    const totalDex = (session.statPoints.DEX || 0) + baseStats.DEX + DEX + (session.statBreakdown.buffs?.DEX || 0);
    session.statBreakdown.totalDodge = calculateDodge(session.stats.level, totalAgi, effective.dodgeBonus + dodge);
    session.statBreakdown.totalAccuracy = calculateAccuracy(session.stats.level, totalDex, effective.accuracyBonus + accuracy);
  }

  healPlayer(session: PlayerSession): void {
    session.stats.health = session.stats.maxHealth;
    session.stats.mana = session.stats.maxMana;
  }

  addItemToInventory(session: PlayerSession, itemId: string, quantity: number): boolean {
    if (session.inventory.length >= GAME_CONFIG.MAX_INVENTORY_SLOTS) return false;

    const existing = session.inventory.find(slot => slot.itemId === itemId);
    const itemDef = ITEM_DATABASE[itemId];

    if (existing && itemDef && itemDef.maxStack > 1) {
      if (existing.quantity + quantity <= itemDef.maxStack) {
        existing.quantity += quantity;
        return true;
      }
    }

    let emptySlot = -1;
    for (let i = 0; i < GAME_CONFIG.MAX_INVENTORY_SLOTS; i++) {
      if (!session.inventory.find(s => s.slot === i)) {
        emptySlot = i;
        break;
      }
    }

    if (emptySlot === -1) return false;

    session.inventory.push({ itemId, quantity, slot: emptySlot });
    return true;
  }

  addItemToInventoryWithMeta(session: PlayerSession, item: InventoryItem): boolean {
    if (session.inventory.length >= GAME_CONFIG.MAX_INVENTORY_SLOTS) return false;

    const itemDef = ITEM_DATABASE[item.itemId];
    if (itemDef && itemDef.maxStack > 1 && !item.enhancementLevel) {
      const existing = session.inventory.find(s => s.itemId === item.itemId);
      if (existing && existing.quantity + item.quantity <= itemDef.maxStack) {
        existing.quantity += item.quantity;
        return true;
      }
    }

    let emptySlot = -1;
    for (let i = 0; i < GAME_CONFIG.MAX_INVENTORY_SLOTS; i++) {
      if (!session.inventory.find(s => s.slot === i)) {
        emptySlot = i;
        break;
      }
    }

    if (emptySlot === -1) return false;

    session.inventory.push({ ...item, slot: emptySlot, quantity: item.quantity });
    return true;
  }

  removeItemFromInventory(session: PlayerSession, itemId: string, quantity: number): boolean {
    let remaining = quantity;
    for (const slot of session.inventory) {
      if (slot.itemId !== itemId || remaining <= 0) continue;
      const take = Math.min(remaining, slot.quantity);
      slot.quantity -= take;
      remaining -= take;
    }
    if (remaining > 0) return false;
    session.inventory = session.inventory.filter(s => s.quantity > 0);
    session.inventory.forEach((s, i) => { s.slot = i; });
    return true;
  }

  equipItem(session: PlayerSession, itemId: string): boolean {
    const invSlot = session.inventory.find(s => s.itemId === itemId);
    if (!invSlot) return false;

    const itemDef = ITEM_DATABASE[itemId];
    if (!itemDef || !itemDef.equipmentSlot) return false;
    if (session.stats.level < itemDef.requiredLevel) return false;

    let slot = itemDef.equipmentSlot as EquipmentSlot;
    if (slot === EquipmentSlot.RING_1 || slot === EquipmentSlot.RING_2) {
      slot = session.equipment.ring_1 ? EquipmentSlot.RING_2 : EquipmentSlot.RING_1;
    } else if (slot === EquipmentSlot.EARRING_1 || slot === EquipmentSlot.EARRING_2) {
      slot = session.equipment.earring_1 ? EquipmentSlot.EARRING_2 : EquipmentSlot.EARRING_1;
    }

    const currentlyEquipped = session.equipment[slot];
    if (currentlyEquipped) {
      this.unequipItem(session, slot);
    }

    session.equipment[slot] = {
      itemId,
      quantity: 1,
      slot: 0,
      enhancementLevel: invSlot.enhancementLevel,
      enhancementElement: invSlot.enhancementElement,
    };
    session.inventory = session.inventory.filter(s => s.itemId !== itemId);

    this.recalcStats(session);
    return true;
  }

  unequipItem(session: PlayerSession, slot: EquipmentSlot): boolean {
    const equipped = session.equipment[slot];
    if (!equipped) return false;

    const item: InventoryItem = {
      itemId: equipped.itemId,
      quantity: 1,
      slot: 0,
      enhancementLevel: equipped.enhancementLevel,
      enhancementElement: equipped.enhancementElement,
    };
    const added = this.addItemToInventoryWithMeta(session, item);
    if (!added) return false;
    session.equipment[slot] = null;
    this.recalcStats(session);
    return true;
  }

  update(deltaTime: number): void {
  }
}
