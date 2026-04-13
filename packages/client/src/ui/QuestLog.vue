<template>
  <div class="quest-panel" v-if="visible">
    <div class="panel-header">
      <h3>Quest Log</h3>
      <button class="close-btn" @click="$emit('close')">x</button>
    </div>
    <div class="quest-list">
      <div v-if="quests.length === 0" class="no-quests">
        No active quests
      </div>
      <div
        v-for="quest in quests"
        :key="quest.questId"
        class="quest-entry"
        :class="quest.status"
      >
        <div class="quest-header">
          <h4>{{ getQuestTitle(quest.questId) }}</h4>
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
import { QUEST_DATABASE } from '@dust-saga/shared';

defineProps<{
  visible: boolean;
  quests: Array<{
    questId: string;
    status: string;
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
</script>

<style scoped>
.quest-panel {
  position: absolute;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
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
