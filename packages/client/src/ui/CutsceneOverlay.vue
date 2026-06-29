<template>
  <div v-if="visible" class="cutscene-overlay" @click="handleClick">
    <div class="letterbox-top"></div>
    <div class="letterbox-bottom">
      <div v-if="speaker" class="cutscene-speaker">{{ speaker }}</div>
      <div class="cutscene-text">{{ text }}</div>
      <div v-if="text" class="cutscene-hint">▼ Click to continue</div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  visible: boolean;
  speaker?: string;
  text: string;
}>();

const emit = defineEmits<{
  'advance': [];
}>();

function handleClick() {
  emit('advance');
}
</script>

<style scoped>
.cutscene-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.letterbox-top {
  height: 12vh;
  background: black;
}

.letterbox-bottom {
  min-height: 22vh;
  background: linear-gradient(to top, rgba(0,0,0,0.97), rgba(0,0,0,0.85));
  padding: 20px 48px 28px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.cutscene-speaker {
  color: #ffd166;
  font-size: 1rem;
  font-weight: bold;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 1);
}

.cutscene-text {
  color: #f0f0f0;
  font-size: 1.05rem;
  line-height: 1.6;
  max-width: 800px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 1);
  white-space: pre-wrap;
  min-height: 1.6em;
}

.cutscene-hint {
  color: #888;
  font-size: 0.72rem;
  margin-top: 12px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
</style>
