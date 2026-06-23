<template>
  <div class="hud">
    <div class="hud-top-left">
      <div class="player-info">
        <div class="player-name">{{ playerName }}</div>
        <div class="player-class">{{ playerClass }}</div>
        <div class="level-badge">Lv. {{ stats?.level || 1 }}</div>
      </div>
      <div class="player-bars">
        <div class="bars">
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
        <div class="status-effects" v-if="activeEffects.length > 0">
          <div
            v-for="eff in activeEffects"
            :key="eff.id"
            class="effect-icon"
            :class="{ buff: eff.isBuff, debuff: !eff.isBuff }"
            :title="eff.remaining ? eff.type + ' (' + eff.remaining + 's)' : eff.type"
          >
            {{ eff.label }}
            <span class="effect-timer" v-if="eff.remaining">{{ eff.remaining }}</span>
          </div>
        </div>
      </div>
      <div class="target-info" v-if="targetId">
        <div class="target-header">
          <div class="target-identity">
            <span class="target-name" :class="{ 'player-target': targetType === 'player' }">{{ targetName }}</span>
            <span class="target-level" v-if="targetLevel > 0">Lv. {{ targetLevel }}</span>
            <span class="target-class" v-if="targetClass">{{ targetClass }}</span>
          </div>
          <button class="target-close" @click="$emit('clear-target')">x</button>
        </div>
        <div class="bar-container target-bar" v-if="targetMaxHealth > 0">
          <div class="bar target-health" :class="{ 'player-health': targetType === 'player' }" :style="{ width: targetHealthPercent + '%' }"></div>
          <span class="bar-text">{{ targetHealth }} / {{ targetMaxHealth }}</span>
        </div>
        <div class="target-effects" v-if="targetStatusEffects.length > 0">
          <div
            v-for="eff in targetEffectsDisplay"
            :key="eff.id"
            class="effect-icon mini"
            :class="{ buff: eff.isBuff, debuff: !eff.isBuff }"
            :title="eff.remaining ? eff.type + ' (' + eff.remaining + 's)' : eff.type"
          >
            {{ eff.label }}
          </div>
        </div>
        <div class="target-actions" v-if="targetType === 'player'">
          <button class="social-btn" title="Add Friend" @click="$emit('whisper-player', targetName)">F</button>
          <button class="social-btn" title="Add to Party" @click="$emit('party-action', targetId)">P</button>
          <button class="social-btn" title="Trade" @click="$emit('trade-action', targetId)">T</button>
          <button class="social-btn" title="Add to Guild">G</button>
          <button class="social-btn" title="Whisper" @click="$emit('whisper-player', targetName)">W</button>
        </div>
      </div>
    </div>

    <div class="hud-top-right">
      <div class="minimap-container">
        <canvas ref="minimapCanvas" width="150" height="150"></canvas>
      </div>
      <div class="fps-counter">{{ fps }}</div>
    </div>

    <div class="hud-bottom-center">
      <CastBar />
    </div>

    <SkillBarContainer @use-skill="(bi, si) => $emit('use-skill', bi, si)" />

    <div class="hud-bottom-right">
      <div class="action-buttons">
        <button class="action-btn" @click="$emit('toggle-inventory')" title="Inventory (I)">B</button>
        <button class="action-btn" @click="$emit('toggle-quests')" title="Quests (J)">Q</button>
        <button class="action-btn" @click="$emit('toggle-character')" title="Character (C)">C</button>
        <button class="action-btn" @click="$emit('toggle-skills')" title="Skills (K)">K</button>
        <button class="action-btn" :class="{ active: isResting }" @click="$emit('toggle-rest')" title="Rest (R)">R</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { PlayerStats, StatusEffectType } from '@dust-saga/shared';
import SkillBarContainer from './SkillBarContainer.vue';
import CastBar from './CastBar.vue';

const fps = ref(0);
let fpsInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  fpsInterval = setInterval(() => {
    const canvas = document.querySelector('canvas');
    if (canvas && (canvas as any).engineInstance) {
      fps.value = Math.round((canvas as any).engineInstance.getFps());
    }
  }, 500);
});

onUnmounted(() => {
  if (fpsInterval) clearInterval(fpsInterval);
});

const BUFF_TYPES = new Set([
  StatusEffectType.HASTE,
  StatusEffectType.BUFF_DEFENSE,
  StatusEffectType.BUFF_CAST_SPEED,
  StatusEffectType.BUFF_MAX_HP,
  StatusEffectType.BUFF_MP_REGEN,
  StatusEffectType.BUFF_ATTACK,
  StatusEffectType.BUFF_GENERIC,
  StatusEffectType.BUFF_STAT,
  StatusEffectType.BUFF_PHYSICAL_REDUC,
  StatusEffectType.BUFF_DODGE,
  StatusEffectType.BUFF_ACCURACY,
  StatusEffectType.BUFF_ATTACK_SPEED,
  StatusEffectType.WEAPON_AURA,
  StatusEffectType.BUFF_RESIST,
  StatusEffectType.BUFF_CRIT_RESIST,
  StatusEffectType.BUFF_CRIT_DAMAGE_REDUCE,
  StatusEffectType.BUFF_AURA_DAMAGE_REDUCE,
  StatusEffectType.BUFF_MANA_SHIELD,
  StatusEffectType.BUFF_SPELL_INTERRUPT_RESIST,
  StatusEffectType.BUFF_DEBUFF_RESIST,
  StatusEffectType.BUFF_DAMAGE_REDIRECT,
  StatusEffectType.BUFF_BLOCK_CHANCE,
  StatusEffectType.BUFF_BLOCKING_STANCE,
  StatusEffectType.BUFF_BLOCKING_PROTECTED,
  StatusEffectType.BUFF_CONSUMABLE_ON_ATTACK,
  StatusEffectType.BUFF_GUARDED,
  StatusEffectType.BUFF_DAMAGE_NEGATION,
  StatusEffectType.BUFF_MOVE_SPEED,
  StatusEffectType.SONG_GREEN,
  StatusEffectType.SONG_BLUE,
  StatusEffectType.SONG_YELLOW,
  StatusEffectType.SONG_ACTIVE,
]);

const DEBUFF_ICONS: Record<string, string> = {
  [StatusEffectType.POISON]: 'Ps',
  [StatusEffectType.BURN]: 'Br',
  [StatusEffectType.FREEZE]: 'Fr',
  [StatusEffectType.STUN]: 'St',
  [StatusEffectType.SILENCE]: 'Si',
  [StatusEffectType.SLEEP]: 'Sl',
  [StatusEffectType.KNOCKDOWN]: 'Kd',
  [StatusEffectType.CHARM]: 'Ch',
  [StatusEffectType.BLEED]: 'Bl',
  [StatusEffectType.ROOT]: 'Rt',
  [StatusEffectType.SLOW]: 'Sw',
  [StatusEffectType.SEVERE_POISON]: 'SP',
  [StatusEffectType.MP_DRAIN]: 'MD',
  [StatusEffectType.DEBUFF_DAMAGE_DOWN]: 'AD',
  [StatusEffectType.DEBUFF_DEFENSE_DOWN]: 'DD',
  [StatusEffectType.DEBUFF_SPEED_DOWN]: 'SD',
  [StatusEffectType.DEBUFF_ACCURACY_DOWN]: 'AC',
  [StatusEffectType.DEBUFF_CAST_SPEED_DOWN]: 'CS',
  [StatusEffectType.DEBUFF_DAMAGE_TAKEN_UP]: 'DT',
  [StatusEffectType.DEBUFF_DODGE_DOWN]: 'Do',
  [StatusEffectType.SONG_RED]: 'RS',
  [StatusEffectType.FEAR]: 'Fe',
  [StatusEffectType.CURSE]: 'Cu',
  [StatusEffectType.MP_DAMAGE_DEBUFF]: 'MP',
};

function getEffectLabel(e: any): string {
  if (e.skillName) {
    const words = e.skillName.split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return e.skillName.substring(0, 2).toUpperCase();
  }
  return DEBUFF_ICONS[e.type] || '??';
}

const props = defineProps<{
  stats: PlayerStats | null;
  playerName: string;
  playerClass: string;
  targetId: string | null;
  targetName: string;
  targetHealth: number;
  targetMaxHealth: number;
  targetLevel: number;
  targetType: string;
  targetClass: string;
  targetStatusEffects: any[];
  statusEffects: any[];
  isResting: boolean;
}>();

defineEmits<{
  'toggle-inventory': [];
  'toggle-quests': [];
  'toggle-character': [];
  'toggle-skills': [];
  'toggle-rest': [];
  'clear-target': [];
  'use-skill': [barIndex: number, slotIndex: number];
  'whisper-player': [playerName: string];
  'party-action': [targetId: string];
  'trade-action': [targetId: string];
}>();

const minimapCanvas = ref<HTMLCanvasElement | null>(null);
const effectNow = ref(Date.now());
let effectTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  effectTimer = setInterval(() => { effectNow.value = Date.now(); }, 500);
});

onUnmounted(() => {
  if (effectTimer) clearInterval(effectTimer);
});

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

const activeEffects = computed(() => {
  void effectNow.value;
  return (props.statusEffects || []).map(e => {
    const remaining = Math.max(0, (e.appliedAt + e.duration - Date.now()) / 1000);
    const isToggled = e.duration >= 3600000;
    return {
      ...e,
      label: getEffectLabel(e),
      isBuff: BUFF_TYPES.has(e.type),
      remaining: isToggled ? '' : remaining.toFixed(1),
      expired: isToggled ? false : remaining <= 0,
    };
  }).filter(e => !e.expired && !e.songProximityBuff);
});

const targetEffectsDisplay = computed(() => {
  void effectNow.value;
  return (props.targetStatusEffects || []).map(e => {
    const remaining = Math.max(0, (e.appliedAt + e.duration - Date.now()) / 1000);
    const isToggled = e.duration >= 3600000;
    return {
      ...e,
      label: getEffectLabel(e),
      isBuff: BUFF_TYPES.has(e.type),
      remaining: isToggled ? '' : remaining.toFixed(1),
      expired: isToggled ? false : remaining <= 0,
    };
  }).filter(e => !e.expired);
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

.player-bars {
  display: flex;
  flex-direction: column;
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

.target-name.player-target {
  color: #42a5f5;
}

.target-class {
  font-size: 0.7rem;
  color: #aaa;
  text-transform: capitalize;
}

.target-actions {
  display: flex;
  gap: 4px;
  margin-top: 5px;
}

.social-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #ccc;
  font-size: 0.7rem;
  padding: 2px 8px;
  cursor: pointer;
}

.social-btn:hover {
  background: rgba(66, 165, 245, 0.3);
  color: white;
}

.player-health {
  background: linear-gradient(to bottom, #42a5f5, #1565c0) !important;
}

.status-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}

.effect-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: bold;
  color: white;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.effect-icon.buff {
  background: rgba(76, 175, 80, 0.7);
}

.effect-icon.debuff {
  background: rgba(244, 67, 54, 0.7);
}

.effect-timer {
  font-size: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1;
}

.target-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 3px;
}

.effect-icon.mini {
  width: 20px;
  height: 20px;
  font-size: 0.5rem;
  border-radius: 3px;
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

.fps-counter {
  margin-top: 4px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  color: #8f8;
  font-size: 0.7rem;
  font-family: monospace;
  text-align: right;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
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

.action-btn.active {
  background: rgba(80, 200, 120, 0.5);
  border-color: rgba(80, 200, 120, 0.8);
}
</style>
