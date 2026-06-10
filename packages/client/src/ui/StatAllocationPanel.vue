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

      <div class="stat-actions" v-if="hasPending">
        <button class="confirm-btn" @click="handleConfirm">Confirm</button>
        <button class="cancel-btn" @click="handleCancel">Cancel</button>
      </div>

      <div class="panel-tabs">
        <button class="panel-tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">Stats</button>
        <button class="panel-tab" :class="{ active: activeTab === 'resists' }" @click="activeTab = 'resists'">Resists</button>
      </div>

      <template v-if="activeTab === 'stats'">
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
              <span class="combat-label">Atk Spd</span>
              <span class="combat-value">{{ formatPercent(combatStats.attackSpeed) }}</span>
            </div>
            <div class="combat-item">
              <span class="combat-label">CD Reduction</span>
              <span class="combat-value">-{{ combatStats.cooldownReduction }}%</span>
            </div>
          </div>
        </div>

        <div class="enhancement-stats" v-if="hasEnhancement">
          <h3>Enhancement Bonuses</h3>
          <div class="enhance-grid">
            <div class="enhance-item" v-if="enhBonuses.attack > 0">
              <span class="enhance-label">ATK</span>
              <span class="enhance-value">+{{ enhBonuses.attack }}</span>
            </div>
            <div class="enhance-item" v-if="enhBonuses.defense > 0">
              <span class="enhance-label">DEF</span>
              <span class="enhance-value">+{{ enhBonuses.defense }}</span>
            </div>
            <div class="enhance-item" v-if="enhBonuses.health > 0">
              <span class="enhance-label">HP</span>
              <span class="enhance-value">+{{ enhBonuses.health }}</span>
            </div>
            <div class="enhance-item" v-if="enhBonuses.magicAttackPercent > 0">
              <span class="enhance-label">MATK</span>
              <span class="enhance-value">+{{ enhBonuses.magicAttackPercent }}%</span>
            </div>
            <div class="enhance-item" v-if="enhBonuses.dodge > 0">
              <span class="enhance-label">Dodge</span>
              <span class="enhance-value">+{{ enhBonuses.dodge }}</span>
            </div>
          </div>
        </div>

        <div class="racial-passive" v-if="racialPassive">
          <span class="passive-name">{{ racialPassive.name }}</span>
          <span class="passive-desc">{{ racialPassive.description }}</span>
        </div>
      </template>

      <template v-if="activeTab === 'resists'">
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
              <span class="resist-icon holy">H</span>
              <span class="resist-label">Holy</span>
              <span class="resist-value">{{ resistances.holy }}</span>
            </div>
          </div>
        </div>

        <div class="resistances">
          <h3>Status Resistances</h3>
          <div class="resist-grid">
            <div class="resist-item" v-for="r in [
              { key: 'ailment', label: 'Ailment', cls: 'ailment' },
              { key: 'disorder', label: 'Disorder', cls: 'disorder' },
              { key: 'stun', label: 'Stun', cls: 'stun' },
              { key: 'trip', label: 'Trip', cls: 'trip' },
              { key: 'freeze', label: 'Freeze', cls: 'freeze' },
              { key: 'burn', label: 'Burn', cls: 'burn' },
              { key: 'curse', label: 'Curse', cls: 'curse' },
              { key: 'bleed', label: 'Bleed', cls: 'bleed' },
              { key: 'sleep', label: 'Sleep', cls: 'sleep' },
              { key: 'weakness', label: 'Weakness', cls: 'weakness' },
              { key: 'weaken', label: 'Weaken', cls: 'weaken' },
              { key: 'knockdown', label: 'Knockdown', cls: 'knockdown' },
              { key: 'knockback', label: 'Knockback', cls: 'knockback' },
            ]" :key="r.key">
              <span class="resist-icon" :class="r.cls">{{ r.label[0] }}</span>
              <span class="resist-label">{{ r.label }}</span>
              <span class="resist-value">{{ (statusResistances as Record<string, number>)[r.key] }}</span>
            </div>
          </div>
        </div>
      </template>
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
  racialPassive?: string;
  jobId: string;
  statBreakdown: any;
  statusEffects: any[];
}>();

const emit = defineEmits<{
  'close': [];
  'allocate': [stat: string];
  'allocate-batch': [allocations: Record<string, number>];
}>();

const activeTab = ref<'stats' | 'resists'>('stats');

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

const derivedList = computed(() => {
  const castSpeedCurrent = (props.stats?.castSpeed ?? 100) - 100;
  const extraDex = Object.values(pendingPoints).reduce((s, v) => s + v, 0);
  const dexNow = (props.statPoints?.DEX || 0) + getBase('DEX');
  const castSpeedPreview = 100 + Math.floor((dexNow + extraDex) / 10) * 5 - 100;
  return [
    { label: 'HP', current: currentDerived.value.maxHealth, preview: previewDerived.value.maxHealth },
    { label: 'MP', current: currentDerived.value.maxMana, preview: previewDerived.value.maxMana },
    { label: 'ATK', current: currentDerived.value.attack, preview: previewDerived.value.attack },
    { label: 'DEF', current: currentDerived.value.defense, preview: previewDerived.value.defense },
    { label: 'CRIT', current: currentDerived.value.critChance + '%', preview: previewDerived.value.critChance + '%' },
    { label: 'MATK', current: currentDerived.value.magicAttack, preview: previewDerived.value.magicAttack },
    { label: 'CSPD', current: '+' + castSpeedCurrent + '%', preview: '+' + castSpeedPreview + '%' },
  ];
});

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
  const choice = raceData.passiveChoices.find(c => c.id === props.racialPassive);
  if (choice) return { name: choice.name, description: choice.description };
  return { name: raceData.passiveChoices[0].name, description: raceData.passiveChoices[0].description };
});

const combatStats = computed(() => {
  const gc = props.statBreakdown?.gearCombat;
  const totalINT = (props.statPoints?.INT || 0) + (props.statBreakdown?.baseStats?.INT || 0);
  const baseCdReduction = Math.floor(totalINT / 10) * 2;
  const buffCdReduction = props.statBreakdown?.buffCooldownReduction || 0;
  return {
    accuracy: props.statBreakdown?.totalAccuracy ?? gc?.accuracy ?? 0,
    dodge: props.statBreakdown?.totalDodge ?? gc?.dodge ?? 0,
    attackSpeed: gc?.attackSpeed || 0,
    castSpeed: ((props.stats?.castSpeed ?? 100) - 100) / 100,
    cooldownReduction: baseCdReduction + buffCdReduction,
  };
});

const enhBonuses = computed(() => {
  const e = props.statBreakdown?.enhancement;
  return {
    attack: e?.attack || 0,
    defense: e?.defense || 0,
    health: e?.health || 0,
    magicAttackPercent: e?.magicAttackPercent || 0,
    dodge: e?.dodge || 0,
  };
});

const hasEnhancement = computed(() => {
  const e = enhBonuses.value;
  return e.attack > 0 || e.defense > 0 || e.health > 0 || e.magicAttackPercent > 0 || e.dodge > 0;
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

const statusResistances = computed(() => {
  const gc = props.statBreakdown?.gearCombat;
  const sb = props.statBreakdown;
  return {
    ailment: sb?.totalAilmentResist ?? (gc?.ailmentResist || 0),
    disorder: sb?.totalDisorderResist ?? (gc?.disorderResist || 0),
    stun: gc?.stunResist || 0,
    trip: gc?.tripResist || 0,
    freeze: gc?.freezeResist || 0,
    burn: gc?.burnResist || 0,
    curse: gc?.curseResist || 0,
    bleed: gc?.bleedResist || 0,
    sleep: gc?.sleepResist || 0,
    weakness: gc?.weaknessResist || 0,
    knockdown: gc?.knockdownResist || 0,
    knockback: gc?.knockbackResist || 0,
    weaken: gc?.weakenResist || 0,
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
  border-radius: 10px;
  padding: 1rem;
  width: 400px;
  color: white;
  user-select: none;
}

.stat-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.6rem;
}

.stat-panel-header h2 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
}

.drag-dots {
  cursor: grab;
  color: #666;
  font-size: 0.85rem;
  margin-right: 8px;
}

.drag-dots:active {
  cursor: grabbing;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #aaa;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.85rem;
}

.close-btn:hover {
  background: rgba(255, 80, 80, 0.4);
  color: white;
}

.points-available {
  text-align: center;
  margin-bottom: 0.6rem;
}

.points-badge {
  background: #667eea;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: bold;
}

.stat-rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.6rem;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.stat-name {
  width: 32px;
  font-size: 0.75rem;
  font-weight: bold;
  color: #aaa;
}

.stat-bar-container {
  flex: 1;
  height: 12px;
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
  width: 42px;
  text-align: right;
  font-size: 0.8rem;
  font-weight: bold;
}

.stat-change {
  color: #4caf50;
  font-size: 0.7rem;
}

.stat-base {
  width: 70px;
  font-size: 0.65rem;
  color: #666;
}
.bonus-gear {
  color: #66bb6a;
}
.bonus-buff {
  color: #ffa726;
}

.stat-minus-btn {
  width: 22px;
  height: 22px;
  background: #c62828;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
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
  width: 22px;
  height: 22px;
  background: #667eea;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
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
  font-size: 0.6rem;
  color: #ffb74d;
  font-weight: 600;
  min-width: 22px;
  text-align: center;
}

.stat-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  justify-content: center;
}

.confirm-btn {
  background: #4caf50;
  border: none;
  color: white;
  padding: 5px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: bold;
}

.confirm-btn:hover {
  background: #388e3c;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc;
  padding: 5px 16px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.8rem;
}

.cancel-btn:hover {
  background: rgba(255, 80, 80, 0.3);
  color: white;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.5rem;
}

.panel-tab {
  flex: 1;
  padding: 4px 8px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #666;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: color 0.15s, border-color 0.15s;
}

.panel-tab:hover { color: #aaa; }
.panel-tab.active { color: #a8b8ff; border-bottom-color: #667eea; }

.derived-stats h3 {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.derived-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
  margin-bottom: 0.6rem;
}

.derived-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.derived-label {
  color: #999;
  font-size: 0.7rem;
}

.derived-value {
  font-size: 0.75rem;
  font-weight: bold;
}

.derived-new {
  color: #4caf50;
  font-size: 0.75rem;
  font-weight: bold;
  margin-left: 4px;
}

.racial-passive {
  background: rgba(136, 204, 170, 0.1);
  border: 1px solid rgba(136, 204, 170, 0.3);
  border-radius: 5px;
  padding: 0.4rem 0.6rem;
  margin-bottom: 0.5rem;
}

.passive-name {
  font-size: 0.75rem;
  font-weight: bold;
  color: #88ccaa;
  display: block;
  margin-bottom: 0.1rem;
}

.passive-desc {
  font-size: 0.65rem;
  color: #aaa;
  line-height: 1.3;
}

.combat-stats h3,
.resistances h3 {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.combat-stats {
  margin-bottom: 0.6rem;
}

.combat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}

.combat-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.combat-label {
  color: #999;
  font-size: 0.7rem;
}

.combat-value {
  font-size: 0.75rem;
  font-weight: bold;
}

.enhancement-stats {
  margin-bottom: 0.6rem;
}

.enhancement-stats h3 {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.enhance-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
}

.enhance-item {
  background: rgba(255, 183, 77, 0.1);
  border: 1px solid rgba(255, 183, 77, 0.2);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.enhance-label {
  color: #ffb74d;
  font-size: 0.7rem;
}

.enhance-value {
  color: #ffe0b2;
  font-size: 0.75rem;
  font-weight: bold;
}

.resistances {
  margin-bottom: 0.6rem;
}

.resist-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.3rem;
}

.resist-item {
  background: rgba(255, 255, 255, 0.05);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.resist-icon {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
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

.resist-icon.holy {
  background: rgba(255, 235, 59, 0.3);
  color: #ffee58;
}

.resist-icon.ailment { background: rgba(255, 152, 0, 0.3); color: #ffb74d; }
.resist-icon.disorder { background: rgba(233, 30, 99, 0.3); color: #ec407a; }
.resist-icon.stun { background: rgba(255, 193, 7, 0.3); color: #ffca28; }
.resist-icon.trip { background: rgba(121, 85, 72, 0.3); color: #a1887f; }
.resist-icon.freeze { background: rgba(33, 150, 243, 0.3); color: #42a5f5; }
.resist-icon.burn { background: rgba(244, 67, 54, 0.3); color: #ef5350; }
.resist-icon.curse { background: rgba(106, 27, 154, 0.3); color: #9c27b0; }
.resist-icon.bleed { background: rgba(198, 40, 40, 0.3); color: #c62828; }
.resist-icon.sleep { background: rgba(63, 81, 181, 0.3); color: #5c6bc0; }
.resist-icon.weakness { background: rgba(233, 30, 99, 0.3); color: #ec407a; }
.resist-icon.knockdown { background: rgba(121, 85, 72, 0.3); color: #8d6e63; }
.resist-icon.knockback { background: rgba(255, 152, 0, 0.3); color: #ffa726; }
.resist-icon.weaken { background: rgba(233, 30, 99, 0.3); color: #ec407a; }

.resist-label {
  color: #999;
  font-size: 0.7rem;
  flex: 1;
}

.resist-value {
  font-size: 0.75rem;
  font-weight: bold;
}
</style>
