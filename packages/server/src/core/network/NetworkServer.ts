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
  BuffData, resolveSpiTieredValue,
  getEffectiveStats,
  computeAilmentResist, computeDisorderResist, computeDebuffAccuracy, rollDebuffApplication,
  calculateWeaponElementalDamage,
  calculateDodge,
  calculateHitChance,
  NATION_ZONE_MAP,
  ZoneType,
  normalizeEquipment,
  getEnemyDefinition, getZoneDefinition, NPC_DATABASE, getNPCsInZone, getItem, getQuest, QUEST_DATABASE, ITEM_DATABASE,
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
import { v4 as uuidv4 } from 'uuid';
import { NetworkContext, ServerGameState, PacketHandler } from './NetworkContext';
import { registerAllHandlers } from './handlers';

export class NetworkServer implements NetworkContext {
  private io: SocketIOServer;
  readonly auth: AuthManager;
  readonly combat: CombatSystem;
  readonly ai: AISystem;
  readonly loot: LootSystem;
  readonly playerSys: PlayerSystem;
  readonly skillSys: SkillSystem;
  readonly partySys: PartySystem;
  readonly spawnMgr: SpawnManager;
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
    this.spawnMgr = new SpawnManager();
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
    for (const [characterId, socket] of this.state.playerToSocket) {
      if (socket === socketId) return characterId;
    }
    return undefined;
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

  sendToPlayer(characterId: string, packet: Packet): void {
    const socketId = this.state.playerToSocket.get(characterId);
    if (socketId) {
      this.sendToSocket(socketId, packet);
    }
  }

  broadcastInZone(zoneId: string, packet: Packet, excludeCharacterId?: string): void {
    this.state.players.forEach(session => {
      if (session.zoneId !== zoneId) return;
      if (excludeCharacterId && session.characterId === excludeCharacterId) return;
      const socketId = this.state.playerToSocket.get(session.characterId);
      if (socketId) {
        this.io.to(socketId).emit('packet', packet);
      }
    });
  }

  broadcastEntityEffects(session: PlayerSession): void {
    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_STATUS_EFFECTS,
      timestamp: Date.now(),
      data: { entityId: session.characterId, effects: session.statusEffects }
    }, session.characterId);
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

    this.spawnMgr.getAllEnemies().forEach(enemy => {
      if (enemy.targetId === session.characterId) {
        enemy.state = 'return';
        enemy.targetId = null;
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
    const negationEffect = target.statusEffects?.find(
      e => e.type === StatusEffectType.BUFF_DAMAGE_NEGATION && e.buffData?.damageNegationThreshold
    );
    if (negationEffect && damage <= (negationEffect.buffData!.damageNegationThreshold!)) {
      return { redirected: false, damageTaken: 0 };
    }

    const protectedEffect = target.statusEffects?.find(
      e => e.type === StatusEffectType.BUFF_BLOCKING_PROTECTED && e.buffData?.blockingProtectedBy
    );
    if (protectedEffect) {
      const blockerId = protectedEffect.buffData!.blockingProtectedBy!;
      const blocker = this.state.players.get(blockerId);
      const blockStance = blocker?.statusEffects?.find(e => e.type === StatusEffectType.BUFF_BLOCKING_STANCE);
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

    const selfBlock = target.statusEffects?.find(
      e => e.type === StatusEffectType.BUFF_BLOCKING_STANCE && e.buffData?.blockingStance
    );
    if (selfBlock) {
      const reducedDamage = Math.floor(damage * 0.4);
      target.stats.health = Math.max(0, target.stats.health - reducedDamage);
      this.tryInterruptCast(target);
      return { redirected: false, damageTaken: reducedDamage };
    }

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

  damageEnemy(enemy: EnemyInstance, damage: number): { died: boolean; actualDamage: number } {
    enemy.health = Math.max(0, enemy.health - damage);
    const actualDamage = damage;
    if (enemy.invulnerable) {
      enemy.health = enemy.maxHealth;
      return { died: false, actualDamage };
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

    for (const [id, enemy] of this.spawnMgr.getAllEnemies()) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - pos.x;
      const dz = enemy.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius && (!closest || dist < closest.distance)) {
        closest = { id, distance: dist };
      }
    }

    for (const [id, player] of this.state.players) {
      if (id === session.characterId) continue;
      if (player.stats.health <= 0) continue;
      if (!player.position) continue;
      const dx = player.position.x - pos.x;
      const dz = player.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius && (!closest || dist < closest.distance)) {
        closest = { id, distance: dist };
      }
    }

    return closest;
  }

  findAllEntitiesInRadius(session: PlayerSession, pos: { x: number; y: number; z: number }, radius: number): Array<{ id: string; distance: number }> {
    const results: Array<{ id: string; distance: number }> = [];

    for (const [id, enemy] of this.spawnMgr.getAllEnemies()) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.position.x - pos.x;
      const dz = enemy.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius) {
        results.push({ id, distance: dist });
      }
    }

    for (const [id, player] of this.state.players) {
      if (id === session.characterId) continue;
      if (player.stats.health <= 0) continue;
      if (!player.position) continue;
      const dx = player.position.x - pos.x;
      const dz = player.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= radius) {
        results.push({ id, distance: dist });
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
    if (casterId) {
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
      const staCategories = new Set(['ailment', 'stun', 'trip', 'knockdown', 'knockback', 'bleed']);
      const spiCategories = new Set(['disorder', 'freeze', 'burn', 'curse', 'sleep', 'weakness', 'weaken']);
      if (staCategories.has(category)) {
        const gearKey = `${category}Resist` as keyof typeof gc;
        const gearBonus = (gc as any)?.[gearKey] || 0;
        return computeAilmentResist(totalSTA, gearBonus);
      } else if (spiCategories.has(category)) {
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

      const dx = enemy.position.x - target.position.x;
      const dz = enemy.position.z - target.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const enemyDef = getEnemyDefinition(enemy.enemyType);
      if (dist > (enemyDef?.attackRange || 2) * 2) {
        enemy.state = 'return';
        enemy.targetId = null;
        return;
      }

      const result = this.combat.processEnemyAttack(enemy, target);
      if (!result) return;

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
          data: { attackerId: enemyId, targetId, damage: 0, isCritical: false, damageType: 'physical', missed: true }
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

        this.removeSongProximityBuffs(session);

        for (const [dummyId, meta] of this.dummyMeta) {
          if (meta.ownerId === characterId) {
            if (meta.inParty) this.partySys.leaveParty(dummyId);
            this.state.players.delete(dummyId);
            this.dummyMeta.delete(dummyId);
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
        data: { name: player.characterName, class: player.jobId, race: player.race, jobId: player.jobId, level: player.stats.level, health: player.stats.health, maxHealth: player.stats.maxHealth, modelFile: JOB_DEFINITIONS[player.jobId]?.modelFile }
      });
    });

    this.sendToSocket(socket.id, {
      type: PacketType.WORLD_STATE,
      timestamp: Date.now(),
      data: {
        zoneId,
        zoneDef,
        enemies: enemyData,
        npcs: npcData,
        players: otherPlayers
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

    if (result.damage) {
      this.applyAOEDamageToTargets(session, skillName, aoePosition, aoeRadius, result);
    }

    this.spawnAOEZone(session, skillName, aoePosition, aoeRadius);

    if (result.statusEffects && result.statusEffects.length > 0) {
      const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);
      for (const target of targets) {
        const enemy = this.spawnMgr.getEnemy(target.id);
        if (enemy && enemy.state !== 'dead') {
          for (const effect of result.statusEffects) {
            if (!this.shouldApplyDebuff(effect, target.id, session.characterId)) continue;
            if (this.hasActiveDebuff(target.id, effect.type, effect.skillName)) continue;
            const cloned = { ...effect, targetId: target.id };
            enemy.statusEffects.push(cloned);
          }
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
        const { died } = this.damageEnemy(enemy, targetResult.damage);
        if (targetResult.elementalDamage) {
          for (const el of targetResult.elementalDamage) {
            this.damageEnemy(enemy, el.damage);
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
            const { died } = this.damageEnemy(enemy, hit.damage);
            if (died) enemyDied = true;
          }
          if (hit.elementalDamage) {
            for (const el of hit.elementalDamage) {
              this.damageEnemy(enemy, el.damage);
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
      const { died } = this.damageEnemy(enemy, result.damage!);
      if (result.elementalDamage) {
        for (const el of result.elementalDamage) {
          this.damageEnemy(enemy, el.damage);
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

      for (const [targetId, target] of this.state.players) {
        if (targetId === charId) continue;
        if (target.isDead) continue;
        if (target.zoneId !== caster.zoneId) continue;
        if (!target.position || !caster.position) continue;
        if (!this.isPartyMember(charId, targetId)) continue;

        const dx = caster.position.x - target.position.x;
        const dz = caster.position.z - target.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= songRadius) {
          pulseTargets.push(target);
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

      const { died } = this.damageEnemy(enemy, hpDamage);

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

    if (bt.spiValues) {
      const totalSpi = (caster.baseStats?.SPI || 0) + (caster.statPoints?.SPI || 0);
      const casterBlessing = caster.skillAdeptness?.['Blessing'] || 0;
      const skillName = skill.name.toLowerCase();
      if (skillName === 'green song' || skillName === 'speedy gale') {
        const dodgeResult = resolveSpiTieredValue(bt.spiValues, totalSpi, casterBlessing, 'dodgeChance');
        if (dodgeResult) {
          pushSongBuff(StatusEffectType.BUFF_DODGE, dodgeResult.dodgeChance ?? 0);
        }
        if (skillName === 'green song') {
          const accuracyResult = resolveSpiTieredValue(bt.spiValues, totalSpi, casterBlessing, 'accuracy');
          if (accuracyResult && accuracyResult.accuracy) {
            pushSongBuff(StatusEffectType.BUFF_ACCURACY, accuracyResult.accuracy);
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

      for (const [targetId, target] of this.state.players) {
        if (targetId === blockerId) continue;
        if (target.isDead) continue;
        if (target.zoneId !== blocker.zoneId) continue;
        if (!target.position) continue;

        const dx = target.position.x - blocker.position.x;
        const dz = target.position.z - blocker.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const existingProt = target.statusEffects.find(
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
            target.statusEffects.push({
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
            this.playerSys.recalcStats(target);
            this.sendToPlayer(targetId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: target.statusEffects }
            });
            this.broadcastEntityEffects(target);
          }
        } else {
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
        const { died } = this.damageEnemy(enemy, result.damage);
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
      for (const effect of debuffEffects) {
        if (enemy.statusEffects.some(e => e.type === effect.type && e.skillName === skillName)) continue;
        enemy.statusEffects.push({ ...effect, targetId });
        changed = true;
      }
      if (changed) {
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
        player.statusEffects.push({ ...effect, targetId });
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

  gameLoop(): void {
    const now = Date.now();

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
            const { died } = this.damageEnemy(enemy, result.damage);
            if (result.elementalDamage) {
              for (const el of result.elementalDamage) {
                this.damageEnemy(enemy, el.damage);
              }
            }
            this.broadcastInZone(session.zoneId, {
              type: PacketType.DAMAGE,
              timestamp: Date.now(),
              data: { attackerId: session.characterId, targetId: castResult.targetId, damage: result.damage, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName, elementalDamage: result.elementalDamage }
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
                data: { attackerId: session.characterId, targetId: castResult.targetId, damage: pvpDmgResult.redirected ? 0 : pvpDmgResult.damageTaken, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName, elementalDamage: pvpDmgResult.redirected ? [] : result.elementalDamage, missed: pvpDmgResult.redirected ? true : undefined }
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
               for (const effect of result.statusEffects) {
                 if (!this.shouldApplyDebuff(effect, castResult.targetId, session.characterId)) continue;
                 if (this.hasActiveDebuff(castResult.targetId, effect.type, effect.skillName)) continue;
                 effect.targetId = castResult.targetId;
                 debuffEnemy.statusEffects.push(effect);
               }
              this.broadcastInZone(session.zoneId, {
                type: PacketType.ENTITY_STATUS_EFFECTS,
                timestamp: Date.now(),
                data: { entityId: castResult.targetId, effects: debuffEnemy.statusEffects }
              });
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
    });

    const now2 = Date.now();
    this.tickAOEZones(now2);
    this.tickSongProximity(now2);
    this.tickBlockingProximity(now2);

    this.spawnMgr.getAllEnemies().forEach((enemy, enemyId) => {
      if (enemy.state === 'dead') return;
      if (!enemy.statusEffects || enemy.statusEffects.length === 0) return;

      const tick = this.skillSys.tickStatusEffects(
         { ...enemy, stats: { health: enemy.health, maxHealth: enemy.maxHealth, mana: 0, maxMana: 0, attack: 0, defense: 0, speed: 0, speedMultiplier: 1, magicAttack: 0, critChance: 0, castSpeed: 1, level: enemy.level, experience: 0, experienceToNext: 0 }, statPoints: { STR: 0, AGI: 0, INT: 0, SPI: 0, DEX: 0, STA: 0 }, statusEffects: enemy.statusEffects, skillCooldowns: [], activeCast: null } as any,
        now
      );

      if (tick.damage > 0) {
        const { died } = this.damageEnemy(enemy, tick.damage);
        const zoneId = this.findZoneOfEnemy(enemyId);
        if (zoneId) {
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
        }
        if (died) {
          enemy.state = 'dead';
          enemy.deathTime = now;
          const zoneId = this.findZoneOfEnemy(enemyId);
          if (zoneId) {
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
      }

      if (tick.expired.length > 0 && this.findZoneOfEnemy(enemyId)) {
        const zoneId = this.findZoneOfEnemy(enemyId)!;
        this.broadcastInZone(zoneId, {
          type: PacketType.ENTITY_STATUS_EFFECTS,
          timestamp: Date.now(),
          data: { entityId: enemyId, effects: enemy.statusEffects }
        });
      }
    });

    this.tickDummies();

    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const zonePlayers = new Map<string, { position: { x: number; y: number; z: number }; characterId: string }>();
      this.state.players.forEach(session => {
        if (session.zoneId !== zoneId) return;
        if (session.isDead) return;
        if (session.invulnerableUntil > now) return;
        zonePlayers.set(session.characterId, { position: session.position, characterId: session.characterId });
      });

      this.ai.updateEnemies(this.spawnMgr.getEnemiesInZone(zoneId), zonePlayers, 1 / this.tickRate);
    }

    if (this.activeAOEZones.size > 0) {
      for (const [enemyId, enemy] of this.spawnMgr.getAllEnemies()) {
        if (enemy.state === 'dead') continue;
        this.checkEntityAOEEntries(enemyId, enemy.position);
      }
    }

    const updates: Map<string, any[]> = new Map();

    this.spawnMgr.getAllEnemies().forEach(enemy => {
      if (enemy.state === 'dead') return;

      const zoneId = this.findZoneOfEnemy(enemy.id);
      if (!zoneId) return;

      if (!updates.has(zoneId)) updates.set(zoneId, []);
      updates.get(zoneId)!.push({
        id: enemy.id,
        position: enemy.position,
        rotation: { x: 0, y: enemy.rotation, z: 0, w: 1 },
        state: enemy.state,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        targetId: enemy.targetId
      });
    });

    updates.forEach((entityUpdates, zoneId) => {
      this.broadcastInZone(zoneId, {
        type: PacketType.PLAYER_POSITION_UPDATE,
        timestamp: Date.now(),
        data: { entities: entityUpdates }
      });
    });
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
    this.dummyMeta.delete(dummyId);

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
    const saves: Promise<void>[] = [];
    this.state.players.forEach(session => {
      saves.push(this.auth.saveCharacter(session.characterId, {
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
      }));
    });
    await Promise.all(saves);
    console.log(`Saved ${saves.length} character(s)`);
  }

  getSpawnManager(): SpawnManager {
    return this.spawnMgr;
  }

  getGameState(): ServerGameState {
    return this.state;
  }

  getTickRate(): number {
    return this.tickRate;
  }
}
