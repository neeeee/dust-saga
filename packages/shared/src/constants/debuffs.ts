export type DebuffDOTType = 'poison' | 'severe_poison' | 'bleed' | 'mp_drain';

export interface DebuffEffectTable {
  dot?: DebuffDOTType;
  dotPotency?: number;
  dotHPPercent?: number;
  dotTickInterval?: number;
  dotMpDrain?: number;
  attackDown?: number;
  defenseDown?: number;
  speedDown?: number;
  accuracyDown?: number;
  castSpeedDown?: number;
  damageTakenUp?: number;
  consumable?: boolean;
  preventFieldSpells?: boolean;
}
