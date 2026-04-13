<template>
  <div class="dialog-overlay" v-if="visible" @click.self="$emit('close')">
    <div class="dialog-box">
      <div class="npc-name">{{ npcName }}</div>
      <div class="dialog-text">{{ dialog?.text }}</div>
      <div class="dialog-options">
        <button
          v-for="(opt, i) in dialog?.options || []"
          :key="i"
          class="dialog-option"
          @click="handleOption(opt)"
        >
          {{ opt.text }}
        </button>
      </div>

      <div v-if="shopItems && shopItems.length > 0" class="shop-section">
        <h4>Shop</h4>
        <div class="shop-items">
          <div v-for="item in shopItems" :key="item.id" class="shop-item" @click="$emit('buy', item.id)">
            <span class="item-name">{{ item.name }}</span>
            <span class="item-price">{{ item.sellPrice }}g</span>
            <span class="item-stats">{{ formatStats(item.stats) }}</span>
          </div>
        </div>
      </div>

      <div v-if="availableQuests && availableQuests.length > 0" class="quest-offers">
        <h4>Available Quests</h4>
        <button
          v-for="q in availableQuests"
          :key="q"
          class="quest-offer-btn"
          @click="$emit('accept-quest', q)"
        >
          {{ getQuestTitle(q) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { QUEST_DATABASE } from '@dust-saga/shared';

defineProps<{
  visible: boolean;
  npcName: string;
  dialog: any;
  shopItems: any[];
  availableQuests: string[];
}>();

const emit = defineEmits<{
  'close': [];
  'select-option': [option: any];
  'buy': [itemId: string];
  'accept-quest': [questId: string];
}>();

function handleOption(opt: any) {
  if (opt.action === 'close') {
    emit('close');
  } else {
    emit('select-option', opt);
  }
}

function getQuestTitle(questId: string): string {
  return QUEST_DATABASE[questId]?.title || questId;
}

function formatStats(stats: any): string {
  if (!stats) return '';
  const parts: string[] = [];
  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.health) parts.push(`+${stats.health} HP`);
  if (stats.mana) parts.push(`+${stats.mana} MP`);
  return parts.join(' ');
}
</script>

<style scoped>
.dialog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 60;
}

.dialog-box {
  background: rgba(15, 15, 30, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 20px;
  width: 450px;
  max-height: 80vh;
  overflow-y: auto;
  color: white;
}

.npc-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 12px;
}

.dialog-text {
  background: rgba(255, 255, 255, 0.05);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  line-height: 1.5;
  font-size: 0.9rem;
}

.dialog-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.dialog-option {
  text-align: left;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #ddd;
  cursor: pointer;
  font-size: 0.85rem;
}

.dialog-option:hover {
  background: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
}

.shop-section, .quest-offers {
  margin-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 12px;
}

.shop-section h4, .quest-offers h4 {
  margin: 0 0 8px;
  color: #888;
  font-size: 0.85rem;
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.shop-item:hover {
  background: rgba(102, 126, 234, 0.15);
}

.shop-item .item-name {
  color: #ddd;
}

.shop-item .item-price {
  color: #ffd700;
}

.shop-item .item-stats {
  color: #888;
  font-size: 0.7rem;
}

.quest-offer-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 6px;
  color: #4CAF50;
  cursor: pointer;
  font-size: 0.85rem;
  margin-bottom: 4px;
}

.quest-offer-btn:hover {
  background: rgba(76, 175, 80, 0.25);
}
</style>
