export function computeAilmentResist(totalSTA: number, gearBonus: number = 0): number {
  return Math.floor(totalSTA / 28) * 7 + gearBonus;
}

export function computeDisorderResist(totalSPI: number, gearBonus: number = 0): number {
  return Math.floor(totalSPI / 28) * 7 + gearBonus;
}

export function rollAgainstResist(resistPercent: number): boolean {
  if (resistPercent >= 100) return false;
  if (resistPercent <= 0) return true;
  return Math.random() * 100 >= resistPercent;
}
