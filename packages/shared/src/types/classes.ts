export enum CharacterClass {
  WARRIOR = 'warrior',
  MAGE = 'mage',
  RANGER = 'ranger',
  ROGUE = 'rogue',
  PALADIN = 'paladin'
}

export interface ClassStats {
  baseHealth: number;
  baseMana: number;
  baseAttack: number;
  baseDefense: number;
  baseSpeed: number;
  healthPerLevel: number;
  manaPerLevel: number;
  attackPerLevel: number;
  defensePerLevel: number;
}

export interface ClassDefinition {
  id: CharacterClass;
  name: string;
  description: string;
  stats: ClassStats;
  modelFile: string;
  abilities: string[];
}

export interface CharacterInfo {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  experience: number;
  experienceToNext: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  zoneId: string;
}
