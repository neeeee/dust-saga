import { EntityManager, System } from '../EntityManager';
import { PlayerSession, JobId, BaseClass, StatType } from '@dust-saga/shared';
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
} from '@dust-saga/shared';

export class PlayerSystem extends System {
  private levelUpCallbacks: Array<(playerId: string, newLevel: number) => void> = [];

  private getGearBonuses(session: PlayerSession) {
    const bonuses = { attack: 0, defense: 0, health: 0, mana: 0, speed: 0, STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
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
        magicAttack: stats.magicAttack,
        level,
        experience,
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
      lastRegenTick: Date.now(),
      invulnerableUntil: Date.now() + 3000,
      skillCooldowns: [],
      activeCast: null,
      statusEffects: [],
      statBreakdown: null,
      inventory: [],
      equipment: {
        weapon: null,
        armor: null,
        helmet: null,
        boots: null,
        accessory: null
      },
      quests: []
    };
  }

  grantExperience(session: PlayerSession, amount: number): boolean {
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
    const currentValue = session.statPoints[stat];
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

    session.stats.maxHealth = derived.maxHealth + gear.health;
    session.stats.maxMana = derived.maxMana + gear.mana;
    session.stats.attack = derived.attack + gear.attack;
    session.stats.defense = derived.defense + gear.defense;
    session.stats.speed = derived.speed + gear.speed;
    session.stats.magicAttack = derived.magicAttack;

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

    session.stats.health = Math.floor(effective.maxHealth * healthRatio);
    session.stats.mana = Math.floor(effective.maxMana * manaRatio);

    session.statBreakdown = computeStatBreakdown(session.statPoints, session.statusEffects || [], gear);
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

  removeItemFromInventory(session: PlayerSession, itemId: string, quantity: number): boolean {
    const slot = session.inventory.find(s => s.itemId === itemId);
    if (!slot || slot.quantity < quantity) return false;

    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      session.inventory = session.inventory.filter(s => s.itemId !== itemId);
    }
    return true;
  }

  equipItem(session: PlayerSession, itemId: string): boolean {
    const invSlot = session.inventory.find(s => s.itemId === itemId);
    if (!invSlot) return false;

    const itemDef = ITEM_DATABASE[itemId];
    if (!itemDef || !itemDef.equipmentSlot) return false;
    if (session.stats.level < itemDef.requiredLevel) return false;

    const slot = itemDef.equipmentSlot as EquipmentSlot;
    const currentlyEquipped = session.equipment[slot];

    if (currentlyEquipped) {
      this.unequipItem(session, slot);
    }

    session.equipment[slot] = { itemId, quantity: 1, slot: 0 };
    session.inventory = session.inventory.filter(s => s.itemId !== itemId);

    this.recalcStats(session);
    return true;
  }

  unequipItem(session: PlayerSession, slot: EquipmentSlot): boolean {
    const equipped = session.equipment[slot];
    if (!equipped) return false;

    this.addItemToInventory(session, equipped.itemId, 1);
    session.equipment[slot] = null;
    this.recalcStats(session);
    return true;
  }

  update(deltaTime: number): void {
  }
}
