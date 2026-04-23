<template>
  <div class="hud">
    <div class="hud-top-left">
      <div class="player-info">
        <div class="player-name">{{ playerName }}</div>
        <div class="player-class">{{ playerClass }}</div>
        <div class="level-badge">Lv. {{ stats?.level || 1 }}</div>
      </div>
      <div class="bars">
        <CastBar />
        <div class="bar-container">
          <div class="bar health-bar" :style="{ width: healthPercent + '%' }"></div>
          <span class="bar-text">{{ stats?.health || 0 }} / {{ stats?.maxHealth || 100 }}</span>
        </div>
        <div class="bar-container">
          <div class="bar mana-bar" :style="{ width: manaPercent + '%' }"></div>
          <span class="bar-text">{{ stats?.mana || 0 }} / {{ stats?.maxMana || 50 }}</span>
        </div>
        <div class="bar-container">
          <div class="bar exp-bar" :style="{ width: expPercent + '%' }"></div>
          <span class="bar-text">XP: {{ stats?.experience || 0 }} / {{ stats?.experienceToNext || 100 }}</span>
        </div>
      </div>
      <div class="target-info" v-if="targetId">
        <div class="target-header">
          <div class="target-identity">
            <span class="target-name">{{ targetName }}</span>
            <span class="target-level" v-if="targetLevel > 0">Lv. {{ targetLevel }}</span>
          </div>
          <button class="target-close" @click="$emit('clear-target')">x</button>
        </div>
        <div class="bar-container target-bar">
          <div class="bar target-health" :style="{ width: targetHealthPercent + '%' }"></div>
          <span class="bar-text">{{ targetHealth }} / {{ targetMaxHealth }}</span>
        </div>
      </div>
    </div>

    <div class="hud-top-right">
      <div class="minimap-container">
        <canvas ref="minimapCanvas" width="150" height="150"></canvas>
      </div>
    </div>

    <div class="hud-bottom-center">
      <SkillBar @use-skill="$emit('use-skill', $event)" />
    </div>

    <div class="hud-bottom-right">
      <div class="action-buttons">
        <button class="action-btn" @click="$emit('toggle-inventory')" title="Inventory (I)">B</button>
        <button class="action-btn" @click="$emit('toggle-quests')" title="Quests (J)">Q</button>
        <button class="action-btn" @click="$emit('toggle-character')" title="Character (C)">C</button>
        <button class="action-btn" @click="$emit('toggle-skills')" title="Skills (K)">K</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { PlayerStats } from '@dust-saga/shared';
import SkillBar from './SkillBar.vue';
import CastBar from './CastBar.vue';

const props = defineProps<{
  stats: PlayerStats | null;
  playerName: string;
  playerClass: string;
  targetId: string | null;
  targetName: string;
  targetHealth: number;
  targetMaxHealth: number;
  targetLevel: number;
}>();

defineEmits<{
  'toggle-inventory': [];
  'toggle-quests': [];
  'toggle-character': [];
  'toggle-skills': [];
  'clear-target': [];
  'use-skill': [slotIndex: number];
}>();

const minimapCanvas = ref<HTMLCanvasElement | null>(null);

const healthPercent = computed(() => {
  if (!props.stats) return 100;
  return (props.stats.health / props.stats.maxHealth) * 100;
});

const manaPercent = computed(() => {
  if (!props.stats) return 100;
  return (props.stats.mana / props.stats.maxMana) * 100;
});

const expPercent = computed(() => {
  if (!props.stats) return 0;
  return (props.stats.experience / props.stats.experienceToNext) * 100;
});

const targetHealthPercent = computed(() => {
  if (!props.targetMaxHealth) return 0;
  return (props.targetHealth / props.targetMaxHealth) * 100;
});

onMounted(() => {
  if (minimapCanvas.value) {
    const ctx = minimapCanvas.value.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2a3a2a';
      ctx.fillRect(0, 0, 150, 150);
    }
  }
});

defineExpose({ minimapCanvas });
</script>

<style scoped>
.hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  font-family: 'Segoe UI', sans-serif;
}

.hud > * {
  pointer-events: auto;
}

.hud-top-left {
  position: absolute;
  top: 15px;
  left: 15px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.player-info {
  background: rgba(0, 0, 0, 0.75);
  padding: 8px 12px;
  border-radius: 8px;
  color: white;
  min-width: 100px;
}

.player-name {
  font-weight: bold;
  font-size: 0.95rem;
}

.player-class {
  color: #aaa;
  font-size: 0.75rem;
  text-transform: capitalize;
}

.level-badge {
  background: #667eea;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  display: inline-block;
  margin-top: 4px;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bar-container {
  width: 200px;
  height: 18px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.bar-container.target-bar {
  width: 200px;
  height: 18px;
}

.bar {
  height: 100%;
  transition: width 0.3s;
  border-radius: 3px;
}

.health-bar {
  background: linear-gradient(to bottom, #4CAF50, #2E7D32);
}

.mana-bar {
  background: linear-gradient(to bottom, #2196F3, #1565C0);
}

.exp-bar {
  background: linear-gradient(to bottom, #FF9800, #E65100);
}

.target-health {
  background: linear-gradient(to bottom, #f44336, #c62828);
}

.bar-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 0.65rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.target-info {
  background: rgba(0, 0, 0, 0.75);
  padding: 8px 12px;
  border-radius: 8px;
  color: white;
  min-width: 160px;
}

.target-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.target-identity {
  display: flex;
  align-items: center;
  gap: 6px;
}

.target-close {
  background: rgba(255, 255, 255, 0.15);
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

.target-close:hover {
  background: rgba(255, 80, 80, 0.5);
  color: white;
}

.target-name {
  font-size: 0.9rem;
  font-weight: bold;
  color: #f44336;
}

.target-level {
  font-size: 0.75rem;
  color: #aaa;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 6px;
  border-radius: 8px;
}

.hud-top-right {
  position: absolute;
  top: 15px;
  right: 15px;
}

.minimap-container {
  width: 150px;
  height: 150px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: #1a2a1a;
}

.minimap-container canvas {
  width: 100%;
  height: 100%;
}

.hud-bottom-center {
  position: absolute;
  bottom: 15px;
  left: 50%;
  transform: translateX(-50%);
}

.hud-bottom-right {
  position: absolute;
  bottom: 15px;
  right: 15px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-btn {
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: rgba(102, 126, 234, 0.4);
}
</style>
