<template>
  <div v-if="visible" class="craft-overlay" @click.self="$emit('close')">
    <div class="craft-window" @click.stop>
      <div class="craft-header">
        <span class="craft-title">{{ professionLabel }} — {{ npcName }}</span>
        <button class="craft-close" @click="$emit('close')">✕</button>
      </div>

      <div v-if="recipes.length === 0" class="craft-empty">
        You don't know any recipes this NPC can craft.<br />
        <span class="hint">Recipes drop from enemies. Use the recipe scroll to learn it.</span>
      </div>

      <div v-else class="craft-list">
        <div
          v-for="r in recipes"
          :key="r.id"
          class="recipe-row"
          :class="{ disabled: !canCraft(r), missing: !canCraft(r) }"
        >
          <div class="recipe-head">
            <span class="recipe-name">{{ r.name || itemName(r.resultItemId) }}</span>
            <span class="recipe-output">→ {{ r.resultQuantity }}× {{ itemName(r.resultItemId) }}</span>
          </div>
          <div class="recipe-mats">
            <span
              v-for="mat in r.materials"
              :key="mat.itemId"
              class="mat-chip"
              :class="{ unmet: have(mat.itemId) < mat.quantity }"
            >{{ have(mat.itemId) }}/{{ mat.quantity }} {{ itemName(mat.itemId) }}</span>
            <span class="lvl-chip" :class="{ unmet: playerLevel < r.requiredLevel }">Lv {{ r.requiredLevel }}</span>
          </div>
          <button
            class="craft-btn"
            :disabled="!canCraft(r)"
            @click="$emit('craft', r.id)"
          >Craft</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ITEM_DATABASE, CraftProfession } from '@dust-saga/shared';
import type { RecipeDefinition } from '@dust-saga/shared';

const props = defineProps<{
  visible: boolean;
  npcName: string;
  profession: CraftProfession | undefined;
  recipes: RecipeDefinition[];
  inventory: Array<{ itemId: string; quantity: number }>;
  playerLevel: number;
}>();

defineEmits<{
  'close': [];
  'craft': [recipeId: string];
}>();

const PROFESSION_LABELS: Record<string, string> = {
  blacksmith: 'Blacksmith',
  alchemist: 'Alchemy',
  enchanter: 'Enchanting',
};

const professionLabel = PROFESSION_LABELS[props.profession || ''] || 'Crafting';

function itemName(id: string): string {
  return ITEM_DATABASE[id]?.name || id;
}

function have(itemId: string): number {
  return props.inventory
    .filter(i => i.itemId === itemId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

function canCraft(r: RecipeDefinition): boolean {
  if (props.playerLevel < r.requiredLevel) return false;
  return r.materials.every(m => have(m.itemId) >= m.quantity);
}
</script>

<style scoped>
.craft-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: center;
}

.craft-window {
  background: rgba(15, 15, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 16px 18px;
  width: 540px;
  max-height: 75vh;
  overflow-y: auto;
  color: white;
}

.craft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
}

.craft-title {
  font-weight: bold;
  color: #ffd166;
  font-size: 1rem;
}

.craft-close {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 1.1rem;
}

.craft-close:hover { color: white; }

.craft-empty {
  color: #aaa;
  text-align: center;
  padding: 32px 12px;
  font-size: 0.86rem;
  line-height: 1.5;
}

.craft-empty .hint {
  font-size: 0.76rem;
  color: #666;
}

.craft-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recipe-row {
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px 12px;
  align-items: center;
}

.recipe-row.disabled { opacity: 0.65; }
.recipe-row.missing { border-color: rgba(255, 100, 100, 0.2); }

.recipe-head {
  display: flex;
  flex-direction: column;
}

.recipe-name {
  font-weight: bold;
  color: white;
  font-size: 0.92rem;
}

.recipe-output {
  color: #aaa;
  font-size: 0.78rem;
}

.recipe-mats {
  grid-column: 1 / 2;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mat-chip {
  font-size: 0.74rem;
  padding: 1px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  color: #ccc;
}

.mat-chip.unmet {
  color: #ff8888;
  background: rgba(255, 100, 100, 0.1);
}

.lvl-chip {
  font-size: 0.72rem;
  padding: 1px 6px;
  background: rgba(102, 153, 255, 0.15);
  border-radius: 3px;
  color: #88aaff;
}

.lvl-chip.unmet {
  background: rgba(255, 100, 100, 0.15);
  color: #ff8888;
}

.craft-btn {
  grid-row: 1 / 3;
  grid-column: 2 / 3;
  background: rgba(76, 175, 80, 0.25);
  border: 1px solid rgba(76, 175, 80, 0.6);
  border-radius: 5px;
  color: #6ee06e;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.84rem;
  align-self: stretch;
}

.craft-btn:hover:not(:disabled) { background: rgba(76, 175, 80, 0.4); }
.craft-btn:disabled {
  background: rgba(80, 80, 80, 0.3);
  border-color: rgba(120, 120, 120, 0.4);
  color: #777;
  cursor: not-allowed;
}
</style>
