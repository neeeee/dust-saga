<template>
  <div class="skill-bar">
    <div
      v-for="(slot, index) in skillStore.state.bar"
      :key="index"
      class="skill-slot"
      :class="{
        'skill-slot-filled': slot.skillName,
        'skill-slot-cooldown': slot.skillName && isOnCooldown(slot.skillName),
        'skill-slot-dragover': dragOverIndex === index,
      }"
      @dragover.prevent="onDragOver(index)"
      @dragleave="onDragLeave(index)"
      @drop="onDrop(index)"
      @contextmenu.prevent="onRightClick(index)"
      @click="$emit('use-skill', index)"
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
        <span class="skill-key">{{ index + 1 === 10 ? 0 : index + 1 }}</span>
      </template>
      <span class="slot-key">{{ index + 1 === 10 ? 0 : index + 1 }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSkillStore } from '../composables/useSkillStore';
import { getCategoryColor } from '@dust-saga/shared';

const skillStore = useSkillStore();
const _now = skillStore.now;

defineEmits<{
  'use-skill': [slotIndex: number];
}>();

const dragOverIndex = ref<number | null>(null);
const dragSourceIndex = ref<number | null>(null);

function onDragStart(slotIndex: number, event: DragEvent): void {
  dragSourceIndex.value = slotIndex;
  const slot = skillStore.state.bar[slotIndex];
  if (slot.skillName && event.dataTransfer) {
    event.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'bar-swap',
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

function onDrop(slotIndex: number): void {
  dragOverIndex.value = null;

  const data = (window as any).__dragSkillData;
  if (data) {
    if (data.type === 'from-window') {
      skillStore.setSkillInSlot(slotIndex, data.skillName, data.category, data.subCategory);
    }
    (window as any).__dragSkillData = null;
    return;
  }

  if (dragSourceIndex.value !== null && dragSourceIndex.value !== slotIndex) {
    skillStore.swapSlots(dragSourceIndex.value, slotIndex);
  }
  dragSourceIndex.value = null;
}

function onRightClick(slotIndex: number): void {
  skillStore.removeFromSlot(slotIndex);
}

function getSkillAbbrev(name: string): string {
  const words = name.replace(/\(.*\)/, '').trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function isOnCooldown(skillName: string): boolean {
  void _now.value;
  const cd = skillStore.state.cooldowns[skillName];
  if (!cd) return false;
  return _now.value < cd.readyAt;
}

function getCooldownHeight(skillName: string): number {
  void _now.value;
  const cd = skillStore.state.cooldowns[skillName];
  if (!cd) return 0;
  const remaining = cd.readyAt - _now.value;
  if (remaining <= 0) return 0;
  return (remaining / cd.duration) * 100;
}

function getCooldownText(skillName: string): string {
  void _now.value;
  const cd = skillStore.state.cooldowns[skillName];
  if (!cd) return '';
  const remaining = cd.readyAt - _now.value;
  if (remaining <= 0) return '';
  return (remaining / 1000).toFixed(1);
}

function getMpCost(skillName: string): number {
  const skill = skillStore.state.availableSkills.find(s => s.name === skillName);
  return skill?.mpCost || 0;
}
</script>

<style scoped>
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
  font-size: 0.85rem;
  font-weight: bold;
}

.slot-key {
  position: absolute;
  bottom: 1px;
  right: 3px;
  font-size: 0.55rem;
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
