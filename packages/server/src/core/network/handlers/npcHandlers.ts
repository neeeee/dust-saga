import { Socket } from 'socket.io';
import {
  Packet, PacketType, NPC_DATABASE, getNPCsInZone, getItem, NATION_ZONE_MAP, getZoneDefinition,
} from '@dust-saga/shared';
import { NetworkContext, PacketHandler } from '../NetworkContext';

export function registerHandlers(registry: Map<PacketType, PacketHandler>): void {
  registry.set(PacketType.NPC_INTERACT, handleNPCInteract);
  registry.set(PacketType.NPC_SHOP_BUY, handleShopBuy);
  registry.set(PacketType.NPC_DIALOG_CLOSE, handleNpcDialogClose);
}

function handleNPCInteract(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  const npc = NPC_DATABASE[data.npcId];
  if (!npc) return;

  const dx = session.position.x - npc.position.x;
  const dz = session.position.z - npc.position.z;
  if (Math.sqrt(dx * dx + dz * dz) > 5) return;

  session.currentNpcId = data.npcId;

  let dialog = npc.dialogs.find(d => d.id === (data.dialogId || 'greeting'));
  if (!dialog) dialog = npc.dialogs[0];

  const questsForNpc = npc.quests || [];
  const availableQuests = ctx.questSys.getAvailableQuests(session).filter(q => questsForNpc.includes(q));

  ctx.sendToPlayer(characterId, {
    type: PacketType.NPC_DIALOG,
    timestamp: Date.now(),
    data: {
      npcId: data.npcId,
      npcName: npc.name,
      dialog,
      shopItems: npc.type === 'merchant' || npc.type === 'blacksmith' ? (npc.shopItems || []).map(id => getItem(id)).filter(Boolean) : undefined,
      availableQuests
    }
  });

  if (data.dialogId === 'join_nation') {
    const nationOption = dialog.options?.find(o => o.action === 'join_nation');
    if (nationOption?.actionData?.nation) {
      session.nation = nationOption.actionData.nation as 'varik' | 'pfelstein' | 'latugan';
      const nationInfo = NATION_ZONE_MAP[session.nation];
      if (nationInfo) {
        const nationZoneDef = getZoneDefinition(nationInfo.zoneId);
        session.lastSafeZoneId = nationInfo.zoneId;
        ctx.sendToPlayer(characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `You have joined the ${nationZoneDef?.name || session.nation}! You will now respawn here when you die.`, channel: 'system' }
        });
      }
    }
  }
}

function handleNpcDialogClose(ctx: NetworkContext, socket: Socket, _data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  session.currentNpcId = null;
}

function handleShopBuy(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  if (ctx.tradeSys.isInTrade(characterId)) return;

  const itemDef = getItem(data.itemId);
  if (!itemDef) return;

  const qty = data.quantity || 1;
  const cost = (itemDef.sellPrice || 0) * 2 * qty;
  if (cost > 0 && session.gold < cost) {
    ctx.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: `Not enough gold. Need ${cost}g, have ${session.gold}g.`, type: 'error' } });
    return;
  }

  const added = ctx.playerSys.addItemToInventory(session, data.itemId, qty);
  if (added) {
    session.gold -= cost;
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment, gold: session.gold }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.NOTIFICATION,
      timestamp: Date.now(),
      data: { message: `Purchased ${itemDef.name}${qty > 1 ? ` x${qty}` : ''} for ${cost}g`, type: 'success' }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats }
    });
  }
}
