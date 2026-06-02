import { Socket } from 'socket.io';
import {
  Packet, PacketType, getQuest,
} from '@dust-saga/shared';
import { NetworkContext, PacketHandler } from '../NetworkContext';

export function registerHandlers(registry: Map<PacketType, PacketHandler>): void {
  registry.set(PacketType.QUEST_ACCEPT, handleQuestAccept);
  registry.set(PacketType.QUEST_COMPLETE, handleQuestComplete);
  registry.set(PacketType.QUEST_ABANDON, handleQuestAbandon);
}

function handleQuestAccept(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  if (ctx.questSys.acceptQuest(session, data.questId)) {
    ctx.sendToPlayer(characterId, {
      type: PacketType.QUEST_ACCEPT,
      timestamp: Date.now(),
      data: { questId: data.questId, quest: session.quests.find(q => q.questId === data.questId) }
    });
  }
}

function handleQuestComplete(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  const rewards = ctx.questSys.completeQuest(session, data.questId);
  if (rewards) {
    ctx.playerSys.grantExperience(session, rewards.experience);
    rewards.items.forEach(item => {
      ctx.playerSys.addItemToInventory(session, item.itemId, item.quantity);
    });

    ctx.sendToPlayer(characterId, {
      type: PacketType.QUEST_COMPLETE,
      timestamp: Date.now(),
      data: { questId: data.questId, rewards }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
    ctx.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats }
    });
  }
}

function handleQuestAbandon(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  ctx.questSys.abandonQuest(session, data.questId);
  ctx.sendToPlayer(characterId, {
    type: PacketType.QUEST_ABANDON,
    timestamp: Date.now(),
    data: { questId: data.questId }
  });
}
