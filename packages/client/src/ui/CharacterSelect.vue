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
          <div class="char-class-icon">{{ getClassEmoji(char.class) }}</div>
          <div class="char-info">
            <h3>{{ char.name }}</h3>
            <p class="char-class">{{ char.class }}</p>
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
          <div class="class-select">
            <div
              v-for="(cls, key) in classes"
              :key="key"
              class="class-card"
              :class="{ selected: newClass === key }"
              @click="newClass = key"
            >
              <div class="class-emoji">{{ getClassEmoji(key) }}</div>
              <h4>{{ cls.name }}</h4>
              <p>{{ cls.description }}</p>
              <div class="class-stats">
                <span>HP: {{ cls.stats.baseHealth }}</span>
                <span>ATK: {{ cls.stats.baseAttack }}</span>
                <span>DEF: {{ cls.stats.baseDefense }}</span>
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-primary" @click="handleCreate" :disabled="!newName || !newClass">Create</button>
            <button class="btn-secondary" @click="showCreateForm = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CLASS_DEFINITIONS, CharacterClass } from '@dust-saga/shared';

const props = defineProps<{
  characters: Array<{
    id: string;
    name: string;
    class: string;
    level: number;
    modelFile: string;
  }>;
}>();

const emit = defineEmits<{
  'select-character': [characterId: string];
  'create-character': [name: string, characterClass: string];
  'delete-character': [characterId: string];
}>();

const classes = CLASS_DEFINITIONS;
const selectedCharacterId = ref<string | null>(null);
const showCreateForm = ref(false);
const newName = ref('');
const newClass = ref('');

function getClassEmoji(cls: string): string {
  const emojis: Record<string, string> = {
    warrior: '\u2694\uFE0F',
    mage: '\u2728',
    ranger: '\uD83C\uDFF3\uFE0F',
    rogue: '\uD83D\uDD2A',
    paladin: '\uD83D\uDEE1\uFE0F'
  };
  return emojis[cls] || '\uD83E\uDDD9';
}

function handleCreate() {
  if (newName.value && newClass.value) {
    emit('create-character', newName.value, newClass.value);
    newName.value = '';
    newClass.value = '';
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
  align-items: center;
  z-index: 100;
}

.create-form {
  background: rgba(20, 20, 40, 0.98);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  color: white;
}

.create-form h2 {
  text-align: center;
  margin-bottom: 1rem;
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
}

.class-select {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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

.class-card h4 {
  margin: 0.5rem 0 0.25rem;
  font-size: 0.95rem;
}

.class-card p {
  font-size: 0.75rem;
  color: #aaa;
  margin: 0 0 0.5rem;
  line-height: 1.3;
}

.class-stats {
  display: flex;
  justify-content: space-around;
  font-size: 0.7rem;
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
