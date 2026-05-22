<template>
  <div ref="panelRef" class="stat-panel" v-show="visible" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
      <div class="stat-panel-header" data-drag-handle>
        <span class="drag-dots">&#8960;</span>
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
            <span class="stat-value">{{ getEffectiveTotal(stat.key) }}</span>
            <span class="stat-change" v-if="pendingPoints[stat.key] > 0">(+{{ pendingPoints[stat.key] }})</span>
          </div>
          <div class="stat-base">
            ({{ getBase(stat.key) }} + {{ getAllocated(stat.key) }}
            <span v-if="getGearBonus(stat.key)" class="bonus-gear"> +{{ getGearBonus(stat.key) }}</span>
            <span v-if="getBuffBonus(stat.key)" class="bonus-buff"> +{{ getBuffBonus(stat.key) }}</span>
            )
          </div>
          <button
            class="stat-minus-btn"
            :disabled="pendingPoints[stat.key] <= 0"
            @click="removePending(stat.key)"
          >-</button>
          <button
            class="stat-plus-btn"
            :disabled="effectiveUnspent < getNextCost(stat.key) || getTotal(stat.key) >= 99"
            @click="addPending(stat.key)"
          >+</button>
          <span class="cost-tag" v-if="getNextCost(stat.key) > 1">-{{ getNextCost(stat.key) }}</span>
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

      <div class="combat-stats">
        <h3>Combat Stats</h3>
        <div class="combat-grid">
          <div class="combat-item">
            <span class="combat-label">Accuracy</span>
            <span class="combat-value">{{ combatStats.accuracy }}</span>
          </div>
          <div class="combat-item">
            <span class="combat-label">Dodge</span>
            <span class="combat-value">{{ combatStats.dodge }}</span>
          </div>
          <div class="combat-item">
            <span class="combat-label">Atk Speed</span>
            <span class="combat-value">{{ formatPercent(combatStats.attackSpeed) }}</span>
          </div>
        </div>
      </div>

      <div class="resistances">
        <h3>Elemental Resistances</h3>
        <div class="resist-grid">
          <div class="resist-item">
            <span class="resist-icon fire">F</span>
            <span class="resist-label">Fire</span>
            <span class="resist-value">{{ resistances.fire }}</span>
          </div>
          <div class="resist-item">
            <span class="resist-icon ice">I</span>
            <span class="resist-label">Ice</span>
            <span class="resist-value">{{ resistances.ice }}</span>
          </div>
          <div class="resist-item">
            <span class="resist-icon lightning">L</span>
            <span class="resist-label">Lightning</span>
            <span class="resist-value">{{ resistances.lightning }}</span>
          </div>
          <div class="resist-item">
            <span class="resist-icon poison">P</span>
            <span class="resist-label">Poison</span>
            <span class="resist-value">{{ resistances.poison }}</span>
          </div>
          <div class="resist-item">
            <span class="resist-icon dark">D</span>
            <span class="resist-label">Dark</span>
            <span class="resist-value">{{ resistances.dark }}</span>
          </div>
          <div class="resist-item">
            <span class="resist-icon dark">H</span>
            <span class="resist-label">Holy</span>
            <span class="resist-value">{{ resistances.holy }}</span>
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
</template>

<script setup lang="ts">
import { reactive, computed, watch, ref, onMounted, onUnmounted } from 'vue';
import {
  PlayerStats, StatPoints, StatType, RACE_DATA, Race,
  JOB_DEFINITIONS, JobId, BaseClass, calculateDerivedStats, getJobBaseStatModifier,
  getStatPointCost
} from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-stats', { x: 250, y: 120 });
const panelRef = ref<HTMLElement | null>(null);

const props = defineProps<{
  visible: boolean;
  stats: PlayerStats | null;
  statPoints: StatPoints | null;
  unspentStatPoints: number;
  race: string;
  jobId: string;
  statBreakdown: any;
  statusEffects: any[];
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
  const baseClassId = job?.baseClass === BaseClass.WARRIOR ? 0 : job?.baseClass === BaseClass.SCOUT ? 1 : job?.baseClass === BaseClass.ACOLYTE ? 2 : 3;
  const jobMod = getJobBaseStatModifier(baseClassId);
  return (raceData?.baseStats[key as StatType] || 0) + (jobMod[key] || 0);
}

function getAllocated(key: string): number {
  return (props.statPoints?.[key as StatType] || 0) + (pendingPoints[key] || 0);
}

function getTotal(key: string): number {
  return getBase(key) + getAllocated(key);
}

function getGearBonus(key: string): number {
  return props.statBreakdown?.gear?.[key] || 0;
}

function getBuffBonus(key: string): number {
  if (props.statBreakdown?.buffs?.[key]) return props.statBreakdown.buffs[key];
  if (!props.statusEffects?.length) return 0;
  let total = 0;
  for (const effect of props.statusEffects) {
    const fs = effect.buffData?.flatStats;
    if (!fs) continue;
    if (key === 'STA' && fs.sta) total += fs.sta;
    if (key === 'STR' && fs.str) total += fs.str;
    if (key === 'AGI' && fs.agi) total += fs.agi;
    if (key === 'DEX' && fs.dex) total += fs.dex;
    if (key === 'SPI' && fs.spi) total += fs.spi;
    if (key === 'INT' && fs.int) total += fs.int;
  }
  return total;
}

function getEffectiveTotal(key: string): number {
  return getTotal(key) + getGearBonus(key) + getBuffBonus(key);
}

function getBarWidth(key: string): number {
  return Math.min(100, (getEffectiveTotal(key) / 99) * 100);
}

function getNextCost(key: string): number {
  const currentTotal = getTotal(key);
  if (currentTotal >= 99) return Infinity;
  const [cost] = getStatPointCost(currentTotal);
  return cost;
}

function getPendingCost(key: string): number {
  const allocated = props.statPoints?.[key as StatType] || 0;
  const base = getBase(key);
  let total = 0;
  for (let i = 0; i < (pendingPoints[key] || 0); i++) {
    const [cost] = getStatPointCost(base + allocated + i);
    total += cost;
  }
  return total;
}

const totalPendingCost = computed(() => {
  let total = 0;
  for (const key of Object.keys(pendingPoints)) {
    total += getPendingCost(key);
  }
  return total;
});

const effectiveUnspent = computed(() => props.unspentStatPoints - totalPendingCost.value);

const hasPending = computed(() => totalPendingCost.value > 0);

function addPending(key: string): void {
  if (getTotal(key) >= 99) return;
  const cost = getNextCost(key);
  if (effectiveUnspent.value < cost) return;
  pendingPoints[key] = (pendingPoints[key] || 0) + 1;
}

function removePending(key: string): void {
  if (pendingPoints[key] <= 0) return;
  pendingPoints[key]--;
}

const currentDerived = computed(() => {
  if (props.stats) {
    return {
      maxHealth: props.stats.maxHealth,
      maxMana: props.stats.maxMana,
      attack: props.stats.attack,
      defense: props.stats.defense,
      magicAttack: props.stats.magicAttack,
      critChance: props.stats.critChance,
    };
  }
  return calculateDerivedStats(props.race as Race, props.jobId as JobId, 1, props.statPoints || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 });
});

const previewDerived = computed(() => {
  const previewStatPoints: StatPoints = props.statPoints ? { ...props.statPoints } : { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
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
  { label: 'CRIT', current: currentDerived.value.critChance + '%', preview: previewDerived.value.critChance + '%' },
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

const combatStats = computed(() => {
  const gc = props.statBreakdown?.gearCombat;
  return {
    accuracy: props.statBreakdown?.totalAccuracy ?? gc?.accuracy ?? 0,
    dodge: props.statBreakdown?.totalDodge ?? gc?.dodge ?? 0,
    attackSpeed: gc?.attackSpeed || 0,
  };
});

const resistances = computed(() => {
  const gc = props.statBreakdown?.gearCombat;
  return {
    fire: gc?.fireResist || 0,
    ice: gc?.iceResist || 0,
    lightning: gc?.lightningResist || 0,
    poison: gc?.poisonResist || 0,
    dark: gc?.darkResist || 0,
    holy: gc?.holyResist || 0,
  };
});

function formatPercent(value: number): string {
  if (value === 0) return '0%';
  return (value >= 0 ? '+' : '') + Math.round(value * 100) + '%';
}

onMounted(() => {
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
});
</script>

<style scoped>
.stat-panel {
  position: absolute;
  background: rgba(20, 20, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 1.5rem;
  width: 440px;
  color: white;
  user-select: none;
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
  flex: 1;
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
.bonus-gear {
  color: #66bb6a;
}
.bonus-buff {
  color: #ffa726;
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

.cost-tag {
  font-size: 0.65rem;
  color: #ffb74d;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
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

.combat-stats h3,
.resistances h3 {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.combat-stats {
  margin-bottom: 1rem;
}

.combat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.combat-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.combat-label {
  color: #aaa;
  font-size: 0.75rem;
}

.combat-value {
  font-size: 0.8rem;
  font-weight: bold;
}

.resistances {
  margin-bottom: 1rem;
}

.resist-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}

.resist-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.resist-icon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: bold;
  flex-shrink: 0;
}

.resist-icon.fire {
  background: rgba(244, 67, 54, 0.3);
  color: #ef5350;
}

.resist-icon.ice {
  background: rgba(33, 150, 243, 0.3);
  color: #42a5f5;
}

.resist-icon.lightning {
  background: rgba(255, 193, 7, 0.3);
  color: #ffca28;
}

.resist-icon.poison {
  background: rgba(76, 175, 80, 0.3);
  color: #66bb6a;
}

.resist-icon.dark {
  background: rgba(156, 39, 176, 0.3);
  color: #ab47bc;
}

.resist-label {
  color: #aaa;
  font-size: 0.75rem;
  flex: 1;
}

.resist-value {
  font-size: 0.8rem;
  font-weight: bold;
}
</style>
