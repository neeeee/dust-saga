<template>
  <div class="skill-window-backdrop" @click.self="$emit('close')">
    <div class="skill-window">
      <div class="skill-window-header">
        <h3>Skills</h3>
        <button class="close-btn" @click="$emit('close')">x</button>
      </div>

      <div class="skill-category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="cat-tab"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          {{ cat.label }}
        </button>
      </div>

      <div class="skill-list">
        <template v-if="activeCategory === 'all'">
          <div v-for="(skills, cat) in groupedSkills" :key="cat" class="skill-group">
            <div class="group-label">{{ cat }}</div>
            <div
              v-for="skill in skills"
              :key="skill.name"
              class="skill-entry"
              draggable="true"
              @dragstart="onDragStart(skill, $event)"
              @click="onSkillClick(skill)"
            >
              <div class="skill-entry-icon" :style="{ backgroundColor: getCategoryColor(skill.category) }">
                {{ getAbbrev(skill.name) }}
              </div>
              <div class="skill-entry-info">
                <div class="skill-entry-name">{{ skill.name }}</div>
                <div class="skill-entry-desc">{{ skill.description }}</div>
              </div>
              <div class="skill-entry-stats">
                <span v-if="skill.mpCost" class="stat mp">{{ skill.mpCost }} MP</span>
                <span v-if="skill.castTime > 0" class="stat cast">{{ skill.castTime }}s</span>
                <span v-if="skill.cooldown > 0" class="stat cd">{{ skill.cooldown }}s CD</span>
                <span v-if="skill.isAOE" class="stat aoe">AOE</span>
                <span v-if="skill.castTime === 0" class="stat instant">Instant</span>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <div
            v-for="skill in filteredSkills"
            :key="skill.name"
            class="skill-entry"
            draggable="true"
            @dragstart="onDragStart(skill, $event)"
            @click="onSkillClick(skill)"
          >
            <div class="skill-entry-icon" :style="{ backgroundColor: getCategoryColor(skill.category) }">
              {{ getAbbrev(skill.name) }}
            </div>
            <div class="skill-entry-info">
              <div class="skill-entry-name">{{ skill.name }}</div>
              <div class="skill-entry-desc">{{ skill.description }}</div>
            </div>
            <div class="skill-entry-stats">
              <span v-if="skill.mpCost" class="stat mp">{{ skill.mpCost }} MP</span>
              <span v-if="skill.castTime > 0" class="stat cast">{{ skill.castTime }}s cast</span>
              <span v-if="skill.cooldown > 0" class="stat cd">{{ skill.cooldown }}s CD</span>
              <span v-if="skill.isAOE" class="stat aoe">AOE</span>
              <span v-if="skill.castTime === 0" class="stat instant">Instant</span>
            </div>
          </div>
          <div v-if="filteredSkills.length === 0" class="empty-msg">
            No skills in this category yet.
          </div>
        </template>
      </div>

      <div class="skill-window-footer">
        <span class="hint">Drag skills to the skill bar | Right-click bar slot to remove</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSkillStore, AvailableSkill } from '../composables/useSkillStore';
import { getCategoryColor } from '@dust-saga/shared';

defineEmits<{
  close: [];
}>();

const skillStore = useSkillStore();
const activeCategory = ref('all');

const categories = [
  { key: 'all', label: 'All' },
  { key: 'melee', label: 'Melee' },
  { key: 'technique', label: 'Technique' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'magic', label: 'Magic' },
  { key: 'special', label: 'Special' },
  { key: 'class', label: 'Class' },
];

const groupedSkills = computed(() => skillStore.getSkillsByCategory());

const filteredSkills = computed(() => {
  if (activeCategory.value === 'all') return skillStore.state.availableSkills;
  return skillStore.state.availableSkills.filter(s => s.category === activeCategory.value);
});

function getAbbrev(name: string): string {
  const clean = name.replace(/\(.*\)/, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

function onDragStart(skill: AvailableSkill, event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.setData('text/plain', skill.name);
  event.dataTransfer.effectAllowed = 'copy';
  (window as any).__dragSkillData = {
    type: 'from-window',
    skillName: skill.name,
    category: skill.category,
    subCategory: skill.subCategory,
  };
}

function onSkillClick(skill: AvailableSkill): void {
  const firstEmpty = skillStore.state.bar.findIndex(s => s.skillName === null);
  if (firstEmpty >= 0) {
    skillStore.setSkillInSlot(firstEmpty, skill.name, skill.category, skill.subCategory);
  }
}

onMounted(() => {
  skillStore.buildAvailableSkills();
});
</script>

<style scoped>
.skill-window-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.skill-window {
  width: 600px;
  max-height: 80vh;
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.skill-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.skill-window-header h3 {
  color: white;
  margin: 0;
  font-size: 1rem;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #aaa;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: rgba(255, 80, 80, 0.4);
  color: white;
}

.skill-category-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.cat-tab {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #aaa;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.cat-tab:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.cat-tab.active {
  background: rgba(102, 126, 234, 0.3);
  border-color: rgba(102, 126, 234, 0.5);
  color: white;
}

.skill-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.skill-list::-webkit-scrollbar {
  width: 6px;
}

.skill-list::-webkit-scrollbar-track {
  background: transparent;
}

.skill-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.skill-group {
  margin-bottom: 12px;
}

.group-label {
  color: #667eea;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.skill-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: grab;
  transition: background 0.15s;
  margin-bottom: 2px;
}

.skill-entry:hover {
  background: rgba(255, 255, 255, 0.08);
}

.skill-entry:active {
  cursor: grabbing;
}

.skill-entry-icon {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.65rem;
  flex-shrink: 0;
}

.skill-entry-info {
  flex: 1;
  min-width: 0;
}

.skill-entry-name {
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
}

.skill-entry-desc {
  color: #888;
  font-size: 0.7rem;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-entry-stats {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.stat {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.stat.mp {
  background: rgba(33, 150, 243, 0.2);
  color: #64b5f6;
}

.stat.cast {
  background: rgba(255, 152, 0, 0.2);
  color: #ffb74d;
}

.stat.cd {
  background: rgba(156, 39, 176, 0.2);
  color: #ce93d8;
}

.stat.aoe {
  background: rgba(244, 67, 54, 0.2);
  color: #ef9a9a;
}

.stat.instant {
  background: rgba(76, 175, 80, 0.2);
  color: #81c784;
}

.empty-msg {
  color: #666;
  text-align: center;
  padding: 20px;
  font-size: 0.85rem;
}

.skill-window-footer {
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.hint {
  color: #555;
  font-size: 0.7rem;
}
</style>
