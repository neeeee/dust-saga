import { Socket } from 'socket.io';
import {
  Packet, PacketType, ZoneType, JOB_DEFINITIONS, getZoneDefinition,
} from '@dust-saga/shared';
import { NetworkContext, PacketHandler } from '../NetworkContext';

export function registerHandlers(registry: Map<PacketType, PacketHandler>): void {
  registry.set(PacketType.ENTER_ZONE, handleEnterZone);
}

function handleEnterZone(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  const targetZone = getZoneDefinition(data.zoneId);
  if (!targetZone) return;

  ctx.broadcastInZone(session.zoneId, {
    type: PacketType.ENTITY_DESPAWN,
    timestamp: Date.now(),
    data: { entityId: characterId }
  });

  session.zoneId = data.zoneId;
  ctx.movePlayerToZone(characterId, data.zoneId);
  if (targetZone.type === ZoneType.SAFE || targetZone.type === ZoneType.NATION) {
    session.lastSafeZoneId = data.zoneId;
  }
  session.position = { ...targetZone.playerSpawn };
  session.invulnerableUntil = Date.now() + 3000;

  ctx.broadcastInZone(data.zoneId, {
    type: PacketType.ENTITY_SPAWN,
    timestamp: Date.now(),
    data: {
      id: characterId,
      type: 'player',
      position: session.position,
      rotation: session.rotation,
      data: { name: session.characterName, class: session.jobId, race: session.race, jobId: session.jobId, level: session.stats.level, health: session.stats.health, maxHealth: session.stats.maxHealth, modelFile: JOB_DEFINITIONS[session.jobId]?.modelFile }
    }
  }, characterId);

  ctx.sendZoneState(socket, data.zoneId);

  ctx.sendToPlayer(characterId, {
    type: PacketType.ENTER_ZONE,
    timestamp: Date.now(),
    data: { zoneId: data.zoneId, position: session.position }
  });
}
