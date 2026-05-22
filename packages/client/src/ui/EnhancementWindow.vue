<template>
  <div ref="panelRef" class="enhancement-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
    <div class="panel-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
      <h3>Enhancement</h3>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>

    <div class="enhancement-content">
      <div class="columns">
        <div class="column">
          <div class="column-label">Weapon</div>
          <div
            class="slot weapon-slot"
            :class="{ filled: weaponSlot }"
            @dragover.prevent="onDragOver($event, 'weapon')"
            @dragleave="onDragLeave($event)"
            @drop="onDrop($event, 'weapon')"
          >
            <template v-if="weaponSlot">
              <span class="slot-item-name">{{ getWeaponDisplayName() }}</span>
              <span class="slot-remove" @click="clearSlot('weapon')">x</span>
            </template>
            <template v-else>
              <span class="slot-placeholder">Drag weapon here</span>
            </template>
          </div>
        </div>

        <div class="column">
          <div class="column-label">Materials</div>
          <div class="material-slots">
            <div
              v-for="i in 3"
              :key="i"
              class="slot material-slot"
              :class="{ filled: materialSlots[i - 1] }"
              @dragover.prevent="onDragOver($event, 'material', i - 1)"
              @dragleave="onDragLeave($event)"
              @drop="onDrop($event, 'material', i - 1)"
            >
              <template v-if="materialSlots[i - 1]">
                <span class="slot-item-name">{{ getItemName(materialSlots[i - 1]!.itemId) }}</span>
                <span class="slot-remove" @click="clearSlot('material', i - 1)">x</span>
              </template>
              <template v-else>
                <span class="slot-placeholder">Material</span>
              </template>
            </div>
          </div>
        </div>

        <div class="column">
          <div class="column-label">Result</div>
          <div class="slot result-slot">
            <template v-if="resultItem">
              <span class="slot-item-name result-name">{{ getItemName(resultItem) }}</span>
            </template>
            <template v-else>
              <span class="slot-placeholder">?</span>
            </template>
          </div>
          <button class="enhance-btn" :disabled="!canEnhance" @click="handleEnhance">
            Enhance
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue';
import { ITEM_DATABASE, getEnhancedItemName } from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-enhancement', { x: 400, y: 150 });
const panelRef = ref<HTMLElement | null>(null);

const props = defineProps<{
  visible: boolean;
  inventory: Array<{ itemId: string; quantity: number; slot: number }>;
  equipment: Record<string, any>;
}>();

const emit = defineEmits<{
  'close': [];
  'enhance': [data: { weaponSlot: { slotIndex: number; itemId: string }; materialSlots: Array<{ slotIndex: number; itemId: string }> }];
}>();

const weaponSlot = ref<{ itemId: string; slot: number; enhancementLevel?: number; enhancementElement?: string } | null>(null);
const materialSlots = reactive<[typeof weaponSlot.value, typeof weaponSlot.value, typeof weaponSlot.value]>([null, null, null]);
const resultItem = ref<string | null>(null);

const GEM_ELEMENTS: Record<string, string> = {
  fire_gem: 'fire', ice_gem: 'ice', lightning_gem: 'lightning',
  holy_gem: 'holy', dark_gem: 'dark', poison_gem: 'poison',
  fire_magic_gem: 'magic_fire', ice_magic_gem: 'magic_ice', lightning_magic_gem: 'magic_lightning',
  holy_magic_gem: 'magic_holy', dark_magic_gem: 'magic_dark', poison_magic_gem: 'magic_poison',
};

function getItemName(itemId: string): string {
  return ITEM_DATABASE[itemId]?.name || itemId;
}

function getWeaponDisplayName(): string {
  if (!weaponSlot.value) return '';
  const baseName = getItemName(weaponSlot.value.itemId);
  return getEnhancedItemName(baseName, weaponSlot.value.enhancementLevel, weaponSlot.value.enhancementElement);
}

function detectElement(): string | null {
  for (const mat of materialSlots) {
    if (!mat) continue;
    const el = GEM_ELEMENTS[mat.itemId];
    if (el) return el;
  }
  return weaponSlot.value?.enhancementElement || null;
}

const canEnhance = computed(() => {
  if (!weaponSlot.value) return false;
  const currentLevel = weaponSlot.value.enhancementLevel || 0;
  if (currentLevel >= 10) return false;
  return detectElement() !== null;
});

function onDragOver(e: DragEvent, _slotType: string, _index?: number) {
  (e.currentTarget as HTMLElement).classList.add('drag-over');
}

function onDragLeave(e: DragEvent) {
  (e.currentTarget as HTMLElement).classList.remove('drag-over');
}

function onDrop(e: DragEvent, slotType: string, index?: number) {
  (e.currentTarget as HTMLElement).classList.remove('drag-over');
  const data = e.dataTransfer?.getData('text/plain');
  if (!data) return;

  try {
    const parsed = JSON.parse(data);
    if (!parsed.itemId || parsed.slot === undefined) return;

    const item = { itemId: parsed.itemId, slot: parsed.slot, enhancementLevel: parsed.enhancementLevel, enhancementElement: parsed.enhancementElement };

    if (slotType === 'weapon') {
      weaponSlot.value = item;
    } else if (slotType === 'material' && index !== undefined) {
      materialSlots[index] = item;
    }

    updateResult();
  } catch {}
}

function clearSlot(slotType: string, index?: number) {
  if (slotType === 'weapon') {
    weaponSlot.value = null;
  } else if (slotType === 'material' && index !== undefined) {
    materialSlots[index] = null;
  }
  updateResult();
}

function updateResult() {
  if (!weaponSlot.value) {
    resultItem.value = null;
    return;
  }
  const element = detectElement();
  const currentLevel = weaponSlot.value.enhancementLevel || 0;
  const baseName = getItemName(weaponSlot.value.itemId);
  resultItem.value = getEnhancedItemName(baseName, currentLevel + 1, element || undefined);
}

function handleEnhance() {
  if (!weaponSlot.value) return;
  const materialSlotData = materialSlots
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map(s => ({ slotIndex: s.slot, itemId: s.itemId }));

  emit('enhance', {
    weaponSlot: { slotIndex: weaponSlot.value.slot, itemId: weaponSlot.value.itemId },
    materialSlots: materialSlotData
  });
}

onMounted(() => {
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
});

watch(() => props.visible, (v) => {
  if (!v) {
    weaponSlot.value = null;
    materialSlots[0] = null;
    materialSlots[1] = null;
    materialSlots[2] = null;
    resultItem.value = null;
  }
});
</script>

<style scoped>
.enhancement-panel {
  position: absolute;
  width: 520px;
  background: rgba(10, 10, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  z-index: 55;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
}

.drag-dots {
  cursor: grab;
  color: #666;
  font-size: 0.9rem;
  margin-right: 8px;
}

.drag-dots:active {
  cursor: grabbing;
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

.enhancement-content {
  padding: 16px;
}

.columns {
  display: flex;
  gap: 16px;
}

.column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.column-label {
  color: #888;
  font-size: 0.8rem;
  margin-bottom: 8px;
  text-align: center;
}

.slot {
  width: 100%;
  min-height: 70px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: border-color 0.15s, background 0.15s;
}

.slot.drag-over {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.15);
}

.slot.filled {
  border-color: rgba(102, 126, 234, 0.4);
  background: rgba(102, 126, 234, 0.08);
}

.weapon-slot {
  min-height: 80px;
}

.material-slots {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.material-slot {
  min-height: 50px;
}

.result-slot {
  min-height: 80px;
  background: rgba(255, 215, 0, 0.05);
  border-color: rgba(255, 215, 0, 0.2);
}

.slot-placeholder {
  color: #555;
  font-size: 0.72rem;
  text-align: center;
}

.slot-item-name {
  color: #ddd;
  font-size: 0.72rem;
  text-align: center;
  padding: 0 20px;
}

.result-name {
  color: #ffd700;
  font-weight: bold;
}

.slot-remove {
  position: absolute;
  top: 4px;
  right: 6px;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
}

.slot-remove:hover {
  color: #ff6666;
}

.enhance-btn {
  margin-top: 10px;
  width: 100%;
  padding: 8px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.enhance-btn:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.enhance-btn:not(:disabled):hover {
  background: #5568d3;
}
</style>
