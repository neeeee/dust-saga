export enum LootRule {
  RANDOM = 'random',
  POOL = 'pool',
}

export enum PartyVisibility {
  PRIVATE = 'private',
  OPEN = 'open',
}

export interface PartyMember {
  characterId: string;
  characterName: string;
  level: number;
  jobId: string;
  health: number;
  maxHealth: number;
  isLeader: boolean;
  zoneId: string;
}

export interface PartySettings {
  visibility: PartyVisibility;
  lootRule: LootRule;
}

export interface PartyLootItem {
  lootId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  rolls: Record<string, number>;
}

export interface PartyData {
  partyId: string;
  leaderId: string;
  members: PartyMember[];
  settings: PartySettings;
}

export const MAX_PARTY_SIZE = 8;
export const MAX_LOOT_POOL = 16;
