import { CharacterClass, ClassDefinition } from '../types/classes';

export const CLASS_DEFINITIONS: Record<CharacterClass, ClassDefinition> = {
  [CharacterClass.WARRIOR]: {
    id: CharacterClass.WARRIOR,
    name: 'Warrior',
    description: 'A mighty fighter with high health and physical power. Masters of close combat.',
    modelFile: 'Adventurer.glb',
    abilities: ['slash', 'shield_bash', 'war_cry', 'whirlwind'],
    stats: {
      baseHealth: 150,
      baseMana: 30,
      baseAttack: 15,
      baseDefense: 12,
      baseSpeed: 4,
      healthPerLevel: 15,
      manaPerLevel: 3,
      attackPerLevel: 3,
      defensePerLevel: 2
    }
  },
  [CharacterClass.MAGE]: {
    id: CharacterClass.MAGE,
    name: 'Mage',
    description: 'A powerful spellcaster with devastating magical abilities. Fragile but deadly.',
    modelFile: 'Witch.glb',
    abilities: ['fireball', 'ice_lance', 'arcane_shield', 'meteor'],
    stats: {
      baseHealth: 80,
      baseMana: 120,
      baseAttack: 8,
      baseDefense: 4,
      baseSpeed: 4.5,
      healthPerLevel: 6,
      manaPerLevel: 12,
      attackPerLevel: 1,
      defensePerLevel: 1
    }
  },
  [CharacterClass.RANGER]: {
    id: CharacterClass.RANGER,
    name: 'Ranger',
    description: 'A swift hunter with ranged attacks and survival skills. Fast and agile.',
    modelFile: 'Farmer.glb',
    abilities: ['arrow_shot', 'multishot', 'trap', 'evasion'],
    stats: {
      baseHealth: 100,
      baseMana: 50,
      baseAttack: 12,
      baseDefense: 6,
      baseSpeed: 5.5,
      healthPerLevel: 8,
      manaPerLevel: 5,
      attackPerLevel: 2,
      defensePerLevel: 1
    }
  },
  [CharacterClass.ROGUE]: {
    id: CharacterClass.ROGUE,
    name: 'Rogue',
    description: 'A stealthy assassin with high critical hits. Strikes from the shadows.',
    modelFile: 'Punk.glb',
    abilities: ['backstab', 'poison_blade', 'stealth', 'fan_of_knives'],
    stats: {
      baseHealth: 90,
      baseMana: 40,
      baseAttack: 14,
      baseDefense: 5,
      baseSpeed: 6,
      healthPerLevel: 7,
      manaPerLevel: 4,
      attackPerLevel: 3,
      defensePerLevel: 1
    }
  },
  [CharacterClass.PALADIN]: {
    id: CharacterClass.PALADIN,
    name: 'Paladin',
    description: 'A holy knight with healing abilities and strong defenses. Protector of the weak.',
    modelFile: 'King.glb',
    abilities: ['holy_strike', 'heal', 'divine_shield', 'consecration'],
    stats: {
      baseHealth: 130,
      baseMana: 70,
      baseAttack: 10,
      baseDefense: 14,
      baseSpeed: 3.5,
      healthPerLevel: 12,
      manaPerLevel: 7,
      attackPerLevel: 2,
      defensePerLevel: 3
    }
  }
};

export function getClassStats(cls: CharacterClass, level: number) {
  const def = CLASS_DEFINITIONS[cls];
  const s = def.stats;
  return {
    maxHealth: s.baseHealth + s.healthPerLevel * (level - 1),
    maxMana: s.baseMana + s.manaPerLevel * (level - 1),
    attack: s.baseAttack + s.attackPerLevel * (level - 1),
    defense: s.baseDefense + s.defensePerLevel * (level - 1),
    speed: s.baseSpeed
  };
}

export function getExperienceToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}
