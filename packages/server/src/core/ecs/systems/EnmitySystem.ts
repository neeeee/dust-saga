import { EnmityEntry } from '@dust-saga/shared';

const VE_DECAY_RATE = 60;
const CE_DECAY_RATE = 0;

export class EnmitySystem {

  addCE(enemy: { enmityTable?: Map<string, EnmityEntry> }, characterId: string, amount: number): void {
    this.ensureTable(enemy);
    const entry = enemy.enmityTable!.get(characterId);
    if (entry) {
      entry.ce += amount;
    } else {
      enemy.enmityTable!.set(characterId, { ce: amount, ve: 0, timestamp: Date.now() });
    }
  }

  addVE(enemy: { enmityTable?: Map<string, EnmityEntry> }, characterId: string, amount: number): void {
    this.ensureTable(enemy);
    const entry = enemy.enmityTable!.get(characterId);
    if (entry) {
      entry.ve += amount;
    } else {
      enemy.enmityTable!.set(characterId, { ce: 0, ve: amount, timestamp: Date.now() });
    }
  }

  addEnmity(enemy: { enmityTable?: Map<string, EnmityEntry>; state?: string; targetId?: string | null }, characterId: string, ce: number, ve: number): void {
    this.addCE(enemy, characterId, ce);
    this.addVE(enemy, characterId, ve);
    this.engageIfIdle(enemy, characterId);
  }

  addDamageEnmity(enemy: { enmityTable?: Map<string, EnmityEntry>; state?: string; targetId?: string | null }, characterId: string, damage: number): void {
    if (damage <= 0) return;
    this.addEnmity(enemy, characterId, damage, damage);
  }

  addDebuffEnmity(enemy: { enmityTable?: Map<string, EnmityEntry>; state?: string; targetId?: string | null }, characterId: string, potency: number, applied: boolean): void {
    const base = applied ? 300 + Math.floor(potency * 2) : 200;
    this.addEnmity(enemy, characterId, base, base);
  }

  addHealEnmity(enemy: { enmityTable?: Map<string, EnmityEntry>; state?: string; targetId?: string | null }, characterId: string, healing: number): void {
    if (healing <= 0) return;
    const amount = Math.floor(healing * 0.5);
    if (amount <= 0) return;
    this.addEnmity(enemy, characterId, amount, amount);
  }

  provokeEnmity(enemy: { enmityTable?: Map<string, EnmityEntry>; state?: string; targetId?: string | null }, characterId: string): void {
    this.ensureTable(enemy);
    let maxCE = 0;
    enemy.enmityTable!.forEach(entry => {
      if (entry.ce > maxCE) maxCE = entry.ce;
    });
    this.ensureTable(enemy);
    const entry = enemy.enmityTable!.get(characterId);
    if (entry) {
      entry.ce = maxCE + 1;
      entry.ve = 0;
    } else {
      enemy.enmityTable!.set(characterId, { ce: maxCE + 1, ve: 0, timestamp: Date.now() });
    }
    if (enemy.state === 'idle' || enemy.state === 'return') {
      enemy.state = 'chase';
      enemy.targetId = characterId;
    }
  }

  engageIfIdle(enemy: { state?: string; targetId?: string | null }, characterId: string): void {
    if (enemy.state === 'idle' || enemy.state === 'return') {
      enemy.state = 'chase';
      enemy.targetId = characterId;
    }
  }

  getTopTarget(
    enemy: { enmityTable?: Map<string, EnmityEntry>; targetId: string | null }
  ): { characterId: string; ce: number; ve: number; total: number } | null {
    if (!enemy.enmityTable || enemy.enmityTable.size === 0) return null;

    let best: { characterId: string; ce: number; ve: number; total: number; timestamp: number } | null = null;

    for (const [characterId, entry] of enemy.enmityTable) {
      const total = entry.ce + entry.ve;
      if (total <= 0) continue;
      if (!best || total > best.total || (total === best.total && entry.timestamp < best.timestamp)) {
        best = { characterId, ce: entry.ce, ve: entry.ve, total, timestamp: entry.timestamp };
      }
    }

    return best ? { characterId: best.characterId, ce: best.ce, ve: best.ve, total: best.total } : null;
  }

  removePlayer(enemy: { enmityTable?: Map<string, EnmityEntry> }, characterId: string): void {
    enemy.enmityTable?.delete(characterId);
  }

  decayVE(enemy: { enmityTable?: Map<string, EnmityEntry> }, deltaTime: number): void {
    if (!enemy.enmityTable || enemy.enmityTable.size === 0) return;

    const veDecay = Math.floor(VE_DECAY_RATE * deltaTime);
    const ceDecay = Math.floor(CE_DECAY_RATE * deltaTime);
    if (veDecay <= 0 && ceDecay <= 0) return;

    const toRemove: string[] = [];
    enemy.enmityTable.forEach((entry, characterId) => {
      entry.ve = Math.max(0, entry.ve - veDecay);
      entry.ce = Math.max(0, entry.ce - ceDecay);
      if (entry.ce <= 0 && entry.ve <= 0) {
        toRemove.push(characterId);
      }
    });

    for (const id of toRemove) {
      enemy.enmityTable!.delete(id);
    }
  }

  clearEnmity(enemy: { enmityTable?: Map<string, EnmityEntry> }): void {
    if (enemy.enmityTable) {
      enemy.enmityTable.clear();
    }
  }

  hasEnmityWithParty(enemy: { enmityTable?: Map<string, EnmityEntry> }, partyMemberIds: Set<string>): boolean {
    if (!enemy.enmityTable) return false;
    for (const id of partyMemberIds) {
      if (enemy.enmityTable.has(id)) return true;
    }
    return false;
  }

  private ensureTable(enemy: { enmityTable?: Map<string, EnmityEntry> }): void {
    if (!enemy.enmityTable) {
      enemy.enmityTable = new Map();
    }
  }
}
