<template>
  <div v-if="visible" class="dialog-wrapper" @click="handleClick">
    <div
      class="dialog-float"
      :style="floatStyle"
      @click.stop
    >
      <div class="npc-name">{{ npcName }}</div>
      <div class="dialog-text">{{ dialog?.text }}</div>
      <div v-if="dialog?.options?.length" class="dialog-options">
        <button
          v-for="(opt, i) in dialog.options"
          :key="i"
          class="dialog-option"
          @click.stop="handleOption(opt)"
        >
          {{ opt.text }}
        </button>
      </div>
      <div v-else class="dialog-hint">Click anywhere to continue</div>

      <div v-if="shopItems && shopItems.length > 0" class="shop-section">
        <h4>Shop</h4>
        <div class="shop-items">
          <div v-for="item in shopItems" :key="item.id" class="shop-item" @click.stop="$emit('buy', item.id)">
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
          :key="q.id || q"
          class="quest-offer-btn"
          @click.stop="$emit('accept-quest', q.id || q)"
        >
          <span class="quest-offer-title">{{ q.title || getQuestTitle(q.id || q) }}</span>
          <span v-if="q.description" class="quest-offer-desc">{{ q.description }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { QUEST_DATABASE } from '@dust-saga/shared';

const props = defineProps<{
  visible: boolean;
  npcName: string;
  dialog: any;
  shopItems: any[];
  availableQuests: Array<string | { id: string; title?: string; description?: string }>;
  npcScreenPos: { x: number; y: number } | null;
}>();

const emit = defineEmits<{
  'close': [];
  'select-option': [option: any];
  'buy': [itemId: string];
  'accept-quest': [questId: string];
  'progress': [];
}>();

const panelWidth = 380;
const panelHeight = 200;

const floatStyle = computed(() => {
  if (!props.npcScreenPos) return { display: 'none' };

  let x = props.npcScreenPos.x - panelWidth / 2;
  let y = props.npcScreenPos.y - panelHeight - 10;

  x = Math.max(8, Math.min(x, window.innerWidth - panelWidth - 8));
  y = Math.max(8, y);

  return {
    left: `${x}px`,
    top: `${y}px`,
  };
});

function handleClick() {
  if (props.dialog?.options?.length) return;
  emit('progress');
}

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

function handleKeyDown(e: KeyboardEvent) {
  if (!props.visible) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  cursor: pointer;
}

.dialog-float {
  position: fixed;
  background: rgba(15, 15, 30, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 16px 18px;
  width: 380px;
  color: white;
  cursor: default;
  pointer-events: auto;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

.npc-name {
  font-size: 1.05rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 8px;
}

.dialog-text {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 10px;
  line-height: 1.5;
  font-size: 0.88rem;
}

.dialog-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 8px;
}

.dialog-option {
  text-align: left;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #ddd;
  cursor: pointer;
  font-size: 0.82rem;
}

.dialog-option:hover {
  background: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
}

.dialog-hint {
  text-align: center;
  color: #666;
  font-size: 0.75rem;
  margin-top: 4px;
}

.shop-section, .quest-offers {
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.shop-section h4, .quest-offers h4 {
  margin: 0 0 6px;
  color: #888;
  font-size: 0.82rem;
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.shop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
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
  font-size: 0.68rem;
}

.quest-offer-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 12px;
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 6px;
  color: #4CAF50;
  cursor: pointer;
  font-size: 0.82rem;
  margin-bottom: 3px;
}

.quest-offer-btn:hover {
  background: rgba(76, 175, 80, 0.25);
}

.quest-offer-desc {
  display: block;
  font-size: 0.68rem;
  color: #aaa;
  margin-top: 2px;
  font-weight: normal;
}
</style>
