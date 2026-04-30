import { JobId, BaseClass, JOB_DEFINITIONS, JobDefinition } from '../types/jobs';
import { Race, StatType, StatPoints, createDefaultStatPoints } from '../types/races';
import { RACE_DATA, MAX_LEVEL, MAX_STAT_VALUE, getLevelUpBonuses, getJobBaseStatModifier } from '../constants/races';

export { JobId, BaseClass, JOB_DEFINITIONS } from '../types/jobs';

export function getExperienceToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function calculateMaxLP(job: JobDefinition, level: number, sta: number): number {
  const levelLPComponent = Math.ceil(level * (100 / job.lpPerLevel));
  const staMultiplier = Math.ceil(100 / job.lpPerSta);
  const staLPComponent = Math.ceil(sta * staMultiplier);
  return job.lpBase + levelLPComponent + staLPComponent;
}

export function calculateMaxMP(job: JobDefinition, level: number, spi: number): number {
  const levelMPComponent = Math.ceil(level * (100 / job.mpPerLevel));
  const spiMultiplier = Math.ceil(100 / job.mpPerSpi);
  const spiMPComponent = Math.ceil(spi * spiMultiplier);
  return job.mpBase + levelMPComponent + spiMPComponent;
}

export function calculateDerivedStats(
  race: Race,
  jobId: JobId,
  level: number,
  allocatedStats: StatPoints
): {
  maxHealth: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  magicAttack: number;
  baseStats: { STA: number; STR: number; AGI: number; DEX: number; SPI: number; INT: number };
} {
  const job = JOB_DEFINITIONS[jobId];
  const raceData = RACE_DATA[race];
  if (!job || !raceData) {
    return { maxHealth: 100, maxMana: 50, attack: 10, defense: 5, speed: 4, magicAttack: 8, baseStats: { STA: 5, STR: 5, AGI: 5, DEX: 5, SPI: 5, INT: 5 } };
  }

  const baseClassId = job.baseClass === BaseClass.WARRIOR ? 0 : job.baseClass === BaseClass.SCOUT ? 1 : job.baseClass === BaseClass.ACOLYTE ? 2 : 3;
  const jobMod = getJobBaseStatModifier(baseClassId);

  const baseStats = {
    STA: raceData.baseStats.STA + (jobMod.sta || 0),
    STR: raceData.baseStats.STR + (jobMod.str || 0),
    AGI: raceData.baseStats.AGI + (jobMod.agi || 0),
    DEX: raceData.baseStats.DEX + (jobMod.dex || 0),
    SPI: raceData.baseStats.SPI + (jobMod.spi || 0),
    INT: raceData.baseStats.INT + (jobMod.int || 0),
  };

  const totalSTA = baseStats.STA + allocatedStats.STA;
  const totalSTR = baseStats.STR + allocatedStats.STR;
  const totalAGI = baseStats.AGI + allocatedStats.AGI;
  const totalDEX = baseStats.DEX + allocatedStats.DEX;
  const totalSPI = baseStats.SPI + allocatedStats.SPI;
  const totalINT = baseStats.INT + allocatedStats.INT;

  const maxHealth = calculateMaxLP(job, level, totalSTA);
  const maxMana = calculateMaxMP(job, level, totalSPI);
  const attack = Math.floor(5 + totalSTR * 1.5 + totalDEX * 0.3);
  const defense = Math.floor(3 + totalSTA * 0.8 + totalSTR * 0.3);
  const speed = Math.floor(30 + totalAGI * 0.5);
  const magicAttack = Math.floor(5 + totalINT * 1.5 + totalSPI * 0.3);

  return { maxHealth, maxMana, attack, defense, speed, magicAttack, baseStats };
}

export function getStatPointsGainedAtLevel(level: number): number {
  if (level <= 1) return 0;
  return getLevelUpBonuses(level)[0];
}

export function getSkillPointsGainedAtLevel(level: number): number {
  if (level <= 1) return 0;
  return getLevelUpBonuses(level)[1];
}

export { MAX_LEVEL, MAX_STAT_VALUE, getExperienceToNextLevel as getExperienceToNext };
