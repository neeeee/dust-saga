<template>
  <div ref="panelRef" class="trade-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }" @mousedown="onMouseDown">
    <div class="panel-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
      <h3>Trade</h3>
      <button class="close-btn" @click="$emit('cancel')">x</button>
    </div>

    <div class="trade-content" v-if="trade">
      <div class="trade-columns">
        <div class="trade-column">
          <div class="column-label">You</div>
          <div class="offer-slots">
            <div
              v-for="(item, idx) in trade.yourOffer.items"
              :key="idx"
              class="offer-item"
              @contextmenu.prevent="$emit('remove-item', idx)"
            >
              <span class="item-name">{{ getItemName(item.itemId) }}</span>
              <span class="item-qty" v-if="item.quantity > 1">x{{ item.quantity }}</span>
              <span class="item-enh" v-if="item.enhancementLevel"> +{{ item.enhancementLevel }}</span>
            </div>
            <div
              v-if="canModify && trade.yourOffer.items.length < 12"
              class="offer-slot empty"
              @dragover.prevent="$event.currentTarget.classList.add('drag-over')"
              @dragleave="$event.currentTarget.classList.remove('drag-over')"
              @drop="onDrop($event)"
            >
              <span class="slot-placeholder">Drag item here</span>
            </div>
          </div>
          <div class="gold-row" v-if="canModify">
            <input
              type="number"
              class="gold-input"
              :value="trade.yourOffer.gold"
              min="0"
              @change="onGoldChange($event)"
              placeholder="Gold"
            />
            <span class="gold-label">g</span>
          </div>
          <div class="gold-row" v-else>
            <span class="gold-display">{{ trade.yourOffer.gold }} g</span>
          </div>
          <div class="accept-status" :class="{ accepted: trade.yourOffer.accepted }">
            {{ trade.yourOffer.accepted ? '✓ Accepted' : '' }}
          </div>
        </div>

        <div class="trade-column">
          <div class="column-label">{{ trade.partnerName }}</div>
          <div class="offer-slots">
            <div
              v-for="(item, idx) in trade.theirOffer.items"
              :key="idx"
              class="offer-item theirs"
            >
              <span class="item-name">{{ getItemName(item.itemId) }}</span>
              <span class="item-qty" v-if="item.quantity > 1">x{{ item.quantity }}</span>
              <span class="item-enh" v-if="item.enhancementLevel"> +{{ item.enhancementLevel }}</span>
            </div>
          </div>
          <div class="gold-row">
            <span class="gold-display">{{ trade.theirOffer.gold }} g</span>
          </div>
          <div class="accept-status" :class="{ accepted: trade.theirOffer.accepted }">
            {{ trade.theirOffer.accepted ? '✓ Accepted' : '' }}
          </div>
        </div>
      </div>

      <div class="trade-actions">
        <button
          v-if="canModify"
          class="accept-btn"
          @click="$emit('accept')"
        >
          Accept Trade
        </button>
        <button
          v-if="!canModify && !trade.yourOffer.accepted"
          class="accept-btn"
          @click="$emit('accept')"
        >
          Accept Trade
        </button>
        <span v-if="trade.yourOffer.accepted && !trade.theirOffer.accepted" class="waiting-text">
          Waiting for {{ trade.partnerName }}...
        </span>
        <button class="cancel-btn" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDraggable } from '../composables/useDraggable';
import { getItem } from '@dust-saga/shared';
import type { TradeState } from '@dust-saga/shared';

const props = defineProps<{
  visible: boolean;
  trade: TradeState | null;
}>();

const emit = defineEmits<{
  'add-item': [slot: number, quantity: number];
  'remove-item': [offerIndex: number];
  'set-gold': [gold: number];
  'accept': [];
  'cancel': [];
}>();

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-trade', { x: 300, y: 100 });
const panelRef = ref<HTMLElement | null>(null);

const canModify = computed(() => {
  if (!props.trade) return false;
  return !props.trade.yourOffer.accepted;
});

function getItemName(itemId: string): string {
  const def = getItem(itemId);
  return def?.name || itemId;
}

function onMouseDown(_e: MouseEvent): void {
  // useDraggable handles drag via data-drag-handle
}

function onDrop(e: DragEvent): void {
  e.currentTarget?.classList.remove('drag-over');
  const raw = e.dataTransfer?.getData('text/plain');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.slot !== undefined) {
      emit('add-item', data.slot, 1);
    }
  } catch {}
}

function onGoldChange(e: Event): void {
  const target = e.target as HTMLInputElement;
  emit('set-gold', parseInt(target.value) || 0);
}

watch(() => props.visible, (v) => {
  if (v && panelRef.value) attach(panelRef.value);
  if (!v && panelRef.value) detach(panelRef.value);
}, { flush: 'post' });
</script>

<style scoped>
.trade-panel {
  position: absolute;
  width: 460px;
  background: rgba(10, 10, 25, 0.95);
  border: 1px solid #333;
  border-radius: 6px;
  z-index: 50;
  user-select: none;
  font-family: 'Segoe UI', sans-serif;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid #333;
  cursor: move;
}
.panel-header h3 {
  margin: 0;
  font-size: 13px;
  color: #aabbdd;
  flex: 1;
}
.drag-dots { color: #555; font-size: 14px; }
.close-btn {
  background: none;
  border: none;
  color: #a66;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}
.close-btn:hover { color: #f88; }
.trade-content { padding: 10px; }
.trade-columns {
  display: flex;
  gap: 10px;
}
.trade-column {
  flex: 1;
  min-height: 160px;
}
.column-label {
  font-size: 11px;
  color: #88a;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.offer-slots {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 100px;
  padding: 4px;
  background: rgba(0,0,0,0.3);
  border: 1px solid #2a2a3a;
  border-radius: 4px;
}
.offer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  background: rgba(100, 130, 200, 0.15);
  border: 1px solid #3a4a5a;
  border-radius: 3px;
  font-size: 12px;
  color: #ccf;
  cursor: pointer;
}
.offer-item.theirs {
  background: rgba(200, 130, 100, 0.12);
  border-color: #5a3a2a;
  color: #fbb;
  cursor: default;
}
.offer-item:hover:not(.theirs) {
  background: rgba(100, 130, 200, 0.25);
}
.item-name { flex: 1; }
.item-qty { color: #aaa; font-size: 11px; }
.item-enh { color: #6f6; font-size: 11px; }
.offer-slot.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border: 1px dashed #333;
  border-radius: 3px;
}
.offer-slot.drag-over {
  border-color: #6af;
  background: rgba(100, 170, 255, 0.1);
}
.slot-placeholder { font-size: 11px; color: #555; }
.gold-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}
.gold-input {
  flex: 1;
  background: rgba(0,0,0,0.4);
  border: 1px solid #444;
  color: #dd0;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 13px;
  width: 60px;
}
.gold-label { color: #aa0; font-size: 12px; }
.gold-display { color: #dd0; font-size: 13px; padding: 3px 0; }
.accept-status {
  height: 16px;
  font-size: 11px;
  color: #5f5;
  margin-top: 4px;
}
.trade-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #333;
}
.accept-btn {
  background: #263;
  border: 1px solid #4a5;
  color: #fff;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.accept-btn:hover { background: #374; }
.waiting-text { font-size: 11px; color: #88a; }
.cancel-btn {
  background: #333;
  border: 1px solid #555;
  color: #ddd;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.cancel-btn:hover { background: #444; }
</style>
