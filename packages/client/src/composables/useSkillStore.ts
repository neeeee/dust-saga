import { reactive, ref, watch } from 'vue';
import {
  SkillBarSlot,
  SkillBarSlotCategory,
  SKILL_BAR_SIZE,
  createEmptySkillBar,
  CLASS_SKILL_DATA,
  CLASS_SPECIFIC_SKILLS,
  isPassiveSkill,
  getCategoryForSubCategory,
  SkillDefinition,
  SkillSubCategory,
} from '@dust-saga/shared';

export interface SkillCooldownState {
  skillName: string;
  readyAt: number;
  duration: number;
}

export interface CastState {
  active: boolean;
  skillName: string;
  castTime: number;
  startedAt: number;
  progress: number;
}

export interface AvailableSkill {
  name: string;
  description: string;
  mpCost: number;
  castTime: number;
  cooldown: number;
  isPassive: boolean;
  isAOE: boolean;
  category: string;
  subCategory: string;
  subCategoryId: number;
}

const STORAGE_KEY = 'dust-saga-skillbar';

interface SkillStoreState {
  bar: SkillBarSlot[];
  cooldowns: Record<string, SkillCooldownState>;
  cast: CastState;
  availableSkills: AvailableSkill[];
}

const state = reactive<SkillStoreState>({
  bar: loadSkillBar(),
  cooldowns: {},
  cast: {
    active: false,
    skillName: '',
    castTime: 0,
    startedAt: 0,
    progress: 0,
  },
  availableSkills: [],
});

const now = ref(Date.now());

let tickInterval: ReturnType<typeof setInterval> | null = null;

function startTick(): void {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    now.value = Date.now();
    const keys = Object.keys(state.cooldowns);
    for (const key of keys) {
      if (now.value >= state.cooldowns[key].readyAt) {
        delete state.cooldowns[key];
      }
    }
  }, 100);
}

function stopTick(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

startTick();

function loadSkillBar(): SkillBarSlot[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as SkillBarSlot[];
      if (Array.isArray(parsed) && parsed.length === SKILL_BAR_SIZE) {
        return parsed;
      }
    }
  } catch {}
  return createEmptySkillBar();
}

function saveSkillBar(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bar));
  } catch {}
}

watch(() => state.bar, saveSkillBar, { deep: true });

export function useSkillStore() {
  function setSkillInSlot(slotIndex: number, skillName: string, category: string, subCategory: string): void {
    if (slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return;

    const existingIndex = state.bar.findIndex(s => s.skillName === skillName);
    if (existingIndex >= 0 && existingIndex !== slotIndex) {
      const temp = { ...state.bar[existingIndex] };
      state.bar[existingIndex] = { ...state.bar[slotIndex] };
      state.bar[slotIndex] = temp;
    } else {
      state.bar[slotIndex] = {
        skillName,
        category: category as SkillBarSlotCategory,
        subCategory,
      };
    }
  }

  function removeFromSlot(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return;
    state.bar[slotIndex] = {
      skillName: null,
      category: SkillBarSlotCategory.EMPTY,
      subCategory: '',
    };
  }

  function swapSlots(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= SKILL_BAR_SIZE || toIndex >= SKILL_BAR_SIZE) return;
    const temp = { ...state.bar[fromIndex] };
    state.bar[fromIndex] = { ...state.bar[toIndex] };
    state.bar[toIndex] = temp;
  }

  function startCooldown(skillName: string, cooldownMs: number): void {
    state.cooldowns[skillName] = {
      skillName,
      readyAt: Date.now() + cooldownMs,
      duration: cooldownMs,
    };
  }

  function getCooldownRemaining(skillName: string): number {
    const cd = state.cooldowns[skillName];
    if (!cd) return 0;
    const remaining = cd.readyAt - now.value;
    if (remaining <= 0) {
      delete state.cooldowns[skillName];
      return 0;
    }
    return remaining;
  }

  function getCooldownProgress(skillName: string): number {
    const cd = state.cooldowns[skillName];
    if (!cd) return 0;
    const remaining = cd.readyAt - now.value;
    if (remaining <= 0) {
      delete state.cooldowns[skillName];
      return 0;
    }
    return 1 - remaining / cd.duration;
  }

  function isOnCooldown(skillName: string): boolean {
    return getCooldownRemaining(skillName) > 0;
  }

  function startCast(skillName: string, castTimeMs: number): void {
    state.cast = {
      active: true,
      skillName,
      castTime: castTimeMs,
      startedAt: Date.now(),
      progress: 0,
    };
  }

  function updateCastProgress(): void {
    if (!state.cast.active) return;
    const elapsed = Date.now() - state.cast.startedAt;
    state.cast.progress = Math.min(1, elapsed / state.cast.castTime);
  }

  function endCast(): void {
    state.cast = {
      active: false,
      skillName: '',
      castTime: 0,
      startedAt: 0,
      progress: 0,
    };
  }

  function getSkillInSlot(slotIndex: number): SkillBarSlot | null {
    if (slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return null;
    return state.bar[slotIndex];
  }

  function buildAvailableSkills(): void {
    const skills: AvailableSkill[] = [];
    const seen = new Set<string>();

    for (const [, catData] of Object.entries(CLASS_SKILL_DATA)) {
      const categoryData = catData as { skills: SkillSubCategory[] };
      for (const sub of categoryData.skills) {
        for (const [name, def] of Object.entries(sub.skills)) {
          if (seen.has(name)) continue;
          const skillDef = def as SkillDefinition;
          if (isPassiveSkill(skillDef)) continue;
          seen.add(name);
          skills.push({
            name,
            description: skillDef.description,
            mpCost: skillDef.mpCost,
            castTime: skillDef.castTime,
            cooldown: skillDef.cooldown,
            isPassive: skillDef.isPassive || false,
            isAOE: skillDef.isAOE || false,
            category: getCategoryForSubCategory(sub.id),
            subCategory: sub.name,
            subCategoryId: sub.id,
          });
        }
      }
    }

    for (const [, jobSkills] of Object.entries(CLASS_SPECIFIC_SKILLS)) {
      for (const [name, def] of Object.entries(jobSkills)) {
        if (seen.has(name)) continue;
        if (def.isPassive) continue;
        seen.add(name);
        skills.push({
          name,
          description: def.description,
          mpCost: def.mpCost,
          castTime: def.castTime,
          cooldown: def.cooldown,
          isPassive: false,
          isAOE: false,
          category: 'class',
          subCategory: 'Class',
          subCategoryId: 0,
        });
      }
    }

    state.availableSkills = skills;
  }

  function getSkillsByCategory(): Record<string, AvailableSkill[]> {
    const grouped: Record<string, AvailableSkill[]> = {};
    for (const skill of state.availableSkills) {
      const key = skill.category;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(skill);
    }
    return grouped;
  }

  function clearAllCooldowns(): void {
    for (const key of Object.keys(state.cooldowns)) {
      delete state.cooldowns[key];
    }
  }

  return {
    state,
    now,
    setSkillInSlot,
    removeFromSlot,
    swapSlots,
    startCooldown,
    getCooldownRemaining,
    getCooldownProgress,
    isOnCooldown,
    startCast,
    updateCastProgress,
    endCast,
    getSkillInSlot,
    buildAvailableSkills,
    getSkillsByCategory,
    clearAllCooldowns,
    startTick,
    stopTick,
  };
}
