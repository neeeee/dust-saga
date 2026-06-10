import { Socket } from 'socket.io';
import {
  Packet, PacketType,
  getItem, applyRacialPotionHealing,
} from '@dust-saga/shared';
import { NetworkContext, PacketHandler } from '../NetworkContext';

export function registerHandlers(registry: Map<PacketType, PacketHandler>): void {
  registry.set(PacketType.ITEM_USE, handleItemUse);
  registry.set(PacketType.EQUIP_ITEM, handleEquipItem);
  registry.set(PacketType.UNEQUIP_ITEM, handleUnequipItem);
  registry.set(PacketType.LOOT_PICKUP, handleLootPickup);
  registry.set(PacketType.ITEM_DROP, handleItemDrop);
}

function handleItemUse(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  const itemDef = getItem(data.itemId);
  if (!itemDef) return;

  const invSlot = session.inventory.find(s => s.itemId === data.itemId);
  if (!invSlot) return;

  if (itemDef.type === 'consumable') {
    if (itemDef.stats.health && itemDef.type === 'consumable') {
      session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + applyRacialPotionHealing(session.racialPassive, itemDef.stats.health || 0));
    }
    if (itemDef.stats.mana && itemDef.type === 'consumable') {
      session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + applyRacialPotionHealing(session.racialPassive, itemDef.stats.mana || 0));
    }

    ctx.playerSys.removeItemFromInventory(session, data.itemId, 1);
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
    });
  }
}

function handleEquipItem(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  if (ctx.playerSys.equipItem(session, data.itemId)) {
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
    });
  }
}

function handleUnequipItem(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  if (ctx.playerSys.unequipItem(session, data.slot)) {
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
    });
  }
}

function handleLootPickup(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  const lootInstance = ctx.loot.getLootById(data.lootId);
  if (!lootInstance) return;

  const dx = session.position.x - lootInstance.position.x;
  const dz = session.position.z - lootInstance.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > 5) return;

  const lootResult = ctx.loot.pickupLoot(data.lootId, characterId);
  if (!lootResult) return;

  const added = ctx.playerSys.addItemToInventory(session, lootResult.itemId, lootResult.quantity);
  if (added) {
    ctx.questSys.onItemCollect(session, lootResult.itemId);
    ctx.sendToPlayer(characterId, {
      type: PacketType.LOOT_PICKUP,
      timestamp: Date.now(),
      data: { lootId: data.lootId, itemId: lootResult.itemId, quantity: lootResult.quantity }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
  }
}

function handleItemDrop(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  const { itemId, quantity } = data;
  if (!itemId || quantity <= 0) return;

  const removed = ctx.playerSys.removeItemFromInventory(session, itemId, quantity);
  if (removed) {
    const itemDef = getItem(itemId);
    const name = itemDef?.name || itemId;
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.NOTIFICATION,
      timestamp: Date.now(),
      data: { message: `Trashed ${name}${quantity > 1 ? ` x${quantity}` : ''}.`, type: 'info' }
    });
  }
}
