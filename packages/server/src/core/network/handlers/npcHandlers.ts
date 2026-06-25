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

  const talkProgress = ctx.questSys.onTalk(session, data.npcId);
  if (talkProgress.progressed.length > 0) {
    const msgs = talkProgress.completed.map(qid => {
      const def = ctx.questSys.getQuestDefinition(qid);
      return `Quest "${def?.title || qid}" completed! Return to the NPC.`;
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.QUEST_PROGRESS,
      timestamp: Date.now(),
      data: { quests: session.quests, message: msgs.join('\n') }
    });
  }

  let dialog = npc.dialogs.find(d => d.id === (data.dialogId || 'greeting'));
  if (!dialog) dialog = npc.dialogs[0];

  const staticQuestIds = npc.quests || [];
  const availableQuests = ctx.questSys.getAvailableQuests(session)
    .filter(qid => {
      const def = ctx.questSys.getQuestDefinition(qid);
      return def?.npcId === data.npcId || staticQuestIds.includes(qid);
    })
    .map(qid => {
      const def = ctx.questSys.getQuestDefinition(qid)!;
      return {
        id: qid,
        title: def.title,
        description: def.description || '',
        offerDialog: def.offerDialog,
        rewards: def.rewards,
        requiredLevel: def.requiredLevel,
      };
    });

  const activeQuests = session.quests
    .filter(sq => {
      const def = ctx.questSys.getQuestDefinition(sq.questId);
      if (!def) return false;
      return def.npcId === data.npcId || staticQuestIds.includes(sq.questId);
    })
    .map(sq => {
      const def = ctx.questSys.getQuestDefinition(sq.questId)!;
      return {
        id: sq.questId,
        title: sq.title || def.title,
        description: sq.description || def.description,
        status: sq.status,
        objectives: sq.objectives.map(o => ({
          id: o.id,
          type: o.type,
          targetName: o.targetName,
          requiredCount: o.requiredCount,
          currentCount: o.currentCount,
          cell: o.cell,
          waypoint: o.waypoint,
        })),
        inProgressDialog: def.inProgressDialog,
        turnInDialog: def.turnInDialog,
        rewards: def.rewards,
        turnInReady: sq.status === 'completed',
      };
    });

  ctx.sendToPlayer(characterId, {
    type: PacketType.NPC_DIALOG,
    timestamp: Date.now(),
    data: {
      npcId: data.npcId,
      npcName: npc.name,
      dialog,
      shopItems: npc.type === 'merchant' || npc.type === 'blacksmith' ? (npc.shopItems || []).map(id => getItem(id)).filter(Boolean) : undefined,
      availableQuests,
      activeQuests
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
