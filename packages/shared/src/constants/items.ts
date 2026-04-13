import { ItemDefinition, ItemType, ItemRarity, EquipmentSlot } from '../types/items';

export const ITEM_DATABASE: Record<string, ItemDefinition> = {
  'wooden_sword': {
    id: 'wooden_sword',
    name: 'Wooden Sword',
    type: ItemType.WEAPON,
    rarity: ItemRarity.COMMON,
    stats: { attack: 5 },
    description: 'A basic training sword.',
    maxStack: 1,
    sellPrice: 5,
    requiredLevel: 1,
    equipmentSlot: EquipmentSlot.WEAPON
  },
  'iron_sword': {
    id: 'iron_sword',
    name: 'Iron Sword',
    type: ItemType.WEAPON,
    rarity: ItemRarity.UNCOMMON,
    stats: { attack: 12, criticalChance: 0.05 },
    description: 'A sturdy iron blade.',
    maxStack: 1,
    sellPrice: 25,
    requiredLevel: 5,
    equipmentSlot: EquipmentSlot.WEAPON
  },
  'steel_blade': {
    id: 'steel_blade',
    name: 'Steel Blade',
    type: ItemType.WEAPON,
    rarity: ItemRarity.RARE,
    stats: { attack: 22, criticalChance: 0.1 },
    description: 'A finely crafted steel sword.',
    maxStack: 1,
    sellPrice: 80,
    requiredLevel: 10,
    equipmentSlot: EquipmentSlot.WEAPON
  },
  'leather_armor': {
    id: 'leather_armor',
    name: 'Leather Armor',
    type: ItemType.ARMOR,
    rarity: ItemRarity.COMMON,
    stats: { defense: 5, health: 10 },
    description: 'Basic leather protection.',
    maxStack: 1,
    sellPrice: 8,
    requiredLevel: 1,
    equipmentSlot: EquipmentSlot.ARMOR
  },
  'chainmail': {
    id: 'chainmail',
    name: 'Chainmail',
    type: ItemType.ARMOR,
    rarity: ItemRarity.UNCOMMON,
    stats: { defense: 12, health: 25 },
    description: 'Interlocking metal rings provide good protection.',
    maxStack: 1,
    sellPrice: 35,
    requiredLevel: 5,
    equipmentSlot: EquipmentSlot.ARMOR
  },
  'plate_armor': {
    id: 'plate_armor',
    name: 'Plate Armor',
    type: ItemType.ARMOR,
    rarity: ItemRarity.RARE,
    stats: { defense: 22, health: 50 },
    description: 'Heavy plate armor for maximum protection.',
    maxStack: 1,
    sellPrice: 100,
    requiredLevel: 10,
    equipmentSlot: EquipmentSlot.ARMOR
  },
  'cloth_helmet': {
    id: 'cloth_helmet',
    name: 'Cloth Hood',
    type: ItemType.HELMET,
    rarity: ItemRarity.COMMON,
    stats: { defense: 2, mana: 10 },
    description: 'A simple cloth hood.',
    maxStack: 1,
    sellPrice: 4,
    requiredLevel: 1,
    equipmentSlot: EquipmentSlot.HELMET
  },
  'iron_helmet': {
    id: 'iron_helmet',
    name: 'Iron Helmet',
    type: ItemType.HELMET,
    rarity: ItemRarity.UNCOMMON,
    stats: { defense: 8 },
    description: 'A solid iron helmet.',
    maxStack: 1,
    sellPrice: 20,
    requiredLevel: 5,
    equipmentSlot: EquipmentSlot.HELMET
  },
  'leather_boots': {
    id: 'leather_boots',
    name: 'Leather Boots',
    type: ItemType.BOOTS,
    rarity: ItemRarity.COMMON,
    stats: { defense: 3, speed: 0.5 },
    description: 'Comfortable leather boots.',
    maxStack: 1,
    sellPrice: 5,
    requiredLevel: 1,
    equipmentSlot: EquipmentSlot.BOOTS
  },
  'swift_boots': {
    id: 'swift_boots',
    name: 'Swift Boots',
    type: ItemType.BOOTS,
    rarity: ItemRarity.RARE,
    stats: { defense: 5, speed: 1.5 },
    description: 'Enchanted boots that increase movement speed.',
    maxStack: 1,
    sellPrice: 60,
    requiredLevel: 8,
    equipmentSlot: EquipmentSlot.BOOTS
  },
  'copper_ring': {
    id: 'copper_ring',
    name: 'Copper Ring',
    type: ItemType.ACCESSORY,
    rarity: ItemRarity.COMMON,
    stats: { health: 5, mana: 5 },
    description: 'A simple copper ring.',
    maxStack: 1,
    sellPrice: 10,
    requiredLevel: 1,
    equipmentSlot: EquipmentSlot.ACCESSORY
  },
  'health_potion': {
    id: 'health_potion',
    name: 'Health Potion',
    type: ItemType.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    stats: { health: 50 },
    description: 'Restores 50 health points.',
    maxStack: 20,
    sellPrice: 5,
    requiredLevel: 1
  },
  'mana_potion': {
    id: 'mana_potion',
    name: 'Mana Potion',
    type: ItemType.CONSUMABLE,
    rarity: ItemRarity.COMMON,
    stats: { mana: 40 },
    description: 'Restores 40 mana points.',
    maxStack: 20,
    sellPrice: 5,
    requiredLevel: 1
  },
  'wolf_pelt': {
    id: 'wolf_pelt',
    name: 'Wolf Pelt',
    type: ItemType.MATERIAL,
    rarity: ItemRarity.COMMON,
    stats: {},
    description: 'The pelt of a dire wolf. Can be sold or used in crafting.',
    maxStack: 50,
    sellPrice: 3,
    requiredLevel: 0
  },
  'goblin_ear': {
    id: 'goblin_ear',
    name: 'Goblin Ear',
    type: ItemType.QUEST,
    rarity: ItemRarity.COMMON,
    stats: {},
    description: 'Proof of defeating a goblin.',
    maxStack: 50,
    sellPrice: 1,
    requiredLevel: 0
  },
  'ancient_scroll': {
    id: 'ancient_scroll',
    name: 'Ancient Scroll',
    type: ItemType.MATERIAL,
    rarity: ItemRarity.RARE,
    stats: {},
    description: 'A mysterious scroll with ancient writings.',
    maxStack: 10,
    sellPrice: 50,
    requiredLevel: 0
  }
};

export function getItem(id: string): ItemDefinition | undefined {
  return ITEM_DATABASE[id];
}
