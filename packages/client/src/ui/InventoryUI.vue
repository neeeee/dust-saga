<template>
  <div class="inventory-panel" v-if="visible">
    <div class="panel-header">
      <h3>Inventory</h3>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>

    <div class="inventory-content">
      <div class="equipment-section">
        <h4>Equipment</h4>
        <div class="equipment-slots">
          <div
            v-for="slot in equipmentSlots"
            :key="slot.key"
            class="equip-slot"
            :class="{ filled: equipment[slot.key] }"
            @click="handleEquipClick(slot.key)"
          >
            <span class="slot-label">{{ slot.label }}</span>
            <span v-if="equipment[slot.key]" class="slot-item">{{ getItemName(equipment[slot.key]?.itemId) }}</span>
          </div>
        </div>
      </div>

      <div class="items-section">
        <h4>Items ({{ inventory.length }}/{{ maxSlots }})</h4>
        <div class="item-grid">
          <div
            v-for="item in inventory"
            :key="item.slot"
            class="item-slot"
            :class="getItemRarity(item.itemId)"
            @click="handleItemClick(item)"
          >
            <span class="item-name">{{ getItemName(item.itemId) }}</span>
            <span v-if="item.quantity > 1" class="item-qty">x{{ item.quantity }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ITEM_DATABASE } from '@dust-saga/shared';

defineProps<{
  visible: boolean;
  inventory: Array<{ itemId: string; quantity: number; slot: number }>;
  equipment: Record<string, any>;
  maxSlots: number;
}>();

const emit = defineEmits<{
  'close': [];
  'use-item': [itemId: string];
  'equip-item': [itemId: string];
  'unequip-item': [slot: string];
}>();

const equipmentSlots = [
  { key: 'weapon', label: 'Weapon' },
  { key: 'helmet', label: 'Head' },
  { key: 'armor', label: 'Body' },
  { key: 'boots', label: 'Feet' },
  { key: 'accessory', label: 'Ring' }
];

function getItemName(itemId: string): string {
  return ITEM_DATABASE[itemId]?.name || itemId;
}

function getItemRarity(itemId: string): string {
  return ITEM_DATABASE[itemId]?.rarity || 'common';
}

function handleItemClick(item: { itemId: string; quantity: number }) {
  const itemDef = ITEM_DATABASE[item.itemId];
  if (!itemDef) return;

  if (itemDef.equipmentSlot) {
    emit('equip-item', item.itemId);
  } else if (itemDef.type === 'consumable') {
    emit('use-item', item.itemId);
  }
}

function handleEquipClick(slot: string) {
  emit('unequip-item', slot);
}
</script>

<style scoped>
.inventory-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 400px;
  background: rgba(10, 10, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  z-index: 50;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 1.2rem;
  cursor: pointer;
}

.close-btn:hover {
  color: white;
}

.inventory-content {
  padding: 12px 16px;
}

.equipment-section {
  margin-bottom: 16px;
}

.equipment-section h4,
.items-section h4 {
  margin: 0 0 8px;
  font-size: 0.85rem;
  color: #888;
}

.equipment-slots {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.equip-slot {
  width: 70px;
  height: 60px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.7rem;
}

.equip-slot.filled {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.15);
}

.slot-label {
  color: #666;
  font-size: 0.65rem;
}

.slot-item {
  color: #ddd;
  font-size: 0.65rem;
  text-align: center;
  margin-top: 2px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

.item-slot {
  padding: 6px 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  font-size: 0.7rem;
  position: relative;
  min-height: 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.item-slot:hover {
  background: rgba(255, 255, 255, 0.15);
}

.item-slot.uncommon {
  border-color: rgba(30, 255, 0, 0.4);
}

.item-slot.rare {
  border-color: rgba(0, 112, 255, 0.5);
}

.item-slot.epic {
  border-color: rgba(163, 53, 238, 0.5);
}

.item-slot.legendary {
  border-color: rgba(255, 165, 0, 0.5);
}

.item-name {
  font-size: 0.6rem;
  color: #ddd;
  line-height: 1.2;
}

.item-qty {
  font-size: 0.6rem;
  color: #aaa;
}
</style>
