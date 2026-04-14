import { EntityManager, System } from '../EntityManager';
import { PlayerSession, CharacterClass } from '@dust-saga/shared';
import { getClassStats, getExperienceToNextLevel, ITEM_DATABASE, EquipmentSlot } from '@dust-saga/shared';
import { GAME_CONFIG } from '@dust-saga/shared';

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
    characterClass: CharacterClass,
    level: number
  ): PlayerSession {
    const stats = getClassStats(characterClass, level);
    const xpToNext = getExperienceToNextLevel(level);

    return {
      playerId,
      socketId,
      username,
      characterId,
      characterName,
      characterClass,
      stats: {
        health: stats.maxHealth,
        maxHealth: stats.maxHealth,
        mana: stats.maxMana,
        maxMana: stats.maxMana,
        attack: stats.attack,
        defense: stats.defense,
        speed: stats.speed,
        level,
        experience: 0,
        experienceToNext: xpToNext
      },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      zoneId: 'starter_zone',
      targetId: null,
      lastAttackTime: 0,
      invulnerableUntil: Date.now() + 3000,
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
    while (session.stats.experience >= session.stats.experienceToNext && session.stats.level < GAME_CONFIG.MAX_LEVEL) {
      session.stats.experience -= session.stats.experienceToNext;
      session.stats.level++;
      session.stats.experienceToNext = getExperienceToNextLevel(session.stats.level);

      const newStats = getClassStats(session.characterClass as CharacterClass, session.stats.level);
      session.stats.maxHealth = newStats.maxHealth;
      session.stats.maxMana = newStats.maxMana;
      session.stats.attack = newStats.attack;
      session.stats.defense = newStats.defense;
      session.stats.health = newStats.maxHealth;
      session.stats.mana = newStats.maxMana;

      leveledUp = true;
      this.levelUpCallbacks.forEach(cb => cb(session.characterId, session.stats.level));
    }

    return leveledUp;
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
