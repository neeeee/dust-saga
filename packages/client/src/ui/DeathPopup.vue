<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
  revivedBy?: string;
}>();

const emit = defineEmits<{
  'respawn': [];
  'close': [];
}>();

const respawnCooldown = ref(0);
let interval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  interval = setInterval(() => {
    if (respawnCooldown.value > 0) {
      respawnCooldown.value -= 1;
    }
  }, 1000);
});

onUnmounted(() => {
  if (interval) clearInterval(interval);
});

function handleRespawn() {
  if (respawnCooldown.value > 0) return;
  emit('respawn');
}
</script>

<template>
  <div class="death-overlay" v-if="visible">
    <div class="death-content">
      <div class="death-title">You have died</div>
      <div class="death-subtitle" v-if="props.revivedBy">
        {{ props.revivedBy }} has revived you
      </div>
      <div class="death-subtitle" v-else>
        Choose an option to return to the world
      </div>
      <button
        class="respawn-btn"
        :disabled="respawnCooldown > 0"
        @click="handleRespawn"
      >
        {{ respawnCooldown > 0 ? `Respawn at Inn (${respawnCooldown}s)` : 'Respawn at Inn' }}
      </button>
      <div class="death-hint">Wait to be revived by another player</div>
    </div>
  </div>
</template>

<style scoped>
.death-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  pointer-events: all;
}

.death-content {
  background: rgba(20, 10, 10, 0.95);
  border: 2px solid #8b0000;
  border-radius: 8px;
  padding: 30px 50px;
  text-align: center;
}

.death-title {
  font-size: 28px;
  color: #ff4444;
  font-weight: bold;
  margin-bottom: 12px;
  text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
}

.death-subtitle {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 24px;
}

.respawn-btn {
  background: #4a1a1a;
  color: #ddd;
  border: 1px solid #8b0000;
  border-radius: 4px;
  padding: 10px 30px;
  font-size: 16px;
  cursor: pointer;
  min-width: 220px;
  transition: background 0.2s, border-color 0.2s;
}

.respawn-btn:hover:not(:disabled) {
  background: #6b2020;
  border-color: #cc0000;
}

.respawn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.death-hint {
  font-size: 12px;
  color: #666;
  margin-top: 16px;
}
</style>
