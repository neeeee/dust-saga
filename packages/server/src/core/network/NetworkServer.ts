import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  Packet, PacketType, PlayerSession, Validator,
  JOB_DEFINITIONS, RACE_DATA, createDefaultStatPoints, createDefaultSkillProficiencies, createDefaultSkillAdeptness,
  getBaseClassForJob, calculateDerivedStats, getExperienceToNextLevel, getStatPointsGainedAtLevel,
  getSkillPointsGainedAtLevel, MAX_LEVEL,
  getDesignJobId,
  StatType, JobId, Race, processRacialOnDamage, applyRacialPotionHealing,
  getAdvancementOptions, BaseClass,
  REGEN_CONFIG, SKILL_TARGET_RULES, SkillTargetType, SkillType,
  PartyVisibility, LootRule, MAX_LOOT_POOL,
  GROUND_TARGETED_AOE_SKILLS, DEFAULT_AOE_RADIUS,
  StatusEffectType, StatusEffect, EnemyInstance,
  BuffData, resolveStatTieredValue,
  getEffectiveStats,
  computeAilmentResist, computeDisorderResist, computeDebuffAccuracy, rollDebuffApplication,
  calculateWeaponElementalDamage,
  calculateDodge,
  calculateHitChance,
  NATION_ZONE_MAP,
  ZoneType,
  normalizeEquipment,
  getEnemyDefinition, getZoneDefinition, NPC_DATABASE, getNPCsInZone, getItem, getQuest, QUEST_DATABASE, ITEM_DATABASE,
  SpatialHash, SpatialEntry,
  SUMMON_STATS, BANISH_RADIUS,
} from '@dust-saga/shared';
import { AuthManager } from '../auth/AuthManager';
import { CombatSystem } from '../ecs/systems/CombatSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { LootSystem } from '../ecs/systems/LootSystem';
import { PlayerSystem } from '../ecs/systems/PlayerSystem';
import { SkillSystem } from '../ecs/systems/SkillSystem';
import { PartySystem } from '../ecs/systems/PartySystem';
import { EnmitySystem } from '../ecs/systems/EnmitySystem';
import { SpawnManager } from '../world/SpawnManager';
import { SummonManager } from '../world/SummonManager';
import { QuestSystem } from '../../systems/QuestSystem';
import { v4 as uuidv4 } from 'uuid';
import { NetworkContext, ServerGameState, PacketHandler } from './NetworkContext';
import { registerAllHandlers } from './handlers';

const STA_DEBUFF_CATEGORIES = new Set(['ailment', 'stun', 'trip', 'knockdown', 'knockback', 'bleed']);
const SPI_DEBUFF_CATEGORIES = new Set(['disorder', 'freeze', 'burn', 'curse', 'sleep', 'weakness', 'weaken']);

export class NetworkServer implements NetworkContext {
  private io: SocketIOServer;
  readonly auth: AuthManager;
  readonly combat: CombatSystem;
  readonly ai: AISystem;
  readonly loot: LootSystem;
  readonly playerSys: PlayerSystem;
  readonly skillSys: SkillSystem;
  readonly partySys: PartySystem;
  readonly enmity: EnmitySystem;
  readonly spawnMgr: SpawnManager;
  readonly summonMgr: SummonManager;
  readonly questSys: QuestSystem;
  readonly state: ServerGameState;
  private tickRate: number = 30;
  private handlers: Map<PacketType, PacketHandler>;

  private activeAOEZones: Map<string, {
    id: string;
    casterId: string;
    zoneId: string;
    skillName: string;
    position: { x: number; y: number; z: number };
    radius: number;
    pulseInterval: number;
    remainingPulses: number;
    lastPulseAt: number;
    expiresAt: number;
    entitiesInside: Map<string, number>;
  }> = new Map();

  readonly dummyMeta: Map<string, {
    ownerId: string;
    isPvp: boolean;
    isWalking: boolean;
    walkPoints: Array<{ x: number; y: number; z: number }>;
    walkIndex: number;
    walkDir: number;
    inParty: boolean;
  }> = new Map();
  private dummyCounter: number = 0;

  private zonePlayerIndex: Map<string, Set<string>> = new Map();

  private lastMoveBroadcast: Map<string, number> = new Map();

  private playerSpatialHash = new SpatialHash<PlayerSession>(8);
  private enemySpatialHash = new SpatialHash<EnemyInstance>(8);
  static readonly INTEREST_RADIUS = 50;
  static readonly INTEREST_RADIUS_SQ = 50 * 50;
  private aiTickBucket: number = 0;
  private readonly AI_TICK_STAGGER = 4;

  private addToZonePlayerIndex(zoneId: string, characterId: string): void {
    let set = this.zonePlayerIndex.get(zoneId);
    if (!set) {
      set = new Set();
      this.zonePlayerIndex.set(zoneId, set);
    }
    set.add(characterId);
  }

  private removeFromZonePlayerIndex(characterId: string): void {
    for (const [, set] of this.zonePlayerIndex) {
      set.delete(characterId);
    }
  }

  private movePlayerZoneIndex(characterId: string, newZoneId: string): void {
    this.removeFromZonePlayerIndex(characterId);
    this.addToZonePlayerIndex(newZoneId, characterId);
  }

  constructor(httpServer: any) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.auth = AuthManager.getInstance();
    this.combat = new CombatSystem({ getEntity: () => undefined, getEntitiesWithComponent: () => [], getAllEntities: () => [], addComponent: () => {}, removeComponent: () => {}, createEntity: () => ({ id: '', components: new Map() }), removeEntity: () => {} } as any);
    this.ai = new AISystem({ getEntity: () => undefined, getEntitiesWithComponent: () => [], getAllEntities: () => [], addComponent: () => {}, removeComponent: () => {}, createEntity: () => ({ id: '', components: new Map() }), removeEntity: () => {} } as any);
    this.loot = new LootSystem({ getEntity: () => undefined, getEntitiesWithComponent: () => [], getAllEntities: () => [], addComponent: () => {}, removeComponent: () => {}, createEntity: () => ({ id: '', components: new Map() }), removeEntity: () => {} } as any);
    this.playerSys = new PlayerSystem({ getEntity: () => undefined, getEntitiesWithComponent: () => [], getAllEntities: () => [], addComponent: () => {}, removeComponent: () => {}, createEntity: () => ({ id: '', components: new Map() }), removeEntity: () => {} } as any);
    this.skillSys = new SkillSystem();
    this.partySys = new PartySystem();
    this.enmity = new EnmitySystem();
    this.ai.enmitySys = this.enmity;
    this.spawnMgr = new SpawnManager();
    this.summonMgr = new SummonManager();
    this.questSys = new QuestSystem();
    this.state = {
      players: new Map(),
      socketToPlayer: new Map(),
      playerToSocket: new Map()
    };

    this.handlers = registerAllHandlers();

    this.setupCallbacks();
    this.setupEventHandlers();
    this.setupPlayerCallbacks();
  }

  findCharacterBySocket(socketId: string): string | undefined {
    return this.state.socketToPlayer.get(socketId);
  }

  findPlayerByCharacterId(characterId: string): PlayerSession | undefined {
    return this.state.players.get(characterId);
  }

  findZoneOfEntity(entityId: string): string {
    const enemyZone = this.spawnMgr.findZoneOfEnemy(entityId);
    if (enemyZone) return enemyZone;
    for (const [, session] of this.state.players) {
      if (session.characterId === entityId) return session.zoneId;
    }
    return 'starter_zone';
  }

  findZoneOfEnemy(enemyId: string): string | undefined {
    return this.spawnMgr.findZoneOfEnemy(enemyId);
  }

  sendToSocket(socketId: string, packet: Packet): void {
    this.io.to(socketId).emit('packet', packet);
  }

  registerPlayerInZone(characterId: string, zoneId: string): void {
    this.addToZonePlayerIndex(zoneId, characterId);
    this.insertPlayerSpatial(characterId);
    const socketId = this.state.playerToSocket.get(characterId);
    if (socketId) {
      this.io.of('/').sockets.get(socketId)?.join(`zone:${zoneId}`);
    }
  }

  unregisterPlayerFromZone(characterId: string): void {
    const zoneId = this.getZoneIdForCharacter(characterId);
    this.removeFromZonePlayerIndex(characterId);
    this.removePlayerSpatial(characterId);
    if (zoneId) {
      const socketId = this.state.playerToSocket.get(characterId);
      if (socketId) {
        this.io.of('/').sockets.get(socketId)?.leave(`zone:${zoneId}`);
      }
    }
  }

  movePlayerToZone(characterId: string, newZoneId: string): void {
    const oldZoneId = this.getZoneIdForCharacter(characterId);
    const socketId = this.state.playerToSocket.get(characterId);
    if (socketId) {
      if (oldZoneId) {
        this.io.of('/').sockets.get(socketId)?.leave(`zone:${oldZoneId}`);
      }
      this.io.of('/').sockets.get(socketId)?.join(`zone:${newZoneId}`);
    }
    this.movePlayerZoneIndex(characterId, newZoneId);
  }

  private getZoneIdForCharacter(characterId: string): string | undefined {
    for (const [zoneId, set] of this.zonePlayerIndex) {
      if (set.has(characterId)) return zoneId;
    }
    return undefined;
  }

  forEachPlayerInZone(zoneId: string, cb: (id: string, player: PlayerSession) => void): void {
    const ids = this.zonePlayerIndex.get(zoneId);
    if (!ids) return;
    for (const id of ids) {
      const p = this.state.players.get(id);
      if (p) cb(id, p);
    }
  }

  sendToPlayer(characterId: string, packet: Packet): void {
    const socketId = this.state.playerToSocket.get(characterId);
    if (socketId) {
      this.sendToSocket(socketId, packet);
    }
  }

  broadcastInZone(zoneId: string, packet: Packet, excludeCharacterId?: string): void {
    if (excludeCharacterId) {
      const excludeSocket = this.state.playerToSocket.get(excludeCharacterId);
      if (excludeSocket) {
        this.io.to(`zone:${zoneId}`).except(excludeSocket).emit('packet', packet);
      } else {
        this.io.to(`zone:${zoneId}`).emit('packet', packet);
      }
    } else {
      this.io.to(`zone:${zoneId}`).emit('packet', packet);
    }
  }

  broadcastEntityEffects(session: PlayerSession): void {
    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_STATUS_EFFECTS,
      timestamp: Date.now(),
      data: { entityId: session.characterId, effects: session.statusEffects }
    }, session.characterId);
  }

  updatePlayerSpatialPosition(characterId: string, position: { x: number; z: number }): void {
    const session = this.state.players.get(characterId);
    if (session) {
      this.playerSpatialHash.move(characterId, position.x, position.z);
    }
  }

  insertPlayerSpatial(characterId: string): void {
    const session = this.state.players.get(characterId);
    if (session?.position) {
      this.playerSpatialHash.insert(characterId, session.position.x, session.position.z, session);
    }
  }

  removePlayerSpatial(characterId: string): void {
    this.playerSpatialHash.remove(characterId);
  }

  insertEnemySpatial(enemy: EnemyInstance): void {
    if (enemy.state !== 'dead') {
      this.enemySpatialHash.insert(enemy.id, enemy.position.x, enemy.position.z, enemy);
    }
  }

  removeEnemySpatial(enemyId: string): void {
    this.enemySpatialHash.remove(enemyId);
  }

  queryEnemiesNear(x: number, z: number, radius: number, zoneId: string): SpatialEntry<EnemyInstance>[] {
    return this.enemySpatialHash.queryRadius(x, z, radius).filter(e => {
      if (e.data.state === 'dead') return false;
      const eZone = this.spawnMgr.findZoneOfEnemy(e.id);
      return eZone === zoneId;
    });
  }

  queryPlayersNear(x: number, z: number, radius: number, zoneId: string): SpatialEntry<PlayerSession>[] {
    return this.playerSpatialHash.queryRadius(x, z, radius).filter(e => {
      if (e.data.isDead) return false;
      return e.data.zoneId === zoneId;
    });
  }

  isPartyMember(characterId: string, targetId: string): boolean {
    const party = this.partySys.getPartyForMember(characterId);
    if (!party) return false;
    return party.members.some(m => m.characterId === targetId);
  }

  refreshPartyForMember(characterId: string): void {
    const partyId = this.partySys.getPartyForMember(characterId)?.partyId;
    if (!partyId) return;
    const session = this.state.players.get(characterId);
    if (session) this.partySys.updateMemberStats(characterId, session);
    this.sendPartyUpdate(partyId);
  }

  sendPartyUpdate(partyId: string): void {
    const partyData = this.partySys.getPartyData(partyId);
    if (!partyData) return;

    const pool = this.partySys.getLootPool(partyId);
    for (const member of partyData.members) {
      this.sendToPlayer(member.characterId, {
        type: PacketType.PARTY_UPDATE,
        timestamp: Date.now(),
        data: {
          partyId: partyData.partyId,
          leaderId: partyData.leaderId,
          members: partyData.members,
          settings: partyData.settings,
          lootPool: pool
        }
      });
    }
  }

  handlePlayerDeath(session: PlayerSession): void {
    session.stats.health = 0;
    session.isDead = true;
    session.deathTime = Date.now();
    session.activeCast = null;

    this.spawnMgr.iterateAllEnemies(enemy => {
      if (enemy.targetId === session.characterId) {
        this.enmity.removePlayer(enemy, session.characterId);
        const topTarget = this.enmity.getTopTarget(enemy);
        if (topTarget) {
          enemy.targetId = topTarget.characterId;
          if (enemy.state === 'return') {
            enemy.state = 'chase';
          }
        } else {
          enemy.state = 'return';
          enemy.targetId = null;
        }
      } else if (enemy.enmityTable?.[session.characterId]) {
        this.enmity.removePlayer(enemy, session.characterId);
      }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.DEATH,
      timestamp: Date.now(),
      data: { entityId: session.characterId, isDead: true }
    });

    this.broadcastInZone(session.zoneId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { entityId: session.characterId, health: 0, maxHealth: session.stats.maxHealth }
    }, session.characterId);
    this.refreshPartyForMember(session.characterId);
  }

  handleEnemyKill(enemyId: string, killerId: string): void {
    const enemy = this.spawnMgr.getEnemy(enemyId);
    if (!enemy) return;

    const enemyDef = getEnemyDefinition(enemy.enemyType);

    const killer = this.findPlayerByCharacterId(killerId);
    if (killer && enemyDef) {
      this.playerSys.grantExperience(killer, enemyDef.experience);
      this.sendToPlayer(killer.characterId, {
        type: PacketType.EXPERIENCE_GAIN,
        timestamp: Date.now(),
        data: { experience: enemyDef.experience, totalExperience: killer.stats.experience, level: killer.stats.level }
      });
      this.sendToPlayer(killer.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: killer.characterId, stats: killer.stats }
      });

      const completedQuests = this.questSys.onEnemyKill(killer, enemy.enemyType);
      completedQuests.forEach(questId => {
        this.sendToPlayer(killer.characterId, {
          type: PacketType.QUEST_PROGRESS,
          timestamp: Date.now(),
          data: { questId, status: 'completed', message: `Quest "${getQuest(questId)?.title}" completed! Return to the NPC.` }
        });
      });

      const lootItems = this.loot.generateLoot(enemyDef.lootTable, enemy.position, killerId);
      const party = this.partySys.getPartyForMember(killerId);
      if (party) {
        lootItems.forEach(loot => {
          if (party.settings.lootRule === LootRule.POOL) {
            const pool = this.partySys.getLootPool(party.partyId);
            if (pool.length < MAX_LOOT_POOL) {
              const itemName = getItem(loot.itemId)?.name || loot.itemId;
              this.partySys.addLootToPool(party.partyId, loot.id, loot.itemId, itemName, loot.quantity);
              for (const m of party.members) {
                this.sendToPlayer(m.characterId, {
                  type: PacketType.PARTY_LOOT_ROLL,
                  timestamp: Date.now(),
                  data: { lootId: loot.id, itemId: loot.itemId, itemName, quantity: loot.quantity }
                });
              }
              this.sendPartyUpdate(party.partyId);
            } else {
              const winnerId = this.partySys.distributeLootRandom(party.partyId, loot.itemId, getItem(loot.itemId)?.name || loot.itemId, loot.quantity);
              if (winnerId) {
                const ws = this.state.players.get(winnerId);
                if (ws) {
                  this.playerSys.addItemToInventory(ws, loot.itemId, loot.quantity);
                  this.sendToPlayer(winnerId, {
                    type: PacketType.INVENTORY_UPDATE,
                    timestamp: Date.now(),
                    data: { inventory: ws.inventory, equipment: ws.equipment }
                  });
                }
              }
            }
          } else {
            const winnerId = this.partySys.distributeLootRandom(party.partyId, loot.itemId, getItem(loot.itemId)?.name || loot.itemId, loot.quantity);
            if (winnerId) {
              const ws = this.state.players.get(winnerId);
              if (ws) {
                this.playerSys.addItemToInventory(ws, loot.itemId, loot.quantity);
                this.sendToPlayer(winnerId, {
                  type: PacketType.INVENTORY_UPDATE,
                  timestamp: Date.now(),
                  data: { inventory: ws.inventory, equipment: ws.equipment }
                });
              }
            }
          }
        });
      } else {
        lootItems.forEach(loot => {
          this.broadcastInZone(killer.zoneId, {
            type: PacketType.LOOT_SPAWN,
            timestamp: Date.now(),
            data: loot
          });
        });
      }
    }

    enemy.state = 'dead';
    enemy.deathTime = Date.now();

    const zone = this.findZoneOfEntity(enemyId);
    this.broadcastInZone(zone, {
      type: PacketType.DEATH,
      timestamp: Date.now(),
      data: { entityId: enemyId, killerId }
    });
    this.broadcastInZone(zone, {
      type: PacketType.ENTITY_DESPAWN,
      timestamp: Date.now(),
      data: { entityId: enemyId }
    });
  }

  handleRevivePlayerBySession(caster: PlayerSession, targetId: string): void {
    const reviveTarget = this.state.players.get(targetId);
    if (!reviveTarget || !reviveTarget.isDead) return;

    const dx = caster.position.x - reviveTarget.position.x;
    const dz = caster.position.z - reviveTarget.position.z;
    if (Math.sqrt(dx * dx + dz * dz) > 10) {
      this.sendToPlayer(caster.characterId, {
        type: PacketType.SKILL_USE,
        timestamp: Date.now(),
        data: { skillName: '', error: 'too_far' }
      });
      return;
    }

    reviveTarget.isDead = false;
    reviveTarget.deathTime = 0;
    reviveTarget.stats.health = Math.floor(reviveTarget.stats.maxHealth * 0.5);
    reviveTarget.stats.mana = Math.floor(reviveTarget.stats.maxMana * 0.5);
    reviveTarget.invulnerableUntil = Date.now() + 3000;
    reviveTarget.activeCast = null;
    this.playerSys.recalcStats(reviveTarget);
    this.sendToPlayer(targetId, {
      type: PacketType.PLAYER_REVIVED,
      timestamp: Date.now(),
      data: { characterId: targetId, zoneId: reviveTarget.zoneId, position: reviveTarget.position, health: reviveTarget.stats.health, maxHealth: reviveTarget.stats.maxHealth, invulnerable: true, revivedBy: caster.characterName }
    });
    this.sendToPlayer(targetId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId: targetId, stats: reviveTarget.stats }
    });
    this.broadcastInZone(reviveTarget.zoneId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { entityId: targetId, health: reviveTarget.stats.health, maxHealth: reviveTarget.stats.maxHealth }
    }, targetId);
    this.refreshPartyForMember(targetId);
  }

  applyPlayerDamage(target: PlayerSession, damage: number, attackerId: string, damageType: string, isCritical: boolean, zoneId: string, attackerPosition?: { x: number; y: number; z: number }): { redirected: boolean; damageTaken: number } {
    if (damage <= 0) return { redirected: false, damageTaken: 0 };

    if (target.statusEffects) {
      const invIdx = target.statusEffects.findIndex(e => e.type === StatusEffectType.INVISIBLE);
      if (invIdx !== -1) {
        target.statusEffects.splice(invIdx, 1);
        this.sendToPlayer(target.characterId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: target.statusEffects }
        });
        this.broadcastEntityEffects(target);
      }
    }

    if (!target.statusEffects || target.statusEffects.length === 0) {
      return this._applyRawDamage(target, damage, attackerId, damageType, isCritical, zoneId);
    }

    let negationIdx = -1;
    let protectedIdx = -1;
    let selfBlockIdx = -1;

    for (let i = 0; i < target.statusEffects.length; i++) {
      const e = target.statusEffects[i];
      if (negationIdx === -1 && e.type === StatusEffectType.BUFF_DAMAGE_NEGATION && e.buffData?.damageNegationThreshold) {
        negationIdx = i;
      } else if (protectedIdx === -1 && e.type === StatusEffectType.BUFF_BLOCKING_PROTECTED && e.buffData?.blockingProtectedBy) {
        protectedIdx = i;
      } else if (selfBlockIdx === -1 && e.type === StatusEffectType.BUFF_BLOCKING_STANCE && e.buffData?.blockingStance) {
        selfBlockIdx = i;
      }
    }

    if (negationIdx !== -1) {
      const negationEffect = target.statusEffects[negationIdx];
      if (damage <= (negationEffect.buffData!.damageNegationThreshold!)) {
        return { redirected: false, damageTaken: 0 };
      }
    }

    // Elemental absorption check
    for (let i = target.statusEffects.length - 1; i >= 0; i--) {
      const e = target.statusEffects[i];
      if (e.buffData?.elementalAbsorption) {
        const abs = e.buffData.elementalAbsorption;
        if (abs.elements.includes(damageType) || (damageType !== 'physical' && abs.elements.includes('all'))) {
          const amount = Math.floor(damage * 0.5);
          if (abs.convertTo === 'hp') {
            target.stats.health = Math.min(target.stats.maxHealth, target.stats.health + amount);
          } else {
            target.stats.mana = Math.min(target.stats.maxMana, target.stats.mana + amount);
          }
          return { redirected: false, damageTaken: 0 };
        }
      }
    }

    // Barrier check — consume one barrier matching damage type
    const barrierType = damageType === 'physical' ? StatusEffectType.BARRIER_PHYSICAL : StatusEffectType.BARRIER_MAGICAL;
    for (let i = 0; i < target.statusEffects.length; i++) {
      if (target.statusEffects[i].type === barrierType) {
        target.statusEffects.splice(i, 1);
        this.sendToPlayer(target.characterId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: target.statusEffects }
        });
        this.broadcastEntityEffects(target);
        return { redirected: false, damageTaken: 0 };
      }
    }

    // Mana Shield check — convert portion of damage to MP drain
    for (let i = 0; i < target.statusEffects.length; i++) {
      const e = target.statusEffects[i];
      if (e.type === StatusEffectType.BUFF_MANA_SHIELD && e.buffData?.manaShield) {
        const mpAvailable = target.stats.mana;
        if (mpAvailable > 0) {
          const mpDrain = Math.min(mpAvailable, damage);
          target.stats.mana -= mpDrain;
          damage = Math.max(0, damage - mpDrain);
          this.sendToPlayer(target.characterId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: target.characterId, stats: target.stats }
          });
          if (damage <= 0) return { redirected: false, damageTaken: 0 };
        }
        break;
      }
    }

    if (protectedIdx !== -1) {
      const protectedEffect = target.statusEffects[protectedIdx];
      const blockerId = protectedEffect.buffData!.blockingProtectedBy!;
      const blocker = this.state.players.get(blockerId);
      let blockStance = false;
      if (blocker && !blocker.isDead && blocker.statusEffects) {
        for (let i = 0; i < blocker.statusEffects.length; i++) {
          if (blocker.statusEffects[i].type === StatusEffectType.BUFF_BLOCKING_STANCE) {
            blockStance = true;
            break;
          }
        }
      }
      if (blocker && !blocker.isDead && blockStance) {
        const reducedDamage = Math.floor(damage * 0.4);
        blocker.stats.health = Math.max(0, blocker.stats.health - reducedDamage);
        this.sendToPlayer(blocker.characterId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId, targetId: blocker.characterId, damage: reducedDamage, isCritical: false, damageType, blockedFrom: target.characterId }
        });
        this.sendToPlayer(blocker.characterId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: blocker.characterId, stats: blocker.stats, statBreakdown: blocker.statBreakdown, skillProficiencies: blocker.skillProficiencies, skillAdeptness: blocker.skillAdeptness }
        });
        this.broadcastInZone(zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: blocker.characterId, health: blocker.stats.health, maxHealth: blocker.stats.maxHealth }
        });
        if (blocker.stats.health <= 0) {
          this.handlePlayerDeath(blocker);
        } else {
          this.tryInterruptCast(blocker);
        }
        if (attackerId && this.spawnMgr.getEnemy(attackerId) && Math.random() < 0.5) {
          blocker.statusEffects.push({
            id: `block_kd_${Date.now()}`,
            type: StatusEffectType.KNOCKDOWN,
            sourceId: attackerId,
            targetId: blocker.characterId,
            potency: 0,
            appliedAt: Date.now(),
            duration: 2000,
            tickInterval: 0,
            lastTickAt: Date.now(),
            stacks: 1,
            skillName: 'Blocking',
            debuffCategory: 'knockdown',
          });
          this.sendToPlayer(blocker.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: blocker.statusEffects }
          });
          this.broadcastEntityEffects(blocker);
        }
        return { redirected: true, damageTaken: 0 };
      }
    }

    if (selfBlockIdx !== -1) {
      const reducedDamage = Math.floor(damage * 0.4);
      target.stats.health = Math.max(0, target.stats.health - reducedDamage);
      this.tryInterruptCast(target);
      return { redirected: false, damageTaken: reducedDamage };
    }

    return this._applyRawDamage(target, damage, attackerId, damageType, isCritical, zoneId);
  }

  private _applyRawDamage(target: PlayerSession, damage: number, attackerId: string, damageType: string, isCritical: boolean, zoneId: string): { redirected: boolean; damageTaken: number } {
    const guardian = this.findGuardian(target.characterId);
    if (guardian && !guardian.isDead) {
      guardian.stats.health = Math.max(0, guardian.stats.health - damage);
      this.sendToPlayer(guardian.characterId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { attackerId, targetId: guardian.characterId, damage, isCritical, damageType, redirectedFrom: target.characterId }
      });
      this.sendToPlayer(guardian.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: guardian.characterId, stats: guardian.stats, statBreakdown: guardian.statBreakdown, skillProficiencies: guardian.skillProficiencies, skillAdeptness: guardian.skillAdeptness }
      });
      this.broadcastInZone(zoneId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { entityId: guardian.characterId, health: guardian.stats.health, maxHealth: guardian.stats.maxHealth }
      });
      if (guardian.stats.health <= 0) {
        this.handlePlayerDeath(guardian);
      } else {
        this.tryInterruptCast(guardian);
      }
      return { redirected: true, damageTaken: 0 };
    } else {
      target.stats.health = Math.max(0, target.stats.health - damage);
      this.tryInterruptCast(target);
      return { redirected: false, damageTaken: damage };
    }
  }

  private applyRemoveResistBuffs(target: { statusEffects: StatusEffect[] }, appliedEffect: StatusEffect): void {
    if (!appliedEffect.removeResistBuffs || appliedEffect.removeResistBuffs.length === 0) return;
    const toRemove = appliedEffect.removeResistBuffs;
    for (let i = target.statusEffects.length - 1; i >= 0; i--) {
      const e = target.statusEffects[i];
      if (e.buffData?.resistMods) {
        const hasMatching = Object.keys(e.buffData.resistMods).some(key => toRemove.includes(key));
        if (hasMatching) {
          target.statusEffects.splice(i, 1);
        }
      }
    }
  }

  private applyKnockback(target: { position: { x: number; y: number; z: number }; statusEffects: StatusEffect[] }, effect: StatusEffect, attackerPos: { x: number; z: number }, distance: number): void {
    if (effect.debuffCategory !== 'knockback' || !effect.knockbackVelocity) return;
    if (target.statusEffects.some(e => e.type === StatusEffectType.STUN || e.type === StatusEffectType.FREEZE)) return;
    const dx = target.position.x - attackerPos.x;
    const dz = target.position.z - attackerPos.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return;
    effect.knockbackVelocity = { dx: dx / len, dz: dz / len, remaining: distance };
  }

  private tryInterruptCast(target: PlayerSession): void {
    if (!target.activeCast) return;
    const baseStats = target.baseStats || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
    const gearSpi = target.statBreakdown?.gear?.SPI || 0;
    const buffSpi = target.statBreakdown?.buffs?.SPI || 0;
    const totalSPI = (target.statPoints.SPI || 0) + baseStats.SPI + gearSpi + buffSpi;
    const interruptChance = Math.max(0.05, 0.5 - totalSPI * 0.002);
    if (Math.random() < interruptChance) {
      const skillName = target.activeCast.skillName;
      target.activeCast = null;
      this.sendToPlayer(target.characterId, {
        type: PacketType.COOLDOWN_UPDATE,
        timestamp: Date.now(),
        data: { skillName, type: 'cast_cancel' }
      });
    }
  }

  damageEnemy(enemy: EnemyInstance, damage: number, attackerId?: string): { died: boolean; actualDamage: number } {
    enemy.health = Math.max(0, enemy.health - damage);
    const actualDamage = damage;
    if (enemy.invulnerable) {
      enemy.health = enemy.maxHealth;
      return { died: false, actualDamage };
    }
    if (attackerId) {
      this.enmity.addDamageEnmity(enemy, attackerId, damage);
    }
    return { died: enemy.health <= 0, actualDamage };
  }

  getEnemyEffectiveDefense(enemy: EnemyInstance): number {
    let defense = enemy.level * 0.5;
    const def = getEnemyDefinition(enemy.enemyType);
    if (def) defense = def.defense || 0;
    for (const effect of enemy.statusEffects) {
      if (effect.type === StatusEffectType.DEBUFF_DEFENSE_DOWN) {
        defense = Math.floor(defense * (1 - (effect.potency || 0)));
      }
    }
    return defense;
  }

  sendDamageDebug(session: PlayerSession, result: { debugCalc?: string }): void {
    if (result.debugCalc) {
      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'Damage', message: result.debugCalc, channel: 'system' }
      });
    }
  }

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
  } | null {
    const enemy = this.spawnMgr.getEnemy(id);
    if (enemy) {
      const def = getEnemyDefinition(enemy.enemyType);
      return {
        defense: this.getEnemyEffectiveDefense(enemy),
        magicDefense: Math.floor((def?.defense || 0) * 0.3),
        health: enemy.health,
        level: enemy.level,
        dodge: Math.floor(enemy.level * 0.5),
        fireResist: def?.fireResist || 0,
        iceResist: def?.iceResist || 0,
        lightningResist: def?.lightningResist || 0,
        darkResist: def?.darkResist || 0,
        holyResist: def?.holyResist || 0,
        poisonResist: def?.poisonResist || 0,
      };
    }
    const player = this.state.players.get(id);
    if (player) {
      const eff = getEffectiveStats(player.stats, player.statPoints, player.statusEffects || []);
      return {
        defense: eff.defense,
        magicDefense: Math.floor(eff.defense * 0.3),
        health: player.stats.health,
        level: player.stats.level,
        dodge: calculateDodge(player.stats.level, (player.statPoints.AGI || 0) + ((player.baseStats || { AGI: 0 }).AGI || 0), eff.dodgeBonus),
        damageTakenMultiplier: eff.damageTakenMultiplier,
        physicalDamageReduction: eff.physicalDamageReduction,
        fireResist: player.statBreakdown?.gearCombat?.fireResist || 0,
        iceResist: player.statBreakdown?.gearCombat?.iceResist || 0,
        lightningResist: player.statBreakdown?.gearCombat?.lightningResist || 0,
        darkResist: player.statBreakdown?.gearCombat?.darkResist || 0,
        holyResist: player.statBreakdown?.gearCombat?.holyResist || 0,
        poisonResist: player.statBreakdown?.gearCombat?.poisonResist || 0,
      };
    }
    return null;
  }

  findClosestEntityToPosition(session: PlayerSession, pos: { x: number; y: number; z: number }, radius: number): { id: string; distance: number } | null {
    let closest: { id: string; distance: number } | null = null;

    const nearEnemies = this.queryEnemiesNear(pos.x, pos.z, radius, session.zoneId);
    for (const entry of nearEnemies) {
      const dx = entry.x - pos.x;
      const dz = entry.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius && (!closest || dist < closest.distance)) {
        closest = { id: entry.id, distance: dist };
      }
    }

    const nearPlayers = this.queryPlayersNear(pos.x, pos.z, radius, session.zoneId);
    for (const entry of nearPlayers) {
      if (entry.id === session.characterId) continue;
      const dx = entry.x - pos.x;
      const dz = entry.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius && (!closest || dist < closest.distance)) {
        closest = { id: entry.id, distance: dist };
      }
    }

    return closest;
  }

  findAllEntitiesInRadius(session: PlayerSession, pos: { x: number; y: number; z: number }, radius: number): Array<{ id: string; distance: number }> {
    const results: Array<{ id: string; distance: number }> = [];

    const nearEnemies = this.queryEnemiesNear(pos.x, pos.z, radius, session.zoneId);
    for (const entry of nearEnemies) {
      const dx = entry.x - pos.x;
      const dz = entry.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius) {
        results.push({ id: entry.id, distance: dist });
      }
    }

    const nearPlayers = this.queryPlayersNear(pos.x, pos.z, radius, session.zoneId);
    for (const entry of nearPlayers) {
      if (entry.id === session.characterId) continue;
      const dx = entry.x - pos.x;
      const dz = entry.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius) {
        results.push({ id: entry.id, distance: dist });
      }
    }

    return results;
  }

  consumeDebuffsOnHit(targetSession: PlayerSession): void {
    const idx = targetSession.statusEffects.findIndex(e => e.consumable);
    if (idx !== -1) {
      targetSession.statusEffects.splice(idx, 1);
      this.playerSys.recalcStats(targetSession);
      this.sendToPlayer(targetSession.characterId, {
        type: PacketType.STATUS_EFFECT_UPDATE,
        timestamp: Date.now(),
        data: { effects: targetSession.statusEffects }
      });
      this.sendToPlayer(targetSession.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: targetSession.characterId, stats: targetSession.stats }
      });
      this.broadcastEntityEffects(targetSession);
    }
  }

  shouldApplyDebuff(effect: StatusEffect, targetId: string, casterId?: string): boolean {
    if (!effect.debuffCategory) return true;
    const casterSession = casterId ? this.state.players.get(casterId) : null;
    let accuracy = 65;
    if (casterSession) {
      const baseStats = casterSession.baseStats || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
      const totalSPI = (casterSession.statPoints.SPI || 0) + baseStats.SPI;
      const subCategory = effect.skillName ? this.skillSys.getSubCategoryForSkill(effect.skillName) : null;
      const prof = subCategory ? (casterSession.skillAdeptness[subCategory] || 0) : 0;
      accuracy = computeDebuffAccuracy(totalSPI, prof, effect.debuffCategory);
    }
    const resistPercent = this.getDebuffResist(targetId, effect.debuffCategory);
    const { applied, roll } = rollDebuffApplication(accuracy, resistPercent);
    if (casterId && process.env.DEBUG_DEBUFF_ROLLS === '1') {
      this.sendToPlayer(casterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'Debug', message: `Debuff: ${accuracy.toFixed(0)}% acc - ${resistPercent.toFixed(0)}% ${effect.debuffCategory} resist = ${Math.max(0, accuracy - resistPercent).toFixed(0)}% final (roll ${roll.toFixed(0)}) → ${applied ? 'applied' : 'resisted'}`, channel: 'system' }
      });
    }
    return applied;
  }

  private getDebuffResist(targetId: string, category: string): number {
    const player = this.state.players.get(targetId);
    if (player) {
      const baseStats = player.baseStats || { STA: 0, STR: 0, AGI: 0, DEX: 0, SPI: 0, INT: 0 };
      const totalSTA = (player.statPoints.STA || 0) + baseStats.STA;
      const totalSPI = (player.statPoints.SPI || 0) + baseStats.SPI;
      const gc = player.statBreakdown?.gearCombat;
      if (STA_DEBUFF_CATEGORIES.has(category)) {
        const gearKey = `${category}Resist` as keyof typeof gc;
        const gearBonus = (gc as any)?.[gearKey] || 0;
        return computeAilmentResist(totalSTA, gearBonus);
      } else if (SPI_DEBUFF_CATEGORIES.has(category)) {
        const gearKey = `${category}Resist` as keyof typeof gc;
        const gearBonus = (gc as any)?.[gearKey] || 0;
        return computeDisorderResist(totalSPI, gearBonus);
      }
      return 0;
    }
    const enemy = this.spawnMgr.getEnemy(targetId);
    if (enemy) {
      return category === 'ailment' ? (enemy as any).ailmentResist || 0 : (enemy as any).disorderResist || 0;
    }
    return 0;
  }

  hasActiveDebuff(targetId: string, effectType: StatusEffectType, skillName?: string): boolean {
    const player = this.state.players.get(targetId);
    if (player) {
      return player.statusEffects.some(e => e.type === effectType && (!skillName || e.skillName === skillName) && e.duration > 0);
    }
    const enemy = this.spawnMgr.getEnemy(targetId);
    if (enemy) {
      return enemy.statusEffects.some(e => e.type === effectType && (!skillName || e.skillName === skillName) && e.duration > 0);
    }
    return false;
  }

  private findGuardian(targetId: string): PlayerSession | null {
    for (const [, session] of this.state.players) {
      const guardianEffect = session.statusEffects?.find(
        e => e.type === StatusEffectType.BUFF_DAMAGE_REDIRECT && e.buffData?.damageRedirectTargetId === targetId
      );
      if (guardianEffect) return session;
    }
    return null;
  }

  private setupCallbacks(): void {
    this.combat.onDeath((targetId, killerId) => {
      const enemy = this.spawnMgr.getEnemy(targetId);
      if (!enemy) return;

      const enemyDef = getEnemyDefinition(enemy.enemyType);
      if (!enemyDef) return;

      const killer = this.findPlayerByCharacterId(killerId);
      if (killer) {
        this.playerSys.grantExperience(killer, enemyDef.experience);
        this.sendToPlayer(killer.characterId, {
          type: PacketType.EXPERIENCE_GAIN,
          timestamp: Date.now(),
          data: { experience: enemyDef.experience, totalExperience: killer.stats.experience, level: killer.stats.level }
        });
        this.sendToPlayer(killer.characterId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: killer.characterId, stats: killer.stats }
        });

        const completedQuests = this.questSys.onEnemyKill(killer, enemy.enemyType);
        completedQuests.forEach(questId => {
          this.sendToPlayer(killer.characterId, {
            type: PacketType.QUEST_PROGRESS,
            timestamp: Date.now(),
            data: { questId, status: 'completed', message: `Quest "${getQuest(questId)?.title}" completed! Return to the NPC.` }
          });
        });

        const lootItems = this.loot.generateLoot(enemyDef.lootTable, enemy.position, killerId);
        const party = this.partySys.getPartyForMember(killerId);
        if (party) {
          lootItems.forEach(loot => {
            if (party.settings.lootRule === LootRule.POOL) {
              const pool = this.partySys.getLootPool(party.partyId);
              if (pool.length < MAX_LOOT_POOL) {
                const itemName = getItem(loot.itemId)?.name || loot.itemId;
                this.partySys.addLootToPool(party.partyId, loot.id, loot.itemId, itemName, loot.quantity);
                for (const m of party.members) {
                  this.sendToPlayer(m.characterId, {
                    type: PacketType.PARTY_LOOT_ROLL,
                    timestamp: Date.now(),
                    data: { lootId: loot.id, itemId: loot.itemId, itemName, quantity: loot.quantity }
                  });
                }
                this.sendPartyUpdate(party.partyId);
              } else {
                const winnerId = this.partySys.distributeLootRandom(party.partyId, loot.itemId, getItem(loot.itemId)?.name || loot.itemId, loot.quantity);
                if (winnerId) {
                  const ws = this.state.players.get(winnerId);
                  if (ws) {
                    this.playerSys.addItemToInventory(ws, loot.itemId, loot.quantity);
                    this.sendToPlayer(winnerId, {
                      type: PacketType.INVENTORY_UPDATE,
                      timestamp: Date.now(),
                      data: { inventory: ws.inventory, equipment: ws.equipment }
                    });
                  }
                }
              }
            } else {
              const winnerId = this.partySys.distributeLootRandom(party.partyId, loot.itemId, getItem(loot.itemId)?.name || loot.itemId, loot.quantity);
              if (winnerId) {
                const ws = this.state.players.get(winnerId);
                if (ws) {
                  this.playerSys.addItemToInventory(ws, loot.itemId, loot.quantity);
                  this.sendToPlayer(winnerId, {
                    type: PacketType.INVENTORY_UPDATE,
                    timestamp: Date.now(),
                    data: { inventory: ws.inventory, equipment: ws.equipment }
                  });
                }
              }
            }
          });
        } else {
          lootItems.forEach(loot => {
            this.broadcastInZone(killer.zoneId, {
              type: PacketType.LOOT_SPAWN,
              timestamp: Date.now(),
              data: loot
            });
          });
        }
      }

      enemy.state = 'dead';
      enemy.deathTime = Date.now();

      this.broadcastInZone(
        this.findZoneOfEntity(targetId),
        {
          type: PacketType.DEATH,
          timestamp: Date.now(),
          data: { entityId: targetId, killerId }
        }
      );

      this.broadcastInZone(
        this.findZoneOfEntity(targetId),
        {
          type: PacketType.ENTITY_DESPAWN,
          timestamp: Date.now(),
          data: { entityId: targetId }
        }
      );
    });

    this.ai.onEnemyAttack((enemyId, targetId, _rawDamage) => {
      const target = this.findPlayerByCharacterId(targetId);
      if (!target) return;

      if (target.invulnerableUntil > Date.now()) return;

      const enemy = this.spawnMgr.getEnemy(enemyId);
      if (!enemy || enemy.state === 'dead') return;

      const result = this.combat.processEnemyAttack(enemy, target);
      if (!result) return;

      if (result.missed) {
        this.broadcastInZone(target.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: enemyId, targetId, damage: 0, isCritical: false, damageType: 'physical', missed: true }
        });
      } else {
        const dmgResult = this.applyPlayerDamage(target, result.damage, enemyId, 'physical', result.isCritical || false, target.zoneId, enemy.position);

        if (!dmgResult.redirected) {
          this.sendToPlayer(targetId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: { attackerId: enemyId, targetId, damage: dmgResult.damageTaken, isCritical: result.isCritical, damageType: 'physical' }
          });

          this.sendToPlayer(targetId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: targetId, stats: target.stats, statBreakdown: target.statBreakdown, skillProficiencies: target.skillProficiencies, skillAdeptness: target.skillAdeptness }
          });

          this.broadcastInZone(target.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: { attackerId: enemyId, targetId, damage: dmgResult.damageTaken, isCritical: result.isCritical, damageType: 'physical' }
          }, targetId);

          this.broadcastInZone(target.zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: targetId, health: target.stats.health, maxHealth: target.stats.maxHealth }
        });

        this.refreshPartyForMember(targetId);

        if (target.stats.health <= 0) {
          this.handlePlayerDeath(target);
        }
      } else {
        this.broadcastInZone(target.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: enemyId, targetId, damage: 0, isCritical: false, damageType: 'physical' }
        });
      }
      }
    });

    this.ai.onEnemyAttackSummon((enemyId, summonId, damage) => {
      const summon = this.summonMgr.getSummon(summonId);
      if (!summon) return;

      const enemy = this.spawnMgr.getEnemy(enemyId);
      if (!enemy || enemy.state === 'dead') return;

      const actualDamage = Math.max(1, damage - Math.floor(summon.defense * 0.5));
      const dead = this.summonMgr.damageSummon(summonId, actualDamage);

      this.broadcastInZone(summon.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { attackerId: enemyId, targetId: summonId, damage: actualDamage, isCritical: false, damageType: 'physical' },
      });

      if (dead) {
        this.summonMgr.despawnSummon(summonId);
        this.broadcastInZone(summon.zoneId, {
          type: PacketType.ENTITY_DESPAWN,
          timestamp: Date.now(),
          data: { entityId: summonId },
        });
      }
    });

    this.ai.onEnemyRespawn((enemyId) => {
      const enemy = this.spawnMgr.getEnemy(enemyId);
      if (!enemy) return;
      const zoneId = this.findZoneOfEnemy(enemyId);
      if (!zoneId) return;
      const def = getEnemyDefinition(enemy.enemyType);

      this.broadcastInZone(zoneId, {
        type: PacketType.ENTITY_SPAWN,
        timestamp: Date.now(),
        data: {
          id: enemy.id,
          type: 'enemy',
          position: enemy.position,
          rotation: { x: 0, y: enemy.rotation, z: 0, w: 1 },
          data: {
            enemyType: enemy.enemyType,
            name: def?.name || enemy.enemyType,
            health: enemy.health,
            maxHealth: enemy.maxHealth,
            level: enemy.level,
            state: enemy.state,
            modelFile: def?.modelFile || 'Enemy Small.glb'
          }
        }
      });
    });

    this.ai.onEnemyAggro((enemyId, enemyType, targetId, enemyPos, spawnPos) => {
    });
  }

  private setupPlayerCallbacks(): void {
    this.playerSys.onLevelUp((characterId: string, newLevel: number) => {
      const session = this.findPlayerByCharacterId(characterId);
      if (!session) return;

      this.sendToPlayer(characterId, {
        type: PacketType.LEVEL_UP,
        timestamp: Date.now(),
        data: {
          level: newLevel,
          statPoints: session.statPoints,
          unspentStatPoints: session.unspentStatPoints,
          unspentSkillPoints: session.unspentSkillPoints,
          stats: session.stats
        }
      });

      this.broadcastInZone(session.zoneId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { entityId: characterId, health: session.stats.health, maxHealth: session.stats.maxHealth, level: newLevel }
      });
      this.refreshPartyForMember(characterId);
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('packet', (packet: Packet) => {
        this.handlePacket(socket, packet);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.handleDisconnect(socket);
      });

      socket.on('error', (error: Error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  private async handlePacket(socket: Socket, packet: Packet): Promise<void> {
    try {
      if (packet.type === PacketType.HEARTBEAT) {
        this.sendToSocket(socket.id, { type: PacketType.HEARTBEAT, timestamp: Date.now(), data: {} });
        return;
      }

      if (packet.type === PacketType.PLAYER_MOVE) {
        const cid = this.findCharacterBySocket(socket.id);
        const sess = cid ? this.state.players.get(cid) : null;
        if (sess?.isDead) return;
      }

      const handler = this.handlers.get(packet.type);
      if (handler) {
        await handler(this, socket, packet.data);
      }
    } catch (error) {
      console.error(`Error handling packet ${packet.type}:`, error);
    }
  }

  private handleDisconnect(socket: Socket): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (characterId) {
      const session = this.state.players.get(characterId);
      if (session) {
        this.auth.saveCharacter(characterId, {
          level: session.stats.level,
          experience: session.stats.experience,
          position: session.position,
          zoneId: session.zoneId,
          statPoints: session.statPoints,
          unspentStatPoints: session.unspentStatPoints,
          unspentSkillPoints: session.unspentSkillPoints,
          skillProficiencies: session.skillProficiencies,
          skillAdeptness: session.skillAdeptness,
          jobId: session.jobId,
          nation: session.nation,
          lastSafeZoneId: session.lastSafeZoneId,
          inventory: session.inventory,
          equipment: session.equipment,
          gold: session.gold,
        }).catch(err => console.error('Failed to save character on disconnect:', err));

        for (const [zoneId, zone] of this.activeAOEZones) {
          if (zone.casterId === characterId) {
            this.removeAOEZone(zoneId, zone.zoneId);
          }
        }

        const despawnedSummons = this.summonMgr.despawnAllForOwner(characterId);
        for (const summonId of despawnedSummons) {
          this.broadcastInZone(session.zoneId, {
            type: PacketType.ENTITY_DESPAWN,
            timestamp: Date.now(),
            data: { entityId: summonId },
          });
        }

        this.removeSongProximityBuffs(session);

        for (const [dummyId, meta] of this.dummyMeta) {
          if (meta.ownerId === characterId) {
            if (meta.inParty) this.partySys.leaveParty(dummyId);
            this.state.players.delete(dummyId);
            this.unregisterPlayerFromZone(dummyId);
            this.dummyMeta.delete(dummyId);
            this.clearMovementThrottle(dummyId);
            this.broadcastInZone(session.zoneId, {
              type: PacketType.ENTITY_DESPAWN,
              timestamp: Date.now(),
              data: { entityId: dummyId }
            });
          }
        }

        this.broadcastInZone(session.zoneId, {
          type: PacketType.ENTITY_DESPAWN,
          timestamp: Date.now(),
          data: { entityId: characterId }
        });

        const result = this.partySys.handleDisconnect(characterId);
        if (result && result.party.members.length > 0) {
          this.sendPartyUpdate(result.party.partyId);
          for (const m of result.party.members) {
            this.sendToPlayer(m.characterId, {
              type: PacketType.CHAT_MESSAGE,
              timestamp: Date.now(),
              data: {
                sender: 'Party',
                message: `${session.characterName} has disconnected.`,
                channel: 'party'
              }
            });
          }
        }
      }
      this.state.players.delete(characterId);
      this.state.playerToSocket.delete(characterId);
      this.unregisterPlayerFromZone(characterId);
      this.clearMovementThrottle(characterId);
    }
    this.state.socketToPlayer.delete(socket.id);
  }

  sendZoneState(socket: Socket, zoneId: string, includePlayerId?: string): void {
    const zoneDef = getZoneDefinition(zoneId);
    if (!zoneDef) return;

    const enemies = this.spawnMgr.getEnemiesInZone(zoneId);
    const enemyData: any[] = [];
    enemies.forEach(enemy => {
      if (enemy.state !== 'dead') {
        const def = getEnemyDefinition(enemy.enemyType);
        enemyData.push({
          id: enemy.id,
          type: 'enemy',
          position: enemy.position,
          rotation: { x: 0, y: enemy.rotation, z: 0, w: 1 },
          data: {
            enemyType: enemy.enemyType,
            name: def?.name || enemy.enemyType,
            health: enemy.health,
            maxHealth: enemy.maxHealth,
            level: enemy.level,
            state: enemy.state,
            modelFile: def?.modelFile || 'Enemy Small.glb'
          }
        });
      }
    });

    const npcs = getNPCsInZone(zoneId);
    const npcData = npcs.map(npc => ({
      id: npc.id,
      type: 'npc',
      position: npc.position,
      rotation: { x: 0, y: npc.rotation, z: 0, w: 1 },
      data: {
        name: npc.name,
        npcType: npc.type,
        modelFile: npc.modelFile
      }
    }));

    const otherPlayers: any[] = [];
    this.state.players.forEach(player => {
      if (player.zoneId !== zoneId) return;
      if (player.characterId === this.findCharacterBySocket(socket.id) && player.characterId !== includePlayerId) return;
      otherPlayers.push({
        id: player.characterId,
        type: 'player',
        position: player.position,
        rotation: player.rotation,
        data: { name: player.characterName, class: player.jobId, race: player.race, jobId: player.jobId, level: player.stats.level, health: player.stats.health, maxHealth: player.stats.maxHealth, modelFile: JOB_DEFINITIONS[player.jobId]?.modelFile, invisible: player.statusEffects?.some(e => e.type === StatusEffectType.INVISIBLE) || false }
      });
    });

    const summons = this.summonMgr.getSummonsInZone(zoneId);
    const summonData = summons.map(s => ({
      id: s.id,
      type: 'summon',
      position: s.position,
      rotation: { x: 0, y: s.rotation, z: 0, w: 1 },
      data: {
        summonType: s.summonType,
        ownerId: s.ownerId,
        ownerName: s.ownerName,
        health: s.health,
        maxHealth: s.maxHealth,
        defense: s.defense,
        element: s.element,
        duration: s.duration,
      },
    }));

    this.sendToSocket(socket.id, {
      type: PacketType.WORLD_STATE,
      timestamp: Date.now(),
      data: {
        zoneId,
        zoneDef,
        enemies: enemyData,
        npcs: npcData,
        players: otherPlayers,
        summons: summonData,
      }
    });
  }

  removeBlockingProtectedBuffs(blockerId: string): void {
    for (const [targetId, target] of this.state.players) {
      const prot = target.statusEffects.find(
        e => e.type === StatusEffectType.BUFF_BLOCKING_PROTECTED && e.buffData?.blockingProtectedBy === blockerId
      );
      if (prot) {
        target.statusEffects = target.statusEffects.filter(e => e !== prot);
        this.playerSys.recalcStats(target);
        this.sendToPlayer(targetId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: target.statusEffects }
        });
        this.broadcastEntityEffects(target);
      }
    }
  }

  removeSongProximityBuffs(caster: PlayerSession): void {
    for (const [targetId, target] of this.state.players) {
      if (!target.statusEffects?.length) continue;

      const toRemove = target.statusEffects.filter(e =>
        e.songProximityBuff && e.sourceId === caster.characterId
      );
      if (toRemove.length === 0) continue;

      for (const e of toRemove) {
        e.lastInRangeAt = Date.now();
        e.appliedAt = Date.now();
        e.duration = 5000;
      }

      if (targetId !== caster.characterId) {
        this.sendToPlayer(targetId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: target.statusEffects }
        });
        this.sendToPlayer(targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: targetId, stats: target.stats, statBreakdown: target.statBreakdown, skillProficiencies: target.skillProficiencies, skillAdeptness: target.skillAdeptness }
        });
        this.broadcastEntityEffects(target);
      }
    }
  }

  executeAOESkillInternal(session: PlayerSession, skillName: string, aoePosition: { x: number; y: number; z: number }): void {
    const characterId = session.characterId;
    const skill = this.skillSys.findSkillDefinition(skillName);
    const aoeRadius = skill?.aoeRadius || DEFAULT_AOE_RADIUS;

    const firstTarget = this.findClosestEntityToPosition(session, aoePosition, aoeRadius);
    const firstTargetId = firstTarget?.id || null;

    const result = this.skillSys.executeSkill(session, skillName, firstTargetId, (id) => this.getTargetStatsForEntity(id));
    this.sendDamageDebug(session, result);
    this.playerSys.recalcStats(session);

    this.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown, skillProficiencies: session.skillProficiencies, skillAdeptness: session.skillAdeptness }
    });

    if (this.skillSys.lastProficiencyGain) {
      const pg = this.skillSys.lastProficiencyGain;
      this.sendToPlayer(characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'Proficiency', message: `${pg.subCategory} +${pg.amount} (${Math.floor(pg.newAdeptness)}/${pg.cap})`, channel: 'system' }
      });
      this.skillSys.lastProficiencyGain = undefined;
    }

    this.sendToPlayer(characterId, {
      type: PacketType.COOLDOWN_UPDATE,
      timestamp: Date.now(),
      data: {
        skillName,
        type: 'used',
        mpCost: skill?.mpCost || 0,
        cooldownRemaining: session.skillCooldowns.find(c => c.skillName === skillName)?.readyAt
          ? Math.max(0, (session.skillCooldowns.find(c => c.skillName === skillName)!.readyAt - Date.now()))
          : 0
      }
    });

    this.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
    });

    if (session.statusEffects.length > 0) {
      this.sendToPlayer(characterId, {
        type: PacketType.STATUS_EFFECT_UPDATE,
        timestamp: Date.now(),
        data: { effects: session.statusEffects }
      });
    }

    if (result.summonObject) {
      const summon = this.summonMgr.spawnSummon(
        characterId,
        session.characterName,
        session.zoneId,
        result.summonObject,
        aoePosition,
        session.rotation?.y || 0,
        result.element,
      );
      if (summon) {
        this.broadcastInZone(session.zoneId, {
          type: PacketType.ENTITY_SPAWN,
          timestamp: Date.now(),
          data: {
            id: summon.id,
            type: 'summon',
            position: summon.position,
            rotation: { x: 0, y: summon.rotation, z: 0, w: 1 },
            data: {
              summonType: summon.summonType,
              ownerId: summon.ownerId,
              ownerName: summon.ownerName,
              health: summon.health,
              maxHealth: summon.maxHealth,
              defense: summon.defense,
              element: summon.element,
              duration: summon.duration,
            },
          },
        });
      }
    }

    if (result.banishObject) {
      const banishRadius = result.banishRadius || BANISH_RADIUS;
      const targets = this.summonMgr.getSummonsInRadius(session.zoneId, { x: aoePosition.x, z: aoePosition.z }, banishRadius);
      for (const s of targets) {
        this.summonMgr.despawnSummon(s.id);
        this.broadcastInZone(s.zoneId, {
          type: PacketType.ENTITY_DESPAWN,
          timestamp: Date.now(),
          data: { entityId: s.id },
        });
      }
    }

    if (result.damage) {
      this.applyAOEDamageToTargets(session, skillName, aoePosition, aoeRadius, result);
    }

    if (!result.summonObject && !result.banishObject) {
      this.spawnAOEZone(session, skillName, aoePosition, aoeRadius);
    }

    if (result.statusEffects && result.statusEffects.length > 0) {
      const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);
      for (const target of targets) {
        const enemy = this.spawnMgr.getEnemy(target.id);
        if (enemy && enemy.state !== 'dead') {
          let anyApplied = false;
          let maxPotency = 0;
          for (const effect of result.statusEffects) {
            if (!this.shouldApplyDebuff(effect, target.id, session.characterId)) continue;
            if (this.hasActiveDebuff(target.id, effect.type, effect.skillName)) continue;
            const cloned = { ...effect, targetId: target.id };
            enemy.statusEffects.push(cloned);
            this.applyRemoveResistBuffs(enemy, cloned);
            this.applyKnockback(enemy, cloned, session.position, cloned.potency);
            anyApplied = true;
            if (effect.potency > maxPotency) maxPotency = effect.potency;
          }
          this.enmity.addDebuffEnmity(enemy, session.characterId, maxPotency, anyApplied);
          this.broadcastInZone(session.zoneId, {
            type: PacketType.ENTITY_STATUS_EFFECTS,
            timestamp: Date.now(),
            data: { entityId: target.id, effects: enemy.statusEffects }
          });
        }
      }
    }
  }

  handleAOECastCompletion(session: PlayerSession, castResult: { skillName: string; aoePosition: { x: number; y: number; z: number }; targetId: string | null }): void {
    const skill = this.skillSys.findSkillDefinition(castResult.skillName);
    if (!skill) return;
    this.executeAOESkillInternal(session, castResult.skillName, castResult.aoePosition);
  }

  applyAOEDamageToTargets(
    session: PlayerSession,
    skillName: string,
    aoePosition: { x: number; y: number; z: number },
    aoeRadius: number,
    primaryResult?: any
  ): void {
    const characterId = session.characterId;
    const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);

    for (const target of targets) {
      if (this.state.players.has(target.id) && target.id !== characterId && this.isPartyMember(characterId, target.id)) continue;

      const targetResult = primaryResult && primaryResult.damage
        ? primaryResult
        : this.skillSys.calculateAOEDamage(session, skillName, target.id, (id) => this.getTargetStatsForEntity(id));

      if (!targetResult?.damage) continue;

      const enemy = this.spawnMgr.getEnemy(target.id);
      if (enemy) {
        const { died } = this.damageEnemy(enemy, targetResult.damage, characterId);
        if (targetResult.elementalDamage) {
          for (const el of targetResult.elementalDamage) {
            this.damageEnemy(enemy, el.damage, characterId);
          }
        }
        this.broadcastInZone(session.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: {
            attackerId: characterId,
            targetId: target.id,
            damage: targetResult.damage,
            isCritical: targetResult.isCritical || false,
            damageType: targetResult.damageType || 'physical',
            skillName,
            elementalDamage: targetResult.elementalDamage,
          }
        });

        if (died) {
          enemy.state = 'dead';
          enemy.deathTime = Date.now();
          const enemyDef = getEnemyDefinition(enemy.enemyType);
          if (enemyDef) {
            this.playerSys.grantExperience(session, enemyDef.experience);
            this.sendToPlayer(characterId, {
              type: PacketType.EXPERIENCE_GAIN,
              timestamp: Date.now(),
              data: { experience: enemyDef.experience, totalExperience: session.stats.experience, level: session.stats.level }
            });
            this.sendToPlayer(characterId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId, stats: session.stats }
            });
            const lootItems = this.loot.generateLoot(enemyDef.lootTable, enemy.position, characterId);
            lootItems.forEach(loot => {
              this.broadcastInZone(session.zoneId, {
                type: PacketType.LOOT_SPAWN,
                timestamp: Date.now(),
                data: loot
              });
            });
          }
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DEATH,
            timestamp: Date.now(),
            data: { entityId: target.id, killerId: characterId }
          });
          this.broadcastInZone(session.zoneId, {
            type: PacketType.ENTITY_DESPAWN,
            timestamp: Date.now(),
            data: { entityId: target.id }
          });
        } else {
          this.broadcastInZone(session.zoneId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { entityId: target.id, health: enemy.health, maxHealth: enemy.maxHealth }
          });
        }
      } else {
        const playerTarget = this.state.players.get(target.id);
        if (playerTarget && target.id !== characterId) {
          const coneTotalDmg = targetResult.damage + (targetResult.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
          const coneDmgRslt = this.applyPlayerDamage(playerTarget, coneTotalDmg, characterId, targetResult.damageType || 'physical', targetResult.isCritical || false, session.zoneId);
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: characterId,
              targetId: target.id,
              damage: coneDmgRslt.redirected ? 0 : coneDmgRslt.damageTaken,
              isCritical: targetResult.isCritical || false,
              damageType: targetResult.damageType || 'physical',
              skillName,
              elementalDamage: coneDmgRslt.redirected ? [] : targetResult.elementalDamage,
              missed: coneDmgRslt.redirected ? true : undefined,
            }
          });
          if (!coneDmgRslt.redirected) {
            this.sendToPlayer(target.id, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: target.id, stats: playerTarget.stats, statBreakdown: playerTarget.statBreakdown, skillProficiencies: playerTarget.skillProficiencies, skillAdeptness: playerTarget.skillAdeptness }
            });
            this.broadcastInZone(session.zoneId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { entityId: target.id, health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth }
            }, characterId);
            this.refreshPartyForMember(target.id);
            if (playerTarget.stats.health <= 0) {
              this.handlePlayerDeath(playerTarget);
            }
          }
          this.consumeDebuffsOnHit(playerTarget);
        }
      }
    }
  }

  applySingleTargetSkillDamage(
    session: PlayerSession,
    skillName: string,
    targetId: string,
    result: any
  ): void {
    const characterId = session.characterId;
    const hits = result.hits;

    if (hits && hits.length > 1) {
      let enemyDied = false;
      const enemy = this.spawnMgr.getEnemy(targetId);
      if (enemy) {
        for (const hit of hits) {
          if (hit.damage > 0) {
            const { died } = this.damageEnemy(enemy, hit.damage, characterId);
            if (died) enemyDied = true;
          }
          if (hit.elementalDamage) {
            for (const el of hit.elementalDamage) {
              this.damageEnemy(enemy, el.damage, characterId);
            }
          }
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: characterId,
              targetId,
              damage: hit.damage,
              isCritical: hit.isCritical,
              damageType: result.damageType || 'physical',
              skillName,
              elementalDamage: hit.elementalDamage,
            }
          });
        }
        this.broadcastInZone(session.zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: targetId, health: enemy.health, maxHealth: enemy.maxHealth }
        });
        if (enemyDied) {
          this.handleEnemyKill(targetId, characterId);
        }
        return;
      }

      const playerTarget = this.state.players.get(targetId);
      if (playerTarget && targetId !== characterId) {
        for (const hit of hits) {
          const hitTotal = hit.damage + (hit.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
          const coneDmgResult = this.applyPlayerDamage(playerTarget, hitTotal, characterId, result.damageType || 'physical', hit.isCritical, session.zoneId);
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: characterId,
              targetId,
              damage: coneDmgResult.redirected ? 0 : coneDmgResult.damageTaken,
              isCritical: hit.isCritical,
              damageType: result.damageType || 'physical',
              skillName,
              elementalDamage: coneDmgResult.redirected ? [] : hit.elementalDamage,
              missed: coneDmgResult.redirected ? true : undefined,
            }
          });
        }
        if (playerTarget.stats.health > 0) {
          this.sendToPlayer(targetId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: targetId, stats: playerTarget.stats, statBreakdown: playerTarget.statBreakdown, skillProficiencies: playerTarget.skillProficiencies, skillAdeptness: playerTarget.skillAdeptness }
          });
        }
        if (playerTarget.stats.health <= 0) {
          this.handlePlayerDeath(playerTarget);
        }
      }
      return;
    }

    const enemy = this.spawnMgr.getEnemy(targetId);
    if (enemy) {
      const { died } = this.damageEnemy(enemy, result.damage!, characterId);
      if (result.elementalDamage) {
        for (const el of result.elementalDamage) {
          this.damageEnemy(enemy, el.damage, characterId);
        }
      }
      this.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: {
          attackerId: characterId,
          targetId,
          damage: result.damage,
          isCritical: result.isCritical || false,
          damageType: result.damageType || 'physical',
          skillName,
          elementalDamage: result.elementalDamage,
        }
      });
      this.broadcastInZone(session.zoneId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { entityId: targetId, health: enemy.health, maxHealth: enemy.maxHealth }
      });
      if (died) {
        this.handleEnemyKill(targetId, characterId);
      }
      return;
    }

    const playerTarget = this.state.players.get(targetId);
    if (playerTarget && targetId !== characterId) {
      const totalPvpDmg = (result.damage || 0) + (result.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
      const skillPvpDmgResult = this.applyPlayerDamage(playerTarget, totalPvpDmg, characterId, result.damageType || 'physical', result.isCritical || false, session.zoneId);
      this.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: {
          attackerId: characterId,
          targetId,
          damage: skillPvpDmgResult.redirected ? 0 : skillPvpDmgResult.damageTaken,
          isCritical: result.isCritical || false,
          damageType: result.damageType || 'physical',
          skillName,
          elementalDamage: skillPvpDmgResult.redirected ? [] : result.elementalDamage,
          missed: skillPvpDmgResult.redirected ? true : undefined,
        }
      });
      if (!skillPvpDmgResult.redirected) {
        this.sendToPlayer(targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: targetId, stats: playerTarget.stats, statBreakdown: playerTarget.statBreakdown, skillProficiencies: playerTarget.skillProficiencies, skillAdeptness: playerTarget.skillAdeptness }
        });
        if (playerTarget.stats.health <= 0) {
          this.handlePlayerDeath(playerTarget);
        }
      }
    }
  }

  spawnAOEZone(session: PlayerSession, skillName: string, position: { x: number; y: number; z: number }, radius: number): void {
    const skill = this.skillSys.findSkillDefinition(skillName);
    const totalPulses = skill?.pulseCount || 1;
    const pulseInterval = skill?.pulseInterval || 1000;
    const now = Date.now();

    let expiresAt: number;
    if (skill && skill.duration > 0) {
      expiresAt = skill.duration * 1000 + now;
    } else {
      expiresAt = now + pulseInterval * (totalPulses - 1) + 1500;
    }

    const zoneId = uuidv4();
    const zone = {
      id: zoneId,
      casterId: session.characterId,
      zoneId: session.zoneId,
      skillName,
      position,
      radius,
      pulseInterval,
      remainingPulses: totalPulses,
      lastPulseAt: now,
      expiresAt,
      entitiesInside: new Map<string, number>(),
    };
    for (const [id, enemy] of this.spawnMgr.getAllEnemies()) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      if (Math.sqrt(dx * dx + dz * dz) <= radius) {
        zone.entitiesInside.set(id, now);
      }
    }
    for (const [id, player] of this.state.players) {
      if (id === session.characterId) continue;
      if (player.stats.health <= 0 || !player.position) continue;
      const dx = player.position.x - position.x;
      const dz = player.position.z - position.z;
      if (Math.sqrt(dx * dx + dz * dz) <= radius) {
        zone.entitiesInside.set(id, now);
      }
    }
    this.activeAOEZones.set(zoneId, zone);

    this.broadcastInZone(session.zoneId, {
      type: PacketType.AOE_ENTITY,
      timestamp: Date.now(),
      data: {
        id: zoneId,
        type: 'aoe',
        position,
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        data: { skillName, radius, expiresAt: zone.expiresAt },
      }
    });
  }

  private removeAOEZone(zoneId: string, zoneId_value: string): void {
    const zone = this.activeAOEZones.get(zoneId);
    if (!zone) return;
    this.activeAOEZones.delete(zoneId);

    this.broadcastInZone(zone.zoneId, {
      type: PacketType.AOE_DESPAWN,
      timestamp: Date.now(),
      data: { entityId: zoneId }
    });
  }

  private tickAOEZones(now: number): void {
    const entries = [...this.activeAOEZones.entries()];
    for (const [zoneId, zone] of entries) {
      if (now >= zone.expiresAt || zone.remainingPulses <= 0) {
        this.removeAOEZone(zoneId, zone.zoneId);
        continue;
      }

      const caster = this.state.players.get(zone.casterId);
      if (!caster || caster.isDead) {
        this.removeAOEZone(zoneId, zone.zoneId);
        continue;
      }

      if (zone.remainingPulses <= 0) continue;

      const lastPulse = zone.lastPulseAt || 0;
      if (now - lastPulse < zone.pulseInterval) continue;

      this.applyAOEDamageToTargets(caster, zone.skillName, zone.position, zone.radius);
      zone.lastPulseAt = now;
      zone.remainingPulses--;
    }
  }

  private static SONG_PULSE_INTERVAL = 4000;
  private static SONG_BUFF_DURATION = 5000;

  applySongPulseImmediate(caster: PlayerSession): void {
    const songTypes = [
      StatusEffectType.SONG_GREEN,
      StatusEffectType.SONG_BLUE,
      StatusEffectType.SONG_YELLOW,
      StatusEffectType.SONG_RED,
    ];
    const BUFF_DUR = NetworkServer.SONG_BUFF_DURATION;

    const songEffect = caster.statusEffects?.find(e => songTypes.includes(e.type) && !e.songProximityBuff);
    if (!songEffect) return;

    const skill = this.skillSys.findSkillDefinition(songEffect.skillName || '');
    if (!skill) return;

    songEffect.lastPulseAt = Date.now();

    const songRadius = skill.aoeRadius || 3;

    if (songEffect.type === StatusEffectType.SONG_RED && skill.basePower) {
      this.applyRedSongDamage(caster, skill, songRadius);
      return;
    }

    if (!skill.buffEffectTable) return;
    const pulseTargets: PlayerSession[] = [caster];

    for (const [targetId, target] of this.state.players) {
      if (targetId === caster.characterId) continue;
      if (target.isDead) continue;
      if (target.zoneId !== caster.zoneId) continue;
      if (!target.position || !caster.position) continue;
      if (!this.isPartyMember(caster.characterId, targetId)) continue;

      const dx = caster.position.x - target.position.x;
      const dz = caster.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= songRadius) {
        pulseTargets.push(target);
      }
    }

    const now = Date.now();
    for (const target of pulseTargets) {
      const isCaster = target.characterId === caster.characterId;
      this.applySongPulse(target, caster, skill, now, BUFF_DUR, isCaster);
    }
  }

  private tickSongProximity(now: number): void {
    const songTypes = [
      StatusEffectType.SONG_GREEN,
      StatusEffectType.SONG_BLUE,
      StatusEffectType.SONG_YELLOW,
      StatusEffectType.SONG_RED,
    ];
    const PULSE = NetworkServer.SONG_PULSE_INTERVAL;
    const BUFF_DUR = NetworkServer.SONG_BUFF_DURATION;

    for (const [charId, caster] of this.state.players) {
      if (caster.isDead) continue;
      if (!caster.statusEffects?.length) continue;

      const songEffect = caster.statusEffects.find(e => songTypes.includes(e.type) && !e.songProximityBuff);
      if (!songEffect) continue;

      const lastPulse = songEffect.lastPulseAt || songEffect.appliedAt || 0;
      if (now - lastPulse < PULSE) continue;

      songEffect.lastPulseAt = now;

      const skill = this.skillSys.findSkillDefinition(songEffect.skillName || '');

      const mpDrain = Math.ceil((skill?.mpCost || 30) * 0.3);
      caster.stats.mana = Math.max(0, caster.stats.mana - mpDrain);
      if (caster.stats.mana <= 0) {
        caster.statusEffects = caster.statusEffects.filter(e => {
          if (songTypes.includes(e.type) && !e.songProximityBuff) return false;
          return true;
        });
        this.removeSongProximityBuffs(caster);
        this.playerSys.recalcStats(caster);
        this.sendToPlayer(charId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: caster.statusEffects }
        });
        this.sendToPlayer(charId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: charId, stats: caster.stats, statBreakdown: caster.statBreakdown, skillProficiencies: caster.skillProficiencies, skillAdeptness: caster.skillAdeptness }
        });
        this.sendToPlayer(charId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: 'Song ended - insufficient MP.', channel: 'system' }
        });
        this.broadcastEntityEffects(caster);
        continue;
      }

      this.sendToPlayer(charId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: charId, stats: caster.stats }
      });

      if (!skill) continue;

      if (!skill.buffEffectTable && songEffect.type !== StatusEffectType.SONG_RED) continue;
      const songRadius = skill.aoeRadius || 3;

      const pulseTargets: PlayerSession[] = [caster];

      if (caster.position) {
        const nearby = this.queryPlayersNear(caster.position.x, caster.position.z, songRadius, caster.zoneId);
        for (const entry of nearby) {
          if (entry.id === charId) continue;
          if (!this.isPartyMember(charId, entry.id)) continue;
          pulseTargets.push(entry.data);
        }
      }

      for (const target of pulseTargets) {
        const isCaster = target.characterId === charId;
        this.applySongPulse(target, caster, skill, now, BUFF_DUR, isCaster);
      }

      if (songEffect.type === StatusEffectType.SONG_RED && skill.basePower) {
        this.applyRedSongDamage(caster, skill, songRadius);
      }
    }
  }

  private applyRedSongDamage(
    caster: PlayerSession,
    skill: NonNullable<ReturnType<typeof this.skillSys.findSkillDefinition>>,
    songRadius: number
  ): void {
    if (!caster.position) return;
    const basePower = skill.basePower || 2;
    const totalSpi = (caster.baseStats?.SPI || 0) + (caster.statPoints?.SPI || 0);
    const exorcismProf = caster.skillProficiencies?.['Exorcism'] || 0;
    const baseDamage = Math.floor(basePower * (totalSpi * 0.5 + exorcismProf * 0.3 + caster.stats.level * 0.2));
    const mpDamage = Math.floor(baseDamage * 0.5);

    const enemiesInZone = this.spawnMgr.getEnemiesInZone(caster.zoneId);
    for (const [enemyId, enemy] of enemiesInZone) {
      if (enemy.health <= 0) continue;
      if (!enemy.position) continue;

      const dx = caster.position.x - enemy.position.x;
      const dz = caster.position.z - enemy.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > songRadius) continue;

      const variance = 0.9 + Math.random() * 0.2;
      const hpDamage = Math.max(1, Math.floor(baseDamage * variance));

      const { died } = this.damageEnemy(enemy, hpDamage, caster.characterId);

      this.broadcastInZone(caster.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: {
          attackerId: caster.characterId,
          targetId: enemyId,
          damage: hpDamage,
          isCritical: false,
          damageType: 'magical',
          skillName: skill.name,
        }
      });

      if (died) {
        this.handleEnemyKill(enemyId, caster.characterId);
      }
    }

    for (const [targetId, target] of this.state.players) {
      if (targetId === caster.characterId) continue;
      if (target.isDead) continue;
      if (target.zoneId !== caster.zoneId) continue;
      if (!target.position || !caster.position) continue;
      if (this.isPartyMember(caster.characterId, targetId)) continue;

      const dx = caster.position.x - target.position.x;
      const dz = caster.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > songRadius) continue;

      const variance = 0.9 + Math.random() * 0.2;
      const hpDmg = Math.max(1, Math.floor(baseDamage * variance));
      const mpDmg = Math.max(1, Math.floor(mpDamage * variance));

      const dmgResult = this.applyPlayerDamage(target, hpDmg, caster.characterId, 'magical', false, target.zoneId);
      if (!dmgResult.redirected) {
        target.stats.mana = Math.max(0, target.stats.mana - mpDmg);
        this.sendToPlayer(targetId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: caster.characterId, targetId, damage: dmgResult.damageTaken, isCritical: false, damageType: 'magical', skillName: skill.name, mpDamage: mpDmg }
        });
        this.sendToPlayer(targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: targetId, stats: target.stats, statBreakdown: target.statBreakdown }
        });
        if (target.stats.health <= 0) {
          this.handlePlayerDeath(target);
        }
      }
    }
  }

  private applySongPulse(
    target: PlayerSession,
    caster: PlayerSession,
    skill: NonNullable<ReturnType<typeof this.skillSys.findSkillDefinition>>,
    now: number,
    buffDuration: number,
    isCaster: boolean
  ): void {
    const bt = skill.buffEffectTable;
    if (!bt) return;

    const sourceId = caster.characterId;
    const targetId = target.characterId;

    const existing = target.statusEffects.filter(e =>
      e.songProximityBuff && e.sourceId === sourceId && e.skillName === skill.name
    );
    if (existing.length > 0) {
      for (const e of existing) {
        e.appliedAt = now;
        e.duration = buffDuration;
        e.lastInRangeAt = now;
      }
      this.sendToPlayer(targetId, {
        type: PacketType.STATUS_EFFECT_UPDATE,
        timestamp: Date.now(),
        data: { effects: target.statusEffects }
      });
      return;
    }

    const effects: StatusEffect[] = [];
    const pushSongBuff = (type: StatusEffectType, potency: number, buffData?: BuffData) => {
      effects.push({
        id: `song_${now}_${Math.random().toString(36).slice(2, 6)}_${type}`,
        type,
        sourceId,
        targetId,
        potency,
        appliedAt: now,
        duration: buffDuration,
        tickInterval: 0,
        lastTickAt: now,
        stacks: 1,
        skillName: skill.name,
        songProximityBuff: true,
        lastInRangeAt: now,
        buffData,
      });
    };

    if (bt.songCooldownReduction) {
      pushSongBuff(StatusEffectType.BUFF_CAST_SPEED, bt.songCooldownReduction);
    }
    if (bt.magicalDamageBonus) {
      pushSongBuff(StatusEffectType.BUFF_GENERIC, 0, { magicalDamageBonusPercent: bt.magicalDamageBonus });
    }
    if (bt.auraDamageIncrease) {
      pushSongBuff(StatusEffectType.BUFF_GENERIC, 0, { auraDamageIncreasePercent: bt.auraDamageIncrease });
    }

    if (bt.statTieredValues) {
      const cfg = bt.statTieredValues;
      const statKey = cfg.stat as keyof typeof caster.baseStats;
      const totalStat = (caster.baseStats?.[statKey] || 0) + ((caster.statPoints as unknown as Record<string, number>)?.[statKey] || 0);
      const prof = cfg.proficiencyStat
        ? (caster.skillAdeptness?.[cfg.proficiencyStat] || 0)
        : 0;
      const skillName = skill.name.toLowerCase();
      if (skillName === 'green song' || skillName === 'speedy gale') {
        const dodgeResult = resolveStatTieredValue(cfg, totalStat, prof, 'dodgeChance');
        if (dodgeResult != null) {
          pushSongBuff(StatusEffectType.BUFF_DODGE, dodgeResult);
        }
        if (skillName === 'green song') {
          const accuracyResult = resolveStatTieredValue(cfg, totalStat, prof, 'accuracy');
          if (accuracyResult != null) {
            pushSongBuff(StatusEffectType.BUFF_ACCURACY, accuracyResult);
          }
        }
      }
    }

    if (bt.songDamageNegation) {
      const dn = bt.songDamageNegation;
      const totalSpi = (caster.baseStats?.SPI || 0) + (caster.statPoints?.SPI || 0);
      const hymnProf = caster.skillProficiencies?.['Hymn'] || 0;
      const profBonus = Math.min(hymnProf, dn.proficiencyCap);
      const threshold = Math.floor(dn.base + totalSpi * dn.spiScale + profBonus);
      pushSongBuff(StatusEffectType.BUFF_DAMAGE_NEGATION, 0, { damageNegationThreshold: threshold });
    }

    if (effects.length === 0) return;

    target.statusEffects.push(...effects);
    this.playerSys.recalcStats(target);
    this.sendToPlayer(targetId, {
      type: PacketType.STATUS_EFFECT_UPDATE,
      timestamp: Date.now(),
      data: { effects: target.statusEffects }
    });
    this.sendToPlayer(targetId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId: targetId, stats: target.stats, statBreakdown: target.statBreakdown, skillProficiencies: target.skillProficiencies, skillAdeptness: target.skillAdeptness }
    });
    this.broadcastEntityEffects(target);
    const songType = bt.songType;
    if (songType) {
      this.broadcastInZone(target.zoneId, {
        type: PacketType.SONG_PULSE,
        timestamp: Date.now(),
        data: { entityId: targetId, songType }
      });
    }
   }

   private tickBlockingProximity(now: number): void {
     for (const [blockerId, blocker] of this.state.players) {
       if (blocker.isDead) continue;
       const blockStance = blocker.statusEffects?.find(
         e => e.type === StatusEffectType.BUFF_BLOCKING_STANCE && e.buffData?.blockingStance
       );
       if (!blockStance || !blocker.position) continue;

       const blockRange = blockStance.buffData?.blockingRange || 6;
       const protRange = Math.max(2, blockRange * 0.4);

       let blockerFacing = 0;
       const rot = blocker.rotation as any;
       if (typeof rot === 'object' && rot.w !== undefined) {
         const sinY = 2 * (rot.w * rot.y - rot.z * rot.x);
         const cosY = 1 - 2 * (rot.y * rot.y + rot.z * rot.z);
         blockerFacing = Math.atan2(sinY, cosY);
       }

       const nearby = this.queryPlayersNear(blocker.position.x, blocker.position.z, protRange, blocker.zoneId);
       const processedTargets = new Set<string>();

       for (const entry of nearby) {
         const targetId = entry.id;
         if (targetId === blockerId) continue;
         processedTargets.add(targetId);

         const dx = entry.x - blocker.position.x;
         const dz = entry.z - blocker.position.z;
         const dist = Math.sqrt(dx * dx + dz * dz);

         const existingProt = entry.data.statusEffects?.find(
           e => e.type === StatusEffectType.BUFF_BLOCKING_PROTECTED && e.buffData?.blockingProtectedBy === blockerId
         );

         let behindBlocker = false;
         if (dist <= protRange && dist > 0.01) {
           const angleToTarget = Math.atan2(dx, dz);
           let angleDiff = angleToTarget - blockerFacing;
           while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
           while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
           const behindAngle = Math.abs(angleDiff) - Math.PI;
           behindBlocker = Math.abs(behindAngle) < Math.PI / 4;
         }

         if (behindBlocker) {
           if (!existingProt) {
             entry.data.statusEffects.push({
               id: `block_prot_${blockerId}_${Date.now()}`,
               type: StatusEffectType.BUFF_BLOCKING_PROTECTED,
               sourceId: blockerId,
               targetId,
               potency: 0,
               appliedAt: now,
               duration: 999999999,
               tickInterval: 0,
               lastTickAt: now,
               stacks: 1,
               skillName: 'Blocking',
               buffData: { blockingProtectedBy: blockerId },
             });
             this.playerSys.recalcStats(entry.data);
             this.sendToPlayer(targetId, {
               type: PacketType.STATUS_EFFECT_UPDATE,
               timestamp: Date.now(),
               data: { effects: entry.data.statusEffects }
             });
             this.broadcastEntityEffects(entry.data);
           }
         } else {
           if (existingProt) {
             entry.data.statusEffects = entry.data.statusEffects.filter(e => e !== existingProt);
             this.playerSys.recalcStats(entry.data);
             this.sendToPlayer(targetId, {
               type: PacketType.STATUS_EFFECT_UPDATE,
               timestamp: Date.now(),
               data: { effects: entry.data.statusEffects }
             });
             this.broadcastEntityEffects(entry.data);
           }
         }
       }

       for (const [targetId, target] of this.state.players) {
         if (targetId === blockerId) continue;
         if (target.isDead) continue;
         if (target.zoneId !== blocker.zoneId) continue;
         if (processedTargets.has(targetId)) continue;
         const existingProt = target.statusEffects.find(
           e => e.type === StatusEffectType.BUFF_BLOCKING_PROTECTED && e.buffData?.blockingProtectedBy === blockerId
         );
         if (existingProt) {
           target.statusEffects = target.statusEffects.filter(e => e !== existingProt);
           this.playerSys.recalcStats(target);
           this.sendToPlayer(targetId, {
             type: PacketType.STATUS_EFFECT_UPDATE,
             timestamp: Date.now(),
             data: { effects: target.statusEffects }
           });
           this.broadcastEntityEffects(target);
         }
       }
     }
   }

  private checkEntityAOEEntries(entityId: string, position: { x: number; y: number; z: number }): void {
    for (const [zoneId, zone] of this.activeAOEZones) {
      const dx = position.x - zone.position.x;
      const dz = position.z - zone.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const wasInside = zone.entitiesInside.has(entityId);
      const isInside = dist <= zone.radius;

      if (isInside && !wasInside) {
        zone.entitiesInside.set(entityId, Date.now());
        const caster = this.state.players.get(zone.casterId);
        if (caster) {
          this.damageEntityInAOE(caster, zone.skillName, entityId, zone.position, zone.radius);
          this.applyAOEDebuffsOnEnter(caster, zone.skillName, entityId);
        }
      } else if (!isInside && wasInside) {
        zone.entitiesInside.delete(entityId);
      }
    }
  }

  private damageEntityInAOE(
    session: PlayerSession,
    skillName: string,
    targetId: string,
    aoePosition: { x: number; y: number; z: number },
    aoeRadius: number
  ): void {
    const enemy = this.spawnMgr.getEnemy(targetId);
    if (enemy && enemy.state !== 'dead') {
      const targetStats = this.getTargetStatsForEntity(targetId);
      const result = this.skillSys.calculateAOEDamage(session, skillName, targetId, () => targetStats);
      if (result?.damage) {
        const { died } = this.damageEnemy(enemy, result.damage, session.characterId);
        this.broadcastInZone(session.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: {
            attackerId: session.characterId,
            targetId,
            damage: result.damage,
            isCritical: result.isCritical || false,
            damageType: result.damageType || 'physical',
            skillName,
            elementalDamage: result.elementalDamage,
          }
        });
        if (!died) {
          this.broadcastInZone(session.zoneId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { entityId: targetId, health: enemy.health, maxHealth: enemy.maxHealth }
          });
        } else {
          this.handleEnemyKill(targetId, session.characterId);
        }
      }
    }
  }

  private applyAOEDebuffsOnEnter(caster: PlayerSession, skillName: string, targetId: string): void {
    const skill = this.skillSys.findSkillDefinition(skillName);
    if (!skill?.debuffEffectTable) return;

    const debuffEffects = this.skillSys.buildDebuffEffects(caster, skill);
    if (debuffEffects.length === 0) return;

    const enemy = this.spawnMgr.getEnemy(targetId);
    if (enemy && enemy.state !== 'dead') {
      let changed = false;
      let maxPotency = 0;
      for (const effect of debuffEffects) {
        if (enemy.statusEffects.some(e => e.type === effect.type && e.skillName === skillName)) continue;
        const applied = { ...effect, targetId };
        enemy.statusEffects.push(applied);
        this.applyRemoveResistBuffs(enemy, applied);
        this.applyKnockback(enemy, applied, caster.position, applied.potency);
        changed = true;
        if (effect.potency > maxPotency) maxPotency = effect.potency;
      }
      if (changed) {
        this.enmity.addDebuffEnmity(enemy, caster.characterId, maxPotency, true);
        this.broadcastInZone(caster.zoneId, {
          type: PacketType.ENTITY_STATUS_EFFECTS,
          timestamp: Date.now(),
          data: { entityId: targetId, effects: enemy.statusEffects }
        });
      }
    }

    const player = this.state.players.get(targetId);
    if (player && targetId !== caster.characterId) {
      let changed = false;
      for (const effect of debuffEffects) {
        if (!this.shouldApplyDebuff(effect, targetId, caster.characterId)) continue;
        if (player.statusEffects.some(e => e.type === effect.type && e.skillName === skillName)) continue;
        const applied = { ...effect, targetId };
        player.statusEffects.push(applied);
        this.applyKnockback(player, applied, caster.position, applied.potency);
        changed = true;
      }
      if (changed) {
        this.playerSys.recalcStats(player);
        this.sendToPlayer(targetId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: player.statusEffects }
        });
        this.sendToPlayer(targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: targetId, stats: player.stats }
        });
      }
    }
  }

  gameLoop(_elapsedMs?: number): void {
    const now = Date.now();

    this.tickPlayerUpdates(now);
    this.tickAOEZones(now);
    this.tickSongProximity(now);
    this.tickBlockingProximity(now);
    this.tickEnemyStatusEffects(now);
    this.tickDummies();
    this.tickSummons(now);
    this.tickAI(now);
    this.tickEntityAOEEntries();
    this.tickKnockback();
    this.updateEnemySpatialHash();
    this.broadcastEntityStates();
  }

  private tickPlayerUpdates(now: number): void {
    this.state.players.forEach(session => {
      if (session.isDead) return;

      this.skillSys.updateCooldowns(session);

      const castResult = this.skillSys.checkCasting(session);
      if (castResult?.completed) {
        if (castResult.aoePosition) {
          this.handleAOECastCompletion(session, { skillName: castResult.skillName, aoePosition: castResult.aoePosition!, targetId: castResult.targetId });
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: session.characterId, stats: session.stats }
          });
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: session.statusEffects }
            });
          return;
        }
        const result = this.skillSys.executeSkill(session, castResult.skillName, castResult.targetId, (id) => this.getTargetStatsForEntity(id));
        this.sendDamageDebug(session, result);
        this.playerSys.recalcStats(session);

        if (result.songToggledOff) {
          this.removeSongProximityBuffs(session);
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: session.statusEffects }
          });
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown, skillProficiencies: session.skillProficiencies, skillAdeptness: session.skillAdeptness }
          });
          this.broadcastEntityEffects(session);
          return;
        }

        const devotionFx = session.statusEffects?.find(e => e.buffData?.devotionLink);
        if (devotionFx && result.success) {
          const skillDef = this.skillSys.findSkillDefinition(castResult.skillName);
          const mpCost = skillDef?.mpCost || 0;
          if (mpCost > 0) {
            const partnerId = devotionFx.buffData!.devotionLink!.partnerId;
            const partner = this.state.players.get(partnerId);
            const mpShortfall = Math.max(0, -session.stats.mana);
            session.stats.mana = Math.max(0, session.stats.mana);
            if (partner && mpShortfall > 0) {
              const partnerContribution = Math.min(partner.stats.mana, mpShortfall);
              partner.stats.mana -= partnerContribution;
              session.stats.mana = Math.max(0, session.stats.mana - (mpShortfall - partnerContribution));
              this.sendToPlayer(partnerId, {
                type: PacketType.STATS_UPDATE,
                timestamp: Date.now(),
                data: { characterId: partnerId, stats: partner.stats, statBreakdown: partner.statBreakdown }
              });
              this.refreshPartyForMember(partnerId);
            }
          }
        }

        if (result.defensiveMarchToggledOff) {
          this.removeBlockingProtectedBuffs(session.characterId);
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: session.statusEffects }
          });
          this.broadcastEntityEffects(session);
          return;
        }

        if (result.guardianToggledOff) {
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: session.statusEffects }
          });
          this.broadcastEntityEffects(session);
          if (result.guardianRemovedTarget) {
            const guarded = this.state.players.get(result.guardianRemovedTarget);
            if (guarded) {
              guarded.statusEffects = guarded.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_GUARDED);
              this.sendToPlayer(result.guardianRemovedTarget, {
                type: PacketType.STATUS_EFFECT_UPDATE,
                timestamp: Date.now(),
                data: { effects: guarded.statusEffects }
              });
              this.broadcastEntityEffects(guarded);
            }
          }
          return;
        }

        if (result.guardianApplied) {
          const guardedId = result.guardianApplied;
          const guarded = this.state.players.get(guardedId);
          if (guarded) {
            guarded.statusEffects = guarded.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_GUARDED);
            guarded.statusEffects.push({
              id: `buff_${Date.now()}_guarded_${session.characterId}`,
              type: StatusEffectType.BUFF_GUARDED,
              sourceId: session.characterId,
              targetId: guardedId,
              potency: 0,
              appliedAt: Date.now(),
              duration: 300000,
              tickInterval: 0,
              lastTickAt: Date.now(),
              stacks: 1,
              skillName: 'Guardian',
              buffData: { guardedBy: session.characterId },
            });
            this.playerSys.recalcStats(guarded);
            this.sendToPlayer(guardedId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: guarded.statusEffects }
            });
            this.broadcastEntityEffects(guarded);
          }
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: session.statusEffects }
          });
          this.broadcastEntityEffects(session);
          return;
        }

        if (result.createdItems && result.createdItems.length > 0) {
          for (const ci of result.createdItems) {
            if (ci.consumeItems) {
              let canCraft = true;
              for (const mat of ci.consumeItems) {
                const count = session.inventory.filter(i => i.itemId === mat.itemId).reduce((s, i) => s + i.quantity, 0);
                if (count < mat.quantity) { canCraft = false; break; }
              }
              if (!canCraft) continue;
              for (const mat of ci.consumeItems) {
                let remaining = mat.quantity;
                for (let i = session.inventory.length - 1; i >= 0 && remaining > 0; i--) {
                  if (session.inventory[i].itemId === mat.itemId) {
                    const take = Math.min(session.inventory[i].quantity, remaining);
                    session.inventory[i].quantity -= take;
                    remaining -= take;
                    if (session.inventory[i].quantity <= 0) session.inventory.splice(i, 1);
                  }
                }
              }
            }
            this.playerSys.addItemToInventory(session, ci.itemId, ci.quantity);
            this.sendToPlayer(session.characterId, {
              type: PacketType.NOTIFICATION,
              timestamp: Date.now(),
              data: { message: `Created: ${ci.itemId} x${ci.quantity}` }
            });
          }
          this.sendToPlayer(session.characterId, {
            type: PacketType.INVENTORY_UPDATE,
            timestamp: Date.now(),
            data: { inventory: session.inventory, equipment: session.equipment }
          });
          return;
        }

        this.sendToPlayer(session.characterId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown, skillProficiencies: session.skillProficiencies, skillAdeptness: session.skillAdeptness }
        });

    if (this.skillSys.lastProficiencyGain) {
      const pg = this.skillSys.lastProficiencyGain;
      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'Proficiency', message: `${pg.subCategory} +${pg.amount} (${Math.floor(pg.newAdeptness)}/${pg.cap})`, channel: 'system' }
      });
      this.skillSys.lastProficiencyGain = undefined;
    }

    if (this.skillSys.lastCooldownDebug) {
      const cd = this.skillSys.lastCooldownDebug;
      if (cd.cooldownReduction > 0) {
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'Cooldown', message: `${cd.skillName}: ${cd.baseCd}s -> ${cd.effective.toFixed(1)}s (-${cd.cooldownReduction}% INT=${cd.totalINT})`, channel: 'system' }
        });
      }
      this.skillSys.lastCooldownDebug = undefined;
    }

        if (this.skillSys.lastBuffDebug) {
          this.sendToPlayer(session.characterId, {
            type: PacketType.CHAT_MESSAGE,
            timestamp: Date.now(),
            data: { sender: 'Debug', message: this.skillSys.lastBuffDebug, channel: 'system' }
          });
          this.skillSys.lastBuffDebug = undefined;
        }

        this.sendToPlayer(session.characterId, {
          type: PacketType.COOLDOWN_UPDATE,
          timestamp: Date.now(),
          data: {
            skillName: castResult.skillName,
            type: 'used',
            mpCost: this.skillSys.findSkillDefinition(castResult.skillName)?.mpCost || 0,
            cooldownRemaining: session.skillCooldowns.find(c => c.skillName === castResult.skillName)?.readyAt
              ? Math.max(0, (session.skillCooldowns.find(c => c.skillName === castResult.skillName)!.readyAt - Date.now()))
              : 0
          }
        });

        if (result.missed && castResult.targetId) {
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: session.characterId,
              targetId: castResult.targetId,
              damage: 0,
              isCritical: false,
              damageType: result.damageType || 'physical',
              skillName: castResult.skillName,
              missed: true
            }
          });
        } else if (result.damage && castResult.targetId) {
          const enemy = this.spawnMgr.getEnemy(castResult.targetId);
          if (enemy) {
            const { died } = this.damageEnemy(enemy, result.damage, session.characterId);
            if (result.elementalDamage) {
              for (const el of result.elementalDamage) {
                this.damageEnemy(enemy, el.damage, session.characterId);
              }
            }
            this.broadcastInZone(session.zoneId, {
              type: PacketType.DAMAGE,
              timestamp: Date.now(),
              data: { attackerId: session.characterId, targetId: castResult.targetId, damage: result.damage, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName, elementalDamage: result.elementalDamage, missed: result.missed || undefined }
            });
            if (died) {
              this.handleEnemyKill(castResult.targetId, session.characterId);
            } else {
              this.broadcastInZone(session.zoneId, {
                type: PacketType.STATS_UPDATE,
                timestamp: Date.now(),
                data: { entityId: castResult.targetId, health: enemy.health, maxHealth: enemy.maxHealth }
              });
            }
          } else {
            const playerTarget = this.state.players.get(castResult.targetId);
            if (playerTarget) {
              const totalDmg = result.damage + (result.elementalDamage?.reduce((s: number, e: any) => s + e.damage, 0) || 0);
              const pvpDmgResult = this.applyPlayerDamage(playerTarget, totalDmg, session.characterId, result.damageType || 'physical', result.isCritical || false, session.zoneId);
              if (!pvpDmgResult.redirected) {
                this.sendToPlayer(castResult.targetId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { characterId: castResult.targetId, stats: playerTarget.stats, statBreakdown: playerTarget.statBreakdown, skillProficiencies: playerTarget.skillProficiencies, skillAdeptness: playerTarget.skillAdeptness }
                });
                this.broadcastInZone(session.zoneId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { entityId: castResult.targetId, health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth }
                }, session.characterId);
                this.refreshPartyForMember(castResult.targetId);
                if (playerTarget.stats.health <= 0) {
                  this.handlePlayerDeath(playerTarget);
                }
              }
              this.broadcastInZone(session.zoneId, {
                type: PacketType.DAMAGE,
                timestamp: Date.now(),
                data: { attackerId: session.characterId, targetId: castResult.targetId, damage: pvpDmgResult.redirected ? 0 : pvpDmgResult.damageTaken, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName, elementalDamage: pvpDmgResult.redirected ? [] : result.elementalDamage, missed: result.missed || undefined }
              });
              this.consumeDebuffsOnHit(playerTarget);
            }
          }
        }

        if (result.revived && castResult.targetId) {
          this.handleRevivePlayerBySession(session, castResult.targetId);
        }

        if (result.healing) {
          const healTargetId = castResult.targetId && castResult.targetId !== session.characterId ? castResult.targetId : null;
          const healTarget = healTargetId ? this.state.players.get(healTargetId) : null;
          if (healTarget) {
            if (healTarget.isDead) return;
            healTarget.stats.health = Math.min(healTarget.stats.maxHealth, healTarget.stats.health + result.healing);
            this.broadcastInZone(session.zoneId, {
              type: PacketType.HEAL,
              timestamp: Date.now(),
              data: { targetId: castResult.targetId, amount: result.healing }
            });
            this.sendToPlayer(castResult.targetId!, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: castResult.targetId, stats: healTarget.stats }
            });
            this.broadcastInZone(session.zoneId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { entityId: castResult.targetId, health: healTarget.stats.health, maxHealth: healTarget.stats.maxHealth }
            }, session.characterId);
            this.refreshPartyForMember(castResult.targetId!);
          } else {
            if (!session.isDead) {
              session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + result.healing);
              this.sendToPlayer(session.characterId, {
                type: PacketType.HEAL,
                timestamp: Date.now(),
                data: { targetId: session.characterId, amount: result.healing }
              });
              this.refreshPartyForMember(session.characterId);
            }
          }
        }

        if (result.mpRestored) {
          this.sendToPlayer(session.characterId, {
            type: PacketType.HEAL,
            timestamp: Date.now(),
            data: { targetId: session.characterId, amount: result.mpRestored, mpRestore: true }
          });
        }

        if (result.manaSwap && castResult.targetId) {
          const target = this.state.players.get(castResult.targetId);
          if (target) {
            const casterMana = session.stats.mana;
            const targetMana = target.stats.mana;
            session.stats.mana = targetMana;
            target.stats.mana = casterMana;
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown }
            });
            this.sendToPlayer(castResult.targetId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: castResult.targetId, stats: target.stats, statBreakdown: target.statBreakdown }
            });
            this.refreshPartyForMember(session.characterId);
            this.refreshPartyForMember(castResult.targetId);
          }
        }

        if (result.soulSwap && castResult.targetId) {
          const target = this.state.players.get(castResult.targetId);
          if (target) {
            const casterBuffs = session.statusEffects.filter(e => !e.type.startsWith('DEBUFF_') && e.type !== StatusEffectType.CURSE);
            const targetBuffs = target.statusEffects.filter(e => !e.type.startsWith('DEBUFF_') && e.type !== StatusEffectType.CURSE);
            session.statusEffects = [...session.statusEffects.filter(e => e.type.startsWith('DEBUFF_') || e.type === StatusEffectType.CURSE), ...targetBuffs.map(b => ({ ...b, sourceId: session.characterId, targetId: session.characterId }))];
            target.statusEffects = [...target.statusEffects.filter(e => e.type.startsWith('DEBUFF_') || e.type === StatusEffectType.CURSE), ...casterBuffs.map(b => ({ ...b, sourceId: target.characterId, targetId: target.characterId }))];
            this.playerSys.recalcStats(session);
            this.playerSys.recalcStats(target);
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: session.statusEffects }
            });
            this.sendToPlayer(castResult.targetId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: target.statusEffects }
            });
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown }
            });
            this.sendToPlayer(castResult.targetId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: castResult.targetId, stats: target.stats, statBreakdown: target.statBreakdown }
            });
            this.broadcastEntityEffects(session);
            this.broadcastEntityEffects(target);
          }
        }

        this.sendToPlayer(session.characterId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: session.characterId, stats: session.stats }
        });

        this.sendToPlayer(session.characterId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: session.statusEffects }
        });
        this.broadcastEntityEffects(session);

        const castSkill = this.skillSys.findSkillDefinition(castResult.skillName);
        if (castSkill) {
          const castTargetType = SKILL_TARGET_RULES[castResult.skillName];
          if (castSkill.duration > 0 && castResult.targetId && castResult.targetId !== session.characterId && !castSkill.debuffEffectTable && !castSkill.isDebuff) {
            const shouldApply = !castTargetType
              || castTargetType === SkillTargetType.SELF_OR_TARGET
              || castTargetType === SkillTargetType.PARTY
              || castTargetType === SkillTargetType.OTHER_ONLY;
            if (shouldApply) {
              const tSession = this.state.players.get(castResult.targetId);
              if (tSession) {
                this.skillSys.applyBuffToTarget(tSession, session.characterId, castSkill, session);
                this.playerSys.recalcStats(tSession);
                if (this.skillSys.lastBuffDebug) {
                  this.sendToPlayer(session.characterId, {
                    type: PacketType.CHAT_MESSAGE,
                    timestamp: Date.now(),
                    data: { sender: 'Debug', message: this.skillSys.lastBuffDebug, channel: 'system' }
                  });
                  this.skillSys.lastBuffDebug = undefined;
                }
                this.sendToPlayer(castResult.targetId, {
                  type: PacketType.STATUS_EFFECT_UPDATE,
                  timestamp: Date.now(),
                  data: { effects: tSession.statusEffects }
                });
                this.sendToPlayer(castResult.targetId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { characterId: castResult.targetId, stats: tSession.stats }
                });
                this.broadcastEntityEffects(tSession);
              }
            }
          }

          if (castTargetType === SkillTargetType.PARTY) {
            const partyMembers = this.partySys.getPartyMembers(session.characterId);
            for (const memberId of partyMembers) {
              if (memberId === session.characterId) continue;
              const memberSession = this.state.players.get(memberId);
              if (!memberSession || memberSession.isDead || memberSession.stats.health <= 0) continue;
              if (memberSession.zoneId !== session.zoneId) continue;

              if (castSkill.duration > 0) {
                this.skillSys.applyBuffToTarget(memberSession, session.characterId, castSkill, session);
                this.playerSys.recalcStats(memberSession);
                if (this.skillSys.lastBuffDebug) {
                  this.sendToPlayer(session.characterId, {
                    type: PacketType.CHAT_MESSAGE,
                    timestamp: Date.now(),
                    data: { sender: 'Debug', message: this.skillSys.lastBuffDebug, channel: 'system' }
                  });
                  this.skillSys.lastBuffDebug = undefined;
                }
                this.sendToPlayer(memberId, {
                  type: PacketType.STATUS_EFFECT_UPDATE,
                  timestamp: Date.now(),
                  data: { effects: memberSession.statusEffects }
                });
                this.sendToPlayer(memberId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { characterId: memberId, stats: memberSession.stats }
                });
                this.broadcastInZone(session.zoneId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { entityId: memberId, health: memberSession.stats.health, maxHealth: memberSession.stats.maxHealth }
                }, memberId);
                this.broadcastEntityEffects(memberSession);
              }

    if (result.healing && !session.isDead) {
                memberSession.stats.health = Math.min(memberSession.stats.maxHealth, memberSession.stats.health + result.healing);
                this.sendToPlayer(memberId, {
                  type: PacketType.HEAL,
                  timestamp: Date.now(),
                  data: { targetId: memberId, amount: result.healing }
                });
                this.sendToPlayer(memberId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { characterId: memberId, stats: memberSession.stats }
                });
                this.broadcastInZone(session.zoneId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { entityId: memberId, health: memberSession.stats.health, maxHealth: memberSession.stats.maxHealth }
                }, session.characterId);
                this.refreshPartyForMember(memberId);
              }

              if (result.maxHpIncrease) {
                const hpIncrease = this.skillSys.calculateMaxHpBuff(memberSession, castSkill);
                const healthRatio = memberSession.stats.maxHealth > 0 ? memberSession.stats.health / memberSession.stats.maxHealth : 1;
                memberSession.stats.maxHealth += hpIncrease;
                memberSession.stats.health = Math.min(memberSession.stats.maxHealth, Math.floor(memberSession.stats.maxHealth * healthRatio) + hpIncrease);
                this.sendToPlayer(memberId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { characterId: memberId, stats: memberSession.stats }
                });
                this.broadcastInZone(session.zoneId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
                  data: { entityId: memberId, health: memberSession.stats.health, maxHealth: memberSession.stats.maxHealth }
                }, session.characterId);
                this.refreshPartyForMember(memberId);
              }

              if (result.mpRestored) {
                memberSession.stats.mana = Math.min(memberSession.stats.maxMana, memberSession.stats.mana + result.mpRestored);
                this.sendToPlayer(memberId, {
                  type: PacketType.HEAL,
                  timestamp: Date.now(),
                  data: { targetId: memberId, amount: result.mpRestored, mpRestore: true }
                });
              }
            }
          }
        }
        if (result.statusEffects && result.statusEffects.length > 0 && castResult.targetId) {
          const debuffTarget = this.state.players.get(castResult.targetId);
          if (debuffTarget) {
            for (const effect of result.statusEffects) {
              if (!this.shouldApplyDebuff(effect, castResult.targetId, session.characterId)) continue;
              if (this.hasActiveDebuff(castResult.targetId, effect.type, effect.skillName)) continue;
              effect.targetId = castResult.targetId;
              debuffTarget.statusEffects.push(effect);
            }
            this.playerSys.recalcStats(debuffTarget);
            this.sendToPlayer(castResult.targetId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: debuffTarget.statusEffects }
            });
            this.sendToPlayer(castResult.targetId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: castResult.targetId, stats: debuffTarget.stats }
            });
            this.broadcastEntityEffects(debuffTarget);
          } else {
            const debuffEnemy = this.spawnMgr.getEnemy(castResult.targetId);
            if (debuffEnemy && debuffEnemy.state !== 'dead') {
               let anyApplied = false;
               let maxPotency = 0;
               for (const effect of result.statusEffects) {
                 if (!this.shouldApplyDebuff(effect, castResult.targetId, session.characterId)) continue;
                 if (this.hasActiveDebuff(castResult.targetId, effect.type, effect.skillName)) continue;
                 effect.targetId = castResult.targetId;
                 debuffEnemy.statusEffects.push(effect);
                 anyApplied = true;
                 if (effect.potency > maxPotency) maxPotency = effect.potency;
               }
               this.enmity.addDebuffEnmity(debuffEnemy, session.characterId, maxPotency, anyApplied);
              this.broadcastInZone(session.zoneId, {
                type: PacketType.ENTITY_STATUS_EFFECTS,
                timestamp: Date.now(),
                data: { entityId: castResult.targetId, effects: debuffEnemy.statusEffects }
              });
            }
          }
        }

        if (!result.damage && (!result.statusEffects || result.statusEffects.length === 0) && !result.provoked && !result.healing && castResult.targetId) {
          const fallbackSkillDef = this.skillSys.findSkillDefinition(castResult.skillName);
          if (fallbackSkillDef) {
            const fst = fallbackSkillDef.skillType;
            if (fst === SkillType.DEBUFF || fst === SkillType.FEAR || fst === SkillType.DISPEL) {
              const fallbackEnemy = this.spawnMgr.getEnemy(castResult.targetId);
              if (fallbackEnemy && fallbackEnemy.state !== 'dead') {
                this.enmity.addDebuffEnmity(fallbackEnemy, session.characterId, 0, false);
              }
            }
          }
        }
      }

      if (session.statusEffects && session.statusEffects.length > 0) {
        const tick = this.skillSys.tickStatusEffects(session, now);
        if (tick.damage > 0) {
          const dotDmgResult = this.applyPlayerDamage(session, tick.damage, '', 'magical', false, session.zoneId);
          if (!dotDmgResult.redirected) {
            this.sendToPlayer(session.characterId, {
              type: PacketType.DAMAGE,
              timestamp: Date.now(),
              data: { attackerId: '', targetId: session.characterId, damage: dotDmgResult.damageTaken, isCritical: false, damageType: 'magical', skillName: 'dot' }
            });
            if (session.stats.health <= 0) {
              this.handlePlayerDeath(session);
            }
          }
        }
        if (tick.mpDamage > 0) {
          session.stats.mana = Math.max(0, session.stats.mana - tick.mpDamage);
          this.sendToPlayer(session.characterId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: { attackerId: '', targetId: session.characterId, damage: tick.mpDamage, isCritical: false, damageType: 'magical', skillName: 'mp_drain' }
          });
        }
        if (tick.mpRestored > 0) {
          session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + tick.mpRestored);
        }
        if (tick.healed > 0) {
          session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + tick.healed);
        }
        if (tick.expired.length > 0) {
          this.playerSys.recalcStats(session);
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown }
          });
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: session.statusEffects }
          });
          this.broadcastEntityEffects(session);
        }
      }

      if (session.stats.health > 0 && now - session.lastRegenTick >= REGEN_CONFIG.TICK_INTERVAL_MS) {
        const inCombat = now - session.lastAttackTime < REGEN_CONFIG.OUT_OF_COMBAT_DELAY_MS;
        const lpRegen = Math.floor(session.stats.maxHealth / REGEN_CONFIG.LP_DIVISOR)
          + Math.floor(session.statPoints.STA / REGEN_CONFIG.LP_STA_DIVISOR);
        const mpRegen = Math.floor(session.stats.maxMana / REGEN_CONFIG.MP_DIVISOR)
          + Math.floor(session.statPoints.SPI / REGEN_CONFIG.MP_SPI_DIVISOR);

        const lpGain = inCombat ? Math.floor(lpRegen * REGEN_CONFIG.IN_COMBAT_LP_MULTIPLIER) : lpRegen;
        const mpGain = inCombat ? Math.floor(mpRegen * REGEN_CONFIG.IN_COMBAT_MP_MULTIPLIER) : mpRegen;

        let changed = false;
        if (lpGain > 0 && session.stats.health < session.stats.maxHealth) {
          session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + lpGain);
          changed = true;
        }
        if (mpGain > 0 && session.stats.mana < session.stats.maxMana) {
          session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + mpGain);
          changed = true;
        }

        session.lastRegenTick = now;

        if (changed) {
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: session.characterId, stats: session.stats }
          });
          this.broadcastInZone(session.zoneId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { entityId: session.characterId, health: session.stats.health, maxHealth: session.stats.maxHealth }
          }, session.characterId);
          this.refreshPartyForMember(session.characterId);
        }
      }

      const blockStanceEffect = session.statusEffects?.find(
        e => e.type === StatusEffectType.BUFF_BLOCKING_STANCE && e.buffData?.blockingStance
      );
      if (blockStanceEffect) {
        const lastDrain = (blockStanceEffect as any).lastMpDrainAt || blockStanceEffect.appliedAt;
        if (now - lastDrain >= 2000) {
          (blockStanceEffect as any).lastMpDrainAt = now;
          session.stats.mana = Math.max(0, session.stats.mana - 2);
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown, skillProficiencies: session.skillProficiencies, skillAdeptness: session.skillAdeptness }
          });
          if (session.stats.mana <= 0) {
            session.statusEffects = session.statusEffects.filter(e => e !== blockStanceEffect);
            this.removeBlockingProtectedBuffs(session.characterId);
            this.playerSys.recalcStats(session);
            this.sendToPlayer(session.characterId, {
              type: PacketType.CHAT_MESSAGE,
              timestamp: Date.now(),
              data: { sender: 'System', message: 'Blocking ended - out of MP', channel: 'system' }
            });
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: session.statusEffects }
            });
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown, skillProficiencies: session.skillProficiencies, skillAdeptness: session.skillAdeptness }
            });
            this.broadcastEntityEffects(session);
          }
        }
      }

      const guardianRedirectFx = session.statusEffects?.find(
        e => e.type === StatusEffectType.BUFF_DAMAGE_REDIRECT && e.buffData?.damageRedirectTargetId
      );
      if (guardianRedirectFx && session.position) {
        const guardedCharId = guardianRedirectFx.buffData!.damageRedirectTargetId!;
        const guardedPlayer = this.state.players.get(guardedCharId);
        if (guardedPlayer && guardedPlayer.position) {
          const gdx = session.position.x - guardedPlayer.position.x;
          const gdy = session.position.y - guardedPlayer.position.y;
          const gdz = session.position.z - guardedPlayer.position.z;
          const gdist = Math.sqrt(gdx * gdx + gdy * gdy + gdz * gdz);
          if (gdist > 20) {
            session.statusEffects = session.statusEffects.filter(e => e !== guardianRedirectFx);
            this.playerSys.recalcStats(session);
            this.sendToPlayer(session.characterId, {
              type: PacketType.CHAT_MESSAGE,
              timestamp: Date.now(),
              data: { sender: 'System', message: 'Guardian link broken - target too far away', channel: 'system' }
            });
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: session.statusEffects }
            });
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown, skillProficiencies: session.skillProficiencies, skillAdeptness: session.skillAdeptness }
            });
            this.broadcastEntityEffects(session);
            guardedPlayer.statusEffects = guardedPlayer.statusEffects.filter(e => e.type !== StatusEffectType.BUFF_GUARDED);
            this.sendToPlayer(guardedCharId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: guardedPlayer.statusEffects }
            });
            this.broadcastEntityEffects(guardedPlayer);
          }
        }
      }

      if (session.statsDirty) {
        this.playerSys.recalcStats(session);
        session.statsDirty = false;
      }
    });
  }

  private tickEnemyStatusEffects(now: number): void {
    this.spawnMgr.iterateAllEnemies((enemy, enemyId) => {
      if (enemy.state === 'dead') return;
      if (!enemy.statusEffects || enemy.statusEffects.length === 0) return;

      const fakeSession: any = {
        stats: { health: enemy.health, maxHealth: enemy.maxHealth, mana: 0, maxMana: 0, attack: 0, defense: 0, speed: 0, speedMultiplier: 1, magicAttack: 0, critChance: 0, castSpeed: 1, level: enemy.level, experience: 0, experienceToNext: 0 },
        statPoints: { STR: 0, AGI: 0, INT: 0, SPI: 0, DEX: 0, STA: 0 },
        statusEffects: enemy.statusEffects,
        skillCooldowns: [],
        activeCast: null,
      };

      const tick = this.skillSys.tickStatusEffects(fakeSession, now);

      const zoneId = this.findZoneOfEnemy(enemyId);
      if (!zoneId) return;

      if (tick.damage > 0) {
        const { died } = this.damageEnemy(enemy, tick.damage);
        this.broadcastInZone(zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: '', targetId: enemyId, damage: tick.damage, isCritical: false, damageType: 'magical', skillName: 'dot' }
        });
        this.broadcastInZone(zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: enemyId, health: enemy.health, maxHealth: enemy.maxHealth }
        });
        if (died) {
          enemy.state = 'dead';
          enemy.deathTime = now;
          this.broadcastInZone(zoneId, {
            type: PacketType.DEATH,
            timestamp: Date.now(),
            data: { entityId: enemyId, killerId: '' }
          });
          this.broadcastInZone(zoneId, {
            type: PacketType.ENTITY_DESPAWN,
            timestamp: Date.now(),
            data: { entityId: enemyId }
          });
        }
      }

      if (tick.expired.length > 0) {
        this.broadcastInZone(zoneId, {
          type: PacketType.ENTITY_STATUS_EFFECTS,
          timestamp: Date.now(),
          data: { entityId: enemyId, effects: enemy.statusEffects }
        });
      }
    });
  }

  private tickSummons(now: number): void {
    const expired = this.summonMgr.tickExpired();
    for (const info of expired) {
      this.broadcastInZone(info.zoneId, {
        type: PacketType.ENTITY_DESPAWN,
        timestamp: Date.now(),
        data: { entityId: info.id },
      });
    }

    const nowSec = now / 1000;
    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const summons = this.summonMgr.getSummonsInZone(zoneId);
      if (summons.length === 0) continue;

      const zoneEnemies = this.spawnMgr.getEnemiesInZone(zoneId);

      for (const summon of summons) {
        if (summon.health <= 0) {
          this.summonMgr.despawnSummon(summon.id);
          this.broadcastInZone(zoneId, {
            type: PacketType.ENTITY_DESPAWN,
            timestamp: Date.now(),
            data: { entityId: summon.id },
          });
          continue;
        }

        if (summon.summonType === 'plant') {
          this.tickPlantAttack(summon, zoneEnemies, nowSec);
        } else if (summon.summonType === 'wyvern') {
          this.tickWyvern(summon, zoneEnemies, nowSec);
        } else if (summon.summonType === 'turtle') {
          this.tickTurtleEarthquake(summon, zoneEnemies, nowSec);
        }
      }
    }
  }

  private tickPlantAttack(summon: import('@dust-saga/shared').SummonInstance, zoneEnemies: Map<string, import('@dust-saga/shared').EnemyInstance>, nowSec: number): void {
    if (nowSec - summon.lastAttackTime < summon.attackCooldown) return;

    let closestId: string | null = null;
    let closestDistSq = summon.attackRange * summon.attackRange;

    for (const [enemyId, enemy] of zoneEnemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - summon.position.x;
      const dz = enemy.position.z - summon.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestId = enemyId;
      }
    }

    if (!closestId) return;

    summon.lastAttackTime = nowSec;
    const enemy = zoneEnemies.get(closestId)!;
    const enemyDef = this.getEnemyEffectiveDefense(enemy);
    const damage = Math.max(1, summon.attackDamage - Math.floor(enemyDef * 0.5));

    const { died } = this.damageEnemy(enemy, damage, summon.ownerId);
    this.enmity.addDamageEnmity(enemy, summon.id, damage);

    this.broadcastInZone(summon.zoneId, {
      type: PacketType.ATTACK,
      timestamp: Date.now(),
      data: {
        attackerId: summon.id,
        targetId: closestId,
        damage,
        isCritical: false,
        damageType: summon.element || 'physical',
      },
    });

    if (died) {
      this.handleEnemyKill(closestId, summon.ownerId);
    }
  }

  private tickWyvern(summon: import('@dust-saga/shared').SummonInstance, zoneEnemies: Map<string, import('@dust-saga/shared').EnemyInstance>, nowSec: number): void {
    const WANDER_RADIUS = 10;
    const dt = 1 / this.tickRate;
    const speed = SUMMON_STATS[summon.summonType as keyof typeof SUMMON_STATS].speed;

    if (summon.wanderTarget) {
      const wdx = summon.wanderTarget.x - summon.position.x;
      const wdz = summon.wanderTarget.z - summon.position.z;
      const wDist = Math.sqrt(wdx * wdx + wdz * wdz);
      if (wDist > 1) {
        summon.position.x += (wdx / wDist) * speed * dt;
        summon.position.z += (wdz / wDist) * speed * dt;
        summon.rotation = Math.atan2(wdx, wdz);
      } else {
        summon.wanderTarget = null;
        summon.wanderCooldown = nowSec + 0.5 + Math.random() * 1.5;
      }
    } else if (nowSec >= summon.wanderCooldown) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 3 + Math.random() * (WANDER_RADIUS - 3);
      summon.wanderTarget = {
        x: summon.spawnPosition.x + Math.cos(angle) * dist,
        z: summon.spawnPosition.z + Math.sin(angle) * dist,
      };
    }

    if (nowSec - summon.lastAttackTime < summon.attackCooldown) return;

    const aoeRange = summon.attackRange;
    const aoeRangeSq = aoeRange * aoeRange;
    const hitEnemies: Array<{ id: string; enemy: import('@dust-saga/shared').EnemyInstance; distSq: number }> = [];

    for (const [enemyId, enemy] of zoneEnemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - summon.position.x;
      const dz = enemy.position.z - summon.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= aoeRangeSq) {
        hitEnemies.push({ id: enemyId, enemy, distSq });
      }
    }

    if (hitEnemies.length === 0) return;

    summon.lastAttackTime = nowSec;

    this.broadcastInZone(summon.zoneId, {
      type: PacketType.ATTACK,
      timestamp: Date.now(),
      data: {
        attackerId: summon.id,
        targetId: null,
        damage: summon.attackDamage,
        isCritical: false,
        damageType: 'fire',
        aoeRadius: aoeRange,
      },
    });

    for (const { id, enemy } of hitEnemies) {
      const enemyDef = this.getEnemyEffectiveDefense(enemy);
      const damage = Math.max(1, summon.attackDamage - Math.floor(enemyDef * 0.5));
      const { died } = this.damageEnemy(enemy, damage, summon.ownerId);
      this.enmity.addDamageEnmity(enemy, summon.id, damage);

      this.broadcastInZone(summon.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: {
          attackerId: summon.id,
          targetId: id,
          damage,
          isCritical: false,
          damageType: 'fire',
        },
      });

      if (died) {
        this.handleEnemyKill(id, summon.ownerId);
      }
    }
  }

  private tickTurtleEarthquake(summon: import('@dust-saga/shared').SummonInstance, zoneEnemies: Map<string, import('@dust-saga/shared').EnemyInstance>, nowSec: number): void {
    if (nowSec - summon.lastAttackTime < summon.attackCooldown) return;

    const aoeRange = summon.attackRange;
    const aoeRangeSq = aoeRange * aoeRange;
    const hitEnemies: Array<{ id: string; enemy: import('@dust-saga/shared').EnemyInstance }> = [];

    for (const [enemyId, enemy] of zoneEnemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - summon.position.x;
      const dz = enemy.position.z - summon.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= aoeRangeSq) {
        hitEnemies.push({ id: enemyId, enemy });
      }
    }

    if (hitEnemies.length === 0) return;

    summon.lastAttackTime = nowSec;

    this.broadcastInZone(summon.zoneId, {
      type: PacketType.ATTACK,
      timestamp: Date.now(),
      data: {
        attackerId: summon.id,
        targetId: null,
        damage: summon.attackDamage,
        isCritical: false,
        damageType: 'earth',
        aoeRadius: aoeRange,
      },
    });

    for (const { id, enemy } of hitEnemies) {
      const enemyDef = this.getEnemyEffectiveDefense(enemy);
      const damage = Math.max(1, summon.attackDamage - Math.floor(enemyDef * 0.5));
      const { died } = this.damageEnemy(enemy, damage, summon.ownerId);
      this.enmity.addDamageEnmity(enemy, summon.id, damage);

      this.broadcastInZone(summon.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: {
          attackerId: summon.id,
          targetId: id,
          damage,
          isCritical: false,
          damageType: 'earth',
        },
      });

      if (died) {
        this.handleEnemyKill(id, summon.ownerId);
      }
    }
  }

  private findClosestEnemyToPosition(zoneId: string, pos: { x: number; y: number; z: number }, range: number): string | null {
    const zoneEnemies = this.spawnMgr.getEnemiesInZone(zoneId);
    let closestId: string | null = null;
    let closestDist = range;
    for (const [id, enemy] of zoneEnemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - pos.x;
      const dz = enemy.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = id;
      }
    }
    return closestId;
  }

  private tickAI(now: number): void {
    this.aiTickBucket = (this.aiTickBucket + 1) % this.AI_TICK_STAGGER;

    const reusableZonePlayers = new Map<string, Map<string, { position: { x: number; y: number; z: number }; characterId: string }>>();

    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const zonePlayerIds = this.zonePlayerIndex.get(zoneId);
      let zonePlayers = reusableZonePlayers.get(zoneId);
      if (!zonePlayers) {
        zonePlayers = new Map();
        reusableZonePlayers.set(zoneId, zonePlayers);
      }
      zonePlayers.clear();
      if (zonePlayerIds) {
        for (const cid of zonePlayerIds) {
          const s = this.state.players.get(cid);
          if (!s || s.isDead || s.invulnerableUntil > now) continue;
          if (s.statusEffects?.some(e => e.type === StatusEffectType.INVISIBLE)) continue;
          if (s.statusEffects?.some(e => e.buffData?.misdirection)) continue;
          zonePlayers.set(cid, { position: s.position, characterId: cid });
        }
      }

      const zoneSummons = new Map<string, { position: { x: number; y: number; z: number }; summonId: string }>();
      for (const summon of this.summonMgr.getSummonsInZone(zoneId)) {
        zoneSummons.set(summon.id, { position: summon.position, summonId: summon.id });
      }

      this.ai.updateEnemies(this.spawnMgr.getEnemiesInZone(zoneId), zonePlayers, zoneSummons, 1 / this.tickRate);
    }
  }

  private tickEntityAOEEntries(): void {
    if (this.activeAOEZones.size === 0) return;
    for (const zoneId of this.spawnMgr.getZoneIds()) {
        const zoneEnemies = this.spawnMgr.getEnemiesInZone(zoneId);
        if (!zoneEnemies) continue;
        for (const [enemyId, enemy] of zoneEnemies) {
          if (enemy.state === 'dead') continue;
          this.checkEntityAOEEntries(enemyId, enemy.position);
        }
    }
  }

  private tickKnockback(): void {
    const speed = 15;
    const dt = 1 / this.tickRate;
    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const enemies = this.spawnMgr.getEnemiesInZone(zoneId);
      if (enemies) {
        for (const [, enemy] of enemies) {
          if (enemy.state === 'dead') continue;
          const def = getEnemyDefinition(enemy.enemyType);
          if (def?.knockbackImmune) continue;
          const kb = enemy.statusEffects?.find(e => e.debuffCategory === 'knockback' && e.knockbackVelocity && e.knockbackVelocity.remaining > 0);
          if (!kb) continue;
          const v = kb.knockbackVelocity!;
          const step = Math.min(v.remaining, speed * dt);
          enemy.position.x += v.dx * step;
          enemy.position.z += v.dz * step;
          v.remaining -= step;
          if (v.remaining <= 0) {
            const idx = enemy.statusEffects.indexOf(kb);
            if (idx !== -1) enemy.statusEffects.splice(idx, 1);
          }
        }
      }

      const zonePlayerIds = this.zonePlayerIndex.get(zoneId);
      if (zonePlayerIds) {
        for (const cid of zonePlayerIds) {
          const player = this.state.players.get(cid);
          if (!player || player.isDead) continue;
          const kb = player.statusEffects?.find(e => e.debuffCategory === 'knockback' && e.knockbackVelocity && e.knockbackVelocity.remaining > 0);
          if (!kb) continue;
          const v = kb.knockbackVelocity!;
          const step = Math.min(v.remaining, speed * dt);
          player.position.x += v.dx * step;
          player.position.z += v.dz * step;
          v.remaining -= step;
          if (v.remaining <= 0) {
            const idx = player.statusEffects.indexOf(kb);
            if (idx !== -1) player.statusEffects.splice(idx, 1);
          }
        }
      }
    }
  }

  private updateEnemySpatialHash(): void {
    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const zoneEnemies = this.spawnMgr.getEnemiesInZone(zoneId);
      if (!zoneEnemies) continue;
      for (const [enemyId, enemy] of zoneEnemies) {
        if (enemy.state !== 'dead' && enemy.position) {
          this.enemySpatialHash.move(enemyId, enemy.position.x, enemy.position.z);
        }
      }
    }
  }

  private broadcastEntityStates(): void {
    const RADIUS_SQ = NetworkServer.INTEREST_RADIUS_SQ;

    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const zoneEnemies = this.spawnMgr.getEnemiesInZone(zoneId);
      if (!zoneEnemies) continue;
      const zonePlayerIds = this.zonePlayerIndex.get(zoneId);
      if (!zonePlayerIds || zonePlayerIds.size === 0) continue;

      const aliveEnemies: Array<{ id: string; position: { x: number; y: number; z: number }; rotation: number; state: string; health: number; maxHealth: number; targetId: string | null }> = [];
      for (const [enemyId, enemy] of zoneEnemies) {
        if (enemy.state === 'dead') continue;
        aliveEnemies.push({ id: enemyId, position: enemy.position, rotation: enemy.rotation, state: enemy.state, health: enemy.health, maxHealth: enemy.maxHealth, targetId: enemy.targetId });
      }

      for (const characterId of zonePlayerIds) {
        const player = this.state.players.get(characterId);
        if (!player || !player.position) continue;

        const visible: typeof aliveEnemies = [];
        const px = player.position.x;
        const pz = player.position.z;

        for (let i = 0; i < aliveEnemies.length; i++) {
          const e = aliveEnemies[i];
          const dx = e.position.x - px;
          const dz = e.position.z - pz;
          if (dx * dx + dz * dz <= RADIUS_SQ) {
            visible.push(e);
          }
        }

        if (visible.length > 0) {
          this.sendToPlayer(characterId, {
            type: PacketType.PLAYER_POSITION_UPDATE,
            timestamp: Date.now(),
            data: {
              entities: visible.map(e => ({
                id: e.id,
                position: e.position,
                rotation: { x: 0, y: e.rotation, z: 0, w: 1 },
                state: e.state,
                health: e.health,
                maxHealth: e.maxHealth,
                targetId: e.targetId
              }))
            }
          });
        }
      }

      const zoneSummons = this.summonMgr.getSummonsInZone(zoneId);
      if (zoneSummons.length > 0) {
        const summonStates = zoneSummons.map(s => ({
          id: s.id,
          position: s.position,
          rotation: { x: 0, y: s.rotation, z: 0, w: 1 },
          health: s.health,
          maxHealth: s.maxHealth,
          summonType: s.summonType,
          ownerId: s.ownerId,
        }));
        for (const characterId of zonePlayerIds) {
          this.sendToPlayer(characterId, {
            type: PacketType.PLAYER_POSITION_UPDATE,
            timestamp: Date.now(),
            data: { summons: summonStates },
          });
        }
      }
    }
  }

  spawnDummy(session: PlayerSession): void {
    this.dummyCounter++;
    const dummyId = `dummy_${Date.now()}_${this.dummyCounter}`;
    const dummyJob: JobId = JobId.WARRIOR;
    const dummyPosition = { x: session.position.x + 3, y: session.position.y, z: session.position.z };

    const dummySession: PlayerSession = {
      playerId: 'gm_dummy',
      socketId: '',
      username: 'gm_dummy',
      characterId: dummyId,
      characterName: `Dummy_${this.dummyCounter}`,
      race: 'human',
      jobId: dummyJob,
      baseClass: BaseClass.WARRIOR,
      stats: { health: 100, maxHealth: 100, mana: 50, maxMana: 50, attack: 10, defense: 5, speed: 1, speedMultiplier: 1, magicAttack: 5, critChance: 0.05, castSpeed: 1, level: 1, experience: 0, experienceToNext: 100 },
      statPoints: { STR: 5, AGI: 5, INT: 5, SPI: 5, DEX: 5, STA: 5 },
      baseStats: { STR: 5, AGI: 5, INT: 5, SPI: 5, DEX: 5, STA: 5 },
      unspentStatPoints: 0,
      unspentSkillPoints: 0,
      skillProficiencies: createDefaultSkillProficiencies(),
      skillAdeptness: createDefaultSkillAdeptness(getDesignJobId(dummyJob)),
      position: { ...dummyPosition },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      zoneId: session.zoneId,
      targetId: null,
      lastAttackTime: 0,
      lastManualAttackTime: 0,
      lastRegenTick: 0,
      invulnerableUntil: Date.now() + 999999999,
      isDead: false,
      deathTime: 0,
      nation: null,
      lastSafeZoneId: session.zoneId,
      skillCooldowns: [],
      activeCast: null,
      statusEffects: [],
      statBreakdown: null,
      inventory: [],
      gold: 0,
      equipment: normalizeEquipment(null),
      quests: [],
    };

    this.state.players.set(dummyId, dummySession);
    this.registerPlayerInZone(dummyId, session.zoneId);
    this.dummyMeta.set(dummyId, {
      ownerId: session.characterId,
      isPvp: false,
      isWalking: false,
      walkPoints: [
        { x: dummyPosition.x - 5, y: dummyPosition.y, z: dummyPosition.z },
        { x: dummyPosition.x + 5, y: dummyPosition.y, z: dummyPosition.z },
      ],
      walkIndex: 0,
      walkDir: 1,
      inParty: false,
    });

    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_SPAWN,
      timestamp: Date.now(),
      data: {
        id: dummyId,
        type: 'player',
        position: dummyPosition,
        rotation: dummySession.rotation,
        data: {
          name: dummySession.characterName,
          class: dummySession.jobId,
          race: dummySession.race,
          jobId: dummySession.jobId,
          level: dummySession.stats.level,
          health: dummySession.stats.health,
          maxHealth: dummySession.stats.maxHealth,
          modelFile: JOB_DEFINITIONS[dummySession.jobId]?.modelFile || 'Adventurer.glb'
        }
      }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `SPAWNED ${dummyId}`, channel: 'system' }
    });
  }

  despawnDummy(dummyId: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    if (meta.inParty) {
      this.partySys.leaveParty(dummyId);
    }

    this.state.players.delete(dummyId);
    this.unregisterPlayerFromZone(dummyId);
    this.dummyMeta.delete(dummyId);
    this.clearMovementThrottle(dummyId);

    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_DESPAWN,
      timestamp: Date.now(),
      data: { entityId: dummyId }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `DESPAWNED ${dummyId}`, channel: 'system' }
    });
  }

  setDummyProperty(dummyId: string, prop: string, value: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    const dummy = this.state.players.get(dummyId);
    if (!dummy) return;

    const num = parseFloat(value);
    if (isNaN(num)) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Invalid value: ${value}`, channel: 'system' } });
      return;
    }

    const propMap: Record<string, (v: number) => void> = {
      str: (v) => { dummy.statPoints.STR = v; dummy.baseStats.STR = v; },
      dex: (v) => { dummy.statPoints.DEX = v; dummy.baseStats.DEX = v; },
      agi: (v) => { dummy.statPoints.AGI = v; dummy.baseStats.AGI = v; },
      int: (v) => { dummy.statPoints.INT = v; dummy.baseStats.INT = v; },
      spi: (v) => { dummy.statPoints.SPI = v; dummy.baseStats.SPI = v; },
      sta: (v) => { dummy.statPoints.STA = v; dummy.baseStats.STA = v; },
      level: (v) => { dummy.stats.level = Math.max(1, Math.min(v, MAX_LEVEL)); },
      hp: (v) => { dummy.stats.health = v; dummy.stats.maxHealth = Math.max(dummy.stats.maxHealth, v); },
      maxhp: (v) => { dummy.stats.maxHealth = v; dummy.stats.health = Math.min(dummy.stats.health, v); },
      mp: (v) => { dummy.stats.mana = v; dummy.stats.maxMana = Math.max(dummy.stats.maxMana, v); },
      maxmp: (v) => { dummy.stats.maxMana = v; dummy.stats.mana = Math.min(dummy.stats.mana, v); },
      attack: (v) => { dummy.stats.attack = v; },
      defense: (v) => { dummy.stats.defense = v; },
      speed: (v) => { dummy.stats.speed = v; },
      crit: (v) => { dummy.stats.critChance = v; },
    };

    const setter = propMap[prop.toLowerCase()];
    if (!setter) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Unknown prop "${prop}". Valid: ${Object.keys(propMap).join(', ')}`, channel: 'system' } });
      return;
    }

    setter(num);
    this.playerSys.recalcStats(dummy);

    this.broadcastInZone(dummy.zoneId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { entityId: dummyId, health: dummy.stats.health, maxHealth: dummy.stats.maxHealth, level: dummy.stats.level }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `SET ${dummyId} ${prop}=${num}`, channel: 'system' }
    });
  }

  setDummyClass(dummyId: string, jobIdStr: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    const dummy = this.state.players.get(dummyId);
    if (!dummy) return;

    const validJobs = Object.values(JobId) as string[];
    const targetJob = validJobs.find(j => j.toLowerCase() === jobIdStr.toLowerCase());
    if (!targetJob) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Invalid job "${jobIdStr}".`, channel: 'system' } });
      return;
    }

    dummy.jobId = targetJob as JobId;
    dummy.baseClass = getBaseClassForJob(targetJob as JobId);
    this.playerSys.recalcStats(dummy);

    this.broadcastInZone(dummy.zoneId, {
      type: PacketType.ENTITY_DESPAWN,
      timestamp: Date.now(),
      data: { entityId: dummyId }
    });

    this.broadcastInZone(dummy.zoneId, {
      type: PacketType.ENTITY_SPAWN,
      timestamp: Date.now(),
      data: {
        id: dummyId,
        type: 'player',
        position: dummy.position,
        rotation: dummy.rotation,
        data: {
          name: dummy.characterName,
          class: dummy.jobId,
          race: dummy.race,
          jobId: dummy.jobId,
          level: dummy.stats.level,
          health: dummy.stats.health,
          maxHealth: dummy.stats.maxHealth,
          modelFile: JOB_DEFINITIONS[dummy.jobId]?.modelFile || 'Adventurer.glb'
        }
      }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `CLASS ${dummyId} ${targetJob}`, channel: 'system' }
    });
  }

  setDummyGear(dummyId: string, preset: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    const dummy = this.state.players.get(dummyId);
    if (!dummy) return;

    const presets: Record<string, Record<string, string | null>> = {
      naked: { weapon: null, armor: null, helmet: null, boots: null, gloves: null, legs: null, shield: null },
      common: { weapon: 'wooden_sword', armor: 'leather_armor', helmet: 'cloth_helmet', boots: 'leather_boots', gloves: null, legs: null, shield: null },
      rare: { weapon: 'steel_blade', armor: 'plate_armor', helmet: 'iron_helmet', boots: 'swift_boots', gloves: 'chain_gloves', legs: 'chain_leggings', shield: null },
      legendary: { weapon: 'legendary_blade', armor: 'dragon_plate', helmet: 'dragon_helm', boots: 'dragon_greaves', gloves: 'dragon_gauntlets', legs: 'dragon_leggings', shield: 'tower_shield' },
    };

    const gearPreset = presets[preset.toLowerCase()];
    if (!gearPreset) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Unknown preset "${preset}". Valid: ${Object.keys(presets).join(', ')}`, channel: 'system' } });
      return;
    }

    for (const [slot, itemId] of Object.entries(gearPreset)) {
      if (itemId && ITEM_DATABASE[itemId]) {
        (dummy.equipment as any)[slot] = { itemId, enhancementLevel: 0, enhancementElement: null, quantity: 1, slot: 0 };
      } else {
        (dummy.equipment as any)[slot] = null;
      }
    }

    this.playerSys.recalcStats(dummy);

    this.broadcastInZone(dummy.zoneId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { entityId: dummyId, health: dummy.stats.health, maxHealth: dummy.stats.maxHealth, level: dummy.stats.level }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `GEAR ${dummyId} ${preset}`, channel: 'system' }
    });
  }

  toggleDummyPvp(dummyId: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    const dummy = this.state.players.get(dummyId);
    if (!dummy) return;

    meta.isPvp = !meta.isPvp;
    dummy.invulnerableUntil = meta.isPvp ? 0 : Date.now() + 999999999;
    dummy.stats.health = dummy.stats.maxHealth;
    dummy.isDead = false;

    this.broadcastInZone(dummy.zoneId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { entityId: dummyId, health: dummy.stats.health, maxHealth: dummy.stats.maxHealth }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `PVP ${dummyId} ${meta.isPvp ? 'on' : 'off'}`, channel: 'system' }
    });
  }

  toggleDummyWalk(dummyId: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    const dummy = this.state.players.get(dummyId);
    if (!dummy) return;

    meta.isWalking = !meta.isWalking;
    if (meta.isWalking) {
      meta.walkPoints = [
        { x: dummy.position.x - 5, y: dummy.position.y, z: dummy.position.z },
        { x: dummy.position.x + 5, y: dummy.position.y, z: dummy.position.z },
      ];
      meta.walkIndex = 0;
      meta.walkDir = 1;
    }

    this.sendToPlayer(session.characterId, {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { sender: 'GM', message: `WALK ${dummyId} ${meta.isWalking ? 'on' : 'off'}`, channel: 'system' }
    });
  }

  toggleDummyParty(dummyId: string, session: PlayerSession): void {
    const meta = this.dummyMeta.get(dummyId);
    if (!meta || meta.ownerId !== session.characterId) {
      this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: `Dummy "${dummyId}" not found.`, channel: 'system' } });
      return;
    }

    const dummy = this.state.players.get(dummyId);
    if (!dummy) return;

    if (meta.inParty) {
      const result = this.partySys.leaveParty(dummyId);
      if (result) {
        meta.inParty = false;
        this.sendPartyUpdate(result.party.partyId);
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'GM', message: `PARTY ${dummyId} removed`, channel: 'system' }
        });
      }
    } else {
      let party = this.partySys.getPartyForMember(session.characterId);
      if (!party) {
        party = this.partySys.createParty(session.characterId, session, { visibility: PartyVisibility.OPEN, lootRule: LootRule.RANDOM });
        if (!party) {
          this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'GM', message: 'Failed to create party.', channel: 'system' } });
          return;
        }
        this.sendPartyUpdate(party.partyId);
      }

      const joined = this.partySys.joinParty(party.partyId, dummyId, dummy);
      if (joined) {
        meta.inParty = true;
        this.sendPartyUpdate(party.partyId);
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'GM', message: `PARTY ${dummyId} added`, channel: 'system' }
        });
      } else {
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'GM', message: 'Failed to add dummy to party (full or already in one).', channel: 'system' }
        });
      }
    }
  }

  private tickDummies(): void {
    const now = Date.now();
    for (const [dummyId, meta] of this.dummyMeta) {
      if (!meta.isWalking) continue;
      const dummy = this.state.players.get(dummyId);
      if (!dummy || dummy.isDead) continue;

      const target = meta.walkPoints[meta.walkIndex];
      if (!target) continue;

      const dx = target.x - dummy.position.x;
      const dz = target.z - dummy.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const speed = 3;
      if (dist < 0.5) {
        meta.walkIndex += meta.walkDir;
        if (meta.walkIndex >= meta.walkPoints.length) {
          meta.walkIndex = meta.walkPoints.length - 2;
          meta.walkDir = -1;
        } else if (meta.walkIndex < 0) {
          meta.walkIndex = 1;
          meta.walkDir = 1;
        }
      } else {
        const dirX = dx / dist;
        const dirZ = dz / dist;
        dummy.position.x += dirX * speed * (1 / this.tickRate);
        dummy.position.z += dirZ * speed * (1 / this.tickRate);
        dummy.rotation.y = Math.atan2(dirX, dirZ);
      }

      this.broadcastInZone(dummy.zoneId, {
        type: PacketType.PLAYER_POSITION_UPDATE,
        timestamp: now,
        data: {
          characterId: dummyId,
          position: dummy.position,
          rotation: dummy.rotation
        }
      });
    }
  }

  async saveAllCharacters(): Promise<void> {
    const sessions = [...this.state.players.values()];
    const BATCH_SIZE = 50;
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(session =>
        this.auth.saveCharacter(session.characterId, {
          level: session.stats.level,
          experience: session.stats.experience,
          position: session.position,
          zoneId: session.zoneId,
          statPoints: session.statPoints,
          unspentStatPoints: session.unspentStatPoints,
          unspentSkillPoints: session.unspentSkillPoints,
          skillProficiencies: session.skillProficiencies,
            skillAdeptness: session.skillAdeptness,
            jobId: session.jobId,
            nation: session.nation,
            lastSafeZoneId: session.lastSafeZoneId,
            inventory: session.inventory,
            equipment: session.equipment,
            gold: session.gold,
        }).catch(err => console.error(`Failed to save ${session.characterId}:`, err))
      ));
    }
    console.log(`Saved ${sessions.length} character(s)`);
  }

  getSpawnManager(): SpawnManager {
    return this.spawnMgr;
  }

  populateEnemySpatialHash(): void {
    this.spawnMgr.iterateAllEnemies(enemy => {
      if (enemy.state !== 'dead') {
        this.enemySpatialHash.insert(enemy.id, enemy.position.x, enemy.position.z, enemy);
      }
    });
  }

  getGameState(): ServerGameState {
    return this.state;
  }

  getTickRate(): number {
    return this.tickRate;
  }

  getLastMoveBroadcast(characterId: string): number {
    return this.lastMoveBroadcast.get(characterId) || 0;
  }

  setLastMoveBroadcast(characterId: string, time: number): void {
    this.lastMoveBroadcast.set(characterId, time);
  }

  clearMovementThrottle(characterId: string): void {
    this.lastMoveBroadcast.delete(characterId);
  }
}
