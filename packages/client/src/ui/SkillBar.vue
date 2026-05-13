<template>
  <div
    class="skill-bar-wrapper"
    :style="{ left: posX + 'px', top: posY + 'px' }"
  >
    <div class="skill-bar-drag-handle" @mousedown="startDrag">
      <span class="drag-dots">⠿</span>
    </div>
    <button v-if="barIndex > 0" class="skill-bar-close" @click.stop="$emit('close')">x</button>
    <div class="skill-bar">
      <div
        v-for="(slot, index) in bar"
        :key="index"
        class="skill-slot"
        :class="{
          'skill-slot-filled': slot.skillName,
          'skill-slot-cooldown': slot.skillName && isOnCooldown(slot.skillName),
          'skill-slot-dragover': dragOverIndex === index,
        }"
        @dragover.prevent="onDragOver(index)"
        @dragleave="onDragLeave(index)"
        @drop="onDrop(index, $event)"
        @contextmenu.prevent="onRightClick(index)"
        @click="$emit('use-skill', barIndex, index)"
      >
        <template v-if="slot.skillName">
          <div
            class="skill-icon"
            :style="{ backgroundColor: getCategoryColor(slot.category) }"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
          >
            {{ getSkillAbbrev(slot.skillName) }}
          </div>
          <div
            v-if="isOnCooldown(slot.skillName)"
            class="cooldown-overlay"
            :style="{ height: getCooldownHeight(slot.skillName) + '%' }"
          >
            <span class="cooldown-text">{{ getCooldownText(slot.skillName) }}</span>
          </div>
          <span v-if="getMpCost(slot.skillName)" class="mp-cost">{{ getMpCost(slot.skillName) }}</span>
        </template>
        <template v-else>
          <span class="skill-key">{{ keyLabel(index) }}</span>
        </template>
        <span class="slot-key">{{ keyLabel(index) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSkillStore } from '../composables/useSkillStore';
import { getCategoryColor, BAR_KEYBIND_LABELS, type SkillBarSlot } from '@dust-saga/shared';

const props = defineProps<{
  barIndex: number;
  bar: SkillBarSlot[];
  posX: number;
  posY: number;
}>();

const emit = defineEmits<{
  'use-skill': [barIndex: number, slotIndex: number];
  close: [];
  'move': [barIndex: number, x: number, y: number];
}>();

const skillStore = useSkillStore();

const dragOverIndex = ref<number | null>(null);
const dragSourceIndex = ref<number | null>(null);
const dragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

function keyLabel(index: number): string {
  const labels = BAR_KEYBIND_LABELS[props.barIndex];
  return labels ? labels[index] : String(index + 1 === 10 ? 0 : index + 1);
}

function startDrag(e: MouseEvent): void {
  dragging.value = true;
  dragOffset.value = {
    x: e.clientX - props.posX,
    y: e.clientY - props.posY,
  };
  const onMove = (ev: MouseEvent) => {
    if (!dragging.value) return;
    const x = ev.clientX - dragOffset.value.x;
    const y = ev.clientY - dragOffset.value.y;
    emit('move', props.barIndex, x, y);
  };
  const onUp = () => {
    dragging.value = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function onDragStart(slotIndex: number, event: DragEvent): void {
  dragSourceIndex.value = slotIndex;
  const slot = props.bar[slotIndex];
  if (slot.skillName && event.dataTransfer) {
    event.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'bar-swap',
      barIndex: props.barIndex,
      slotIndex,
      skillName: slot.skillName,
      category: slot.category,
      subCategory: slot.subCategory,
    }));
    event.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(slotIndex: number): void {
  dragOverIndex.value = slotIndex;
}

function onDragLeave(slotIndex: number): void {
  if (dragOverIndex.value === slotIndex) {
    dragOverIndex.value = null;
  }
}

function onDrop(slotIndex: number, event?: DragEvent): void {
  dragOverIndex.value = null;

  const data = (window as any).__dragSkillData;
  if (data) {
    if (data.type === 'from-window') {
      skillStore.setSkillInSlot(props.barIndex, slotIndex, data.skillName, data.category, data.subCategory);
    }
    (window as any).__dragSkillData = null;
    return;
  }

  if (event?.dataTransfer) {
    try {
      const raw = event.dataTransfer.getData('text/plain');
      if (raw) {
        const transferData = JSON.parse(raw);
        if (transferData.type === 'bar-swap') {
          skillStore.swapSlots(transferData.barIndex, transferData.slotIndex, props.barIndex, slotIndex);
          dragSourceIndex.value = null;
          return;
        }
      }
    } catch {}
  }

  if (dragSourceIndex.value !== null && dragSourceIndex.value !== slotIndex) {
    skillStore.swapSlots(props.barIndex, dragSourceIndex.value, props.barIndex, slotIndex);
  }
  dragSourceIndex.value = null;
}

function onRightClick(slotIndex: number): void {
  skillStore.removeFromSlot(props.barIndex, slotIndex);
}

function getSkillAbbrev(name: string): string {
  const words = name.replace(/\(.*\)/, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function isOnCooldown(skillName: string): boolean {
  void skillStore.now.value;
  return skillStore.isOnCooldown(skillName);
}

function getCooldownHeight(skillName: string): number {
  void skillStore.now.value;
  const cd = skillStore.state.cooldowns[skillName];
  if (!cd) return 0;
  const remaining = cd.readyAt - skillStore.now.value;
  if (remaining <= 0) return 0;
  return (remaining / cd.duration) * 100;
}

function getCooldownText(skillName: string): string {
  void skillStore.now.value;
  const cd = skillStore.state.cooldowns[skillName];
  if (!cd) return '';
  const remaining = cd.readyAt - skillStore.now.value;
  if (remaining <= 0) return '';
  return (remaining / 1000).toFixed(1);
}

function getMpCost(skillName: string): number {
  const skill = skillStore.state.availableSkills.find(s => s.name === skillName);
  return skill?.mpCost || 0;
}
</script>

<style scoped>
.skill-bar-wrapper {
  position: absolute;
  display: flex;
  align-items: flex-start;
  gap: 0;
  user-select: none;
  z-index: 50;
}

.skill-bar-drag-handle {
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  margin-right: 4px;
  margin-top: 5px;
  flex-shrink: 0;
}

.skill-bar-drag-handle:active {
  cursor: grabbing;
}

.drag-dots {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1;
}

.skill-bar-close {
  width: 16px;
  height: 16px;
  background: rgba(200, 50, 50, 0.3);
  border: 1px solid rgba(255, 100, 100, 0.3);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  margin-top: 5px;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}

.skill-bar-close:hover {
  background: rgba(200, 50, 50, 0.6);
  color: #fff;
}

.skill-bar {
  display: flex;
  gap: 3px;
  background: rgba(0, 0, 0, 0.8);
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.skill-slot {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.skill-slot:hover {
  border-color: rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.1);
}

.skill-slot-filled:hover {
  border-color: rgba(255, 200, 50, 0.5);
}

.skill-slot-dragover {
  border-color: #667eea !important;
  background: rgba(102, 126, 234, 0.2) !important;
  box-shadow: 0 0 8px rgba(102, 126, 234, 0.3);
}

.skill-slot-cooldown {
  opacity: 0.85;
}

.skill-icon {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.7rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.5px;
}

.skill-key {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.75rem;
  font-weight: bold;
}

.slot-key {
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.cooldown-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cooldown-text {
  color: white;
  font-size: 0.65rem;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
}

.mp-cost {
  position: absolute;
  top: 1px;
  left: 3px;
  font-size: 0.5rem;
  color: #64b5f6;
  pointer-events: none;
}
</style>
