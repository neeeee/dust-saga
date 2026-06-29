<template>
  <div v-if="visible" class="dialog-wrapper" @click="handleClick">
    <div
      class="dialog-float"
      :style="floatStyle"
      @click.stop
    >
      <div class="npc-name">{{ npcName }}</div>

      <template v-if="questDetail">
        <div class="quest-detail-header">
          <span class="quest-detail-title">{{ questDetail.quest.title }}</span>
          <div class="quest-detail-tags">
            <span v-if="questDetail.kind === 'offer' && questDetail.quest.repeatable" class="repeat-badge small" :class="questDetail.quest.repeatable">{{ repeatLabel(questDetail.quest.repeatable) }}</span>
            <span v-if="questDetail.kind === 'offer'" class="quest-detail-tag offer">Available</span>
            <span v-else-if="questDetail.kind === 'turnin'" class="quest-detail-tag turnin">Ready</span>
            <span v-else class="quest-detail-tag progress">In Progress</span>
          </div>
        </div>

        <div v-if="currentPages.length > 0" class="dialog-text">
          <div v-if="currentPages[questDetail.page].speaker" class="page-speaker">{{ currentPages[questDetail.page].speaker }}</div>
          {{ currentPages[questDetail.page].text }}
        </div>

        <div v-if="questDetail.kind !== 'progress'" class="reward-preview">
          <h4>Rewards</h4>
          <div class="reward-list">
            <span v-if="questDetail.quest.rewards?.experience" class="reward-chip">+{{ questDetail.quest.rewards.experience }} XP</span>
            <span v-if="questDetail.quest.rewards?.gold" class="reward-chip gold">+{{ questDetail.quest.rewards.gold }} gold</span>
            <span v-for="item in (questDetail.quest.rewards?.items || [])" :key="item.itemId" class="reward-chip item">{{ item.quantity }}× {{ item.itemId }}</span>
          </div>
        </div>

        <div v-if="questDetail.kind === 'progress'" class="active-objectives">
          <h4>Objectives</h4>
          <div v-for="obj in questDetail.quest.objectives" :key="obj.id" class="objective-row">
            <span class="objective-name">{{ obj.targetName }}</span>
            <span class="objective-count">{{ obj.currentCount }} / {{ obj.requiredCount }}</span>
            <span v-if="obj.cell" class="objective-cell">@ {{ obj.cell }}</span>
          </div>
        </div>

        <div class="dialog-options">
          <button v-if="questDetail.page > 0" class="dialog-option" @click.stop="prevPage">Back</button>
          <button v-if="questDetail.page < currentPages.length - 1" class="dialog-option primary" @click.stop="nextPage">Next</button>
          <button v-if="questDetail.page >= currentPages.length - 1 && questDetail.kind === 'offer'" class="dialog-option accept" @click.stop="acceptQuest">Accept</button>
          <button v-if="questDetail.page >= currentPages.length - 1 && questDetail.kind === 'turnin'" class="dialog-option accept" @click.stop="completeQuest">Complete</button>
          <button class="dialog-option" @click.stop="exitDetail">Close</button>
        </div>
      </template>

      <template v-else>
        <div class="dialog-text">{{ dialog?.text }}</div>
        <div v-if="dialog?.options?.length" class="dialog-options">
          <button
            v-for="(opt, i) in dialog.options"
            :key="i"
            class="dialog-option"
            @click.stop="handleOption(opt)"
          >
            {{ opt.text }}
          </button>
        </div>
        <div v-else class="dialog-hint">Click anywhere to continue</div>

        <div v-if="shopItems && shopItems.length > 0" class="shop-section">
          <h4>Shop</h4>
          <div class="shop-items">
            <div v-for="item in shopItems" :key="item.id" class="shop-item" @click.stop="$emit('buy', item.id)">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-price">{{ item.sellPrice }}g</span>
              <span class="item-stats">{{ formatStats(item.stats) }}</span>
            </div>
          </div>
        </div>

        <div v-if="availableQuests && availableQuests.length > 0" class="quest-offers">
          <h4>Available Quests</h4>
          <button
            v-for="q in availableQuests"
            :key="q.id"
            class="quest-offer-btn"
            :class="{ repeatable: !!q.repeatable }"
            @click.stop="openOffer(q)"
          >
            <div class="quest-offer-head">
              <span class="quest-offer-title">{{ q.title || q.id }}</span>
              <span v-if="q.repeatable" class="repeat-badge" :class="q.repeatable">{{ repeatLabel(q.repeatable) }}</span>
            </div>
            <span v-if="q.description" class="quest-offer-desc">{{ q.description }}</span>
            <span v-if="q.completionCount && q.completionCount > 0" class="quest-offer-completed">Completed ×{{ q.completionCount }}</span>
            <span v-if="q.requiredLevel" class="quest-offer-level">Requires level {{ q.requiredLevel }}</span>
          </button>
        </div>

        <div v-if="activeQuests && activeQuests.length > 0" class="quest-active">
          <h4>Your Quests</h4>
          <button
            v-for="q in activeQuests"
            :key="q.id"
            class="quest-active-btn"
            :class="{ ready: q.turnInReady }"
            @click.stop="openActive(q)"
          >
            <span class="quest-offer-title">{{ q.title }}</span>
            <span class="quest-offer-desc">{{ summarizeObjectives(q.objectives) }}</span>
            <span v-if="q.turnInReady" class="quest-offer-level ready-tag">Ready to turn in</span>
            <span v-else class="quest-offer-level">In progress</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

type AvailableQuest = {
  id: string;
  title?: string;
  description?: string;
  offerDialog?: Array<{ speaker?: string; text: string; emote?: string }>;
  rewards?: { experience: number; gold: number; items: Array<{ itemId: string; quantity: number }> };
  requiredLevel?: number;
  repeatable?: string;
  completionCount?: number;
  nextAvailableAt?: number | null;
};

type ActiveQuest = {
  id: string;
  title?: string;
  description?: string;
  status: string;
  objectives: Array<{ id: string; targetName: string; requiredCount: number; currentCount: number; cell?: string }>;
  inProgressDialog?: Array<{ speaker?: string; text: string; emote?: string }>;
  turnInDialog?: Array<{ speaker?: string; text: string; emote?: string }>;
  rewards?: { experience: number; gold: number; items: Array<{ itemId: string; quantity: number }> };
  turnInReady?: boolean;
};

const props = defineProps<{
  visible: boolean;
  npcName: string;
  dialog: any;
  shopItems: any[];
  availableQuests: AvailableQuest[];
  activeQuests?: ActiveQuest[];
  npcScreenPos: { x: number; y: number } | null;
}>();

const emit = defineEmits<{
  'close': [];
  'select-option': [option: any];
  'buy': [itemId: string];
  'accept-quest': [questId: string];
  'complete-quest': [questId: string];
  'progress': [];
}>();

const panelWidth = 380;
const panelHeight = 240;

type QuestDetail =
  | { kind: 'offer'; quest: AvailableQuest; page: number }
  | { kind: 'progress'; quest: ActiveQuest; page: number }
  | { kind: 'turnin'; quest: ActiveQuest; page: number };

const questDetail = ref<QuestDetail | null>(null);

watch(() => props.visible, (v) => {
  if (!v) questDetail.value = null;
});

const floatStyle = computed(() => {
  if (!props.npcScreenPos) return { display: 'none' };

  let x = props.npcScreenPos.x - panelWidth / 2;
  let y = props.npcScreenPos.y - panelHeight - 10;

  x = Math.max(8, Math.min(x, window.innerWidth - panelWidth - 8));
  y = Math.max(8, y);

  return {
    left: `${x}px`,
    top: `${y}px`,
  };
});

const currentPages = computed<Array<{ speaker?: string; text: string }>>(() => {
  if (!questDetail.value) return [];
  if (questDetail.value.kind === 'offer') {
    return questDetail.value.quest.offerDialog?.length ? questDetail.value.quest.offerDialog : [{ text: questDetail.value.quest.description || '' }];
  }
  if (questDetail.value.kind === 'turnin') {
    return questDetail.value.quest.turnInDialog?.length ? questDetail.value.quest.turnInDialog : [{ text: 'Thank you for completing this task.' }];
  }
  return questDetail.value.quest.inProgressDialog?.length ? questDetail.value.quest.inProgressDialog : [{ text: 'How goes the task?' }];
});

function handleClick() {
  if (questDetail.value) return;
  if (props.dialog?.options?.length) return;
  emit('progress');
}

function handleOption(opt: any) {
  if (opt.action === 'close') {
    emit('close');
  } else {
    emit('select-option', opt);
  }
}

function openOffer(q: AvailableQuest) {
  questDetail.value = { kind: 'offer', quest: q, page: 0 };
}

function openActive(q: ActiveQuest) {
  questDetail.value = { kind: q.turnInReady ? 'turnin' : 'progress', quest: q, page: 0 };
}

function nextPage() {
  if (questDetail.value && questDetail.value.page < currentPages.value.length - 1) {
    questDetail.value.page++;
  }
}

function prevPage() {
  if (questDetail.value && questDetail.value.page > 0) {
    questDetail.value.page--;
  }
}

function exitDetail() {
  questDetail.value = null;
}

function acceptQuest() {
  if (!questDetail.value) return;
  const id = questDetail.value.kind === 'offer'
    ? questDetail.value.quest.id
    : questDetail.value.quest.id;
  questDetail.value = null;
  emit('accept-quest', id);
}

function completeQuest() {
  if (!questDetail.value) return;
  const id = questDetail.value.quest.id;
  questDetail.value = null;
  emit('complete-quest', id);
}

function repeatLabel(interval: string): string {
  if (interval === 'daily') return 'Daily';
  if (interval === 'weekly') return 'Weekly';
  if (interval === 'unlimited') return 'Repeatable';
  return '';
}

function summarizeObjectives(objs: Array<{ targetName: string; requiredCount: number; currentCount: number; cell?: string }> | undefined): string {
  if (!objs || objs.length === 0) return '';
  return objs.map(o => `${o.targetName}: ${o.currentCount}/${o.requiredCount}${o.cell ? ` (at ${o.cell})` : ''}`).join(' · ');
}

function formatStats(stats: any): string {
  if (!stats) return '';
  const parts: string[] = [];
  if (stats.attack) parts.push(`+${stats.attack} ATK`);
  if (stats.defense) parts.push(`+${stats.defense} DEF`);
  if (stats.health) parts.push(`+${stats.health} HP`);
  if (stats.mana) parts.push(`+${stats.mana} MP`);
  return parts.join(' ');
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.visible) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (questDetail.value) {
      questDetail.value = null;
    } else {
      emit('close');
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  cursor: pointer;
}

.dialog-float {
  position: fixed;
  background: rgba(15, 15, 30, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 16px 18px;
  width: 380px;
  max-height: 70vh;
  overflow-y: auto;
  color: white;
  cursor: default;
  pointer-events: auto;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
}

.npc-name {
  font-size: 1.05rem;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 8px;
}

.dialog-text {
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 10px;
  line-height: 1.5;
  font-size: 0.88rem;
  white-space: pre-wrap;
}

.page-speaker {
  font-size: 0.72rem;
  color: #ffd166;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.dialog-options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 8px;
}

.dialog-option {
  text-align: left;
  padding: 7px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #ddd;
  cursor: pointer;
  font-size: 0.82rem;
}

.dialog-option:hover {
  background: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
}

.dialog-option.primary {
  background: rgba(102, 126, 234, 0.25);
  border-color: rgba(102, 126, 234, 0.6);
  color: white;
}

.dialog-option.accept {
  background: rgba(76, 175, 80, 0.25);
  border-color: rgba(76, 175, 80, 0.7);
  color: #6ee06e;
  font-weight: bold;
}

.dialog-hint {
  text-align: center;
  color: #666;
  font-size: 0.75rem;
  margin-top: 4px;
}

.shop-section, .quest-offers, .quest-active {
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 10px;
}

.shop-section h4, .quest-offers h4, .quest-active h4, .reward-preview h4, .active-objectives h4 {
  margin: 0 0 6px;
  color: #888;
  font-size: 0.82rem;
}

.shop-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.shop-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.78rem;
}

.shop-item:hover {
  background: rgba(102, 126, 234, 0.15);
}

.shop-item .item-name {
  color: #ddd;
}

.shop-item .item-price {
  color: #ffd700;
}

.shop-item .item-stats {
  color: #888;
  font-size: 0.68rem;
}

.quest-offer-btn, .quest-active-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 12px;
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 6px;
  color: #4CAF50;
  cursor: pointer;
  font-size: 0.82rem;
  margin-bottom: 3px;
}

.quest-active-btn {
  background: rgba(102, 126, 234, 0.12);
  border-color: rgba(102, 126, 234, 0.3);
  color: #aab4ff;
}

.quest-active-btn.ready {
  background: rgba(255, 209, 102, 0.15);
  border-color: rgba(255, 209, 102, 0.4);
  color: #ffd166;
}

.quest-offer-btn:hover, .quest-active-btn:hover {
  filter: brightness(1.15);
}

.quest-offer-desc {
  display: block;
  font-size: 0.68rem;
  color: #aaa;
  margin-top: 2px;
  font-weight: normal;
}

.quest-offer-level {
  display: block;
  font-size: 0.66rem;
  color: #777;
  margin-top: 2px;
  font-weight: normal;
}

.quest-offer-level.ready-tag {
  color: #ffd166;
}

.quest-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.quest-detail-title {
  font-weight: bold;
  color: white;
}

.quest-detail-tag {
  font-size: 0.66rem;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.quest-detail-tag.offer { background: rgba(76, 175, 80, 0.25); color: #6ee06e; }
.quest-detail-tag.progress { background: rgba(102, 126, 234, 0.25); color: #aab4ff; }
.quest-detail-tag.turnin { background: rgba(255, 209, 102, 0.25); color: #ffd166; }

.reward-preview, .active-objectives {
  margin-top: 8px;
  margin-bottom: 8px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
}

.reward-list, .objective-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.reward-chip {
  font-size: 0.72rem;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.reward-chip.gold { color: #ffd700; }
.reward-chip.item { color: #aab4ff; }

.objective-row {
  justify-content: space-between;
  font-size: 0.78rem;
  margin-bottom: 3px;
}

.objective-name { color: #ddd; }
.objective-count { color: #aaa; }
.objective-cell { color: #ffd166; font-size: 0.72rem; }

.quest-detail-tags {
  display: flex;
  gap: 4px;
  align-items: center;
}

.quest-offer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4px;
}

.quest-offer-completed {
  display: block;
  font-size: 0.66rem;
  color: #888;
  margin-top: 2px;
  font-weight: normal;
}

.repeat-badge {
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: bold;
  white-space: nowrap;
}

.repeat-badge.small {
  font-size: 0.58rem;
  padding: 1px 4px;
}

.repeat-badge.daily { background: rgba(102, 153, 255, 0.25); color: #88aaff; }
.repeat-badge.weekly { background: rgba(179, 102, 255, 0.25); color: #b366ff; }
.repeat-badge.unlimited { background: rgba(76, 175, 80, 0.25); color: #6ee06e; }

.quest-offer-btn.repeatable {
  border-color: rgba(102, 153, 255, 0.25);
}
</style>
