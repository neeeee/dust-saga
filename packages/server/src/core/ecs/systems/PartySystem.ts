import {
  PartyData, PartyMember, PartySettings, PartyVisibility,
  LootRule, PartyLootItem, MAX_PARTY_SIZE, MAX_LOOT_POOL,
  PlayerSession, JOB_DEFINITIONS
} from '@dust-saga/shared';

export class PartySystem {
  private parties: Map<string, PartyData> = new Map();
  private playerParty: Map<string, string> = new Map();
  private lootPool: Map<string, PartyLootItem[]> = new Map();
  private nextId = 1;

  createParty(
    leaderId: string,
    leaderSession: PlayerSession,
    settings: PartySettings
  ): PartyData | null {
    if (this.playerParty.has(leaderId)) return null;

    const partyId = `party_${this.nextId++}_${Date.now()}`;
    const leader: PartyMember = {
      characterId: leaderId,
      characterName: leaderSession.characterName,
      level: leaderSession.stats.level,
      jobId: leaderSession.jobId,
      health: leaderSession.stats.health,
      maxHealth: leaderSession.stats.maxHealth,
      isLeader: true,
      zoneId: leaderSession.zoneId,
    };

    const party: PartyData = {
      partyId,
      leaderId,
      members: [leader],
      settings,
    };

    this.parties.set(partyId, party);
    this.playerParty.set(leaderId, partyId);
    this.lootPool.set(partyId, []);
    return party;
  }

  joinParty(
    partyId: string,
    characterId: string,
    session: PlayerSession
  ): PartyData | null {
    const party = this.parties.get(partyId);
    if (!party) return null;
    if (this.playerParty.has(characterId)) return null;
    if (party.members.length >= MAX_PARTY_SIZE) return null;

    if (party.settings.visibility === PartyVisibility.PRIVATE) {
      return null;
    }

    const member: PartyMember = {
      characterId,
      characterName: session.characterName,
      level: session.stats.level,
      jobId: session.jobId,
      health: session.stats.health,
      maxHealth: session.stats.maxHealth,
      isLeader: false,
      zoneId: session.zoneId,
    };

    party.members.push(member);
    this.playerParty.set(characterId, partyId);
    return party;
  }

  joinByInvite(
    partyId: string,
    characterId: string,
    session: PlayerSession
  ): PartyData | null {
    const party = this.parties.get(partyId);
    if (!party) return null;
    if (this.playerParty.has(characterId)) return null;
    if (party.members.length >= MAX_PARTY_SIZE) return null;

    const member: PartyMember = {
      characterId,
      characterName: session.characterName,
      level: session.stats.level,
      jobId: session.jobId,
      health: session.stats.health,
      maxHealth: session.stats.maxHealth,
      isLeader: false,
      zoneId: session.zoneId,
    };

    party.members.push(member);
    this.playerParty.set(characterId, partyId);
    return party;
  }

  leaveParty(characterId: string): { party: PartyData; removedId: string; newLeader?: string } | null {
    const partyId = this.playerParty.get(characterId);
    if (!partyId) return null;

    const party = this.parties.get(partyId);
    if (!party) return null;

    party.members = party.members.filter(m => m.characterId !== characterId);
    this.playerParty.delete(characterId);

    let newLeader: string | undefined;
    if (party.members.length === 0) {
      this.parties.delete(partyId);
      this.lootPool.delete(partyId);
      return { party, removedId: characterId };
    }

    if (party.leaderId === characterId) {
      party.leaderId = party.members[0].characterId;
      party.members[0].isLeader = true;
      newLeader = party.leaderId;
    }

    return { party, removedId: characterId, newLeader };
  }

  kickMember(leaderId: string, targetId: string): { party: PartyData; removedId: string } | null {
    const partyId = this.playerParty.get(leaderId);
    if (!partyId) return null;

    const party = this.parties.get(partyId);
    if (!party || party.leaderId !== leaderId) return null;
    if (leaderId === targetId) return null;

    const isMember = party.members.some(m => m.characterId === targetId);
    if (!isMember) return null;

    party.members = party.members.filter(m => m.characterId !== targetId);
    this.playerParty.delete(targetId);

    return { party, removedId: targetId };
  }

  promoteLeader(leaderId: string, targetId: string): PartyData | null {
    const partyId = this.playerParty.get(leaderId);
    if (!partyId) return null;

    const party = this.parties.get(partyId);
    if (!party || party.leaderId !== leaderId) return null;

    const target = party.members.find(m => m.characterId === targetId);
    if (!target) return null;

    const oldLeader = party.members.find(m => m.characterId === leaderId);
    if (oldLeader) oldLeader.isLeader = false;
    target.isLeader = true;
    party.leaderId = targetId;

    return party;
  }

  updateMemberStats(characterId: string, session: PlayerSession): void {
    const partyId = this.playerParty.get(characterId);
    if (!partyId) return;

    const party = this.parties.get(partyId);
    if (!party) return;

    const member = party.members.find(m => m.characterId === characterId);
    if (!member) return;

    member.level = session.stats.level;
    member.health = session.stats.health;
    member.maxHealth = session.stats.maxHealth;
    member.jobId = session.jobId;
    member.zoneId = session.zoneId;
  }

  getPartyForMember(characterId: string): PartyData | null {
    const partyId = this.playerParty.get(characterId);
    if (!partyId) return null;
    return this.parties.get(partyId) || null;
  }

  getPartyForMemberOf(targetCharacterId: string): PartyData | null {
    const partyId = this.playerParty.get(targetCharacterId);
    if (!partyId) return null;
    return this.parties.get(partyId) || null;
  }

  getPartyData(partyId: string): PartyData | null {
    return this.parties.get(partyId) || null;
  }

  isPartyLeader(characterId: string): boolean {
    const party = this.getPartyForMember(characterId);
    return party?.leaderId === characterId;
  }

  getPartyMembers(characterId: string): string[] {
    const party = this.getPartyForMember(characterId);
    if (!party) return [];
    return party.members.map(m => m.characterId);
  }

  addLootToPool(
    partyId: string,
    lootId: string,
    itemId: string,
    itemName: string,
    quantity: number
  ): PartyLootItem | null {
    const pool = this.lootPool.get(partyId);
    if (!pool) return null;

    if (pool.length >= MAX_LOOT_POOL) return null;

    const item: PartyLootItem = { lootId, itemId, itemName, quantity, rolls: {} };
    pool.push(item);
    return item;
  }

  rollOnLoot(partyId: string, lootId: string, characterId: string, roll: number): PartyLootItem | null {
    const pool = this.lootPool.get(partyId);
    if (!pool) return null;

    const item = pool.find(i => i.lootId === lootId);
    if (!item) return null;

    item.rolls[characterId] = roll;
    return item;
  }

  resolveLootRoll(partyId: string, lootId: string): { winnerId: string; item: PartyLootItem } | null {
    const pool = this.lootPool.get(partyId);
    if (!pool) return null;

    const idx = pool.findIndex(i => i.lootId === lootId);
    if (idx === -1) return null;

    const item = pool[idx];
    const party = this.parties.get(partyId);
    if (!party) return null;

    const rollEntries = Object.entries(item.rolls);
    if (rollEntries.length === 0) {
      pool.splice(idx, 1);
      return null;
    }

    let winnerId = rollEntries[0][0];
    let highestRoll = rollEntries[0][1];
    for (let i = 1; i < rollEntries.length; i++) {
      if (rollEntries[i][1] > highestRoll) {
        winnerId = rollEntries[i][0];
        highestRoll = rollEntries[i][1];
      }
    }

    pool.splice(idx, 1);
    return { winnerId, item };
  }

  getLootPool(partyId: string): PartyLootItem[] {
    return this.lootPool.get(partyId) || [];
  }

  distributeLootRandom(
    partyId: string,
    itemId: string,
    itemName: string,
    quantity: number
  ): string | null {
    const party = this.parties.get(partyId);
    if (!party || party.members.length === 0) return null;

    const idx = Math.floor(Math.random() * party.members.length);
    return party.members[idx].characterId;
  }

  removeParty(partyId: string): void {
    const party = this.parties.get(partyId);
    if (!party) return;

    for (const m of party.members) {
      this.playerParty.delete(m.characterId);
    }
    this.parties.delete(partyId);
    this.lootPool.delete(partyId);
  }

  getMaxPartySize(): number {
    return MAX_PARTY_SIZE;
  }

  handleDisconnect(characterId: string): { party: PartyData; removedId: string; newLeader?: string } | null {
    return this.leaveParty(characterId);
  }
}
