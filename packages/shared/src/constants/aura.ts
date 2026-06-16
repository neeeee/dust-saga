export interface GloomTier {
  spi: number;
  damage: number;
}

const GLOOM_TABLE: GloomTier[] = [
  { spi: 150, damage: 150 },
  { spi: 138, damage: 138 },
  { spi: 125, damage: 124 },
  { spi: 113, damage: 112 },
  { spi: 100, damage: 99 },
  { spi: 88, damage: 87 },
  { spi: 75, damage: 73 },
  { spi: 63, damage: 61 },
  { spi: 50, damage: 48 },
  { spi: 38, damage: 36 },
  { spi: 25, damage: 22 },
  { spi: 13, damage: 10 },
];

export const GLOOM_PROFICIENCY_REQUIRED = 16;
export const GLOOM_RECOIL_REDUCTION_PROFICIENCY = 71;
export const GLOOM_SPI_CAP = 150;

export function getGloomDamage(spi: number, auraDamageMultiplier: number = 1): number {
  const cappedSpi = Math.min(spi, GLOOM_SPI_CAP);
  let base = 5;
  if (cappedSpi >= 13) {
    for (const tier of GLOOM_TABLE) {
      if (cappedSpi >= tier.spi) {
        base = tier.damage;
        break;
      }
    }
  }
  return Math.floor(base * auraDamageMultiplier);
}

export function getGloomRecoil(gloomDamage: number, darknessProficiency: number): number {
  const rate = darknessProficiency >= GLOOM_RECOIL_REDUCTION_PROFICIENCY ? 0.10 : 0.50;
  return Math.floor(gloomDamage * rate);
}

export function isGloomActive(darknessProficiency: number): boolean {
  return darknessProficiency >= GLOOM_PROFICIENCY_REQUIRED;
}
