import { Socket } from 'socket.io';
import {
  Packet, PacketType, PlayerSession,
  StatType, JobId, Race,
  SKILL_TARGET_RULES, SkillTargetType,
  StatusEffectType, StatusEffect, EnemyInstance,
  PartyVisibility, LootRule, MAX_LOOT_POOL,
} from '@dust-saga/shared';
import { AuthManager } from '../auth/AuthManager';
import { CombatSystem } from '../ecs/systems/CombatSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { LootSystem } from '../ecs/systems/LootSystem';
import { PlayerSystem } from '../ecs/systems/PlayerSystem';
import { SkillSystem } from '../ecs/systems/SkillSystem';
import { PartySystem } from '../ecs/systems/PartySystem';
import { SpawnManager } from '../world/SpawnManager';
import { QuestSystem } from '../../systems/QuestSystem';

export interface ServerGameState {
  players: Map<string, PlayerSession>;
  socketToPlayer: Map<string, string>;
  playerToSocket: Map<string, string>;
}

export type PacketHandler = (ctx: NetworkContext, socket: Socket, data: any) => void | Promise<void>;

export interface NetworkContext {
  readonly state: ServerGameState;
  readonly auth: AuthManager;
  readonly combat: CombatSystem;
  readonly ai: AISystem;
  readonly loot: LootSystem;
  readonly playerSys: PlayerSystem;
  readonly skillSys: SkillSystem;
  readonly partySys: PartySystem;
  readonly spawnMgr: SpawnManager;
  readonly questSys: QuestSystem;

  findCharacterBySocket(socketId: string): string | undefined;
  findPlayerByCharacterId(characterId: string): PlayerSession | undefined;
  findZoneOfEntity(entityId: string): string;
  findZoneOfEnemy(enemyId: string): string | undefined;
  sendToSocket(socketId: string, packet: Packet): void;
  sendToPlayer(characterId: string, packet: Packet): void;
  broadcastInZone(zoneId: string, packet: Packet, excludeCharacterId?: string): void;
  sendZoneState(socket: Socket, zoneId: string, includePlayerId?: string): void;

  isPartyMember(characterId: string, targetId: string): boolean;
  refreshPartyForMember(characterId: string): void;
  sendPartyUpdate(partyId: string): void;
  broadcastEntityEffects(session: PlayerSession): void;

  handlePlayerDeath(session: PlayerSession): void;
  handleEnemyKill(enemyId: string, killerId: string): void;
  handleRevivePlayerBySession(caster: PlayerSession, targetId: string): void;
  applyPlayerDamage(target: PlayerSession, damage: number, attackerId: string, damageType: string, isCritical: boolean, zoneId: string, attackerPosition?: { x: number; y: number; z: number }): { redirected: boolean; damageTaken: number };
  damageEnemy(enemy: EnemyInstance, damage: number): { died: boolean; actualDamage: number };
  getEnemyEffectiveDefense(enemy: EnemyInstance): number;
  sendDamageDebug(session: PlayerSession, result: { debugCalc?: string }): void;
  getTargetStatsForEntity(id: string): {
    defense: number;
    magicDefense: number;
    health: number;
    level: number;
    dodge: number;
    damageTakenMultiplier?: number;
    physicalDamageReduction?: number;
    fireResist?: number;
    iceResist?: number;
    lightningResist?: number;
    darkResist?: number;
    holyResist?: number;
    poisonResist?: number;
  } | null;

  findClosestEntityToPosition(session: PlayerSession, pos: { x: number; y: number; z: number }, radius: number): { id: string; distance: number } | null;
  findAllEntitiesInRadius(session: PlayerSession, pos: { x: number; y: number; z: number }, radius: number): Array<{ id: string; distance: number }>;
  applyAOEDamageToTargets(session: PlayerSession, skillName: string, aoePosition: { x: number; y: number; z: number }, aoeRadius: number, primaryResult?: any): void;
  applySingleTargetSkillDamage(session: PlayerSession, skillName: string, targetId: string, result: any): void;
  spawnAOEZone(session: PlayerSession, skillName: string, position: { x: number; y: number; z: number }, radius: number): void;
  executeAOESkillInternal(session: PlayerSession, skillName: string, aoePosition: { x: number; y: number; z: number }): void;
  consumeDebuffsOnHit(targetSession: PlayerSession): void;
  shouldApplyDebuff(effect: StatusEffect, targetId: string, casterId?: string): boolean;
  hasActiveDebuff(targetId: string, effectType: StatusEffectType, skillName?: string): boolean;
  removeBlockingProtectedBuffs(blockerId: string): void;
  removeSongProximityBuffs(caster: PlayerSession): void;
  applySongPulseImmediate(caster: PlayerSession): void;

  spawnDummy(session: PlayerSession): void;
  despawnDummy(dummyId: string, session: PlayerSession): void;
  setDummyProperty(dummyId: string, prop: string, value: string, session: PlayerSession): void;
  setDummyClass(dummyId: string, jobIdStr: string, session: PlayerSession): void;
  setDummyGear(dummyId: string, preset: string, session: PlayerSession): void;
  toggleDummyPvp(dummyId: string, session: PlayerSession): void;
  toggleDummyWalk(dummyId: string, session: PlayerSession): void;
  toggleDummyParty(dummyId: string, session: PlayerSession): void;
  readonly dummyMeta: Map<string, {
    ownerId: string;
    isPvp: boolean;
    isWalking: boolean;
    walkPoints: Array<{ x: number; y: number; z: number }>;
    walkIndex: number;
    walkDir: number;
    inParty: boolean;
  }>;
}
