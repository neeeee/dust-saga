import { reactive, ref, watch } from 'vue';
import {
  SkillBarSlot,
  SkillBarSlotCategory,
  SKILL_BAR_SIZE,
  MAX_SKILL_BARS,
  SkillBarLayout,
  createEmptySkillBar,
  createDefaultLayout,
  CLASS_SKILL_DATA,
  getClassSpecificSkillsForJob,
  getCategoryForSubCategory,
  SkillDefinition,
  SkillSubCategory,
  SUB_CATEGORY_TO_CATEGORY,
  meetsRequirements,
  getMaxPotential,
  getMinAdeptness,
  getDesignJobId,
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
  unlocked: boolean;
  reqPoints: number;
  reqLevel?: number;
  crossReqs?: Array<{ skillName: string; points: number }>;
}

export interface SubCategoryInfo {
  id: number;
  name: string;
  currentPoints: number;
  currentAdeptness: number;
  minAdeptness: number;
  maxPoints: number;
  skills: AvailableSkill[];
  category: string;
}

const STORAGE_KEY_PREFIX = 'dust-saga-skillbar';
let currentCharacterId: string | null = null;

function getStorageKey(): string {
  return currentCharacterId ? `${STORAGE_KEY_PREFIX}-${currentCharacterId}` : STORAGE_KEY_PREFIX;
}

interface SkillStoreState {
  layout: SkillBarLayout;
  cooldowns: Record<string, SkillCooldownState>;
  cast: CastState;
  availableSkills: AvailableSkill[];
  skillProficiencies: Record<string, number>;
  skillAdeptness: Record<string, number>;
  unspentSkillPoints: number;
  jobId: string;
  baseClass: string;
  level: number;
}

const state = reactive<SkillStoreState>({
  layout: {
    bars: [createEmptySkillBar()],
    positions: [
      { x: typeof window !== 'undefined' ? Math.round(window.innerWidth / 2 - 250) : 0, y: typeof window !== 'undefined' ? window.innerHeight - 60 : 0 },
    ],
  },
  cooldowns: {},
  cast: {
    active: false,
    skillName: '',
    castTime: 0,
    startedAt: 0,
    progress: 0,
  },
  availableSkills: [],
  skillProficiencies: {},
  skillAdeptness: {},
  unspentSkillPoints: 0,
  jobId: 'warrior',
  baseClass: 'warrior',
  level: 1,
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

function loadLayout(): SkillBarLayout {
  try {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
      const parsed = JSON.parse(saved) as SkillBarLayout;
      if (parsed.bars && parsed.bars.length > 0 && parsed.positions && parsed.positions.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return createDefaultLayout();
}

function saveLayout(): void {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(state.layout));
  } catch {}
}

watch(() => state.layout, saveLayout, { deep: true });

function getSlot(barIndex: number, slotIndex: number): SkillBarSlot | null {
  const bar = state.layout.bars[barIndex];
  if (!bar || slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return null;
  return bar[slotIndex];
}

function findSkillAcrossBars(skillName: string): { barIndex: number; slotIndex: number } | null {
  for (let b = 0; b < state.layout.bars.length; b++) {
    const idx = state.layout.bars[b].findIndex(s => s.skillName === skillName);
    if (idx >= 0) return { barIndex: b, slotIndex: idx };
  }
  return null;
}

export function useSkillStore() {
  function initForCharacter(characterId: string): void {
    currentCharacterId = characterId;
    const saved = loadLayout();
    if (saved.positions[0] && saved.positions[0].x === 0 && saved.positions[0].y === 0) {
      saved.positions[0] = {
        x: Math.round(window.innerWidth / 2 - 250),
        y: window.innerHeight - 60,
      };
    }
    state.layout = saved;
  }

  function updateSkillProficiencies(proficiencies: Record<string, number>, adeptness?: Record<string, number>, jobId?: string, baseClass?: string, unspentSkillPoints?: number, level?: number): void {
    state.skillProficiencies = proficiencies || {};
    if (adeptness) state.skillAdeptness = adeptness;
    if (jobId !== undefined) state.jobId = jobId;
    if (baseClass !== undefined) state.baseClass = baseClass;
    if (unspentSkillPoints !== undefined) state.unspentSkillPoints = unspentSkillPoints;
    if (level !== undefined) state.level = level;
    buildAvailableSkills();
  }

  function setSkillInSlot(barIndex: number, slotIndex: number, skillName: string, category: string, subCategory: string): void {
    const bar = state.layout.bars[barIndex];
    if (!bar || slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return;

    const existing = findSkillAcrossBars(skillName);
    if (existing && !(existing.barIndex === barIndex && existing.slotIndex === slotIndex)) {
      const temp = { ...state.layout.bars[existing.barIndex][existing.slotIndex] };
      state.layout.bars[existing.barIndex][existing.slotIndex] = { ...bar[slotIndex] };
      bar[slotIndex] = temp;
    } else {
      bar[slotIndex] = {
        skillName,
        category: category as SkillBarSlotCategory,
        subCategory,
      };
    }
  }

  function removeFromSlot(barIndex: number, slotIndex: number): void {
    const bar = state.layout.bars[barIndex];
    if (!bar || slotIndex < 0 || slotIndex >= SKILL_BAR_SIZE) return;
    bar[slotIndex] = {
      skillName: null,
      category: SkillBarSlotCategory.EMPTY,
      subCategory: '',
    };
  }

  function swapSlots(fromBar: number, fromSlot: number, toBar: number, toSlot: number): void {
    const from = state.layout.bars[fromBar];
    const to = state.layout.bars[toBar];
    if (!from || !to) return;
    if (fromSlot < 0 || fromSlot >= SKILL_BAR_SIZE || toSlot < 0 || toSlot >= SKILL_BAR_SIZE) return;
    const temp = { ...from[fromSlot] };
    from[fromSlot] = { ...to[toSlot] };
    to[toSlot] = temp;
  }

  function addBar(): boolean {
    if (state.layout.bars.length >= MAX_SKILL_BARS) return false;
    const lastPos = state.layout.positions[state.layout.positions.length - 1];
    state.layout.bars.push(createEmptySkillBar());
    state.layout.positions.push({
      x: lastPos ? lastPos.x : window.innerWidth / 2,
      y: lastPos ? lastPos.y - 70 : window.innerHeight - 130,
    });
    return true;
  }

  function removeBar(barIndex: number): boolean {
    if (barIndex <= 0 || barIndex >= state.layout.bars.length) return false;
    state.layout.bars.splice(barIndex, 1);
    state.layout.positions.splice(barIndex, 1);
    return true;
  }

  function moveBar(barIndex: number, x: number, y: number): void {
    if (barIndex < 0 || barIndex >= state.layout.positions.length) return;
    state.layout.positions[barIndex] = { x, y };
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

  function getSkillInSlot(barIndex: number, slotIndex: number): SkillBarSlot | null {
    return getSlot(barIndex, slotIndex);
  }

  function checkSkillUnlocked(def: SkillDefinition, subCategoryName: string, proficiencies: Record<string, number>): boolean {
    if (typeof def.reqPoints === 'number') {
      return (proficiencies[subCategoryName] || 0) >= def.reqPoints;
    }
    if (Array.isArray(def.reqPoints)) {
      return meetsRequirements(def.reqPoints, (skillName: string) => proficiencies[skillName] || 0);
    }
    return false;
  }

  function buildAvailableSkills(): void {
    const skills: AvailableSkill[] = [];
    const seen = new Set<string>();
    const proficiencies = state.skillProficiencies || {};
    const designJobId = getDesignJobId(state.jobId);

    const effectiveProficiencies: Record<string, number> = {};
    for (const subName of Object.keys(SUB_CATEGORY_TO_CATEGORY)) {
      effectiveProficiencies[subName] = (proficiencies[subName] || 0) + getMinAdeptness(designJobId, subName);
    }

    for (const [, catData] of Object.entries(CLASS_SKILL_DATA)) {
      const categoryData = catData as { skills: SkillSubCategory[] };
      for (const sub of categoryData.skills) {
        for (const [name, def] of Object.entries(sub.skills)) {
          if (seen.has(name)) continue;
          const skillDef = def as SkillDefinition;
          seen.add(name);
          const unlocked = checkSkillUnlocked(skillDef, sub.name, effectiveProficiencies);
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
            unlocked,
            reqPoints: typeof skillDef.reqPoints === 'number' ? skillDef.reqPoints : -1,
            crossReqs: Array.isArray(skillDef.reqPoints)
              ? skillDef.reqPoints.map(r => ({ skillName: r.skillName, points: r.points }))
              : undefined,
          });
        }
      }
    }

    const jobSkills = getClassSpecificSkillsForJob(state.jobId, state.baseClass as any);
    for (const [name, def] of Object.entries(jobSkills)) {
      if (seen.has(name)) continue;
      if (def.isPassive) continue;
      seen.add(name);
      let unlocked = false;
      if (!def.reqLevel || def.reqLevel <= state.level) {
        unlocked = true;
      }
      if (def.reqPoints && typeof def.reqPoints === 'number') {
        unlocked = false;
      }
      if (def.reqPoints && Array.isArray(def.reqPoints)) {
        unlocked = meetsRequirements(def.reqPoints, (skillName: string) => effectiveProficiencies[skillName] || 0);
      }
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
        unlocked,
        reqPoints: -1,
        reqLevel: def.reqLevel,
      });
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

  function getSubCategories(): SubCategoryInfo[] {
    const result: SubCategoryInfo[] = [];
    const seen = new Set<string>();
    const proficiencies = state.skillProficiencies || {};

    for (const [, catData] of Object.entries(CLASS_SKILL_DATA)) {
      const categoryData = catData as { skills: SkillSubCategory[] };
      for (const sub of categoryData.skills) {
        if (seen.has(sub.name)) continue;
        seen.add(sub.name);
        const cat = getCategoryForSubCategory(sub.id);
        const adeptness = state.skillAdeptness || {};
        const subSkills = state.availableSkills.filter(s => s.subCategory === sub.name);
        const designJobId = getDesignJobId(state.jobId);
        result.push({
          id: sub.id,
          name: sub.name,
          currentPoints: proficiencies[sub.name] || 0,
          currentAdeptness: adeptness[sub.name] || 0,
          minAdeptness: getMinAdeptness(designJobId, sub.name),
          maxPoints: getMaxPotential(designJobId, sub.name),
          skills: subSkills,
          category: cat,
        });
      }
    }

    const classSkills = state.availableSkills.filter(s => s.subCategory === 'Class');
    if (classSkills.length > 0) {
      result.push({
        id: -1,
        name: 'Class',
        currentPoints: 0,
        currentAdeptness: 0,
        minAdeptness: 0,
        maxPoints: 0,
        skills: classSkills,
        category: 'class',
      });
    }

    return result;
  }

  function getSubCategoriesByCategory(category: string): SubCategoryInfo[] {
    return getSubCategories().filter(s => s.category === category);
  }

  function getCategoryPoints(categoryName: string): number {
    let total = 0;
    for (const [subName, cat] of Object.entries(SUB_CATEGORY_TO_CATEGORY)) {
      if (cat === categoryName) {
        total += state.skillProficiencies[subName] || 0;
      }
    }
    return total;
  }

  function clearAllCooldowns(): void {
    for (const key of Object.keys(state.cooldowns)) {
      delete state.cooldowns[key];
    }
  }

  function getSlotForUse(barIndex: number, slotIndex: number): SkillBarSlot | null {
    void _now.value;
    return getSlot(barIndex, slotIndex);
  }

  const _now = now;

  return {
    state,
    now: _now,
    initForCharacter,
    updateSkillProficiencies,
    setSkillInSlot,
    removeFromSlot,
    swapSlots,
    addBar,
    removeBar,
    moveBar,
    startCooldown,
    getCooldownRemaining,
    getCooldownProgress,
    isOnCooldown,
    startCast,
    updateCastProgress,
    endCast,
    getSkillInSlot,
    getSlotForUse,
    buildAvailableSkills,
    getSkillsByCategory,
    getSubCategories,
    getSubCategoriesByCategory,
    getCategoryPoints,
    clearAllCooldowns,
    startTick,
    stopTick,
  };
}
