<template>
  <div class="skill-window-backdrop" @click.self="$emit('close')">
    <div class="skill-window">
      <div class="skill-window-header">
        <h3>Skills</h3>
        <div class="header-right">
          <span class="unspent-pts" v-if="skillStore.state.unspentSkillPoints > 0">
            {{ skillStore.state.unspentSkillPoints }} pts available
          </span>
          <button class="close-btn" @click="$emit('close')">x</button>
        </div>
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
          <span class="cat-pts" v-if="getCatPoints(cat.key) > 0">{{ getCatPoints(cat.key) }}</span>
        </button>
      </div>

      <div class="skill-list">
        <template v-if="activeCategory === 'class'">
          <div class="class-section-label">Class Skills</div>
          <div
            v-for="skill in classSkills"
            :key="skill.name"
            class="skill-entry"
            :class="{ locked: !skill.unlocked }"
            draggable="true"
            @dragstart="onDragStart(skill, $event)"
            @click="onSkillClick(skill)"
          >
            <div class="skill-entry-icon class-icon">
              {{ getAbbrev(skill.name) }}
            </div>
            <div class="skill-entry-info">
              <div class="skill-entry-name">
                {{ skill.name }}
                <span class="req-tag" v-if="!skill.unlocked">Lv {{ skill.reqPoints }}</span>
              </div>
              <div class="skill-entry-desc">{{ skill.description }}</div>
            </div>
            <div class="skill-entry-stats">
              <span v-if="skill.mpCost" class="stat mp">{{ skill.mpCost }} MP</span>
              <span v-if="skill.castTime > 0" class="stat cast">{{ skill.castTime }}s</span>
              <span v-if="skill.cooldown > 0" class="stat cd">{{ skill.cooldown }}s CD</span>
              <span v-if="skill.isAOE" class="stat aoe">AOE</span>
              <span v-if="skill.castTime === 0 && !skill.isPassive" class="stat instant">Instant</span>
            </div>
          </div>
          <div v-if="classSkills.length === 0" class="empty-msg">
            No class skills available.
          </div>
        </template>
        <template v-else>
          <div v-for="subCat in filteredSubCategories" :key="subCat.name" class="sub-category-group">
            <div class="sub-category-header">
              <div class="sub-cat-info">
                <span class="sub-cat-name">{{ subCat.name }}</span>
                <span class="sub-cat-pts" v-if="subCat.currentAdeptness > 0">
                  {{ subCat.currentAdeptness }}/{{ subCat.currentPoints }}
                </span>
                <span class="sub-cat-pts" v-else>{{ subCat.currentPoints }} pts</span>
              </div>
              <button
                class="allocate-btn"
                :disabled="skillStore.state.unspentSkillPoints <= 0"
                @click="onAllocate(subCat.name)"
                title="Allocate 1 point"
              >
                +1
              </button>
            </div>
            <div
              v-for="skill in getSortedSkills(subCat)"
              :key="skill.name"
              class="skill-entry"
              :class="{ locked: !skill.unlocked, passive: skill.isPassive }"
              draggable="skill.unlocked && !skill.isPassive"
              @dragstart="onDragStart(skill, $event)"
              @click="onSkillClick(skill)"
            >
              <div
                class="skill-entry-icon"
                :style="{ backgroundColor: skill.unlocked ? getCategoryColor(subCat.category) : 'rgba(255,255,255,0.05)' }"
              >
                {{ getAbbrev(skill.name) }}
              </div>
              <div class="skill-entry-info">
              <div class="skill-entry-name">
                {{ skill.name }}
                <span class="req-tag" v-if="!skill.unlocked && skill.reqPoints >= 0">
                  {{ subCat.currentPoints }}/{{ skill.reqPoints }}
                </span>
                <span class="req-tag cross" v-else-if="!skill.unlocked && skill.crossReqs">
                  {{ formatCrossReqs(skill.crossReqs) }}
                </span>
                <span class="passive-tag" v-if="skill.isPassive">Passive</span>
              </div>
              <div class="skill-entry-desc">{{ skill.description }}</div>
            </div>
            <div class="skill-entry-stats">
              <span v-if="skill.mpCost" class="stat mp">{{ skill.mpCost }} MP</span>
              <span v-if="skill.castTime > 0" class="stat cast">{{ skill.castTime }}s</span>
              <span v-if="skill.cooldown > 0" class="stat cd">{{ skill.cooldown }}s CD</span>
              <span v-if="skill.isAOE" class="stat aoe">AOE</span>
              <span v-if="skill.castTime === 0 && !skill.isPassive" class="stat instant">Instant</span>
            </div>
            </div>
          </div>
          <div v-if="filteredSubCategories.length === 0" class="empty-msg">
            No skills in this category yet.
          </div>
        </template>
      </div>

      <div class="skill-window-footer">
        <span class="hint">Drag unlocked skills to the skill bar | Click +1 to invest points</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSkillStore, AvailableSkill, SubCategoryInfo } from '../composables/useSkillStore';
import { getCategoryColor } from '@dust-saga/shared';

const props = defineProps<{
  gameClient?: any;
}>();

defineEmits<{
  close: [];
  allocateSkill: (subCategoryName: string) => void;
}>();

const skillStore = useSkillStore();
const activeCategory = ref('melee');

const categories = [
  { key: 'melee', label: 'Melee' },
  { key: 'technique', label: 'Technique' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'magic', label: 'Magic' },
  { key: 'special', label: 'Special' },
  { key: 'class', label: 'Class' },
];

const filteredSubCategories = computed(() => {
  if (activeCategory.value === 'class') return [];
  return skillStore.getSubCategoriesByCategory(activeCategory.value);
});

const classSkills = computed(() => {
  return skillStore.state.availableSkills.filter(s => s.category === 'class');
});

function getCatPoints(key: string): number {
  return skillStore.getCategoryPoints(key);
}

function getSortedSkills(subCat: SubCategoryInfo): AvailableSkill[] {
  return [...subCat.skills].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return (a.reqPoints >= 0 ? a.reqPoints : 999) - (b.reqPoints >= 0 ? b.reqPoints : 999);
  });
}

function getAbbrev(name: string): string {
  const clean = name.replace(/\(.*\)/, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

function formatCrossReqs(reqs: Array<{ skillName: string; points: number }> | undefined): string {
  if (!reqs) return '';
  return reqs.map(r => `${r.skillName} ${r.points}`).join(', ');
}

function onDragStart(skill: AvailableSkill, event: DragEvent): void {
  if (!skill.unlocked || skill.isPassive) {
    event.preventDefault();
    return;
  }
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
  if (!skill.unlocked || skill.isPassive) return;
  for (let b = 0; b < skillStore.state.layout.bars.length; b++) {
    const idx = skillStore.state.layout.bars[b].findIndex(s => s.skillName === null);
    if (idx >= 0) {
      skillStore.setSkillInSlot(b, idx, skill.name, skill.category, skill.subCategory);
      return;
    }
  }
}

function onAllocate(subCategoryName: string): void {
  if (props.gameClient) {
    props.gameClient.allocateSkillPoint(subCategoryName);
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
  width: 700px;
  max-height: 85vh;
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

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.unspent-pts {
  color: #66bb6a;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(102, 187, 106, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
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
  display: flex;
  align-items: center;
  gap: 4px;
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

.cat-pts {
  font-size: 0.65rem;
  color: #66bb6a;
  font-weight: 600;
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

.class-section-label {
  color: #667eea;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.sub-category-group {
  margin-bottom: 12px;
}

.sub-category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  margin-bottom: 4px;
}

.sub-cat-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-cat-name {
  color: #667eea;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sub-cat-pts {
  color: #888;
  font-size: 0.7rem;
}

.allocate-btn {
  background: rgba(102, 187, 106, 0.2);
  border: 1px solid rgba(102, 187, 106, 0.4);
  color: #66bb6a;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.15s;
}

.allocate-btn:hover:not(:disabled) {
  background: rgba(102, 187, 106, 0.35);
  border-color: rgba(102, 187, 106, 0.6);
}

.allocate-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
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

.skill-entry.locked {
  opacity: 0.45;
  cursor: default;
}

.skill-entry.locked:hover {
  background: rgba(255, 255, 255, 0.03);
}

.skill-entry.passive {
  cursor: default;
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

.skill-entry-icon.class-icon {
  background: rgba(156, 39, 176, 0.5);
}

.skill-entry-info {
  flex: 1;
  min-width: 0;
}

.skill-entry-name {
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.req-tag {
  font-size: 0.65rem;
  color: #ef9a9a;
  background: rgba(244, 67, 54, 0.15);
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.req-tag.cross {
  color: #ffb74d;
  background: rgba(255, 152, 0, 0.15);
}

.passive-tag {
  font-size: 0.6rem;
  color: #ce93d8;
  background: rgba(156, 39, 176, 0.2);
  padding: 1px 5px;
  border-radius: 3px;
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
