import { v4 as uuidv4 } from 'uuid';
import {
  SummonInstance, SummonType, SummonObject, COMBAT_SUMMON_TYPES, MAX_PLANTS,
} from '@dust-saga/shared';

export class SummonManager {
  private summons: Map<string, SummonInstance> = new Map();
  private ownerIndex: Map<string, string[]> = new Map();
  private zoneIndex: Map<string, Set<string>> = new Map();

  spawnSummon(
    ownerId: string,
    ownerName: string,
    zoneId: string,
    summonObj: SummonObject,
    position: { x: number; y: number; z: number },
    rotation: number,
    element?: string,
  ): SummonInstance | null {
    const summonType = summonObj.objectType as SummonType;
    this.enforceLimits(ownerId, summonType);

    const now = Date.now() / 1000;
    const summon: SummonInstance = {
      id: uuidv4(),
      ownerId,
      ownerName,
      summonType,
      position: { ...position },
      rotation,
      health: summonObj.hp || 500,
      maxHealth: summonObj.hp || 500,
      defense: summonObj.defense || 0,
      element,
      attackDamage: summonObj.attackDamage || summonObj.aoeDamage || 0,
      attackRange: summonObj.attackRange || 3,
      attackCooldown: summonObj.attackCooldown || 3,
      lastAttackTime: 0,
      duration: summonObj.duration,
      spawnedAt: now,
      targetId: null,
      state: summonType === SummonType.WALL ? 'idle' : 'follow',
      zoneId,
    };

    this.summons.set(summon.id, summon);

    if (!this.ownerIndex.has(ownerId)) this.ownerIndex.set(ownerId, []);
    this.ownerIndex.get(ownerId)!.push(summon.id);

    if (!this.zoneIndex.has(zoneId)) this.zoneIndex.set(zoneId, new Set());
    this.zoneIndex.get(zoneId)!.add(summon.id);

    return summon;
  }

  private enforceLimits(ownerId: string, summonType: SummonType): void {
    const owned = this.ownerIndex.get(ownerId) || [];

    if (summonType === SummonType.WALL) {
      const existing = owned.find(id => this.summons.get(id)?.summonType === SummonType.WALL);
      if (existing) this.despawnSummon(existing);
      return;
    }

    if (summonType === SummonType.PLANT) {
      const plants = owned.filter(id => this.summons.get(id)?.summonType === SummonType.PLANT);
      if (plants.length >= MAX_PLANTS) {
        this.despawnSummon(plants[0]);
      }
      return;
    }

    if (summonType === SummonType.WYVERN || summonType === SummonType.TURTLE) {
      for (const id of [...owned]) {
        const s = this.summons.get(id);
        if (s && COMBAT_SUMMON_TYPES.includes(s.summonType)) {
          this.despawnSummon(id);
        }
      }
    }
  }

  despawnSummon(summonId: string): void {
    const summon = this.summons.get(summonId);
    if (!summon) return;

    this.summons.delete(summonId);

    const owned = this.ownerIndex.get(summon.ownerId);
    if (owned) {
      const idx = owned.indexOf(summonId);
      if (idx !== -1) owned.splice(idx, 1);
      if (owned.length === 0) this.ownerIndex.delete(summon.ownerId);
    }

    const zoneSet = this.zoneIndex.get(summon.zoneId);
    if (zoneSet) {
      zoneSet.delete(summonId);
      if (zoneSet.size === 0) this.zoneIndex.delete(summon.zoneId);
    }
  }

  despawnAllForOwner(ownerId: string): string[] {
    const owned = this.ownerIndex.get(ownerId);
    if (!owned) return [];
    const despawned = [...owned];
    for (const id of despawned) {
      this.despawnSummon(id);
    }
    return despawned;
  }

  getSummon(summonId: string): SummonInstance | undefined {
    return this.summons.get(summonId);
  }

  getSummonsInZone(zoneId: string): SummonInstance[] {
    const ids = this.zoneIndex.get(zoneId);
    if (!ids) return [];
    const result: SummonInstance[] = [];
    for (const id of ids) {
      const s = this.summons.get(id);
      if (s) result.push(s);
    }
    return result;
  }

  getSummonsForOwner(ownerId: string): SummonInstance[] {
    const owned = this.ownerIndex.get(ownerId);
    if (!owned) return [];
    const result: SummonInstance[] = [];
    for (const id of owned) {
      const s = this.summons.get(id);
      if (s) result.push(s);
    }
    return result;
  }

  tickExpired(): string[] {
    const now = Date.now() / 1000;
    const expired: string[] = [];
    for (const [id, summon] of this.summons) {
      if (now - summon.spawnedAt >= summon.duration) {
        expired.push(id);
      }
    }
    for (const id of expired) {
      this.despawnSummon(id);
    }
    return expired;
  }
}
