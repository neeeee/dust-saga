<template>
  <div class="character-select">
    <div class="char-select-panel">
      <h1>Choose Your Character</h1>

      <div v-if="characters.length > 0" class="character-list">
        <div
          v-for="char in characters"
          :key="char.id"
          class="character-card"
          :class="{ selected: selectedCharacterId === char.id }"
          @click="selectedCharacterId = char.id"
        >
          <div class="char-class-icon">{{ getRaceEmoji(char.race) }}</div>
          <div class="char-info">
            <h3>{{ char.name }}</h3>
            <p class="char-class">{{ getJobName(char.jobId || char.class) }}</p>
            <p class="char-race">{{ capitalize(char.race || 'Human') }}</p>
            <p class="char-level">Level {{ char.level }}</p>
          </div>
          <button class="delete-btn" @click.stop="$emit('delete-character', char.id)">x</button>
        </div>
      </div>

      <div class="char-actions">
        <button v-if="selectedCharacterId" class="btn-play" @click="$emit('select-character', selectedCharacterId)">
          Enter World
        </button>
        <button class="btn-create" @click="showCreateForm = true">
          Create New
        </button>
      </div>

      <div v-if="showCreateForm" class="create-form-overlay" @click.self="showCreateForm = false">
        <div class="create-form">
          <h2>Create Character</h2>
          <div class="form-group">
            <label>Name</label>
            <input v-model="newName" type="text" placeholder="Character name" maxlength="20" />
          </div>

          <h3 class="section-title">Choose Race</h3>
          <div class="race-select">
            <div
              v-for="race in races"
              :key="race.id"
              class="race-card"
              :class="{ selected: newRace === race.id }"
              @click="newRace = race.id; newPassive = race.passiveChoices[0].id"
            >
              <div class="race-emoji">{{ getRaceEmoji(race.id) }}</div>
              <h4>{{ race.name }}</h4>
              <p>{{ race.description }}</p>
              <div class="race-stats">
                <span v-for="(val, stat) in race.baseStats" :key="stat" class="stat-mini">
                  {{ stat }}: {{ val }}
                </span>
              </div>
              <div class="race-passive">
                <div
                  v-for="choice in race.passiveChoices"
                  :key="choice.id"
                  class="passive-choice"
                  :class="{ selected: newRace === race.id && newPassive === choice.id }"
                  @click.stop="newRace = race.id; newPassive = choice.id"
                >
                  <strong>{{ choice.name }}</strong>: {{ choice.description }}
                </div>
              </div>
            </div>
          </div>

          <h3 class="section-title">Choose Class</h3>
          <div class="class-select">
            <div
              v-for="cls in baseClasses"
              :key="cls.id"
              class="class-card"
              :class="{ selected: newClass === cls.id }"
              @click="newClass = cls.id"
            >
              <div class="class-emoji">{{ getClassEmoji(cls.id) }}</div>
              <h4>{{ cls.name }}</h4>
              <p>{{ cls.description }}</p>
              <div class="class-stats-preview">
                <div class="stat-bar" v-for="stat in previewStats" :key="stat.key">
                  <span class="stat-label">{{ stat.label }}</span>
                  <div class="stat-bar-bg">
                    <div
                      class="stat-bar-fill"
                      :style="{ width: getPreviewPercent(stat.key) + '%' }"
                    ></div>
                  </div>
                  <span class="stat-value">{{ getPreviewValue(stat.key) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button class="btn-primary" @click="handleCreate" :disabled="!newName || !newRace || !newClass">Create</button>
            <button class="btn-secondary" @click="showCreateForm = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { RACE_DATA, JOB_DEFINITIONS, BaseClass, Race, getBaseClassForJob, calculateDerivedStats, createDefaultStatPoints, RacialPassiveId } from '@dust-saga/shared';

const props = defineProps<{
  characters: Array<{
    id: string;
    name: string;
    class: string;
    race: string;
    jobId: string;
    level: number;
    modelFile: string;
  }>;
}>();

const emit = defineEmits<{
  'select-character': [characterId: string];
  'create-character': [data: { name: string; characterClass: string; race: string; racialPassive: string }];
  'delete-character': [characterId: string];
}>();

const races = Object.values(RACE_DATA);
const baseClasses = Object.values(JOB_DEFINITIONS).filter(j => j.tier === 1);
const selectedCharacterId = ref<string | null>(null);
const showCreateForm = ref(false);
const newName = ref('');
const newRace = ref<Race>(Race.HUMAN);
const newClass = ref<BaseClass>(BaseClass.WARRIOR);
const newPassive = ref<RacialPassiveId>(RacialPassiveId.HUMAN_FIGHTING_SPIRIT);

const previewStats = [
  { key: 'maxHealth', label: 'HP' },
  { key: 'maxMana', label: 'MP' },
  { key: 'attack', label: 'ATK' },
  { key: 'defense', label: 'DEF' },
  { key: 'speed', label: 'SPD' },
  { key: 'magicAttack', label: 'MATK' }
];

function getPreviewValue(key: string): number {
  const jobId = Object.values(JOB_DEFINITIONS).find(j => j.baseClass === newClass.value && j.tier === 1)?.id;
  if (!jobId) return 0;
  const stats = calculateDerivedStats(newRace.value, jobId, 1, createDefaultStatPoints());
  return (stats as any)[key] || 0;
}

function getPreviewPercent(key: string): number {
  const val = getPreviewValue(key);
  const maxes: Record<string, number> = { maxHealth: 200, maxMana: 150, attack: 30, defense: 20, speed: 40, magicAttack: 30 };
  return Math.min(100, (val / (maxes[key] || 100)) * 100);
}

function getRaceEmoji(race: string): string {
  const emojis: Record<string, string> = {
    human: '\uD83E\uDDD1',
    elf: '\uD83E\uDDD5',
    dwarf: '\u26CF\uFE0F',
    myrine: '\uD83D\uDC3A',
    enkidu: '\uD83E\uDD81',
    lapin: '\uD83D\uDC30'
  };
  return emojis[race] || '\uD83E\uDDD9';
}

function getClassEmoji(cls: string): string {
  const emojis: Record<string, string> = {
    warrior: '\u2694\uFE0F',
    scout: '\uD83C\uDFF3\uFE0F',
    acolyte: '\u2728',
    mage: '\uD83D\uDD2E'
  };
  return emojis[cls] || '\uD83E\uDDD9';
}

function getJobName(jobId: string): string {
  const job = JOB_DEFINITIONS[jobId as any];
  return job?.name || jobId;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function handleCreate() {
  if (newName.value && newRace.value && newClass.value) {
    const jobId = Object.values(JOB_DEFINITIONS).find(j => j.baseClass === newClass.value && j.tier === 1)?.id || newClass.value;
    emit('create-character', { name: newName.value, characterClass: jobId, race: newRace.value, racialPassive: newPassive.value });
    newName.value = '';
    newClass.value = BaseClass.WARRIOR;
    newRace.value = Race.HUMAN;
    newPassive.value = RacialPassiveId.HUMAN_FIGHTING_SPIRIT;
    showCreateForm.value = false;
  }
}
</script>

<style scoped>
.character-select {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.char-select-panel {
  background: rgba(20, 20, 40, 0.95);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  color: white;
}

.char-select-panel h1 {
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.character-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.character-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.character-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.char-class-icon {
  font-size: 2rem;
  width: 50px;
  text-align: center;
}

.char-info {
  flex: 1;
}

.char-info h3 {
  margin: 0;
  font-size: 1.1rem;
}

.char-class {
  color: #667eea;
  margin: 0.25rem 0 0;
  text-transform: capitalize;
}

.char-race {
  color: #88ccaa;
  margin: 0.1rem 0 0;
  text-transform: capitalize;
  font-size: 0.85rem;
}

.char-level {
  color: #aaa;
  margin: 0;
  font-size: 0.85rem;
}

.delete-btn {
  background: rgba(255, 50, 50, 0.3);
  border: none;
  color: #ff5555;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.8rem;
}

.char-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-play {
  padding: 0.75rem 2rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-create {
  padding: 0.75rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

.create-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 2rem;
  z-index: 100;
  overflow-y: auto;
}

.create-form {
  background: rgba(20, 20, 40, 0.98);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  color: white;
  margin-bottom: 2rem;
}

.create-form h2 {
  text-align: center;
  margin-bottom: 1rem;
}

.section-title {
  color: #aaa;
  margin: 1rem 0 0.5rem;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #aaa;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  box-sizing: border-box;
}

.race-select {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.race-card {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.race-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.race-card.selected {
  border-color: #88ccaa;
  background: rgba(136, 204, 170, 0.2);
}

.race-emoji {
  font-size: 1.5rem;
}

.race-card h4 {
  margin: 0.3rem 0 0.15rem;
  font-size: 0.9rem;
}

.race-card > p {
  font-size: 0.7rem;
  color: #aaa;
  margin: 0 0 0.4rem;
  line-height: 1.3;
}

.race-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  color: #888;
  margin-bottom: 0.3rem;
}

.stat-mini {
  background: rgba(255,255,255,0.05);
  padding: 1px 4px;
  border-radius: 3px;
}

.race-passive {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.65rem;
  color: #88ccaa;
  line-height: 1.2;
}

.passive-choice {
  padding: 2px 4px;
  border-radius: 3px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.passive-choice:hover {
  background: rgba(136, 204, 170, 0.15);
}

.passive-choice.selected {
  border-color: #88ccaa;
  background: rgba(136, 204, 170, 0.25);
  color: #aaddcc;
}

.passive-choice strong {
  color: #aaddcc;
}

.class-select {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.class-card {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.class-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.class-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.class-emoji {
  font-size: 1.5rem;
}

.class-card h4 {
  margin: 0.3rem 0 0.15rem;
  font-size: 0.95rem;
}

.class-card > p {
  font-size: 0.75rem;
  color: #aaa;
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.class-stats-preview {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
}

.stat-label {
  width: 35px;
  text-align: right;
  color: #aaa;
}

.stat-bar-bg {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  background: #667eea;
  border-radius: 3px;
  transition: width 0.3s;
}

.stat-value {
  width: 30px;
  color: #888;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-primary {
  padding: 0.75rem 2rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 0.75rem 2rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
}
</style>
