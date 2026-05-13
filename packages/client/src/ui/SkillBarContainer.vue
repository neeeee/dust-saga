<template>
  <div class="skill-bar-container">
    <SkillBar
      v-for="(bar, i) in skillStore.state.layout.bars"
      :key="i"
      :bar-index="i"
      :bar="bar"
      :pos-x="skillStore.state.layout.positions[i]?.x ?? 0"
      :pos-y="skillStore.state.layout.positions[i]?.y ?? 0"
      @use-skill="(bi, si) => $emit('use-skill', bi, si)"
      @close="skillStore.removeBar(i)"
      @move="(bi, x, y) => skillStore.moveBar(bi, x, y)"
    />
    <button
      v-if="skillStore.state.layout.bars.length < 6"
      class="add-bar-btn"
      @click="skillStore.addBar()"
      title="Add skill bar"
    >+</button>
  </div>
</template>

<script setup lang="ts">
import SkillBar from './SkillBar.vue';
import { useSkillStore } from '../composables/useSkillStore';

const skillStore = useSkillStore();

defineEmits<{
  'use-skill': [barIndex: number, slotIndex: number];
}>();
</script>

<style scoped>
.skill-bar-container {
  pointer-events: none;
}

.skill-bar-container :deep(.skill-bar-wrapper),
.skill-bar-container :deep(.add-bar-btn) {
  pointer-events: auto;
}

.add-bar-btn {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s;
  z-index: 50;
}

.add-bar-btn:hover {
  border-color: rgba(255, 255, 255, 0.5);
  color: #fff;
  background: rgba(0, 0, 0, 0.9);
}
</style>
