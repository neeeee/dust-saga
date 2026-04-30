import { Race, RaceData } from '../types/races';

export const RACE_DATA: Record<Race, RaceData> = {
  [Race.HUMAN]: {
    id: Race.HUMAN,
    name: 'Human',
    description: 'Versatile and adaptable. Well-rounded in all disciplines.',
    baseStats: { STA: 5, STR: 5, AGI: 5, DEX: 5, SPI: 5, INT: 5 },
    passiveName: 'Adaptability',
    passiveDescription: '+10 melee skill (1H), ailment duration -50%, potion effectiveness +15%',
    passiveEffects: {
      meleeSkillBonus: 10,
      ailmentDurationModifier: -0.5,
      potionEffectivenessModifier: 0.15
    }
  },
  [Race.ELF]: {
    id: Race.ELF,
    name: 'Elf',
    description: 'Graceful and magical. Natural affinity for ranged combat and spellcraft.',
    baseStats: { STA: 3, STR: 3, AGI: 6, DEX: 4, SPI: 7, INT: 7 },
    passiveName: 'Elven Grace',
    passiveDescription: '+3 ranged range, spell MP cost -15%, charm resistance +20%',
    passiveEffects: {
      rangedRangeBonus: 3,
      spellMpCostModifier: -0.15,
      charmResistBonus: 20
    }
  },
  [Race.DWARF]: {
    id: Race.DWARF,
    name: 'Dwarf',
    description: 'Sturdy and resilient. Masters of heavy weapons and unwavering defense.',
    baseStats: { STA: 6, STR: 7, AGI: 5, DEX: 6, SPI: 3, INT: 3 },
    passiveName: 'Dwarven Resilience',
    passiveDescription: '1% chance take fatal damage for party, axe/blunt damage +10%, 3% survive fatal with 1HP',
    passiveEffects: {
      fatalDamagePartyChance: 0.01,
      axeBluntDamageBonus: 0.1,
      surviveFatalChance: 0.03
    }
  },
  [Race.MYRINE]: {
    id: Race.MYRINE,
    name: 'Myrine',
    description: 'Quick and elusive. Gifted with heightened reflexes and evasion.',
    baseStats: { STA: 5, STR: 5, AGI: 9, DEX: 6, SPI: 3, INT: 2 },
    passiveName: 'Swift Instinct',
    passiveDescription: 'Crit chance +5%, 5% dodge, chance convert damage to MP',
    passiveEffects: {
      critChanceBonus: 0.05,
      dodgeChanceBonus: 0.05,
      damageToMpChance: 0.05
    }
  },
  [Race.ENKIDU]: {
    id: Race.ENKIDU,
    name: 'Enkidu',
    description: 'Powerful and tough. A beast-like race with immense physical presence.',
    baseStats: { STA: 8, STR: 6, AGI: 4, DEX: 4, SPI: 6, INT: 2 },
    passiveName: 'Beast Fortitude',
    passiveDescription: 'Physical damage taken -10%, 2H weapon damage +10%, boost Lapin party members\' physical defense',
    passiveEffects: {
      physicalDamageTakenModifier: -0.1,
      twoHandDamageBonus: 0.1,
      boostLapinPhysicalDefense: true
    }
  },
  [Race.LAPIN]: {
    id: Race.LAPIN,
    name: 'Lapin',
    description: 'Gentle and magically attuned. A rabbit-like race with strong mystical affinity.',
    baseStats: { STA: 3, STR: 1, AGI: 6, DEX: 5, SPI: 9, INT: 6 },
    passiveName: 'Mystic Hare',
    passiveDescription: 'Magic resistance +10%, MP regen +15%, boost Enkidu party members\' magic defense',
    passiveEffects: {
      magicResistBonus: 0.1,
      mpRegenModifier: 0.15,
      boostEnkiduMagicDefense: true
    }
  }
};

export function getRaceData(race: Race): RaceData {
  return RACE_DATA[race];
}

export const LEVEL_UP_BONUSES: Record<number, [number, number, number]> = {
  2: [6, 1, 0], 3: [6, 1, 0], 4: [6, 1, 0], 5: [6, 1, 0],
  6: [6, 1, 0], 7: [6, 1, 0], 8: [6, 1, 0], 9: [6, 1, 0],
  10: [8, 1, 0], 11: [8, 2, 0], 12: [8, 2, 0], 13: [8, 2, 0],
  14: [8, 2, 0], 15: [8, 2, 0], 16: [8, 2, 0], 17: [8, 2, 0],
  18: [8, 2, 0], 19: [8, 2, 0], 20: [10, 2, 0], 21: [10, 3, 0],
  22: [10, 3, 0], 23: [10, 3, 0], 24: [10, 3, 0], 25: [10, 3, 0],
  26: [10, 3, 0], 27: [10, 3, 0], 28: [10, 3, 0], 29: [10, 3, 0],
  30: [12, 3, 0], 31: [12, 3, 0], 32: [12, 3, 0], 33: [12, 3, 0],
  34: [12, 3, 0], 35: [12, 3, 0], 36: [12, 3, 0], 37: [12, 3, 0],
  38: [12, 3, 0], 39: [12, 3, 0], 40: [14, 3, 0], 41: [14, 3, 0],
  42: [14, 3, 0], 43: [14, 3, 0], 44: [14, 3, 0], 45: [14, 3, 0],
  46: [14, 3, 0], 47: [14, 3, 0], 48: [14, 3, 0], 49: [14, 3, 0],
  50: [16, 3, 0], 51: [8, 3, 0], 52: [8, 3, 0], 53: [8, 3, 0],
  54: [8, 3, 0], 55: [8, 3, 0], 56: [2, 2, 0], 57: [2, 2, 0],
  58: [2, 2, 0], 59: [2, 2, 0], 60: [2, 2, 0],
};

export function getLevelUpBonuses(level: number): [number, number, number] {
  return LEVEL_UP_BONUSES[level] || [2, 1, 0];
}

export const STAT_POINT_COSTS: Record<number, [number, number]> = {};
for (let i = 1; i <= 30; i++) STAT_POINT_COSTS[i] = [2, 1];
for (let i = 31; i <= 50; i++) STAT_POINT_COSTS[i] = [3, 1];
for (let i = 51; i <= 70; i++) STAT_POINT_COSTS[i] = [4, 1];
for (let i = 71; i <= 90; i++) STAT_POINT_COSTS[i] = [5, 1];
for (let i = 91; i <= 99; i++) STAT_POINT_COSTS[i] = [6, 1];

export function getStatPointCost(currentValue: number): [number, number] {
  return STAT_POINT_COSTS[Math.min(currentValue, 99)] || [6, 1];
}

export const MAX_LEVEL = 60;
export const MAX_STAT_VALUE = 99;

export const JOB_BASE_STAT_MODIFIERS: Record<number, Record<string, number>> = {
  0: { STA: 2, STR: 3, AGI: -1, DEX: 1, SPI: -1, INT: 0 },
  1: { STA: 0, STR: 2, AGI: 1, DEX: 2, SPI: -1, INT: 0 },
  2: { STA: 0, STR: 2, AGI: -1, DEX: 0, SPI: 1, INT: 2 },
  3: { STA: -1, STR: 1, AGI: -1, DEX: 1, SPI: 1, INT: 3 },
};

export function getJobBaseStatModifier(baseClass: number): Record<string, number> {
  return JOB_BASE_STAT_MODIFIERS[baseClass] || JOB_BASE_STAT_MODIFIERS[0];
}
