<template>
  <div v-if="visible" class="stat-panel-overlay" @click.self="$emit('close')">
    <div class="stat-panel">
      <div class="stat-panel-header">
        <h2>Character Stats</h2>
        <button class="close-btn" @click="handleCancel">x</button>
      </div>

      <div class="points-available" v-if="effectiveUnspent > 0">
        <span class="points-badge">{{ effectiveUnspent }} stat points available!</span>
      </div>

      <div class="stat-rows">
        <div v-for="stat in statList" :key="stat.key" class="stat-row">
          <div class="stat-name">{{ stat.key }}</div>
          <div class="stat-bar-container">
            <div class="stat-bar-fill" :style="{ width: getBarWidth(stat.key) + '%' }"></div>
          </div>
          <div class="stat-values">
            <span class="stat-value">{{ getTotal(stat.key) }}</span>
            <span class="stat-change" v-if="pendingPoints[stat.key] > 0">(+{{ pendingPoints[stat.key] }})</span>
          </div>
          <div class="stat-base">({{ getBase(stat.key) }} + {{ getAllocated(stat.key) }})</div>
          <button
            class="stat-minus-btn"
            :disabled="pendingPoints[stat.key] <= 0"
            @click="removePending(stat.key)"
          >-</button>
          <button
            class="stat-plus-btn"
            :disabled="effectiveUnspent <= 0 || getTotal(stat.key) >= 99"
            @click="addPending(stat.key)"
          >+</button>
        </div>
      </div>

      <div class="derived-stats">
        <h3>Derived Stats</h3>
        <div class="derived-grid">
          <div class="derived-item" v-for="d in derivedList" :key="d.label">
            <span class="derived-label">{{ d.label }}</span>
            <span class="derived-value">{{ d.current }}</span>
            <span class="derived-new" v-if="d.current !== d.preview">{{ d.preview }}</span>
          </div>
        </div>
      </div>

      <div class="stat-actions" v-if="hasPending">
        <button class="confirm-btn" @click="handleConfirm">Confirm</button>
        <button class="cancel-btn" @click="handleCancel">Cancel</button>
      </div>

      <div class="racial-passive" v-if="racialPassive">
        <span class="passive-name">{{ racialPassive.name }}</span>
        <span class="passive-desc">{{ racialPassive.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue';
import {
  PlayerStats, StatPoints, StatType, RACE_DATA, Race,
  JOB_DEFINITIONS, JobId, calculateDerivedStats
} from '@dust-saga/shared';

const props = defineProps<{
  visible: boolean;
  stats: PlayerStats | null;
  statPoints: StatPoints | null;
  unspentStatPoints: number;
  race: string;
  jobId: string;
}>();

const emit = defineEmits<{
  'close': [];
  'allocate': [stat: string];
  'allocate-batch': [allocations: Record<string, number>];
}>();

const statList = [
  { key: 'STA', label: 'Stamina' },
  { key: 'STR', label: 'Strength' },
  { key: 'AGI', label: 'Agility' },
  { key: 'DEX', label: 'Dexterity' },
  { key: 'SPI', label: 'Spirit' },
  { key: 'INT', label: 'Intelligence' }
];

const pendingPoints = reactive<Record<string, number>>({
  STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0
});

watch(() => props.visible, (v) => {
  if (v) {
    for (const key of Object.keys(pendingPoints)) {
      pendingPoints[key] = 0;
    }
  }
});

function getBase(key: string): number {
  const raceData = RACE_DATA[props.race as Race];
  const job = JOB_DEFINITIONS[props.jobId as JobId];
  return (raceData?.baseStats[key as StatType] || 0) + (job?.baseStatModifiers[key as StatType] || 0);
}

function getAllocated(key: string): number {
  return (props.statPoints?.[key as StatType] || 0) + (pendingPoints[key] || 0);
}

function getTotal(key: string): number {
  return getBase(key) + getAllocated(key);
}

function getBarWidth(key: string): number {
  return Math.min(100, (getTotal(key) / 99) * 100);
}

const totalPending = computed(() => {
  return Object.values(pendingPoints).reduce((s, v) => s + v, 0);
});

const effectiveUnspent = computed(() => props.unspentStatPoints - totalPending.value);

const hasPending = computed(() => totalPending.value > 0);

function addPending(key: string): void {
  if (effectiveUnspent.value <= 0 || getTotal(key) >= 99) return;
  pendingPoints[key] = (pendingPoints[key] || 0) + 1;
}

function removePending(key: string): void {
  if (pendingPoints[key] <= 0) return;
  pendingPoints[key]--;
}

const currentDerived = computed(() => {
  return calculateDerivedStats(props.race as Race, props.jobId as JobId, props.stats?.level || 1, props.statPoints || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 });
});

const previewDerived = computed(() => {
  const previewStatPoints: StatPoints = { ...props.statPoints } as StatPoints || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
  for (const key of Object.keys(pendingPoints)) {
    previewStatPoints[key as StatType] = (previewStatPoints[key as StatType] || 0) + pendingPoints[key];
  }
  return calculateDerivedStats(props.race as Race, props.jobId as JobId, props.stats?.level || 1, previewStatPoints);
});

const derivedList = computed(() => [
  { label: 'HP', current: currentDerived.value.maxHealth, preview: previewDerived.value.maxHealth },
  { label: 'MP', current: currentDerived.value.maxMana, preview: previewDerived.value.maxMana },
  { label: 'ATK', current: currentDerived.value.attack, preview: previewDerived.value.attack },
  { label: 'DEF', current: currentDerived.value.defense, preview: previewDerived.value.defense },
  { label: 'SPD', current: currentDerived.value.speed, preview: previewDerived.value.speed },
  { label: 'MATK', current: currentDerived.value.magicAttack, preview: previewDerived.value.magicAttack },
]);

function handleConfirm(): void {
  if (!hasPending.value) return;
  const batch: Record<string, number> = {};
  for (const [key, val] of Object.entries(pendingPoints)) {
    if (val > 0) batch[key] = val;
  }
  emit('allocate-batch', batch);
  for (const key of Object.keys(pendingPoints)) {
    pendingPoints[key] = 0;
  }
}

function handleCancel(): void {
  for (const key of Object.keys(pendingPoints)) {
    pendingPoints[key] = 0;
  }
  emit('close');
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
  width: 440px;
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
  gap: 0.4rem;
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

.stat-values {
  width: 45px;
  text-align: right;
  font-size: 0.85rem;
  font-weight: bold;
}

.stat-change {
  color: #4caf50;
  font-size: 0.75rem;
}

.stat-base {
  width: 75px;
  font-size: 0.7rem;
  color: #666;
}

.stat-minus-btn {
  width: 24px;
  height: 24px;
  background: #c62828;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
}

.stat-minus-btn:hover:not(:disabled) {
  background: #e53935;
}

.stat-minus-btn:disabled {
  opacity: 0.2;
  cursor: not-allowed;
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
  align-items: center;
}

.derived-label {
  color: #aaa;
  font-size: 0.75rem;
}

.derived-value {
  font-size: 0.8rem;
  font-weight: bold;
}

.derived-new {
  color: #4caf50;
  font-size: 0.8rem;
  font-weight: bold;
  margin-left: 4px;
}

.stat-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  justify-content: center;
}

.confirm-btn {
  background: #4caf50;
  border: none;
  color: white;
  padding: 6px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
}

.confirm-btn:hover {
  background: #388e3c;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc;
  padding: 6px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.cancel-btn:hover {
  background: rgba(255, 80, 80, 0.3);
  color: white;
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
