export type DebuffDOTType = 'poison' | 'severe_poison' | 'bleed' | 'mp_drain';

export interface DebuffEffectTable {
  dot?: DebuffDOTType;
  dotPotency?: number;
  dotHPPercent?: number;
  dotTickInterval?: number;
  dotMpDrain?: number;
  dotSPIBase?: number;
  dotSPIMax?: number;
  dotSPICap?: number;
  attackDown?: number;
  defenseDown?: number;
  speedDown?: number;
  accuracyDown?: number;
  castSpeedDown?: number;
  damageTakenUp?: number;
  moveSpeedDown?: number;
  hasKnockback?: {
    knockbackDistance: number;
  };
  hasStun?: {
    stunDuration: number;
  };
  preventEquipment?: {
    equipmentSlotDisabled: string;
  };
  consumable?: boolean;
  preventFieldSpells?: boolean;
  preventSpellCast?: boolean;
}
