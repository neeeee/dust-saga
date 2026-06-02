import { PacketType } from '@dust-saga/shared';
import { PacketHandler } from '../NetworkContext';
import { registerHandlers as registerAuth } from './authHandlers';
import { registerHandlers as registerCharacter } from './characterHandlers';
import { registerHandlers as registerMovement } from './movementHandlers';
import { registerHandlers as registerCombat } from './combatHandlers';
import { registerHandlers as registerSkill } from './skillHandlers';
import { registerHandlers as registerChat } from './chatHandlers';
import { registerHandlers as registerInventory } from './inventoryHandlers';
import { registerHandlers as registerQuest } from './questHandlers';
import { registerHandlers as registerNPC } from './npcHandlers';
import { registerHandlers as registerZone } from './zoneHandlers';
import { registerHandlers as registerStat } from './statHandlers';
import { registerHandlers as registerParty } from './partyHandlers';
import { registerHandlers as registerDeath } from './deathHandlers';
import { registerHandlers as registerEnhancement } from './enhancementHandlers';

export function registerAllHandlers(): Map<PacketType, PacketHandler> {
  const registry = new Map<PacketType, PacketHandler>();

  registerAuth(registry);
  registerCharacter(registry);
  registerMovement(registry);
  registerCombat(registry);
  registerSkill(registry);
  registerChat(registry);
  registerInventory(registry);
  registerQuest(registry);
  registerNPC(registry);
  registerZone(registry);
  registerStat(registry);
  registerParty(registry);
  registerDeath(registry);
  registerEnhancement(registry);

  return registry;
}
