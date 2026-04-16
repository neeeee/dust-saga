export enum Race {
  HUMAN = 'human',
  ELF = 'elf',
  DWARF = 'dwarf',
  MYRINE = 'myrine',
  ENKIDU = 'enkidu',
  LAPIN = 'lapin'
}

export interface RaceData {
  id: Race;
  name: string;
  description: string;
  baseStats: Record<StatType, number>;
  passiveName: string;
  passiveDescription: string;
  passiveEffects: RacialPassiveEffects;
}

export enum StatType {
  STA = 'STA',
  STR = 'STR',
  AGI = 'AGI',
  DEX = 'DEX',
  SPI = 'SPI',
  INT = 'INT'
}

export const STAT_TYPES: StatType[] = [
  StatType.STA,
  StatType.STR,
  StatType.AGI,
  StatType.DEX,
  StatType.SPI,
  StatType.INT
];

export interface RacialPassiveEffects {
  meleeSkillBonus?: number;
  ailmentDurationModifier?: number;
  potionEffectivenessModifier?: number;
  rangedRangeBonus?: number;
  spellMpCostModifier?: number;
  charmResistBonus?: number;
  fatalDamagePartyChance?: number;
  axeBluntDamageBonus?: number;
  surviveFatalChance?: number;
  critChanceBonus?: number;
  dodgeChanceBonus?: number;
  damageToMpChance?: number;
  physicalDamageTakenModifier?: number;
  twoHandDamageBonus?: number;
  boostLapinPhysicalDefense?: boolean;
  magicResistBonus?: number;
  mpRegenModifier?: number;
  boostEnkiduMagicDefense?: boolean;
}

export interface StatPoints {
  STA: number;
  STR: number;
  AGI: number;
  DEX: number;
  SPI: number;
  INT: number;
}

export function createDefaultStatPoints(): StatPoints {
  return { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
}
