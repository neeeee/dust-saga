import { Socket } from 'socket.io';
import {
  Packet, PacketType, PlayerSession,
} from '@dust-saga/shared';
import { NetworkContext, PacketHandler } from '../NetworkContext';

export function registerHandlers(registry: Map<PacketType, PacketHandler>): void {
  registry.set(PacketType.ATTACK, handleAttack);
  registry.set(PacketType.MANUAL_ATTACK, handleManualAttack);
}

function handleAttack(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session) return;

  if (data.targetId && ctx.state.players.has(data.targetId) && ctx.isPartyMember(characterId, data.targetId)) return;

  const damageInfo = ctx.combat.processPlayerAttack(
    session,
    data.targetId,
    ctx.spawnMgr.getEnemiesInZone(session.zoneId) || new Map(),
    ctx.state.players
  );

  if (damageInfo) {
    session.lastAttackTime = Date.now();

    const enemy = ctx.spawnMgr.getEnemy(data.targetId);
    const player = ctx.state.players.get(data.targetId);

    if (player && data.targetId !== characterId) {
      const totalAutoDmg = damageInfo.damage + (damageInfo.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
      const autoDmgResult = ctx.applyPlayerDamage(player, totalAutoDmg, characterId, damageInfo.damageType || 'physical', damageInfo.isCritical || false, session.zoneId, session.position);
      ctx.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { ...damageInfo, damage: autoDmgResult.redirected ? 0 : autoDmgResult.damageTaken, missed: autoDmgResult.redirected ? true : damageInfo.missed }
      });
      if (!autoDmgResult.redirected) {
        ctx.sendToPlayer(data.targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: data.targetId, stats: player.stats, statBreakdown: player.statBreakdown, skillProficiencies: player.skillProficiencies, skillAdeptness: player.skillAdeptness }
        });
        if (player.stats.health <= 0) {
          ctx.handlePlayerDeath(player);
        }
      }
    } else {
      ctx.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: damageInfo
      });
    }

    if (enemy) {
      if (damageInfo.elementalDamage) {
        for (const el of damageInfo.elementalDamage) {
          ctx.damageEnemy(enemy, el.damage, characterId);
        }
      }
      if (!damageInfo.missed && damageInfo.damage > 0) {
        ctx.enmity.addDamageEnmity(enemy, characterId, damageInfo.damage);
      } else if (damageInfo.missed) {
        ctx.enmity.addEnmity(enemy, characterId, 50, 0);
      }
      ctx.broadcastInZone(session.zoneId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { entityId: data.targetId, health: enemy.health, maxHealth: enemy.maxHealth }
      });
    }
  }
}

function handleManualAttack(ctx: NetworkContext, socket: Socket, data: any): void {
  const characterId = ctx.findCharacterBySocket(socket.id);
  if (!characterId) return;

  const session = ctx.state.players.get(characterId);
  if (!session || session.isDead) return;

  const zoneEnemies = ctx.spawnMgr.getEnemiesInZone(session.zoneId) || new Map();
  const zonePlayerBuf = new Map<string, PlayerSession>();
  ctx.forEachPlayerInZone(session.zoneId, (id, p) => zonePlayerBuf.set(id, p));

  const results = ctx.combat.processManualAttack(
    session,
    data.facingAngle,
    zoneEnemies,
    zonePlayerBuf
  ).filter((r: any) => !ctx.state.players.has(r.targetId) || r.targetId === characterId || !ctx.isPartyMember(characterId, r.targetId));

  for (const info of results) {
    const enemy = ctx.spawnMgr.getEnemy(info.targetId);
    const pTarget = ctx.state.players.get(info.targetId);

    if (pTarget && info.targetId !== characterId) {
      const manualTotal = info.damage + (info.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
      const manualDmgResult = ctx.applyPlayerDamage(pTarget, manualTotal, characterId, info.damageType || 'physical', info.isCritical || false, session.zoneId, session.position);
      ctx.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { ...info, damage: manualDmgResult.redirected ? 0 : manualDmgResult.damageTaken, missed: manualDmgResult.redirected ? true : info.missed }
      });
      if (!manualDmgResult.redirected) {
        ctx.sendToPlayer(info.targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: info.targetId, stats: pTarget.stats, statBreakdown: pTarget.statBreakdown, skillProficiencies: pTarget.skillProficiencies, skillAdeptness: pTarget.skillAdeptness }
        });
        if (pTarget.stats.health <= 0) {
          ctx.handlePlayerDeath(pTarget);
        }
      }
    } else {
      ctx.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: info
      });
    }

    if (enemy) {
      if (!info.missed && info.damage > 0) {
        const manualTotalDmg = info.damage + (info.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
        ctx.enmity.addDamageEnmity(enemy, characterId, manualTotalDmg);
      } else if (info.missed) {
        ctx.enmity.addEnmity(enemy, characterId, 50, 0);
      }
      ctx.broadcastInZone(session.zoneId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { entityId: info.targetId, health: enemy.health, maxHealth: enemy.maxHealth }
      });
    }
  }
}
