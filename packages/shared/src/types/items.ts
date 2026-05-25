export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  HELMET = 'helmet',
  BOOTS = 'boots',
  GLOVES = 'gloves',
  LEGS = 'legs',
  SHIELD = 'shield',
  EARRING = 'earring',
  NECKLACE = 'necklace',
  BELT = 'belt',
  RING = 'ring',
  ACCESSORY = 'accessory',
  CONSUMABLE = 'consumable',
  MATERIAL = 'material',
  QUEST = 'quest'
}

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export enum EquipmentSlot {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  HELMET = 'helmet',
  BOOTS = 'boots',
  GLOVES = 'gloves',
  LEGS = 'legs',
  SHIELD = 'shield',
  EARRING_1 = 'earring_1',
  EARRING_2 = 'earring_2',
  NECKLACE = 'necklace',
  BELT = 'belt',
  RING_1 = 'ring_1',
  RING_2 = 'ring_2'
}

export interface ItemStats {
  attack?: number;
  magicAttack?: number;
  defense?: number;
  health?: number;
  mana?: number;
  speed?: number;
  criticalChance?: number;
  STA?: number;
  STR?: number;
  AGI?: number;
  DEX?: number;
  SPI?: number;
  INT?: number;
  accuracy?: number;
  dodge?: number;
  attackSpeed?: number;
  castSpeed?: number;
  fireResist?: number;
  iceResist?: number;
  lightningResist?: number;
  poisonResist?: number;
  darkResist?: number;
  holyResist?: number;
  ailmentResist?: number;
  disorderResist?: number;
  stunResist?: number;
  tripResist?: number;
  freezeResist?: number;
  burnResist?: number;
  curseResist?: number;
  bleedResist?: number;
  sleepResist?: number;
  weaknessResist?: number;
  weakenResist?: number;
  knockdownResist?: number;
  knockbackResist?: number;
  weaponElement?: 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'poison';
  weaponElementPower?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  stats: ItemStats;
  description: string;
  icon?: string;
  maxStack: number;
  sellPrice: number;
  requiredLevel: number;
  equipmentSlot?: EquipmentSlot;
  soulSlots?: number;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
  enhancementLevel?: number;
  enhancementElement?: 'fire' | 'ice' | 'lightning' | 'holy' | 'dark' | 'poison' | 'magic_fire' | 'magic_ice' | 'magic_lightning' | 'magic_holy' | 'magic_dark' | 'magic_poison';
}

export interface Equipment {
  weapon: InventoryItem | null;
  armor: InventoryItem | null;
  helmet: InventoryItem | null;
  boots: InventoryItem | null;
  gloves: InventoryItem | null;
  legs: InventoryItem | null;
  shield: InventoryItem | null;
  earring_1: InventoryItem | null;
  earring_2: InventoryItem | null;
  necklace: InventoryItem | null;
  belt: InventoryItem | null;
  ring_1: InventoryItem | null;
  ring_2: InventoryItem | null;
}

export const DEFAULT_EQUIPMENT: Equipment = {
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
};

export function normalizeEquipment(equipment: any): Equipment {
  if (!equipment) return { ...DEFAULT_EQUIPMENT };
  const norm = { ...DEFAULT_EQUIPMENT };
  for (const key of Object.keys(DEFAULT_EQUIPMENT) as (keyof Equipment)[]) {
    if (equipment[key] !== undefined && equipment[key] !== null) {
      norm[key] = equipment[key];
    }
  }
  return norm;
}

export interface LootDrop {
  itemId: string;
  quantity: number;
  chance: number;
}

export interface LootTable {
  rolls: number;
  drops: LootDrop[];
}
