import { EntityManager, System } from '../EntityManager';
import { PlayerSession, JobId, BaseClass, StatType } from '@dust-saga/shared';
import {
  calculateDerivedStats,
  getExperienceToNextLevel,
  getStatPointsGainedAtLevel,
  getBaseClassForJob,
  JOB_DEFINITIONS,
  ITEM_DATABASE,
  EquipmentSlot,
  GAME_CONFIG,
  MAX_LEVEL
} from '@dust-saga/shared';

export class PlayerSystem extends System {
  private levelUpCallbacks: Array<(playerId: string, newLevel: number) => void> = [];

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
    experience: number = 0
  ): PlayerSession {
    const baseClass = getBaseClassForJob(jobId);
    const stats = calculateDerivedStats(race as any, jobId, level, statPoints);
    const xpToNext = getExperienceToNextLevel(level);

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
      unspentStatPoints,
      unspentSkillPoints,
      skillProficiencies,
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
      session.unspentSkillPoints += 1;

      this.recalcStats(session);

      leveledUp = true;
      this.levelUpCallbacks.forEach(cb => cb(session.characterId, session.stats.level));
    }

    return leveledUp;
  }

  allocateStatPoint(session: PlayerSession, stat: StatType): boolean {
    const currentValue = session.statPoints[stat];
    const cost = Math.ceil((currentValue + 1) / 10);

    if (session.unspentStatPoints < cost) return false;
    if (currentValue >= 99) return false;

    session.statPoints[stat] += 1;
    session.unspentStatPoints -= cost;

    this.recalcStats(session);
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
    const derived = calculateDerivedStats(
      session.race as any,
      session.jobId,
      session.stats.level,
      session.statPoints
    );
    const healthRatio = session.stats.maxHealth > 0 ? session.stats.health / session.stats.maxHealth : 1;
    const manaRatio = session.stats.maxMana > 0 ? session.stats.mana / session.stats.maxMana : 1;

    session.stats.maxHealth = derived.maxHealth;
    session.stats.maxMana = derived.maxMana;
    session.stats.attack = derived.attack;
    session.stats.defense = derived.defense;
    session.stats.speed = derived.speed;
    session.stats.magicAttack = derived.magicAttack;

    session.stats.health = Math.floor(derived.maxHealth * healthRatio);
    session.stats.mana = Math.floor(derived.maxMana * manaRatio);
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

    if (itemDef.stats.attack) session.stats.attack += itemDef.stats.attack;
    if (itemDef.stats.defense) session.stats.defense += itemDef.stats.defense;
    if (itemDef.stats.health) session.stats.maxHealth += itemDef.stats.health;
    if (itemDef.stats.mana) session.stats.maxMana += itemDef.stats.mana;

    return true;
  }

  unequipItem(session: PlayerSession, slot: EquipmentSlot): boolean {
    const equipped = session.equipment[slot];
    if (!equipped) return false;

    const itemDef = ITEM_DATABASE[equipped.itemId];

    if (itemDef) {
      if (itemDef.stats.attack) session.stats.attack -= itemDef.stats.attack;
      if (itemDef.stats.defense) session.stats.defense -= itemDef.stats.defense;
      if (itemDef.stats.health) session.stats.maxHealth -= itemDef.stats.health;
      if (itemDef.stats.mana) session.stats.maxMana -= itemDef.stats.mana;
    }

    this.addItemToInventory(session, equipped.itemId, 1);
    session.equipment[slot] = null;
    return true;
  }

  update(deltaTime: number): void {
  }
}
