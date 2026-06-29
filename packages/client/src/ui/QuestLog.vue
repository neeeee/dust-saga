<template>
  <div ref="panelRef" class="quest-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
    <div class="panel-header" data-drag-handle>
      <span class="drag-dots">&#8960;</span>
      <h3>Quest Log</h3>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>
    <div class="quest-list">
      <div v-if="visibleQuests.length === 0" class="no-quests">
        No active quests
      </div>
      <div
        v-for="quest in visibleQuests"
        :key="quest.questId"
        class="quest-entry"
        :class="quest.status"
      >
        <div class="quest-header">
          <h4>{{ quest.title || getQuestTitle(quest.questId) }}</h4>
          <span class="quest-status" :class="quest.status">{{ statusLabel(quest.status) }}</span>
        </div>
        <div class="quest-objectives">
          <div v-for="obj in quest.objectives" :key="obj.id" class="objective">
            <div class="obj-bar-container">
              <div class="obj-bar" :style="{ width: objectivePercent(obj) + '%' }"></div>
            </div>
            <span class="obj-text">{{ obj.targetName }}: {{ obj.currentCount }}/{{ obj.requiredCount }}</span>
          </div>
        </div>
        <div class="quest-actions" v-if="quest.status === 'completed'">
          <button class="btn-complete" @click="$emit('complete-quest', quest.questId)">
            Turn In
          </button>
        </div>
        <div class="quest-actions" v-if="quest.status === 'in_progress'">
          <button class="btn-abandon" @click="$emit('abandon-quest', quest.questId)">
            Abandon
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { QUEST_DATABASE } from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-questlog', { x: 500, y: 120 });
const panelRef = ref<HTMLElement | null>(null);

const props = defineProps<{
  visible: boolean;
  quests: Array<{
    questId: string;
    status: string;
    title?: string;
    description?: string;
    objectives: Array<{
      id: string;
      type: string;
      targetId: string;
      targetName: string;
      requiredCount: number;
      currentCount: number;
    }>;
  }>;
}>();

// Hide turned-in quests from the journal — they stay in session.quests as
// prereq records but shouldn't clutter the active log.
const visibleQuests = computed(() => props.quests.filter(q => q.status !== 'turned_in'));

defineEmits<{
  'close': [];
  'complete-quest': [questId: string];
  'abandon-quest': [questId: string];
}>();

function getQuestTitle(questId: string): string {
  return QUEST_DATABASE[questId]?.title || questId;
}

function objectivePercent(obj: { currentCount: number; requiredCount: number }): number {
  return Math.min(100, (obj.currentCount / obj.requiredCount) * 100);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_progress: 'Active',
    completed: 'Complete',
    turned_in: 'Done'
  };
  return labels[status] || status;
}

onMounted(() => {
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
});
</script>

<style scoped>
.quest-panel {
  position: absolute;
  width: 320px;
  max-height: 500px;
  background: rgba(10, 10, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  color: white;
  z-index: 50;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
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

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 1.2rem;
  cursor: pointer;
}

.no-quests {
  padding: 20px;
  text-align: center;
  color: #666;
}

.quest-entry {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.quest-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.quest-header h4 {
  margin: 0;
  font-size: 0.9rem;
}

.quest-status {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.quest-status.in_progress {
  background: rgba(102, 126, 234, 0.3);
  color: #667eea;
}

.quest-status.completed {
  background: rgba(76, 175, 80, 0.3);
  color: #4CAF50;
}

.quest-status.turned_in {
  background: rgba(150, 150, 150, 0.3);
  color: #999;
}

.objective {
  margin-bottom: 4px;
}

.obj-bar-container {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-bottom: 2px;
}

.obj-bar {
  height: 100%;
  background: #667eea;
  border-radius: 2px;
  transition: width 0.3s;
}

.obj-text {
  font-size: 0.75rem;
  color: #aaa;
}

.quest-actions {
  margin-top: 6px;
  display: flex;
  gap: 6px;
}

.btn-complete {
  padding: 4px 12px;
  background: #4CAF50;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 0.75rem;
  cursor: pointer;
}

.btn-abandon {
  padding: 4px 12px;
  background: rgba(255, 50, 50, 0.3);
  border: none;
  border-radius: 4px;
  color: #ff5555;
  font-size: 0.75rem;
  cursor: pointer;
}
</style>
