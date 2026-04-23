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

export function createEmptySkillBar(): SkillBarSlot[] {
  return Array.from({ length: SKILL_BAR_SIZE }, () => ({
    skillName: null,
    category: SkillBarSlotCategory.EMPTY,
    subCategory: '',
  }));
}
