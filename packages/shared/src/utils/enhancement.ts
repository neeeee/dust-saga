const ELEMENT_PREFIXES: Record<string, string> = {
  fire: 'Flaming',
  ice: 'Icy',
  lightning: 'Thunderous',
  holy: 'Blessed',
  dark: 'Darkened',
  poison: 'Poisonous',
};

export function getEnhancedItemName(
  baseName: string,
  enhancementLevel?: number,
  enhancementElement?: string
): string {
  const prefix = enhancementElement ? (ELEMENT_PREFIXES[enhancementElement] || '') : '';
  const suffix = enhancementLevel ? ` +${enhancementLevel}` : '';
  return prefix ? `${prefix} ${baseName}${suffix}` : `${baseName}${suffix}`;
}
