<template>
  <div v-if="cast.active" class="cast-bar-container">
    <div class="cast-bar-bg">
      <div class="cast-bar-fill" :style="{ width: (cast.progress * 100) + '%' }"></div>
    </div>
    <span class="cast-bar-text">{{ cast.skillName }}</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useSkillStore } from '../composables/useSkillStore';

const { state: { cast }, updateCastProgress } = useSkillStore();

let tickInterval: number | null = null;

onMounted(() => {
  tickInterval = window.setInterval(() => {
    if (cast.active) {
      updateCastProgress();
      const elapsed = Date.now() - cast.startedAt;
      if (elapsed >= cast.castTime) {
        updateCastProgress();
      }
    }
  }, 50);
});

onUnmounted(() => {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
  }
});
</script>

<style scoped>
.cast-bar-container {
  position: relative;
  width: 240px;
  height: 22px;
  margin-bottom: 8px;
}

.cast-bar-bg {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
}

.cast-bar-fill {
  height: 100%;
  background: linear-gradient(to right, #f39c12, #e67e22);
  border-radius: 3px;
  transition: width 0.05s linear;
}

.cast-bar-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  pointer-events: none;
}
</style>
