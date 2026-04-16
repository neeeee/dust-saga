import { JobId, BaseClass, JOB_DEFINITIONS, JobDefinition } from '../types/jobs';
import { Race, StatType, StatPoints, createDefaultStatPoints } from '../types/races';
import { RACE_DATA, MAX_LEVEL, MAX_STAT_VALUE } from '../constants/races';

export { CharacterClass as LegacyCharacterClass } from '../types/classes';
export { JobId, BaseClass, JOB_DEFINITIONS } from '../types/jobs';

export function getExperienceToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function calculateMaxLP(job: JobDefinition, level: number, sta: number): number {
  return Math.floor(job.lpBase + job.lpPerLevel * (level - 1) + job.lpPerSta * sta);
}

export function calculateMaxMP(job: JobDefinition, level: number, spi: number): number {
  return Math.floor(job.mpBase + job.mpPerLevel * (level - 1) + job.mpPerSpi * spi);
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
} {
  const job = JOB_DEFINITIONS[jobId];
  const raceData = RACE_DATA[race];
  if (!job || !raceData) {
    return { maxHealth: 100, maxMana: 50, attack: 10, defense: 5, speed: 4, magicAttack: 8 };
  }

  const totalSTA = raceData.baseStats.STA + allocatedStats.STA + (job.baseStatModifiers.STA || 0);
  const totalSTR = raceData.baseStats.STR + allocatedStats.STR + (job.baseStatModifiers.STR || 0);
  const totalAGI = raceData.baseStats.AGI + allocatedStats.AGI + (job.baseStatModifiers.AGI || 0);
  const totalDEX = raceData.baseStats.DEX + allocatedStats.DEX + (job.baseStatModifiers.DEX || 0);
  const totalSPI = raceData.baseStats.SPI + allocatedStats.SPI + (job.baseStatModifiers.SPI || 0);
  const totalINT = raceData.baseStats.INT + allocatedStats.INT + (job.baseStatModifiers.INT || 0);

  const maxHealth = calculateMaxLP(job, level, totalSTA);
  const maxMana = calculateMaxMP(job, level, totalSPI);
  const attack = Math.floor(5 + totalSTR * 1.5 + totalDEX * 0.3);
  const defense = Math.floor(3 + totalSTA * 0.8 + totalSTR * 0.3);
  const speed = Math.floor(30 + totalAGI * 0.5);
  const magicAttack = Math.floor(5 + totalINT * 1.5 + totalSPI * 0.3);

  return { maxHealth, maxMana, attack, defense, speed, magicAttack };
}

export function getStatPointsGainedAtLevel(level: number): number {
  if (level <= 1) return 0;
  return 3 + Math.floor(level / 5);
}

export { MAX_LEVEL, MAX_STAT_VALUE, getExperienceToNextLevel as getExperienceToNext };
