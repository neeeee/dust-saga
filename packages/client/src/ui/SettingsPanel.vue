<template>
  <div ref="panelRef" class="settings-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
    <div class="settings-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
      <span class="settings-title">Settings</span>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>
    <div class="settings-body">
      <div class="settings-section">
        <div class="section-label">UI Layout</div>
        <button class="settings-btn" @click="handleResetUI">Reset UI Positions</button>
      </div>
      <div class="settings-section">
        <div class="section-label">Account</div>
        <button class="settings-btn" @click="$emit('return-to-character-select')">Return to Character Select</button>
        <button class="settings-btn danger" @click="$emit('logout')">Logout to Title</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useDraggable, resetAllDraggablePositions } from '../composables/useDraggable';
import { useSkillStore } from '../composables/useSkillStore';

defineProps<{ visible: boolean }>();
defineEmits<{
  'close': [];
  'logout': [];
  'return-to-character-select': [];
}>();

const panelRef = ref<HTMLElement | null>(null);
const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-settings', { x: 500, y: 200 });
const skillStore = useSkillStore();

function handleResetUI(): void {
  resetAllDraggablePositions();
  skillStore.resetLayout();
}

onMounted(() => {
  attach(panelRef.value);
});

onUnmounted(() => {
  detach(panelRef.value);
});
</script>

<style scoped>
.settings-panel {
  position: absolute;
  width: 240px;
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: white;
  font-family: 'Segoe UI', sans-serif;
  z-index: 1000;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px 8px 0 0;
  cursor: move;
}

.drag-dots {
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.8rem;
}

.settings-title {
  flex: 1;
  font-size: 0.9rem;
  font-weight: bold;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #aaa;
  font-size: 0.75rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  background: rgba(255, 80, 80, 0.5);
  color: white;
}

.settings-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.settings-btn {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #ccc;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.settings-btn:hover {
  background: rgba(102, 126, 234, 0.3);
  border-color: rgba(102, 126, 234, 0.6);
  color: white;
}

.settings-btn.danger:hover {
  background: rgba(255, 80, 80, 0.3);
  border-color: rgba(255, 80, 80, 0.6);
}
</style>
