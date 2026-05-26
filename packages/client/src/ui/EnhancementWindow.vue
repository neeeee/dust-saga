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
          <div class="slot result-slot" :class="resultSlotClass">
            <template v-if="weaponSlot && detectElement()">
              <span class="slot-item-name result-name">{{ getResultName() }}</span>
            </template>
            <template v-else>
              <span class="slot-placeholder">?</span>
            </template>
          </div>
          <div v-if="successRateLabel" class="success-rate" :class="successRateClass">
            {{ successRateLabel }}
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
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue';
import { ITEM_DATABASE, getEnhancedItemName } from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-enhancement', { x: 400, y: 150 });
const panelRef = ref<HTMLElement | null>(null);

const ENHANCE_FAILURE: number[] = [0, 0, 5, 15, 25, 35, 50, 65, 80, 90];

const props = defineProps<{
  visible: boolean;
  inventory: Array<{ itemId: string; quantity: number; slot: number }>;
  equipment: Record<string, any>;
  lastResult: { success: boolean; weaponSlotIndex: number; enhancementLevel: number; enhancementElement: string } | null;
}>();

const emit = defineEmits<{
  'close': [];
  'enhance': [data: { weaponSlot: { slotIndex: number; itemId: string }; materialSlots: Array<{ slotIndex: number; itemId: string }> }];
}>();

const weaponSlot = ref<{ itemId: string; slot: number; enhancementLevel?: number; enhancementElement?: string } | null>(null);
const materialSlots = reactive<[typeof weaponSlot.value, typeof weaponSlot.value, typeof weaponSlot.value]>([null, null, null]);

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

function getResultName(): string {
  if (!weaponSlot.value) return '';
  const element = detectElement();
  const currentLevel = weaponSlot.value.enhancementLevel || 0;
  const baseName = getItemName(weaponSlot.value.itemId);
  return getEnhancedItemName(baseName, currentLevel + 1, element || undefined);
}

function detectElement(): string | null {
  for (const mat of materialSlots) {
    if (!mat) continue;
    const el = GEM_ELEMENTS[mat.itemId];
    if (el) return el;
  }
  return weaponSlot.value?.enhancementElement || null;
}

const currentLevel = computed(() => weaponSlot.value?.enhancementLevel || 0);

const successRateLabel = computed(() => {
  if (currentLevel.value >= 10) return null;
  const rate = ENHANCE_FAILURE[currentLevel.value];
  if (rate <= 0) return 'Guaranteed';
  if (rate <= 10) return 'Great';
  if (rate <= 25) return 'Good';
  if (rate <= 50) return 'Risky';
  return 'Dangerous';
});

const successRateClass = computed(() => {
  if (currentLevel.value >= 10) return '';
  const rate = ENHANCE_FAILURE[currentLevel.value];
  if (rate <= 0) return 'rate-guaranteed';
  if (rate <= 10) return 'rate-excellent';
  if (rate <= 25) return 'rate-great';
  if (rate <= 50) return 'rate-risky';
  return 'rate-dangerous';
});

const resultSlotClass = computed(() => {
  if (!props.lastResult) return '';
  return props.lastResult.success ? 'result-success' : 'result-failed';
});

const canEnhance = computed(() => {
  if (!weaponSlot.value) return false;
  if (currentLevel.value >= 10) return false;
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
  } catch {}
}

function clearSlot(slotType: string, index?: number) {
  if (slotType === 'weapon') {
    weaponSlot.value = null;
  } else if (slotType === 'material' && index !== undefined) {
    materialSlots[index] = null;
  }
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

watch(() => props.lastResult, (result) => {
  if (!result || !weaponSlot.value) return;
  if (result.weaponSlotIndex !== weaponSlot.value.slot) return;

  if (result.success) {
    weaponSlot.value = {
      ...weaponSlot.value,
      enhancementLevel: result.enhancementLevel,
      enhancementElement: result.enhancementElement,
    };
  }

  for (let i = materialSlots.length - 1; i >= 0; i--) {
    if (materialSlots[i] !== null) {
      materialSlots[i] = null;
    }
  }
});

onMounted(() => {
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
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

.result-slot.result-success {
  border-color: rgba(76, 175, 80, 0.5);
  background: rgba(76, 175, 80, 0.08);
}

.result-slot.result-failed {
  border-color: rgba(244, 67, 54, 0.5);
  background: rgba(244, 67, 54, 0.08);
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

.success-rate {
  text-align: center;
  font-size: 0.7rem;
  font-weight: bold;
  padding: 4px 0;
  transition: color 0.2s;
}

.rate-guaranteed { color: #4caf50; }
.rate-excellent { color: #66bb6a; }
.rate-great { color: #ffa726; }
.rate-good { color: #ce93d8; }
.rate-risky { color: #ef5350; }
.rate-dangerous { color: #b71c1c; }

.enhance-btn {
  margin-top: 6px;
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
