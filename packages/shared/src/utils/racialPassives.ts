import { Race, RacialPassiveEffects } from '../types/races';
import { RACE_DATA } from '../constants/races';
import { PlayerSession } from '../types/player';

export function getRacialPassives(race: string): RacialPassiveEffects {
  const raceData = RACE_DATA[race as Race];
  return raceData?.passiveEffects || {};
}

export function applyRacialCritChance(race: string, baseCritChance: number): number {
  const passives = getRacialPassives(race);
  return baseCritChance + (passives.critChanceBonus || 0);
}

export function applyRacialDodgeChance(race: string): number {
  const passives = getRacialPassives(race);
  return passives.dodgeChanceBonus || 0;
}

export function applyRacialIncomingDamage(race: string, damage: number, damageType: 'physical' | 'magical'): number {
  const passives = getRacialPassives(race);
  if (damageType === 'physical' && passives.physicalDamageTakenModifier) {
    damage = Math.floor(damage * (1 + passives.physicalDamageTakenModifier));
  }
  if (damageType === 'magical' && passives.magicResistBonus) {
    damage = Math.floor(damage * (1 - passives.magicResistBonus));
  }
  return Math.max(1, damage);
}

export function applyRacialOutgoingDamage(race: string, damage: number, weaponType?: string): number {
  const passives = getRacialPassives(race);
  if (weaponType === 'axe' || weaponType === 'blunt') {
    if (passives.axeBluntDamageBonus) {
      damage = Math.floor(damage * (1 + passives.axeBluntDamageBonus));
    }
  }
  if (weaponType === 'twohand') {
    if (passives.twoHandDamageBonus) {
      damage = Math.floor(damage * (1 + passives.twoHandDamageBonus));
    }
  }
  return damage;
}

export function applyRacialPotionHealing(race: string, baseHeal: number): number {
  const passives = getRacialPassives(race);
  if (passives.potionEffectivenessModifier) {
    return Math.floor(baseHeal * (1 + passives.potionEffectivenessModifier));
  }
  return baseHeal;
}

export function applyRacialMpCost(race: string, baseMpCost: number): number {
  const passives = getRacialPassives(race);
  if (passives.spellMpCostModifier) {
    return Math.max(1, Math.floor(baseMpCost * (1 + passives.spellMpCostModifier)));
  }
  return baseMpCost;
}

export function applyRacialAilmentDuration(race: string, baseDurationMs: number): number {
  const passives = getRacialPassives(race);
  if (passives.ailmentDurationModifier) {
    return Math.max(0, Math.floor(baseDurationMs * (1 + passives.ailmentDurationModifier)));
  }
  return baseDurationMs;
}

export function checkSurviveFatal(race: string): boolean {
  const passives = getRacialPassives(race);
  if (passives.surviveFatalChance) {
    return Math.random() < passives.surviveFatalChance;
  }
  return false;
}

export function checkDamageToMpConversion(race: string): boolean {
  const passives = getRacialPassives(race);
  if (passives.damageToMpChance) {
    return Math.random() < passives.damageToMpChance;
  }
  return false;
}

export function processRacialOnDamage(
  target: PlayerSession,
  incomingDamage: number,
  damageType: 'physical' | 'magical'
): { finalDamage: number; survivedFatal: boolean; mpConverted: number } {
  const race = target.race;
  let finalDamage = applyRacialIncomingDamage(race, incomingDamage, damageType);
  let survivedFatal = false;
  let mpConverted = 0;

  if (checkDamageToMpConversion(race)) {
    mpConverted = Math.floor(finalDamage * 0.3);
    target.stats.mana = Math.min(target.stats.maxMana, target.stats.mana + mpConverted);
  }

  if (finalDamage >= target.stats.health && checkSurviveFatal(race)) {
    finalDamage = target.stats.health - 1;
    survivedFatal = true;
  }

  return { finalDamage, survivedFatal, mpConverted };
}

export function getRangedRangeBonus(race: string): number {
  const passives = getRacialPassives(race);
  return passives.rangedRangeBonus || 0;
}

export function getCharmResist(race: string): number {
  const passives = getRacialPassives(race);
  return passives.charmResistBonus || 0;
}

export function getMpRegenBonus(race: string): number {
  const passives = getRacialPassives(race);
  return passives.mpRegenModifier || 0;
}
