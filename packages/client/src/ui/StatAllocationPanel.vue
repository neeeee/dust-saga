<template>
  <div v-if="visible" class="stat-panel-overlay" @click.self="$emit('close')">
    <div class="stat-panel">
      <div class="stat-panel-header">
        <h2>Character Stats</h2>
        <button class="close-btn" @click="$emit('close')">x</button>
      </div>

      <div class="points-available" v-if="unspentStatPoints > 0">
        <span class="points-badge">{{ unspentStatPoints }} stat points available!</span>
      </div>

      <div class="stat-rows">
        <div v-for="stat in statList" :key="stat.key" class="stat-row">
          <div class="stat-name">{{ stat.key }}</div>
          <div class="stat-bar-container">
            <div class="stat-bar-fill" :style="{ width: getBarWidth(stat.key) + '%' }"></div>
          </div>
          <div class="stat-value">{{ getTotal(stat.key) }}</div>
          <div class="stat-base">({{ getBase(stat.key) }} + {{ getAllocated(stat.key) }})</div>
          <button
            class="stat-plus-btn"
            :disabled="unspentStatPoints <= 0 || getAllocated(stat.key) >= 99"
            @click="$emit('allocate', stat.key)"
          >+</button>
        </div>
      </div>

      <div class="derived-stats">
        <h3>Derived Stats</h3>
        <div class="derived-grid">
          <div class="derived-item">
            <span class="derived-label">HP</span>
            <span class="derived-value">{{ stats?.maxHealth || 0 }}</span>
          </div>
          <div class="derived-item">
            <span class="derived-label">MP</span>
            <span class="derived-value">{{ stats?.maxMana || 0 }}</span>
          </div>
          <div class="derived-item">
            <span class="derived-label">ATK</span>
            <span class="derived-value">{{ stats?.attack || 0 }}</span>
          </div>
          <div class="derived-item">
            <span class="derived-label">DEF</span>
            <span class="derived-value">{{ stats?.defense || 0 }}</span>
          </div>
          <div class="derived-item">
            <span class="derived-label">SPD</span>
            <span class="derived-value">{{ stats?.speed || 0 }}</span>
          </div>
          <div class="derived-item">
            <span class="derived-label">MATK</span>
            <span class="derived-value">{{ stats?.magicAttack || 0 }}</span>
          </div>
        </div>
      </div>

      <div class="racial-passive" v-if="racialPassive">
        <span class="passive-name">{{ racialPassive.name }}</span>
        <span class="passive-desc">{{ racialPassive.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PlayerStats, StatPoints, StatType, RACE_DATA, Race, JOB_DEFINITIONS, JobId } from '@dust-saga/shared';

const props = defineProps<{
  visible: boolean;
  stats: PlayerStats | null;
  statPoints: StatPoints | null;
  unspentStatPoints: number;
  race: string;
  jobId: string;
}>();

defineEmits<{
  'close': [];
  'allocate': [stat: string];
}>();

const statList = [
  { key: 'STA', label: 'Stamina' },
  { key: 'STR', label: 'Strength' },
  { key: 'AGI', label: 'Agility' },
  { key: 'DEX', label: 'Dexterity' },
  { key: 'SPI', label: 'Spirit' },
  { key: 'INT', label: 'Intelligence' }
];

function getBase(key: string): number {
  const raceData = RACE_DATA[props.race as Race];
  const job = JOB_DEFINITIONS[props.jobId as JobId];
  return (raceData?.baseStats[key as StatType] || 0) + (job?.baseStatModifiers[key as StatType] || 0);
}

function getAllocated(key: string): number {
  return props.statPoints?.[key as StatType] || 0;
}

function getTotal(key: string): number {
  return getBase(key) + getAllocated(key);
}

function getBarWidth(key: string): number {
  return Math.min(100, (getTotal(key) / 99) * 100);
}

const racialPassive = computed(() => {
  const raceData = RACE_DATA[props.race as Race];
  if (!raceData) return null;
  return { name: raceData.passiveName, description: raceData.passiveDescription };
});
</script>

<style scoped>
.stat-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

.stat-panel {
  background: rgba(20, 20, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 1.5rem;
  width: 420px;
  color: white;
}

.stat-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stat-panel-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #aaa;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.9rem;
}

.close-btn:hover {
  background: rgba(255, 80, 80, 0.4);
  color: white;
}

.points-available {
  text-align: center;
  margin-bottom: 1rem;
}

.points-badge {
  background: #667eea;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.stat-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-name {
  width: 35px;
  font-size: 0.8rem;
  font-weight: bold;
  color: #aaa;
}

.stat-bar-container {
  flex: 1;
  height: 14px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  background: linear-gradient(to right, #667eea, #5568d3);
  border-radius: 3px;
  transition: width 0.3s;
}

.stat-value {
  width: 28px;
  text-align: right;
  font-size: 0.85rem;
  font-weight: bold;
}

.stat-base {
  width: 80px;
  font-size: 0.7rem;
  color: #666;
}

.stat-plus-btn {
  width: 24px;
  height: 24px;
  background: #667eea;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
}

.stat-plus-btn:hover:not(:disabled) {
  background: #5568d3;
}

.stat-plus-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.derived-stats h3 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.derived-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.derived-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
}

.derived-label {
  color: #aaa;
  font-size: 0.75rem;
}

.derived-value {
  font-size: 0.8rem;
  font-weight: bold;
}

.racial-passive {
  background: rgba(136, 204, 170, 0.1);
  border: 1px solid rgba(136, 204, 170, 0.3);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
}

.passive-name {
  font-size: 0.8rem;
  font-weight: bold;
  color: #88ccaa;
  display: block;
  margin-bottom: 0.15rem;
}

.passive-desc {
  font-size: 0.7rem;
  color: #aaa;
  line-height: 1.3;
}
</style>
