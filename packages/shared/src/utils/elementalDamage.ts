import { StatusEffect, StatusEffectType } from '../types/status';
import { ITEM_DATABASE } from '../constants/items';

export interface ElementalDamageLine {
  element: string;
  damage: number;
}

const ELEMENT_RESIST_KEYS: Record<string, string> = {
  fire: 'fireResist',
  ice: 'iceResist',
  lightning: 'lightningResist',
  dark: 'darkResist',
  holy: 'holyResist',
  poison: 'poisonResist',
};

export function calculateWeaponElementalDamage(
  weaponItemId: string | null | undefined,
  statusEffects: StatusEffect[],
  attackerSPI: number,
  attackerINT: number,
  attackerLevel: number,
  targetResists: Record<string, number | undefined>
): ElementalDamageLine[] {
  const lines: ElementalDamageLine[] = [];

  if (weaponItemId) {
    const weaponDef = ITEM_DATABASE[weaponItemId];
    if (weaponDef?.stats.weaponElement && weaponDef.stats.weaponElementPower) {
      const el = weaponDef.stats.weaponElement;
      const basePower = weaponDef.stats.weaponElementPower;
      let damage = Math.floor(
        basePower * (attackerSPI * 0.3 + attackerINT * 0.2 + attackerLevel * 0.2)
      );
      damage = applyResistance(damage, el, targetResists);
      damage = Math.max(1, Math.floor(damage * (0.9 + Math.random() * 0.2)));
      if (damage > 0) {
        lines.push({ element: el, damage });
      }
    }
  }

  for (const effect of statusEffects) {
    if (effect.type === StatusEffectType.WEAPON_AURA && effect.buffData?.weaponAura) {
      const { element, minDamage, maxDamage } = effect.buffData.weaponAura;
      let damage = minDamage + Math.floor(Math.random() * (maxDamage - minDamage + 1));
      damage = applyResistance(damage, element, targetResists);
      if (damage > 0) {
        lines.push({ element, damage });
      }
    }
  }

  return lines;
}

function applyResistance(
  damage: number,
  element: string,
  targetResists: Record<string, number | undefined>
): number {
  const resistKey = ELEMENT_RESIST_KEYS[element];
  if (!resistKey) return damage;
  const resist = targetResists[resistKey] || 0;
  if (resist === 0) return damage;
  const multiplier = resist > 0
    ? 1 - Math.min(0.75, resist / 100)
    : 1 + Math.min(1.0, Math.abs(resist) / 100);
  return Math.floor(damage * multiplier);
}
