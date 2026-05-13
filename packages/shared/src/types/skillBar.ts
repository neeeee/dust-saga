export interface SkillBarSlot {
  skillName: string | null;
  category: SkillBarSlotCategory;
  subCategory: string;
}

export enum SkillBarSlotCategory {
  EMPTY = 'empty',
  MELEE = 'melee',
  TECHNIQUE = 'technique',
  PRAYER = 'prayer',
  MAGIC = 'magic',
  SPECIAL = 'special'
}

export const SKILL_BAR_SIZE = 10;

export const MAX_SKILL_BARS = 6;

export const SKILL_CATEGORY_COLORS: Record<string, string> = {
  melee: '#c0392b',
  technique: '#27ae60',
  prayer: '#f39c12',
  magic: '#8e44ad',
  special: '#16a085',
};

export const SKILL_BAR_KEYBINDS = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'
];

export const BAR_KEYBIND_LABELS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S0'],
  ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C0'],
];

export interface SkillBarLayout {
  bars: SkillBarSlot[][];
  positions: { x: number; y: number }[];
}

export function createEmptySkillBar(): SkillBarSlot[] {
  return Array.from({ length: SKILL_BAR_SIZE }, () => ({
    skillName: null,
    category: SkillBarSlotCategory.EMPTY,
    subCategory: '',
  }));
}

export function createDefaultLayout(): SkillBarLayout {
  return {
    bars: [createEmptySkillBar()],
    positions: [
      { x: 0, y: 0 },
    ],
  };
}
