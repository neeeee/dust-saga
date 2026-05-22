import { EntityManager, System } from '../EntityManager';
import { LootTable } from '@dust-saga/shared';

export interface LootInstance {
  id: string;
  itemId: string;
  quantity: number;
  position: { x: number; y: number; z: number };
  spawnTime: number;
  lootTableIndex: number;
}

export class LootSystem extends System {
  private activeLoot: Map<string, LootInstance> = new Map();
  private lootSpawnCallbacks: Array<(loot: LootInstance) => void> = [];
  private lootDespawnTime: number = 60000;

  constructor(entityManager: EntityManager) {
    super(entityManager);
  }

  onLootSpawn(callback: (loot: LootInstance) => void): void {
    this.lootSpawnCallbacks.push(callback);
  }

  generateLoot(
    lootTable: LootTable,
    position: { x: number; y: number; z: number },
    killerId: string
  ): LootInstance[] {
    const loot: LootInstance[] = [];

    for (let i = 0; i < lootTable.rolls; i++) {
      for (const drop of lootTable.drops) {
        if (Math.random() < drop.chance) {
          const lootInstance: LootInstance = {
            id: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            itemId: drop.itemId,
            quantity: drop.quantity,
            position: {
              x: position.x + (Math.random() - 0.5) * 2,
              y: position.y + 0.5,
              z: position.z + (Math.random() - 0.5) * 2
            },
            spawnTime: Date.now(),
            lootTableIndex: i
          };

          this.activeLoot.set(lootInstance.id, lootInstance);
          loot.push(lootInstance);
          this.lootSpawnCallbacks.forEach(cb => cb(lootInstance));
        }
      }
    }

    return loot;
  }

  getLootById(lootId: string): LootInstance | null {
    return this.activeLoot.get(lootId) || null;
  }

  pickupLoot(lootId: string, playerId: string): { itemId: string; quantity: number } | null {
    const loot = this.activeLoot.get(lootId);
    if (!loot) return null;

    if (Date.now() - loot.spawnTime > this.lootDespawnTime) {
      this.activeLoot.delete(lootId);
      return null;
    }

    this.activeLoot.delete(lootId);
    return { itemId: loot.itemId, quantity: loot.quantity };
  }

  getLootNearby(position: { x: number; y: number; z: number }, radius: number): LootInstance[] {
    const nearby: LootInstance[] = [];
    const now = Date.now();

    this.activeLoot.forEach(loot => {
      if (now - loot.spawnTime > this.lootDespawnTime) {
        this.activeLoot.delete(loot.id);
        return;
      }

      const dx = loot.position.x - position.x;
      const dz = loot.position.z - position.z;
      if (Math.sqrt(dx * dx + dz * dz) <= radius) {
        nearby.push(loot);
      }
    });

    return nearby;
  }

  update(deltaTime: number): void {
    const now = Date.now();
    this.activeLoot.forEach((loot, id) => {
      if (now - loot.spawnTime > this.lootDespawnTime) {
        this.activeLoot.delete(id);
      }
    });
  }
}
