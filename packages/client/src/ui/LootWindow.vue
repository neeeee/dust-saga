<template>
  <div v-if="visible" class="loot-window">
    <div class="loot-header">
      <span class="loot-source">{{ sourceName || 'Loot' }}</span>
      <button class="loot-close" @click="$emit('close')">✕</button>
    </div>

    <div v-if="items.length === 0" class="loot-empty">Empty</div>

    <div v-else class="loot-list">
      <button
        v-for="it in items"
        :key="it.id"
        class="loot-row"
        :class="it.rarity"
        :disabled="!lootId"
        @click="lootId && $emit('take-item', lootId, it.id)"
      >
        <span class="loot-name">{{ itemName(it.itemId) }}</span>
        <span v-if="it.quantity > 1" class="loot-qty">×{{ it.quantity }}</span>
      </button>
    </div>

    <div class="loot-actions">
      <button
        v-if="items.length > 0 && lootId"
        class="loot-all-btn"
        @click="$emit('take-all', lootId)"
      >Loot All</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ITEM_DATABASE } from '@dust-saga/shared';

defineProps<{
  visible: boolean;
  lootId: string | null;
  sourceName: string;
  items: Array<{ id: string; itemId: string; quantity: number; rarity?: string }>;
}>();

defineEmits<{
  'close': [];
  'take-item': [lootId: string, itemId: string];
  'take-all': [lootId: string];
}>();

function itemName(id: string): string {
  return ITEM_DATABASE[id]?.name || id;
}
</script>

<style scoped>
.loot-window {
  position: fixed;
  bottom: 90px;
  right: 24px;
  width: 280px;
  background: rgba(15, 15, 30, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 12px 14px;
  color: white;
  z-index: 50;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

.loot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 6px;
}

.loot-source {
  font-weight: bold;
  color: #ffd166;
  font-size: 0.92rem;
}

.loot-close {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 4px;
}

.loot-close:hover { color: white; }

.loot-empty {
  color: #777;
  text-align: center;
  padding: 14px 0;
  font-size: 0.82rem;
}

.loot-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.loot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  color: white;
  cursor: pointer;
  font-size: 0.84rem;
}

.loot-row:hover {
  background: rgba(255, 209, 102, 0.15);
  border-color: rgba(255, 209, 102, 0.4);
}

.loot-row.common    { color: #ddd; }
.loot-row.uncommon  { color: #6ee06e; border-color: rgba(110, 224, 110, 0.25); }
.loot-row.rare      { color: #6699ff; border-color: rgba(102, 153, 255, 0.3); }
.loot-row.epic      { color: #b366ff; border-color: rgba(179, 102, 255, 0.3); }
.loot-row.legendary { color: #ffb347; border-color: rgba(255, 179, 71, 0.4); }

.loot-qty { color: #aaa; font-size: 0.78rem; }

.loot-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.loot-all-btn {
  background: rgba(76, 175, 80, 0.25);
  border: 1px solid rgba(76, 175, 80, 0.6);
  border-radius: 5px;
  color: #6ee06e;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: bold;
}

.loot-all-btn:hover { background: rgba(76, 175, 80, 0.4); }
</style>
