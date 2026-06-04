<template>
  <div ref="panelRef" class="skill-window" data-draggable :style="{ left: posX + 'px', top: posY + 'px' }">
    <div class="skill-window-header" data-drag-handle>
      <h3>Skills</h3>
      <div class="header-right">
        <span class="unspent-pts" v-if="effectiveUnspent > 0">
          {{ effectiveUnspent }} pts
        </span>
        <button class="icon-toggle" @click="iconOnly = !iconOnly" :title="iconOnly ? 'Show details' : 'Icon only'">
          {{ iconOnly ? '&#9776;' : '&#9638;' }}
        </button>
        <button class="close-btn" @click="handleClose">x</button>
      </div>
    </div>

    <div class="search-row">
      <input v-model="searchQuery" class="skill-search" type="text" placeholder="Search..." />
    </div>

    <div class="skill-list" ref="listRef">
      <template v-if="searchQuery.trim()">
        <div v-for="r in searchResults" :key="r.subCat.name + '-' + r.skill.name" class="search-result">
          <div class="search-subcat-label" @click="toggleAccordion(r.subCat.name)">
            <span class="arrow">{{ openAccordions.has(r.subCat.name) ? '&#9660;' : '&#9654;' }}</span>
            <span>{{ r.subCat.name }}</span>
            <span class="subcat-pts">{{ r.subCat.currentPoints }}/{{ r.subCat.maxPoints }}</span>
          </div>
          <div v-if="openAccordions.has(r.subCat.name)" class="accordion-body">
            <div
              v-for="skill in getSortedSkills(r.subCat)"
              :key="skill.name"
              class="skill-entry"
              :class="{ locked: !skill.unlocked, passive: skill.isPassive, highlight: skill.name === r.skill.name }"
              :draggable="skill.unlocked && !skill.isPassive"
              @dragstart="onDragStart(skill, $event)"
              @click="onSkillClick(skill)"
            >
              <div class="skill-icon" :style="{ backgroundColor: skill.unlocked ? getCategoryColor(r.subCat.category) : 'rgba(255,255,255,0.05)' }">
                {{ getAbbrev(skill.name) }}
              </div>
              <div v-if="!iconOnly" class="skill-info">
                <div class="skill-name">
                  {{ skill.name }}
                  <span class="req-tag" v-if="!skill.unlocked && skill.reqPoints >= 0">{{ r.subCat.currentPoints }}/{{ skill.reqPoints }}</span>
                  <span class="req-tag cross" v-else-if="!skill.unlocked && skill.crossReqs">{{ formatCrossReqs(skill.crossReqs) }}</span>
                  <span class="req-tag level" v-else-if="!skill.unlocked && skill.reqLevel">Lv {{ skill.reqLevel }}</span>
                  <span class="passive-tag" v-if="skill.isPassive">Passive</span>
                </div>
                <div class="skill-desc">{{ skill.description }}</div>
              </div>
              <div v-if="!iconOnly" class="skill-stats">
                <span v-if="skill.mpCost" class="stat mp">{{ skill.mpCost }}</span>
                <span v-if="skill.castTime > 0" class="stat cast">{{ skill.castTime }}s</span>
                <span v-if="skill.cooldown > 0" class="stat cd">{{ skill.cooldown }}s</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="searchResults.length === 0" class="empty-msg">No results for "{{ searchQuery }}"</div>
      </template>

      <template v-else>
        <div v-for="subCat in allSubCategories" :key="subCat.name" class="accordion">
          <div class="accordion-header" @click="toggleAccordion(subCat.name)">
            <span class="arrow">{{ openAccordions.has(subCat.name) ? '&#9660;' : '&#9654;' }}</span>
            <span class="subcat-name">{{ subCat.name }}</span>
            <span class="subcat-pts">{{ subCat.currentPoints }}<template v-if="subCat.maxPoints > 0">/{{ subCat.maxPoints }}</template></span>
            <div class="alloc-controls" v-if="subCat.maxPoints > 0">
              <button class="alloc-btn minus" :disabled="pendingAlloc[subCat.name] <= 0" @click.stop="removePending(subCat.name)">-</button>
              <span class="alloc-change" v-if="pendingAlloc[subCat.name] > 0">+{{ pendingAlloc[subCat.name] }}</span>
              <button class="alloc-btn plus" :disabled="effectiveUnspent <= 0 || subCat.currentPoints + (pendingAlloc[subCat.name] || 0) >= subCat.maxPoints" @click.stop="addPending(subCat.name)">+</button>
            </div>
          </div>
          <div v-if="openAccordions.has(subCat.name)" :class="iconOnly ? 'icon-grid' : 'accordion-body'">
            <template v-if="iconOnly">
              <div
                v-for="skill in getSortedSkills(subCat)"
                :key="skill.name"
                class="icon-cell"
                :class="{ locked: !skill.unlocked, passive: skill.isPassive }"
                :draggable="skill.unlocked && !skill.isPassive"
                @dragstart="onDragStart(skill, $event)"
                @click="onSkillClick(skill)"
                :title="skill.name + (skill.isPassive ? ' (Passive)' : '')"
              >
                <div class="skill-icon" :style="{ backgroundColor: skill.unlocked ? getCategoryColor(subCat.category) : 'rgba(255,255,255,0.05)' }">
                  {{ getAbbrev(skill.name) }}
                </div>
              </div>
            </template>
            <template v-else>
              <div
                v-for="skill in getSortedSkills(subCat)"
                :key="skill.name"
                class="skill-entry"
                :class="{ locked: !skill.unlocked, passive: skill.isPassive }"
                :draggable="skill.unlocked && !skill.isPassive"
                @dragstart="onDragStart(skill, $event)"
                @click="onSkillClick(skill)"
              >
                <div class="skill-icon" :style="{ backgroundColor: skill.unlocked ? getCategoryColor(subCat.category) : 'rgba(255,255,255,0.05)' }">
                  {{ getAbbrev(skill.name) }}
                </div>
                <div class="skill-info">
                  <div class="skill-name">
                    {{ skill.name }}
                     <span class="req-tag" v-if="!skill.unlocked && skill.reqPoints >= 0">{{ subCat.currentPoints + (pendingAlloc[subCat.name] || 0) }}/{{ skill.reqPoints }}</span>
                     <span class="req-tag cross" v-else-if="!skill.unlocked && skill.crossReqs">{{ formatCrossReqs(skill.crossReqs) }}</span>
                     <span class="req-tag level" v-else-if="!skill.unlocked && skill.reqLevel">Lv {{ skill.reqLevel }}</span>
                    <span class="passive-tag" v-if="skill.isPassive">Passive</span>
                  </div>
                  <div class="skill-desc">{{ skill.description }}</div>
                </div>
                <div class="skill-stats">
                  <span v-if="skill.mpCost" class="stat mp">{{ skill.mpCost }}</span>
                  <span v-if="skill.castTime > 0" class="stat cast">{{ skill.castTime }}s</span>
                  <span v-if="skill.cooldown > 0" class="stat cd">{{ skill.cooldown }}s</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>

    <div class="skill-actions" v-if="hasPending">
      <button class="confirm-btn" @click="handleConfirm">Confirm ({{ totalPending }} pts)</button>
      <button class="cancel-btn" @click="clearPending">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { useSkillStore, AvailableSkill, SubCategoryInfo } from '../composables/useSkillStore';
import { getCategoryColor } from '@dust-saga/shared';
import { useDraggable } from '../composables/useDraggable';

const { posX, posY, attach, detach } = useDraggable('[data-drag-handle]', 'panel-skills', { x: 60, y: 120 });
const panelRef = ref<HTMLElement | null>(null);
const listRef = ref<HTMLElement | null>(null);

const props = defineProps<{
  gameClient?: any;
}>();

  const emit = defineEmits<{ close: [] }>();

  const skillStore = useSkillStore();
const searchQuery = ref('');
const iconOnly = ref(false);
const openAccordions = reactive(new Set<string>());
const pendingAlloc = reactive<Record<string, number>>({});

const allSubCategories = computed(() => skillStore.getSubCategories());

const totalPending = computed(() => {
  let sum = 0;
  for (const v of Object.values(pendingAlloc)) sum += v;
  return sum;
});

const effectiveUnspent = computed(() => skillStore.state.unspentSkillPoints - totalPending.value);
const hasPending = computed(() => totalPending.value > 0);

const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return [];
  const results: Array<{ subCat: SubCategoryInfo; skill: AvailableSkill }> = [];
  for (const subCat of allSubCategories.value) {
    for (const skill of subCat.skills) {
      if (skill.name.toLowerCase().includes(q)) {
        results.push({ subCat, skill });
      }
    }
  }
  for (const r of results) {
    if (!openAccordions.has(r.subCat.name)) {
      openAccordions.add(r.subCat.name);
    }
  }
  return results;
});

function toggleAccordion(name: string): void {
  if (openAccordions.has(name)) {
    openAccordions.delete(name);
  } else {
    openAccordions.add(name);
  }
}

function addPending(name: string): void {
  if (effectiveUnspent.value <= 0) return;
  const sub = allSubCategories.value.find(s => s.name === name);
  if (!sub) return;
  if ((sub.currentPoints + (pendingAlloc[name] || 0)) >= sub.maxPoints) return;
  pendingAlloc[name] = (pendingAlloc[name] || 0) + 1;
}

function removePending(name: string): void {
  if ((pendingAlloc[name] || 0) <= 0) return;
  pendingAlloc[name] = (pendingAlloc[name] || 0) - 1;
  if (pendingAlloc[name] === 0) delete pendingAlloc[name];
}

function clearPending(): void {
  for (const key of Object.keys(pendingAlloc)) {
    delete pendingAlloc[key];
  }
}

function handleConfirm(): void {
  if (!hasPending.value || !props.gameClient) return;
  const batch: Record<string, number> = {};
  for (const [key, val] of Object.entries(pendingAlloc)) {
    if (val > 0) batch[key] = val;
  }
  props.gameClient.allocateSkillBatch(batch);
  clearPending();
}

function handleClose(): void {
  clearPending();
  emit('close');
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
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.substring(0, 2).toUpperCase();
}

function formatCrossReqs(reqs: Array<{ skillName: string; points: number }> | undefined): string {
  if (!reqs) return '';
  return reqs.map(r => `${r.skillName} ${r.points}`).join(', ');
}

function onDragStart(skill: AvailableSkill, event: DragEvent): void {
  if (!skill.unlocked || skill.isPassive) { event.preventDefault(); return; }
  if (!event.dataTransfer) return;
  event.dataTransfer.setData('text/plain', skill.name);
  event.dataTransfer.effectAllowed = 'copy';
  (window as any).__dragSkillData = { type: 'from-window', skillName: skill.name, category: skill.category, subCategory: skill.subCategory };
}

function onSkillClick(skill: AvailableSkill): void {
  if (!skill.unlocked || skill.isPassive) return;
  for (let b = 0; b < skillStore.state.layout.bars.length; b++) {
    const idx = skillStore.state.layout.bars[b].findIndex(s => s.skillName === null);
    if (idx >= 0) { skillStore.setSkillInSlot(b, idx, skill.name, skill.category, skill.subCategory); return; }
  }
}

onMounted(() => {
  skillStore.buildAvailableSkills();
  if (panelRef.value) attach(panelRef.value);
});

onUnmounted(() => {
  if (panelRef.value) detach(panelRef.value);
});
</script>

<style scoped>
.skill-window {
  position: absolute;
  width: 420px;
  max-height: 520px;
  background: rgba(20, 20, 40, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  z-index: 100;
  user-select: none;
  font-size: 13px;
}

.skill-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  cursor: grab;
  user-select: none;
}

.skill-window-header:active { cursor: grabbing; }
.skill-window-header h3 { color: white; margin: 0; font-size: 0.95rem; flex: 1; }

.header-right { display: flex; align-items: center; gap: 8px; }

.unspent-pts {
  color: #66bb6a;
  font-size: 0.75rem;
  font-weight: 600;
  background: rgba(102, 187, 106, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
}

.icon-toggle {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  color: #aaa;
  width: 26px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-toggle:hover { background: rgba(255,255,255,0.15); color: white; }

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
.close-btn:hover { background: rgba(255, 80, 80, 0.4); color: white; }

.search-row { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }

.skill-search {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: white;
  padding: 3px 8px;
  font-size: 0.75rem;
  width: 100%;
  outline: none;
  box-sizing: border-box;
}
.skill-search::placeholder { color: #666; }
.skill-search:focus { border-color: rgba(102, 126, 234, 0.5); background: rgba(255, 255, 255, 0.12); }

.skill-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  max-height: 380px;
}
.skill-list::-webkit-scrollbar { width: 5px; }
.skill-list::-webkit-scrollbar-track { background: transparent; }
.skill-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 3px; }

.accordion-header, .search-subcat-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}
.accordion-header:hover, .search-subcat-label:hover { background: rgba(255,255,255,0.05); }

.arrow { font-size: 0.55rem; color: #666; width: 12px; text-align: center; }
.subcat-name { color: #667eea; font-size: 0.78rem; font-weight: 600; flex: 1; }
.subcat-pts { color: #888; font-size: 0.68rem; margin-right: 6px; }

.alloc-controls { display: flex; align-items: center; gap: 3px; }

.alloc-btn {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}
.alloc-btn.minus { background: rgba(198, 40, 40, 0.3); color: #ef5350; }
.alloc-btn.minus:hover:not(:disabled) { background: rgba(198, 40, 40, 0.5); }
.alloc-btn.plus { background: rgba(102, 126, 234, 0.3); color: #a8b8ff; }
.alloc-btn.plus:hover:not(:disabled) { background: rgba(102, 126, 234, 0.5); }
.alloc-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.alloc-change { color: #66bb6a; font-size: 0.68rem; font-weight: 600; min-width: 22px; text-align: center; }

.accordion-body { padding: 2px 0; }

.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
  padding: 6px 10px;
}

.icon-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  border-radius: 4px;
  transition: background 0.1s;
}
.icon-cell:hover { background: rgba(255,255,255,0.08); }
.icon-cell:active { cursor: grabbing; }
.icon-cell.locked { opacity: 0.35; cursor: default; }
.icon-cell.passive { cursor: default; }

.icon-cell .skill-icon { width: 100%; aspect-ratio: 1; }

.skill-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 24px;
  cursor: grab;
  transition: background 0.1s;
}
.skill-entry:hover { background: rgba(255,255,255,0.06); }
.skill-entry:active { cursor: grabbing; }
.skill-entry.locked { opacity: 0.4; cursor: default; }
.skill-entry.locked:hover { background: rgba(255,255,255,0.02); }
.skill-entry.passive { cursor: default; }
.skill-entry.highlight { background: rgba(102,126,234,0.12); }

.skill-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 0.6rem;
  flex-shrink: 0;
}

.skill-info { flex: 1; min-width: 0; }

.skill-name {
  color: white;
  font-size: 0.78rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}

.req-tag {
  font-size: 0.6rem;
  color: #ef9a9a;
  background: rgba(244, 67, 54, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}
.req-tag.cross { color: #ffb74d; background: rgba(255, 152, 0, 0.15); }
.req-tag.level { color: #64b5f6; background: rgba(33, 150, 243, 0.15); }

.passive-tag {
  font-size: 0.58rem;
  color: #ce93d8;
  background: rgba(156, 39, 176, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.skill-desc {
  color: #777;
  font-size: 0.65rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-stats { display: flex; gap: 3px; flex-shrink: 0; }

.stat {
  font-size: 0.58rem;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}
.stat.mp { background: rgba(33, 150, 243, 0.2); color: #64b5f6; }
.stat.cast { background: rgba(255, 152, 0, 0.2); color: #ffb74d; }
.stat.cd { background: rgba(156, 39, 176, 0.2); color: #ce93d8; }

.empty-msg { color: #666; text-align: center; padding: 16px; font-size: 0.8rem; }

.skill-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
  justify-content: center;
}

.confirm-btn {
  background: #4caf50;
  border: none;
  color: white;
  padding: 4px 14px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: bold;
}
.confirm-btn:hover { background: #388e3c; }

.cancel-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  color: #ccc;
  padding: 4px 14px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.78rem;
}
.cancel-btn:hover { background: rgba(255, 80, 80, 0.3); color: white; }
</style>
