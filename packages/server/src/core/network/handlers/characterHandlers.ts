import { Socket } from 'socket.io';
import {
  Packet, PacketType, PlayerSession, Validator,
  JOB_DEFINITIONS, RACE_DATA, createDefaultStatPoints, createDefaultSkillProficiencies, createDefaultSkillAdeptness,
  getDesignJobId, JobId, Race,
  getZoneDefinition, normalizeEquipment,
} from '@dust-saga/shared';
import { NetworkContext, PacketHandler } from '../NetworkContext';

export function registerHandlers(registry: Map<PacketType, PacketHandler>): void {
  registry.set(PacketType.CHARACTER_LIST, handleCharacterList);
  registry.set(PacketType.CHARACTER_CREATE, handleCharacterCreate);
  registry.set(PacketType.CHARACTER_SELECT, handleCharacterSelect);
  registry.set(PacketType.CHARACTER_DELETE, handleCharacterDelete);
}

async function handleCharacterList(ctx: NetworkContext, socket: Socket, _data: any): Promise<void> {
  const playerId = ctx.state.socketToPlayer.get(socket.id);
  if (!playerId) return;

  const characters = await ctx.auth.getCharacters(playerId);

  const characterInfos = characters.map(c => {
    const jobDef = JOB_DEFINITIONS[(c.job_id || c.class) as JobId];
    const raceData = RACE_DATA[(c.race || 'human') as Race];
    return {
      id: c.id,
      name: c.name,
      class: c.class || c.job_id,
      race: c.race || 'human',
      jobId: c.job_id || c.class,
      level: c.level,
      zoneId: c.zone_id || 'starter_zone',
      modelFile: jobDef?.modelFile || 'Adventurer.glb'
    };
  });

  ctx.sendToSocket(socket.id, {
    type: PacketType.CHARACTER_LIST,
    timestamp: Date.now(),
    data: { characters: characterInfos }
  });
}

async function handleCharacterCreate(ctx: NetworkContext, socket: Socket, data: any): Promise<void> {
  const playerId = ctx.state.socketToPlayer.get(socket.id);
  if (!playerId) return;

  if (!Validator.validatePlayerName(data.name)) {
    ctx.sendToSocket(socket.id, {
      type: PacketType.ERROR,
      timestamp: Date.now(),
      data: { message: 'Invalid character name. Use 3-20 alphanumeric characters.' }
    });
    return;
  }

  const result = await ctx.auth.createCharacter(playerId, data.name, data.race || 'human', data.characterClass, data.racialPassive);

  if (result.success) {
    const jobDef = JOB_DEFINITIONS[data.characterClass as JobId];
    ctx.sendToSocket(socket.id, {
      type: PacketType.CHARACTER_CREATE,
      timestamp: Date.now(),
      data: {
        character: {
          id: result.characterId,
          name: data.name,
          class: data.characterClass,
          race: data.race || 'human',
          jobId: data.characterClass,
          level: 1,
          zoneId: 'starter_zone',
          modelFile: jobDef?.modelFile || 'Adventurer.glb'
        }
      }
    });
  } else {
    ctx.sendToSocket(socket.id, {
      type: PacketType.ERROR,
      timestamp: Date.now(),
      data: { message: result.error }
    });
  }
}

async function handleCharacterSelect(ctx: NetworkContext, socket: Socket, data: any): Promise<void> {
  const playerId = ctx.state.socketToPlayer.get(socket.id);
  if (!playerId) return;

  const characters = await ctx.auth.getCharacters(playerId);
  const char = characters.find(c => c.id === data.characterId);
  if (!char) {
    ctx.sendToSocket(socket.id, {
      type: PacketType.ERROR,
      timestamp: Date.now(),
      data: { message: 'Character not found' }
    });
    return;
  }

  const session = ctx.playerSys.createSession(
    playerId,
    socket.id,
    playerId,
    char.id,
    char.name,
    char.race || 'human',
    (char.job_id || char.class) as any,
    char.level,
    char.stat_points ? (typeof char.stat_points === 'string' ? JSON.parse(char.stat_points) : char.stat_points) : createDefaultStatPoints(),
    char.unspent_stat_points || 0,
    char.unspent_skill_points || 0,
    char.skill_proficiencies ? (typeof char.skill_proficiencies === 'string' ? JSON.parse(char.skill_proficiencies) : char.skill_proficiencies) : createDefaultSkillProficiencies(),
    char.skill_adeptness ? (typeof char.skill_adeptness === 'string' ? JSON.parse(char.skill_adeptness) : char.skill_adeptness) : createDefaultSkillAdeptness(getDesignJobId(char.job_id || char.class)),
    char.experience || 0
  );

  session.zoneId = char.zone_id || 'starter_zone';
  session.nation = (char.nation as 'varik' | 'pfelstein' | 'latugan' | null) || null;
  session.lastSafeZoneId = char.last_safe_zone_id || session.zoneId;
  session.gold = char.gold || 100;
  session.racialPassive = char.racial_passive || undefined;

  if (char.inventory) {
    const parsed = typeof char.inventory === 'string' ? JSON.parse(char.inventory) : char.inventory;
    if (Array.isArray(parsed)) session.inventory = parsed;
  }
  if (char.equipment) {
    const parsed = typeof char.equipment === 'string' ? JSON.parse(char.equipment) : char.equipment;
    if (parsed && typeof parsed === 'object') session.equipment = normalizeEquipment(parsed);
  }

  ctx.playerSys.recalcStats(session);

  const zoneDef = getZoneDefinition(session.zoneId);
  if (char.position_x === 0 && char.position_y === 0 && char.position_z === 0) {
    session.position = { ...(zoneDef?.playerSpawn || { x: 0, y: 0, z: 0 }) };
  } else {
    session.position = { x: char.position_x, y: char.position_y, z: char.position_z };
  }

  ctx.state.players.set(session.characterId, session);
  ctx.state.playerToSocket.set(session.characterId, socket.id);
  ctx.state.socketToPlayer.set(socket.id, session.characterId);
  ctx.registerPlayerInZone(session.characterId, session.zoneId);

  ctx.sendToSocket(socket.id, {
    type: PacketType.CHARACTER_SELECT,
    timestamp: Date.now(),
    data: {
      characterId: session.characterId,
      characterName: session.characterName,
      characterClass: session.jobId,
      race: session.race,
      jobId: session.jobId,
      baseClass: session.baseClass,
      stats: session.stats,
      position: session.position,
      rotation: session.rotation,
      zoneId: session.zoneId,
      inventory: session.inventory,
      equipment: session.equipment,
      gold: session.gold,
      quests: session.quests,
      statPoints: session.statPoints,
      unspentStatPoints: session.unspentStatPoints,
      unspentSkillPoints: session.unspentSkillPoints,
      skillProficiencies: session.skillProficiencies,
      skillAdeptness: session.skillAdeptness,
      statBreakdown: session.statBreakdown,
      racialPassive: session.racialPassive
    }
  });

  ctx.sendZoneState(socket, session.zoneId);
  ctx.broadcastInZone(session.zoneId, {
    type: PacketType.ENTITY_SPAWN,
    timestamp: Date.now(),
    data: {
      id: session.characterId,
      type: 'player',
      position: session.position,
      rotation: session.rotation,
      data: { name: session.characterName, class: session.jobId, race: session.race, jobId: session.jobId, level: session.stats.level, health: session.stats.health, maxHealth: session.stats.maxHealth, modelFile: JOB_DEFINITIONS[session.jobId]?.modelFile }
    }
  });
}

async function handleCharacterDelete(ctx: NetworkContext, socket: Socket, data: any): Promise<void> {
  const playerId = ctx.state.socketToPlayer.get(socket.id);
  if (!playerId) return;

  await ctx.auth.deleteCharacter(playerId, data.characterId);
  ctx.sendToSocket(socket.id, {
    type: PacketType.CHARACTER_DELETE,
    timestamp: Date.now(),
    data: { characterId: data.characterId }
  });
}
