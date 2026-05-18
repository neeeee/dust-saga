export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  HELMET = 'helmet',
  BOOTS = 'boots',
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
  ACCESSORY = 'accessory'
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
  fireResist?: number;
  iceResist?: number;
  lightningResist?: number;
  poisonResist?: number;
  darkResist?: number;
  holyResist?: number;
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
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
}

export interface Equipment {
  weapon: InventoryItem | null;
  armor: InventoryItem | null;
  helmet: InventoryItem | null;
  boots: InventoryItem | null;
  accessory: InventoryItem | null;
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
