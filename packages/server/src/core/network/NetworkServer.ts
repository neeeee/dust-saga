import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  Packet, PacketType, PlayerSession, Validator,
  JOB_DEFINITIONS,   RACE_DATA, createDefaultStatPoints, createDefaultSkillProficiencies, createDefaultSkillAdeptness,
  getBaseClassForJob, calculateDerivedStats, getExperienceToNextLevel, getStatPointsGainedAtLevel,
  getSkillPointsGainedAtLevel, MAX_LEVEL,
  getDesignJobId,
  StatType, JobId, Race, processRacialOnDamage, applyRacialPotionHealing,
  getAdvancementOptions, BaseClass,
  REGEN_CONFIG, SKILL_TARGET_RULES, SkillTargetType,
  PartyVisibility, LootRule, MAX_LOOT_POOL,
  GROUND_TARGETED_AOE_SKILLS, DEFAULT_AOE_RADIUS,
  StatusEffectType, StatusEffect, EnemyInstance,
  getEffectiveStats,
  computeAilmentResist, computeDisorderResist, computeDebuffAccuracy, rollDebuffApplication,
  calculateWeaponElementalDamage,
  calculateDodge,
  calculateHitChance,
  NATION_ZONE_MAP,
  ZoneType,
  normalizeEquipment,
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
import { getEnemyDefinition, getZoneDefinition, NPC_DATABASE, getNPCsInZone, getItem, getQuest, QUEST_DATABASE, ITEM_DATABASE } from '@dust-saga/shared';
import { v4 as uuidv4 } from 'uuid';

interface ServerGameState {
  players: Map<string, PlayerSession>;
  socketToPlayer: Map<string, string>;
  playerToSocket: Map<string, string>;
}

export class NetworkServer {
  private io: SocketIOServer;
  private auth: AuthManager;
  private combat: CombatSystem;
  private ai: AISystem;
  private loot: LootSystem;
  private playerSys: PlayerSystem;
  private skillSys: SkillSystem;
  private partySys: PartySystem;
  private spawnMgr: SpawnManager;
  private questSys: QuestSystem;
  private state: ServerGameState;
  private tickRate: number = 30;

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

    this.setupCallbacks();
    this.setupEventHandlers();
    this.setupPlayerCallbacks();
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

    this.ai.onEnemyAttack((enemyId, targetId, damage) => {
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

      const targetDodge = target.statBreakdown?.totalDodge ?? 0;
      const enemyAccuracy = enemy.level + 7;
      const hitChance = Math.min(0.99, Math.max(0.01, calculateHitChance(enemyAccuracy, targetDodge)));
      if (Math.random() > hitChance) {
        this.sendToPlayer(targetId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: enemyId, targetId, damage: 0, isCritical: false, damageType: 'physical', missed: true }
        });
        this.broadcastInZone(target.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: enemyId, targetId, damage: 0, isCritical: false, damageType: 'physical', missed: true }
        }, targetId);
        return;
      }

      const actualDamage = Math.max(1, damage - target.stats.defense * 0.2);
      let reducedDamage = actualDamage;
      if (enemy.statusEffects) {
        for (const effect of enemy.statusEffects) {
          if (effect.type === 'debuff_damage_down') {
            reducedDamage = Math.floor(reducedDamage * (1 - (effect.potency || 0)));
          }
        }
      }
      const targetEff = getEffectiveStats(target.stats, target.statPoints, target.statusEffects || []);
      if (targetEff.physicalDamageReduction > 0) {
        reducedDamage = Math.floor(reducedDamage * (1 - Math.min(0.9, targetEff.physicalDamageReduction)));
      }
      reducedDamage = Math.max(1, reducedDamage);
      const racialResult = processRacialOnDamage(target, Math.floor(reducedDamage), 'physical');
      const finalDamage = racialResult.finalDamage;
      target.stats.health = Math.max(0, target.stats.health - finalDamage);

      this.sendToPlayer(targetId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { attackerId: enemyId, targetId, damage: finalDamage, isCritical: false, damageType: 'physical' }
      });

      this.sendToPlayer(targetId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: targetId, stats: target.stats }
      });

      this.broadcastInZone(target.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { attackerId: enemyId, targetId, damage: finalDamage, isCritical: false, damageType: 'physical' }
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

  private handlePlayerDeath(session: PlayerSession): void {
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

  private handleRespawnRequest(socket: Socket, _data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;
    const session = this.state.players.get(characterId);
    if (!session || !session.isDead) return;

    let respawnZoneId: string;
    let respawnPos: { x: number; y: number; z: number };

    if (session.nation && NATION_ZONE_MAP[session.nation]) {
      const nationInfo = NATION_ZONE_MAP[session.nation];
      respawnZoneId = nationInfo.zoneId;
      const zoneDef = getZoneDefinition(respawnZoneId);
      respawnPos = zoneDef?.playerSpawn || { x: 0, y: 0, z: 0 };
    } else {
      respawnZoneId = session.lastSafeZoneId;
      const zoneDef = getZoneDefinition(respawnZoneId);
      respawnPos = zoneDef?.playerSpawn || { x: 0, y: 0, z: 0 };
    }

    const changingZone = session.zoneId !== respawnZoneId;
    if (changingZone) {
      this.broadcastInZone(session.zoneId, {
        type: PacketType.ENTITY_DESPAWN,
        timestamp: Date.now(),
        data: { entityId: characterId }
      });
    }

    session.isDead = false;
    session.deathTime = 0;
    session.stats.health = session.stats.maxHealth;
    session.stats.mana = session.stats.maxMana;
    session.position = { ...respawnPos };
    session.invulnerableUntil = Date.now() + 5000;
    session.targetId = null;
    session.activeCast = null;
    session.statusEffects = [];
    this.playerSys.recalcStats(session);

    if (changingZone) {
      session.zoneId = respawnZoneId;
      this.broadcastInZone(respawnZoneId, {
        type: PacketType.ENTITY_SPAWN,
        timestamp: Date.now(),
        data: {
          id: characterId,
          type: 'player',
          position: session.position,
          rotation: session.rotation,
          data: { name: session.characterName, class: session.jobId, race: session.race, jobId: session.jobId, level: session.stats.level, health: session.stats.health, maxHealth: session.stats.maxHealth }
        }
      });
      this.sendZoneState(socket, respawnZoneId, characterId);
    }

    this.sendToPlayer(characterId, {
      type: PacketType.PLAYER_REVIVED,
      timestamp: Date.now(),
      data: { characterId, zoneId: respawnZoneId, position: respawnPos, health: session.stats.health, maxHealth: session.stats.maxHealth, invulnerable: true }
    });

    this.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats }
    });

    this.broadcastInZone(session.zoneId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { entityId: characterId, health: session.stats.health, maxHealth: session.stats.maxHealth }
    }, characterId);

    this.refreshPartyForMember(characterId);
  }

  private handleRevivePlayer(socket: Socket, data: any): void {
    const reviverId = this.findCharacterBySocket(socket.id);
    if (!reviverId) return;
    const reviver = this.state.players.get(reviverId);
    if (!reviver || reviver.isDead) return;

    const targetId = data.targetId;
    if (!targetId) return;
    const target = this.state.players.get(targetId);
    if (!target || !target.isDead) return;

    const dx = reviver.position.x - target.position.x;
    const dz = reviver.position.z - target.position.z;
    if (Math.sqrt(dx * dx + dz * dz) > 5) {
      this.sendToPlayer(reviverId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'System', message: 'Too far away to revive.', channel: 'system' }
      });
      return;
    }

    const targetZoneDef = getZoneDefinition(target.zoneId);
    const reviverZoneDef = getZoneDefinition(reviver.zoneId);
    const targetNation = targetZoneDef?.nation;
    const reviverNation = reviverZoneDef?.nation;

    if (targetNation) {
      if (reviverNation !== targetNation) {
        this.sendToPlayer(reviverId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: 'Cannot revive players from another nation in this zone.', channel: 'system' }
        });
        return;
      }
    }

    this.handleRevivePlayerBySession(reviver, targetId);
  }

  private handleRevivePlayerBySession(caster: PlayerSession, targetId: string): void {
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
      switch (packet.type) {
        case PacketType.HEARTBEAT:
          this.sendToSocket(socket.id, { type: PacketType.HEARTBEAT, timestamp: Date.now(), data: {} });
          break;

        case PacketType.LOGIN:
          await this.handleLogin(socket, packet.data);
          break;

        case PacketType.REGISTER:
          await this.handleRegister(socket, packet.data);
          break;

        case PacketType.CHARACTER_LIST:
          await this.handleCharacterList(socket, packet.data);
          break;

        case PacketType.CHARACTER_CREATE:
          await this.handleCharacterCreate(socket, packet.data);
          break;

        case PacketType.CHARACTER_SELECT:
          await this.handleCharacterSelect(socket, packet.data);
          break;

        case PacketType.CHARACTER_DELETE:
          await this.handleCharacterDelete(socket, packet.data);
          break;

        case PacketType.PLAYER_MOVE:
          {
            const cid = this.findCharacterBySocket(socket.id);
            const sess = cid ? this.state.players.get(cid) : null;
            if (sess?.isDead) break;
            this.handlePlayerMove(socket, packet.data);
          }
          break;

        case PacketType.ATTACK:
          this.handleAttack(socket, packet.data);
          break;

        case PacketType.MANUAL_ATTACK:
          this.handleManualAttack(socket, packet.data);
          break;

        case PacketType.SKILL_USE:
          this.handleSkillUse(socket, packet.data);
          break;

        case PacketType.CHAT_MESSAGE:
          this.handleChatMessage(socket, packet.data);
          break;

        case PacketType.ITEM_USE:
          this.handleItemUse(socket, packet.data);
          break;

        case PacketType.EQUIP_ITEM:
          this.handleEquipItem(socket, packet.data);
          break;

        case PacketType.UNEQUIP_ITEM:
          this.handleUnequipItem(socket, packet.data);
          break;

        case PacketType.LOOT_PICKUP:
          this.handleLootPickup(socket, packet.data);
          break;

        case PacketType.ITEM_DROP:
          this.handleItemDrop(socket, packet.data);
          break;

        case PacketType.QUEST_ACCEPT:
          this.handleQuestAccept(socket, packet.data);
          break;

        case PacketType.QUEST_COMPLETE:
          this.handleQuestComplete(socket, packet.data);
          break;

        case PacketType.QUEST_ABANDON:
          this.handleQuestAbandon(socket, packet.data);
          break;

        case PacketType.NPC_INTERACT:
          this.handleNPCInteract(socket, packet.data);
          break;

        case PacketType.NPC_SHOP_BUY:
          this.handleShopBuy(socket, packet.data);
          break;

        case PacketType.ENTER_ZONE:
          this.handleEnterZone(socket, packet.data);
          break;

        case PacketType.STAT_ALLOCATE:
          this.handleStatAllocate(socket, packet.data);
          break;

        case PacketType.SKILL_ALLOCATE:
          this.handleSkillAllocate(socket, packet.data);
          break;

        case PacketType.JOB_ADVANCE:
          this.handleJobAdvance(socket, packet.data);
          break;

        case PacketType.RESPAWN_REQUEST:
          this.handleRespawnRequest(socket, packet.data);
          break;

        case PacketType.REVIVE_PLAYER:
          this.handleRevivePlayer(socket, packet.data);
          break;

        case PacketType.PARTY_CREATE_REQUEST:
          this.handlePartyCreateRequest(socket, packet.data);
          break;

        case PacketType.PARTY_INVITE_REQUEST:
          this.handlePartyInviteRequest(socket, packet.data);
          break;

        case PacketType.PARTY_JOIN_REQUEST:
          this.handlePartyJoinRequest(socket, packet.data);
          break;

        case PacketType.PARTY_LEAVE:
          this.handlePartyLeave(socket);
          break;

        case PacketType.PARTY_KICK:
          this.handlePartyKick(socket, packet.data);
          break;

        case PacketType.PARTY_LOOT_ROLL:
          this.handlePartyLootRoll(socket, packet.data);
          break;

        case PacketType.PARTY_PROMOTE:
          this.handlePartyPromote(socket, packet.data);
          break;

        case PacketType.WEAPON_ENHANCE:
          this.handleWeaponEnhance(socket, packet.data);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error(`Error handling packet ${packet.type}:`, error);
    }
  }

  private async handleLogin(socket: Socket, data: any): Promise<void> {
    const result = await this.auth.login(data.username, data.password);

    if (result.success) {
      this.state.socketToPlayer.set(socket.id, result.playerId!);
      this.sendToSocket(socket.id, {
        type: PacketType.AUTH_SUCCESS,
        timestamp: Date.now(),
        data: { playerId: result.playerId, username: result.username, token: result.token, level: result.level }
      });
    } else {
      this.sendToSocket(socket.id, {
        type: PacketType.AUTH_FAILURE,
        timestamp: Date.now(),
        data: { message: result.error }
      });
    }
  }

  private async handleRegister(socket: Socket, data: any): Promise<void> {
    const result = await this.auth.register(data.username, data.email, data.password);

    if (result.success) {
      this.state.socketToPlayer.set(socket.id, result.playerId!);
      this.sendToSocket(socket.id, {
        type: PacketType.AUTH_SUCCESS,
        timestamp: Date.now(),
        data: { playerId: result.playerId, token: result.token }
      });
    } else {
      this.sendToSocket(socket.id, {
        type: PacketType.AUTH_FAILURE,
        timestamp: Date.now(),
        data: { message: result.error }
      });
    }
  }

  private async handleCharacterList(socket: Socket, data: any): Promise<void> {
    const playerId = this.state.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const characters = await this.auth.getCharacters(playerId);

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

    this.sendToSocket(socket.id, {
      type: PacketType.CHARACTER_LIST,
      timestamp: Date.now(),
      data: { characters: characterInfos }
    });
  }

  private async handleCharacterCreate(socket: Socket, data: any): Promise<void> {
    const playerId = this.state.socketToPlayer.get(socket.id);
    if (!playerId) return;

    if (!Validator.validatePlayerName(data.name)) {
      this.sendToSocket(socket.id, {
        type: PacketType.ERROR,
        timestamp: Date.now(),
        data: { message: 'Invalid character name. Use 3-20 alphanumeric characters.' }
      });
      return;
    }

    const result = await this.auth.createCharacter(playerId, data.name, data.race || 'human', data.characterClass);

    if (result.success) {
      const jobDef = JOB_DEFINITIONS[data.characterClass as JobId];
      this.sendToSocket(socket.id, {
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
      this.sendToSocket(socket.id, {
        type: PacketType.ERROR,
        timestamp: Date.now(),
        data: { message: result.error }
      });
    }
  }

  private async handleCharacterSelect(socket: Socket, data: any): Promise<void> {
    const playerId = this.state.socketToPlayer.get(socket.id);
    if (!playerId) return;

    const characters = await this.auth.getCharacters(playerId);
    const char = characters.find(c => c.id === data.characterId);
    if (!char) {
      this.sendToSocket(socket.id, {
        type: PacketType.ERROR,
        timestamp: Date.now(),
        data: { message: 'Character not found' }
      });
      return;
    }

    const session = this.playerSys.createSession(
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

    if (char.inventory) {
      const parsed = typeof char.inventory === 'string' ? JSON.parse(char.inventory) : char.inventory;
      if (Array.isArray(parsed)) session.inventory = parsed;
    }
    if (char.equipment) {
      const parsed = typeof char.equipment === 'string' ? JSON.parse(char.equipment) : char.equipment;
      if (parsed && typeof parsed === 'object') session.equipment = normalizeEquipment(parsed);
    }

    this.playerSys.recalcStats(session);

    const zoneDef = getZoneDefinition(session.zoneId);
    if (char.position_x === 0 && char.position_y === 0 && char.position_z === 0) {
      session.position = { ...(zoneDef?.playerSpawn || { x: 0, y: 0, z: 0 }) };
    } else {
      session.position = { x: char.position_x, y: char.position_y, z: char.position_z };
    }

    this.state.players.set(session.characterId, session);
    this.state.playerToSocket.set(session.characterId, socket.id);

    this.sendToSocket(socket.id, {
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
          statBreakdown: session.statBreakdown
      }
    });

    this.sendZoneState(socket, session.zoneId);
    this.broadcastInZone(session.zoneId, {
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

  private async handleCharacterDelete(socket: Socket, data: any): Promise<void> {
    const playerId = this.state.socketToPlayer.get(socket.id);
    if (!playerId) return;

    await this.auth.deleteCharacter(playerId, data.characterId);
    this.sendToSocket(socket.id, {
      type: PacketType.CHARACTER_DELETE,
      timestamp: Date.now(),
      data: { characterId: data.characterId }
    });
  }

  private handlePlayerMove(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (!Validator.validatePosition(data.position)) return;

    session.position = data.position;
    if (data.rotation) {
      session.rotation = data.rotation;
    }

    if (this.activeAOEZones.size > 0) {
      this.checkEntityAOEEntries(characterId, session.position);
    }

    this.broadcastInZone(session.zoneId, {
      type: PacketType.PLAYER_POSITION_UPDATE,
      timestamp: Date.now(),
      data: {
        socketId: socket.id,
        characterId,
        position: data.position,
        rotation: data.rotation || session.rotation
      }
    }, characterId);
  }

  private handleAttack(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const damageInfo = this.combat.processPlayerAttack(
      session,
      data.targetId,
      this.spawnMgr.getAllEnemies(),
      this.state.players
    );

    if (damageInfo) {
      session.lastAttackTime = Date.now();

      this.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: damageInfo
      });

      const enemy = this.spawnMgr.getEnemy(data.targetId);
      if (enemy) {
        if (damageInfo.elementalDamage) {
          for (const el of damageInfo.elementalDamage) {
            this.damageEnemy(enemy, el.damage);
          }
        }
        this.broadcastInZone(session.zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: data.targetId, health: enemy.health, maxHealth: enemy.maxHealth }
        });
      }
    }
  }

  private handleManualAttack(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session || session.isDead) return;

    const results = this.combat.processManualAttack(
      session,
      data.facingAngle,
      this.spawnMgr.getAllEnemies(),
      this.state.players
    );

    for (const info of results) {
      this.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: info
      });

      const enemy = this.spawnMgr.getEnemy(info.targetId);
      if (enemy) {
        this.broadcastInZone(session.zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: info.targetId, health: enemy.health, maxHealth: enemy.maxHealth }
        });
      }

      const player = this.state.players.get(info.targetId);
      if (player) {
        this.sendToPlayer(info.targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { health: player.stats.health, maxHealth: player.stats.maxHealth, mana: player.stats.mana, maxMana: player.stats.maxMana }
        });
      }
    }
  }

  private handleSkillUse(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const { skillName, targetId, aoePosition } = data;
    if (!skillName) return;

    if (aoePosition && GROUND_TARGETED_AOE_SKILLS.has(skillName)) {
      this.handleGroundAOESkillUse(socket, session, skillName, aoePosition);
      return;
    }

    const check = this.skillSys.canUseSkill(session, skillName, targetId || null);
    if (!check.canUse) {
      this.sendToPlayer(characterId, {
        type: PacketType.SKILL_USE,
        timestamp: Date.now(),
        data: { skillName, error: check.error }
      });
      return;
    }

    const skillDef = this.skillSys.findSkillDefinition(skillName);
    if (skillDef?.consumableItem) {
      const needed = skillDef.consumableItemQuantity || 1;
      const count = session.inventory.filter(i => i.itemId === skillDef.consumableItem).reduce((s, i) => s + i.quantity, 0);
      if (count < needed) {
        this.sendToPlayer(characterId, {
          type: PacketType.SKILL_USE,
          timestamp: Date.now(),
          data: { skillName, error: 'no_materials' }
        });
        return;
      }
      let remaining = needed;
      for (let i = session.inventory.length - 1; i >= 0 && remaining > 0; i--) {
        if (session.inventory[i].itemId === skillDef.consumableItem) {
          const take = Math.min(session.inventory[i].quantity, remaining);
          session.inventory[i].quantity -= take;
          remaining -= take;
          if (session.inventory[i].quantity <= 0) session.inventory.splice(i, 1);
        }
      }
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory }
      });
    }

    const { started, castTime } = this.skillSys.beginCast(session, skillName, targetId || null);
    if (!started) return;

    if (castTime > 0) {
      const skill = this.skillSys.findSkillDefinition(skillName);
      const baseCastMs = (skill?.castTime || 0) * 1000;
      const cooldownPct = Math.max(0, 100 - Math.floor(session.statPoints.INT / 10) * 2);
      const effectiveCd = Math.floor((skill?.cooldown || 0) * 1000 * cooldownPct / 100);
      this.sendToPlayer(characterId, {
        type: PacketType.COOLDOWN_UPDATE,
        timestamp: Date.now(),
        data: { skillName, castTime, type: 'cast_start' }
      });
      return;
    }

    const getTargetStats = (id: string) => {
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
        const eff = getEffectiveStats(
          player.stats,
          player.statPoints,
          player.statusEffects || []
        );
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
    };    const skill = this.skillSys.findSkillDefinition(skillName);
    const aoeRadius = skill?.aoeRadius || DEFAULT_AOE_RADIUS;
    let firstTargetId: string | null = targetId || null;

    if (skill?.isAOE && aoePosition) {
      const firstTarget = this.findClosestEntityToPosition(
        session, aoePosition, aoeRadius
      );
      firstTargetId = firstTarget?.id || targetId || null;
    }

    const result = this.skillSys.executeSkill(session, skillName, firstTargetId, getTargetStats);
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
        this.sendToPlayer(characterId, {
          type: PacketType.NOTIFICATION,
          timestamp: Date.now(),
          data: { message: `Created: ${ci.itemId} x${ci.quantity}` }
        });
      }
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory }
      });
    }

    if (result.sacrificeHeal && result.targetId) {
      const target = this.state.players.get(result.targetId);
      if (target) {
        session.stats.health = 0;
        session.isDead = true;
        target.stats.health = target.stats.maxHealth;
      }
    }

    if (result.mpDamage && result.mpDamage > 0 && firstTargetId) {
      const mpTarget = this.spawnMgr.getEnemy(firstTargetId);
      if (mpTarget) {
        this.broadcastInZone(session.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: characterId, targetId: firstTargetId, damage: result.mpDamage, damageType: 'mp', skillName }
        });
      } else {
        const playerTarget = this.state.players.get(firstTargetId);
        if (playerTarget) {
          playerTarget.stats.mana = Math.max(0, playerTarget.stats.mana - result.mpDamage);
        }
      }
      this.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { attackerId: characterId, targetId: firstTargetId, damage: result.mpDamage, damageType: 'mp', skillName }
      });
    }

    if (result.fear && aoePosition) {
      const fearTargets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);
      for (const ft of fearTargets) {
        const enemy = this.spawnMgr.getEnemy(ft.id);
        if (enemy && enemy.state !== 'dead') {
          const angle = Math.random() * Math.PI * 2;
          enemy.position.x += Math.cos(angle) * 10;
          enemy.position.z += Math.sin(angle) * 10;
        }
      }
    }

    if (result.dispelBuff && firstTargetId) {
      const playerTarget = this.state.players.get(firstTargetId);
      if (playerTarget) {
        playerTarget.statusEffects = playerTarget.statusEffects.filter(e => !e.buffData);
      }
    }

    if (result.dispelDebuff && firstTargetId) {
      const playerTarget = this.state.players.get(firstTargetId);
      if (playerTarget) {
        playerTarget.statusEffects = playerTarget.statusEffects.filter(e => !e.debuffCategory);
      }
    }

    if (result.summonObject && aoePosition) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: `Summoned ${result.summonObject.objectType}` }
      });
    }

    if (result.banishObject) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: 'Banished summoned object' }
      });
    }

    if (result.damage) {
      if (aoePosition) {
        this.applyAOEDamageToTargets(session, skillName, aoePosition, aoeRadius, result);
      } else if (firstTargetId) {
        this.applySingleTargetSkillDamage(session, skillName, firstTargetId, result);
      }
    }

    if (result.statusEffects && result.statusEffects.length > 0) {
      if (aoePosition) {
        const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);
        for (const target of targets) {
          const enemy = this.spawnMgr.getEnemy(target.id);
          if (enemy && enemy.state !== 'dead') {
            for (const effect of result.statusEffects) {
              if (!this.shouldApplyDebuff(effect, target.id, characterId)) continue;
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
          const playerTarget = this.state.players.get(target.id);
          if (playerTarget && target.id !== characterId) {
            for (const effect of result.statusEffects) {
              if (!this.shouldApplyDebuff(effect, target.id, characterId)) continue;
              if (this.hasActiveDebuff(target.id, effect.type, effect.skillName)) continue;
              const cloned = { ...effect, targetId: target.id };
              playerTarget.statusEffects.push(cloned);
            }
            this.playerSys.recalcStats(playerTarget);
            this.sendToPlayer(target.id, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: playerTarget.statusEffects }
            });
            this.sendToPlayer(target.id, {
              type: PacketType.STATS_UPDATE,
              timestamp: Date.now(),
              data: { characterId: target.id, stats: playerTarget.stats }
            });
            this.broadcastEntityEffects(playerTarget);
          }
        }
      } else if (firstTargetId) {
        const enemy = this.spawnMgr.getEnemy(firstTargetId);
        if (enemy && enemy.state !== 'dead') {
          for (const effect of result.statusEffects) {
            if (!this.shouldApplyDebuff(effect, firstTargetId, characterId)) continue;
            if (this.hasActiveDebuff(firstTargetId, effect.type, effect.skillName)) continue;
            const cloned = { ...effect, targetId: firstTargetId };
            enemy.statusEffects.push(cloned);
          }
          this.broadcastInZone(session.zoneId, {
            type: PacketType.ENTITY_STATUS_EFFECTS,
            timestamp: Date.now(),
            data: { entityId: firstTargetId, effects: enemy.statusEffects }
          });
        }
        const playerTarget = this.state.players.get(firstTargetId);
        if (playerTarget && firstTargetId !== characterId) {
          for (const effect of result.statusEffects) {
            if (!this.shouldApplyDebuff(effect, firstTargetId, characterId)) continue;
            if (this.hasActiveDebuff(firstTargetId, effect.type, effect.skillName)) continue;
            const cloned = { ...effect, targetId: firstTargetId };
            playerTarget.statusEffects.push(cloned);
          }
          this.playerSys.recalcStats(playerTarget);
          this.sendToPlayer(firstTargetId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: playerTarget.statusEffects }
          });
          this.sendToPlayer(firstTargetId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: firstTargetId, stats: playerTarget.stats }
          });
          this.broadcastEntityEffects(playerTarget);
        }
      }
    }

    if (result.healing) {
      session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + result.healing);
      this.sendToPlayer(characterId, {
        type: PacketType.HEAL,
        timestamp: Date.now(),
        data: { targetId: characterId, amount: result.healing }
      });
    }

    if (session.statusEffects.length > 0) {
      this.sendToPlayer(characterId, {
        type: PacketType.STATUS_EFFECT_UPDATE,
        timestamp: Date.now(),
        data: { effects: session.statusEffects }
      });
    }
  }

  private broadcastEntityEffects(session: PlayerSession): void {
    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_STATUS_EFFECTS,
      timestamp: Date.now(),
      data: { entityId: session.characterId, effects: session.statusEffects }
    }, session.characterId);
  }

  private consumeDebuffsOnHit(targetSession: PlayerSession): void {
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

  private getEnemyEffectiveDefense(enemy: EnemyInstance): number {
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

  private shouldApplyDebuff(effect: StatusEffect, targetId: string, casterId?: string): boolean {
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

  private hasActiveDebuff(targetId: string, effectType: StatusEffectType, skillName?: string): boolean {
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

  private damageEnemy(enemy: EnemyInstance, damage: number): { died: boolean; actualDamage: number } {
    enemy.health = Math.max(0, enemy.health - damage);
    const actualDamage = damage;
    if (enemy.invulnerable) {
      enemy.health = enemy.maxHealth;
      return { died: false, actualDamage };
    }
    return { died: enemy.health <= 0, actualDamage };
  }

  private handleChatMessage(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const message = typeof data.message === 'string' ? data.message.substring(0, 200) : '';
    if (!message.trim()) return;

    if (message.startsWith('/')) {
      this.handleChatCommand(socket, session, message);
      return;
    }

    this.io.emit('packet', {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: {
        sender: session.characterName,
        message,
        channel: data.channel || 'global'
      }
    });
  }

  private handleChatCommand(socket: Socket, session: PlayerSession, message: string): void {
    const parts = message.toLowerCase().trim().split(/\s+/);
    const cmd = parts[0];

    if (cmd === '/levelup') {
      const currentLevel = session.stats.level;
      const xpNeeded = session.stats.experienceToNext - session.stats.experience;
      if (xpNeeded > 0) {
        this.playerSys.grantExperience(session, xpNeeded);
      }
      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'System', message: `Leveled up! Now level ${session.stats.level}.`, channel: 'system' }
      });
      this.sendToPlayer(session.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: session.characterId, stats: session.stats, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints, skillProficiencies: session.skillProficiencies,
          skillAdeptness: session.skillAdeptness }
      });
      if (currentLevel < session.stats.level) {
        this.sendToPlayer(session.characterId, {
          type: PacketType.LEVEL_UP,
          timestamp: Date.now(),
          data: { level: session.stats.level, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints }
        });
      }
    } else if (cmd === '/setlevel') {
      const targetLevel = parseInt(parts[1], 10);
      if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > MAX_LEVEL) {
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `Usage: /setlevel <1-${MAX_LEVEL}>`, channel: 'system' }
        });
        return;
      }

      let totalStatPoints = 0;
      let totalSkillPoints = 0;
      for (let lvl = 2; lvl <= targetLevel; lvl++) {
        totalStatPoints += getStatPointsGainedAtLevel(lvl);
        totalSkillPoints += getSkillPointsGainedAtLevel(lvl);
      }

      const spentStatPoints = Object.values(session.statPoints).reduce((sum, v) => sum + v, 0);

      session.unspentStatPoints = totalStatPoints - spentStatPoints;
      const currentSkillSpent = Object.values(session.skillProficiencies).reduce((sum: number, v: any) => sum + (typeof v === 'number' ? v : 0), 0);
      session.unspentSkillPoints = totalSkillPoints - currentSkillSpent;
      if (session.unspentStatPoints < 0) session.unspentStatPoints = 0;
      if (session.unspentSkillPoints < 0) session.unspentSkillPoints = 0;

      session.stats.level = targetLevel;
      session.stats.experience = 0;
      session.stats.experienceToNext = getExperienceToNextLevel(targetLevel);
      this.playerSys.recalcStats(session);

      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'System', message: `Level set to ${targetLevel}. Total stat points: ${totalStatPoints}, total skill points: ${totalSkillPoints}.`, channel: 'system' }
      });
      this.sendToPlayer(session.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: session.characterId, stats: session.stats, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints, skillProficiencies: session.skillProficiencies,
          skillAdeptness: session.skillAdeptness }
      });
      this.sendToPlayer(session.characterId, {
        type: PacketType.LEVEL_UP,
        timestamp: Date.now(),
        data: { level: session.stats.level, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints }
      });
      this.refreshPartyForMember(session.characterId);
    } else if (cmd === '/resetstats') {
      const spentStatPoints = Object.values(session.statPoints).reduce((sum, v) => sum + v, 0);
      session.statPoints = createDefaultStatPoints();
      session.unspentStatPoints += spentStatPoints;
      this.playerSys.recalcStats(session);

      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'System', message: `Stat points reset. Refunded ${spentStatPoints} points.`, channel: 'system' }
      });
      this.sendToPlayer(session.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: session.characterId, stats: session.stats, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints, skillProficiencies: session.skillProficiencies,
          skillAdeptness: session.skillAdeptness }
      });
      this.refreshPartyForMember(session.characterId);
    } else if (cmd === '/advance') {
      if (!parts[1]) {
        const options = getAdvancementOptions(session.jobId as JobId);
        if (options.length === 0) {
          const job = JOB_DEFINITIONS[session.jobId as JobId];
          const tier = job?.tier || '?';
          this.sendToPlayer(session.characterId, {
            type: PacketType.CHAT_MESSAGE,
            timestamp: Date.now(),
            data: { sender: 'System', message: `No advancement options for ${session.jobId} (tier ${tier}). You are at the highest tier or tier ${tier} requires level ${tier === 2 ? 20 : 40} to advance.`, channel: 'system' }
          });
        } else {
          const optionNames = options.map(o => JOB_DEFINITIONS[o]?.name || o).join(', ');
          this.sendToPlayer(session.characterId, {
            type: PacketType.CHAT_MESSAGE,
            timestamp: Date.now(),
            data: { sender: 'System', message: `Available advancements from ${session.jobId}: ${optionNames}. Usage: /advance <jobName>`, channel: 'system' }
          });
        }
        return;
      }

      const targetName = parts.slice(1).join(' ').toLowerCase();
      const options = getAdvancementOptions(session.jobId as JobId);
      const match = options.find(id => {
        const def = JOB_DEFINITIONS[id];
        return id.toLowerCase() === targetName || def?.name.toLowerCase() === targetName;
      });

      if (!match) {
        const optionNames = options.map(o => JOB_DEFINITIONS[o]?.name || o).join(', ');
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `Invalid advancement target "${parts.slice(1).join(' ')}". Options: ${optionNames || 'none'}`, channel: 'system' }
        });
        return;
      }

      const targetDef = JOB_DEFINITIONS[match];
      const oldName = JOB_DEFINITIONS[session.jobId as JobId]?.name || session.jobId;
      if (this.playerSys.advanceJob(session, match)) {
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `Advanced from ${oldName} to ${targetDef?.name || match}! (tier ${targetDef?.tier})`, channel: 'system' }
        });
        this.sendToPlayer(session.characterId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: session.characterId, stats: session.stats, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints, skillProficiencies: session.skillProficiencies,
            skillAdeptness: session.skillAdeptness, jobId: session.jobId, baseClass: session.baseClass }
        });
        this.refreshPartyForMember(session.characterId);
      } else {
        const requiredLevel = targetDef?.tier === 2 ? 20 : targetDef?.tier === 3 ? 40 : 1;
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `Cannot advance to ${targetDef?.name || match}. Requires level ${requiredLevel} (you are ${session.stats.level}).`, channel: 'system' }
        });
      }
    } else if (cmd === '/killallenemies') {
      const enemies = this.spawnMgr.getEnemiesInZone(session.zoneId);
      let killed = 0;
      enemies.forEach((enemy, enemyId) => {
        if (enemy.state === 'dead') return;
        if (enemy.invulnerable) return;
        enemy.health = 0;
        enemy.state = 'dead';
        enemy.deathTime = Date.now();
        killed++;

        this.broadcastInZone(session.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: { attackerId: session.characterId, targetId: enemyId, damage: enemy.maxHealth, isCritical: false, damageType: 'physical' }
        });
        this.broadcastInZone(session.zoneId, {
          type: PacketType.DEATH,
          timestamp: Date.now(),
          data: { entityId: enemyId, killerId: session.characterId }
        });
        this.broadcastInZone(session.zoneId, {
          type: PacketType.ENTITY_DESPAWN,
          timestamp: Date.now(),
          data: { entityId: enemyId }
        });
      });
      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'System', message: `Killed ${killed} enemies in zone.`, channel: 'system' }
      });
    } else if (cmd === '/dummy') {
      const subCmd = parts[1];
      if (subCmd === 'set' && parts[2] && parts[3]) {
        const stat = parts[2];
        const value = parseFloat(parts[3]);
        if (isNaN(value)) {
          this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'System', message: 'Invalid value.', channel: 'system' } });
          return;
        }
        const statKey: Record<string, string> = { defense: 'defense', level: 'level', maxhealth: 'maxHealth', health: 'health', fireresist: 'fireResist', iceresist: 'iceResist', lightningresist: 'lightningResist', darkresist: 'darkResist', holyresist: 'holyResist', poisonresist: 'poisonResist', ailmentresist: 'ailmentResist', disorderresist: 'disorderResist', magicresist: 'magicResist' };
        const resolvedStat = statKey[stat] || null;
        if (!resolvedStat) {
          this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'System', message: `Unknown stat "${stat}". Valid: defense, level, maxHealth, health, fireResist, iceResist, lightningResist, darkResist, holyResist, magicResist`, channel: 'system' } });
          return;
        }
        const enemies = this.spawnMgr.getEnemiesInZone(session.zoneId);
        let found = false;
        for (const [enemyId, enemy] of enemies) {
          if (enemy.enemyType !== 'striking_dummy') continue;
          found = true;
          const def = getEnemyDefinition(enemy.enemyType);
          if (!def) continue;
          switch (resolvedStat) {
            case 'defense': def.defense = value; break;
            case 'level': def.level = value; enemy.level = value; break;
            case 'maxHealth': def.health = value; enemy.health = value; enemy.maxHealth = value; break;
            case 'health': enemy.health = Math.min(value, enemy.maxHealth); break;
            case 'fireResist': def.fireResist = value; break;
            case 'iceResist': def.iceResist = value; break;
            case 'lightningResist': def.lightningResist = value; break;
            case 'darkResist': def.darkResist = value; break;
            case 'holyResist': def.holyResist = value; break;
            case 'poisonResist': def.poisonResist = value; break;
            case 'ailmentResist': (enemy as any).ailmentResist = value; break;
            case 'disorderResist': (enemy as any).disorderResist = value; break;
            case 'magicResist':
              def.fireResist = value; def.iceResist = value; def.lightningResist = value;
              def.darkResist = value; def.holyResist = value; def.poisonResist = value; break;
            default:           this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'System', message: `Unknown stat "${stat}". Valid: defense, level, maxHealth, health, fireResist, iceResist, lightningResist, darkResist, holyResist, poisonResist, ailmentResist, disorderResist, magicResist`, channel: 'system' } }); return;
          }
          this.broadcastInZone(session.zoneId, { type: PacketType.STATS_UPDATE, timestamp: Date.now(), data: { entityId: enemyId, health: enemy.health, maxHealth: enemy.maxHealth } });
        }
        if (found) {
          this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'System', message: `Striking dummy: set ${stat} = ${value}`, channel: 'system' } });
        } else {
          this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'System', message: 'No striking dummy in this zone.', channel: 'system' } });
        }
      } else {
        this.sendToPlayer(session.characterId, { type: PacketType.CHAT_MESSAGE, timestamp: Date.now(), data: { sender: 'System', message: 'Usage: /dummy set <stat> <value>  —  Stats: defense, level, maxHealth, health, fireResist, iceResist, lightningResist, darkResist, holyResist, poisonResist, ailmentResist, disorderResist, magicResist', channel: 'system' } });
      }
    } else if (cmd === '/resetskills') {
      const categoryKeys = new Set(['melee', 'technique', 'prayer', 'magic', 'special']);
      const spentSkillPoints = Object.entries(session.skillProficiencies)
        .filter(([key]) => !categoryKeys.has(key))
        .reduce((sum, [, v]) => sum + v, 0);
      session.skillProficiencies = createDefaultSkillProficiencies();
      session.unspentSkillPoints += spentSkillPoints;

      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'System', message: `Skill points reset. Refunded ${spentSkillPoints} points.`, channel: 'system' }
      });
      this.sendToPlayer(session.characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: session.characterId, stats: session.stats, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints, skillProficiencies: session.skillProficiencies,
          skillAdeptness: session.skillAdeptness }
      });
      this.refreshPartyForMember(session.characterId);
    } else if (cmd === '/giveitem') {
      const itemId = parts[1];
      const quantity = parseInt(parts[2]) || 1;
      if (!itemId || !ITEM_DATABASE[itemId]) {
        const itemNames = Object.keys(ITEM_DATABASE).join(', ');
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `Unknown item "${itemId || ''}". Available: ${itemNames}`, channel: 'system' }
        });
        return;
      }
      const added = this.playerSys.addItemToInventory(session, itemId, quantity);
      if (added) {
        const itemDef = ITEM_DATABASE[itemId];
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: `Received ${itemDef.name} x${quantity}.`, channel: 'system' }
        });
        this.sendToPlayer(session.characterId, {
          type: PacketType.INVENTORY_UPDATE,
          timestamp: Date.now(),
          data: { inventory: session.inventory, equipment: session.equipment }
        });
      } else {
        this.sendToPlayer(session.characterId, {
          type: PacketType.CHAT_MESSAGE,
          timestamp: Date.now(),
          data: { sender: 'System', message: 'Inventory full.', channel: 'system' }
        });
      }
    }
  }

  private handleItemUse(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const itemDef = getItem(data.itemId);
    if (!itemDef) return;

    const invSlot = session.inventory.find(s => s.itemId === data.itemId);
    if (!invSlot) return;

    if (itemDef.type === 'consumable') {
      if (itemDef.stats.health && itemDef.type === 'consumable') {
        session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + applyRacialPotionHealing(session.race, itemDef.stats.health || 0));
      }
      if (itemDef.stats.mana && itemDef.type === 'consumable') {
        session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + applyRacialPotionHealing(session.race, itemDef.stats.mana || 0));
      }

      this.playerSys.removeItemFromInventory(session, data.itemId, 1);
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
      });
    }
  }

  private handleItemDrop(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const { itemId, quantity } = data;
    if (!itemId || quantity <= 0) return;

    const removed = this.playerSys.removeItemFromInventory(session, itemId, quantity);
    if (removed) {
      const itemDef = getItem(itemId);
      const name = itemDef?.name || itemId;
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: `Trashed ${name}${quantity > 1 ? ` x${quantity}` : ''}.`, type: 'info' }
      });
    }
  }

  private handleEquipItem(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (this.playerSys.equipItem(session, data.itemId)) {
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
      });
    }
  }

  private handleUnequipItem(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (this.playerSys.unequipItem(session, data.slot)) {
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
      });
    }
  }

  private handleLootPickup(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const lootInstance = this.loot.getLootById(data.lootId);
    if (!lootInstance) return;

    const dx = session.position.x - lootInstance.position.x;
    const dz = session.position.z - lootInstance.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 5) return;

    const lootResult = this.loot.pickupLoot(data.lootId, characterId);
    if (!lootResult) return;

    const added = this.playerSys.addItemToInventory(session, lootResult.itemId, lootResult.quantity);
    if (added) {
      this.questSys.onItemCollect(session, lootResult.itemId);
      this.sendToPlayer(characterId, {
        type: PacketType.LOOT_PICKUP,
        timestamp: Date.now(),
        data: { lootId: data.lootId, itemId: lootResult.itemId, quantity: lootResult.quantity }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
    }
  }

  private handleQuestAccept(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (this.questSys.acceptQuest(session, data.questId)) {
      this.sendToPlayer(characterId, {
        type: PacketType.QUEST_ACCEPT,
        timestamp: Date.now(),
        data: { questId: data.questId, quest: session.quests.find(q => q.questId === data.questId) }
      });
    }
  }

  private handleQuestComplete(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const rewards = this.questSys.completeQuest(session, data.questId);
    if (rewards) {
      this.playerSys.grantExperience(session, rewards.experience);
      rewards.items.forEach(item => {
        this.playerSys.addItemToInventory(session, item.itemId, item.quantity);
      });

      this.sendToPlayer(characterId, {
        type: PacketType.QUEST_COMPLETE,
        timestamp: Date.now(),
        data: { questId: data.questId, rewards }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats }
      });
    }
  }

  private handleQuestAbandon(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    this.questSys.abandonQuest(session, data.questId);
    this.sendToPlayer(characterId, {
      type: PacketType.QUEST_ABANDON,
      timestamp: Date.now(),
      data: { questId: data.questId }
    });
  }

  private handleNPCInteract(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const npc = NPC_DATABASE[data.npcId];
    if (!npc) return;

    const dx = session.position.x - npc.position.x;
    const dz = session.position.z - npc.position.z;
    if (Math.sqrt(dx * dx + dz * dz) > 5) return;

    let dialog = npc.dialogs.find(d => d.id === (data.dialogId || 'greeting'));
    if (!dialog) dialog = npc.dialogs[0];

    const questsForNpc = npc.quests || [];
    const availableQuests = this.questSys.getAvailableQuests(session).filter(q => questsForNpc.includes(q));

    this.sendToPlayer(characterId, {
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
          this.sendToPlayer(characterId, {
            type: PacketType.CHAT_MESSAGE,
            timestamp: Date.now(),
            data: { sender: 'System', message: `You have joined the ${nationZoneDef?.name || session.nation}! You will now respawn here when you die.`, channel: 'system' }
          });
        }
      }
    }
  }

  private handleShopBuy(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const itemDef = getItem(data.itemId);
    if (!itemDef) return;

    const qty = data.quantity || 1;
    const cost = (itemDef.sellPrice || 0) * 2 * qty;
    if (cost > 0 && session.gold < cost) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: `Not enough gold. Need ${cost}g, have ${session.gold}g.`, type: 'error' } });
      return;
    }

    const added = this.playerSys.addItemToInventory(session, data.itemId, qty);
    if (added) {
      session.gold -= cost;
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment, gold: session.gold }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: `Purchased ${itemDef.name}${qty > 1 ? ` x${qty}` : ''} for ${cost}g`, type: 'success' }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats }
      });
    }
  }

  private handleWeaponEnhance(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const { weaponSlot, materialSlots } = data;
    if (!weaponSlot?.slotIndex && weaponSlot?.slotIndex !== 0) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'No weapon selected.', type: 'error' } });
      return;
    }

    const weaponItem = session.inventory[weaponSlot.slotIndex];
    if (!weaponItem) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'Weapon not found in inventory.', type: 'error' } });
      return;
    }

    const weaponDef = getItem(weaponItem.itemId);
    if (!weaponDef) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'Invalid weapon.', type: 'error' } });
      return;
    }

    const enhancableTypes: string[] = ['weapon', 'armor', 'helmet', 'boots', 'gloves', 'legs', 'shield'];
    if (!enhancableTypes.includes(weaponDef.type) && !weaponDef.equipmentSlot) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'This item cannot be enhanced.', type: 'error' } });
      return;
    }

    const currentLevel = weaponItem.enhancementLevel || 0;
    if (currentLevel >= 10) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'Enhancement level is already at maximum.', type: 'error' } });
      return;
    }

    const GEM_ELEMENT_MAP: Record<string, string> = {
      fire_gem: 'fire', ice_gem: 'ice', lightning_gem: 'lightning',
      holy_gem: 'holy', dark_gem: 'dark', poison_gem: 'poison',
      fire_magic_gem: 'magic_fire', ice_magic_gem: 'magic_ice', lightning_magic_gem: 'magic_lightning',
      holy_magic_gem: 'magic_holy', dark_magic_gem: 'magic_dark', poison_magic_gem: 'magic_poison',
    };

    let element: string | null = weaponItem.enhancementElement || null;
    const materialSlotArr: Array<{ slotIndex: number } | null> = materialSlots || [];
    const consumedSlots: number[] = [];

    for (const mat of materialSlotArr) {
      if (!mat?.slotIndex && mat?.slotIndex !== 0) continue;
      const matItem = session.inventory[mat.slotIndex];
      if (!matItem || matItem.quantity <= 0) continue;
      const matDef = getItem(matItem.itemId);
      if (!matDef) continue;

      const gemElement = GEM_ELEMENT_MAP[matItem.itemId];
      if (gemElement) {
        if (element === null) {
          element = gemElement;
        } else if (element !== gemElement) {
          this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'Cannot mix different element gems.', type: 'error' } });
          return;
        }
        consumedSlots.push(mat.slotIndex);
      }
    }

    if (!element) {
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: 'No element gem provided.', type: 'error' } });
      return;
    }

    const ENHANCE_FAILURE_CHANCE: number[] = [0, 0, 5, 15, 25, 35, 50, 65, 80, 90];
    const failChance = currentLevel < ENHANCE_FAILURE_CHANCE.length ? ENHANCE_FAILURE_CHANCE[currentLevel] : 50;
    if (Math.random() * 100 < failChance) {
      const sortedSlots = [...consumedSlots].sort((a, b) => b - a);
      for (const slotIdx of sortedSlots) {
        const matItem = session.inventory[slotIdx];
        if (matItem) {
          matItem.quantity -= 1;
          if (matItem.quantity <= 0) {
            session.inventory.splice(slotIdx, 1);
          }
        }
      }
      session.inventory.forEach((s, i) => { s.slot = i; });
      this.sendToPlayer(characterId, { type: PacketType.NOTIFICATION, timestamp: Date.now(), data: { message: `Enhancement failed! Level remains at +${currentLevel}.`, type: 'error' } });
      this.sendToPlayer(characterId, {
        type: PacketType.ENHANCEMENT_RESULT,
        timestamp: Date.now(),
        data: { success: false, weaponSlotIndex: weaponSlot.slotIndex, enhancementLevel: currentLevel, enhancementElement: element }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory, equipment: session.equipment }
      });
      return;
    }

    const newLevel = currentLevel + 1;
    weaponItem.enhancementLevel = newLevel;
    weaponItem.enhancementElement = element as any;

    const sortedSlots = [...consumedSlots].sort((a, b) => b - a);
    for (const slotIdx of sortedSlots) {
      const matItem = session.inventory[slotIdx];
      if (matItem) {
        matItem.quantity -= 1;
        if (matItem.quantity <= 0) {
          session.inventory.splice(slotIdx, 1);
        }
      }
    }
    session.inventory.forEach((s, i) => { s.slot = i; });

    this.playerSys.recalcStats(session);

    this.sendToPlayer(characterId, {
      type: PacketType.INVENTORY_UPDATE,
      timestamp: Date.now(),
      data: { inventory: session.inventory, equipment: session.equipment }
    });
    this.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats, statBreakdown: session.statBreakdown }
    });
    this.sendToPlayer(characterId, {
      type: PacketType.ENHANCEMENT_RESULT,
      timestamp: Date.now(),
      data: { success: true, weaponSlotIndex: weaponSlot.slotIndex, enhancementLevel: newLevel, enhancementElement: element }
    });
  }

  private handleStatAllocate(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (data.allocations && typeof data.allocations === 'object') {
      const alloc = data.allocations as Record<string, number>;
      for (const [stat, count] of Object.entries(alloc)) {
        const st = stat as StatType;
        const n = Math.floor(count);
        for (let i = 0; i < n; i++) {
          this.playerSys.allocateStatPoint(session, st);
        }
      }
    } else {
      const stat = data.stat as StatType;
      if (!stat) return;
      this.playerSys.allocateStatPoint(session, stat);
    }

    this.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: {
        characterId,
        stats: session.stats,
        statPoints: session.statPoints,
        unspentStatPoints: session.unspentStatPoints,
        unspentSkillPoints: session.unspentSkillPoints,
        statBreakdown: session.statBreakdown,
      }
    });
  }

  private handleJobAdvance(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (this.playerSys.advanceJob(session, data.jobId)) {
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: {
          characterId,
          stats: session.stats,
          jobId: session.jobId,
          baseClass: session.baseClass
        }
      });
    }
  }

  private handleSkillAllocate(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const subCategoryName = data.subCategoryName as string;
    const count = typeof data.count === 'number' ? Math.floor(data.count) : 1;

    if (!subCategoryName) return;

    const success = this.playerSys.allocateSkillPoint(session, subCategoryName, count);
    if (success) {
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: {
          characterId,
          stats: session.stats,
          statPoints: session.statPoints,
          unspentStatPoints: session.unspentStatPoints,
          unspentSkillPoints: session.unspentSkillPoints,
          skillProficiencies: session.skillProficiencies,
          skillAdeptness: session.skillAdeptness,
          statBreakdown: session.statBreakdown,
        }
      });
    }
  }

  private sendPartyUpdate(partyId: string): void {
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

  private refreshPartyForMember(characterId: string): void {
    const partyId = this.partySys.getPartyForMember(characterId)?.partyId;
    if (!partyId) return;
    const session = this.state.players.get(characterId);
    if (session) this.partySys.updateMemberStats(characterId, session);
    this.sendPartyUpdate(partyId);
  }

  private handlePartyCreateRequest(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const targetId = data.targetId;
    if (!targetId || targetId === characterId) return;

    const targetSession = this.state.players.get(targetId);
    if (!targetSession) return;

    if (this.partySys.getPartyForMember(characterId)) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: 'You are already in a party.', type: 'error' }
      });
      return;
    }

    if (this.partySys.getPartyForMember(targetId)) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: 'Target is already in a party.', type: 'error' }
      });
      return;
    }

    const visibility = data.visibility === 'open' ? PartyVisibility.OPEN : PartyVisibility.PRIVATE;
    const lootRule = data.lootRule === 'pool' ? LootRule.POOL : LootRule.RANDOM;

    const party = this.partySys.createParty(characterId, session, { visibility, lootRule });
    if (!party) return;

    this.sendToPlayer(characterId, {
      type: PacketType.PARTY_UPDATE,
      timestamp: Date.now(),
      data: {
        partyId: party.partyId,
        leaderId: party.leaderId,
        members: party.members,
        settings: party.settings,
        lootPool: []
      }
    });

    this.sendToPlayer(targetId, {
      type: PacketType.PARTY_INVITE,
      timestamp: Date.now(),
      data: {
        partyId: party.partyId,
        leaderName: session.characterName,
        settings: party.settings,
        memberCount: party.members.length
      }
    });
  }

  private handlePartyInviteRequest(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const targetId = data.targetId;
    if (!targetId || targetId === characterId) return;

    const targetSession = this.state.players.get(targetId);
    if (!targetSession) return;

    const party = this.partySys.getPartyForMember(characterId);
    if (!party || party.leaderId !== characterId) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: 'Only the party leader can invite members.', type: 'error' }
      });
      return;
    }

    if (this.partySys.getPartyForMemberOf(targetId)) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: 'Target is already in a party.', type: 'error' }
      });
      return;
    }

    if (party.members.length >= this.partySys.getMaxPartySize()) {
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: 'Party is full.', type: 'error' }
      });
      return;
    }

    this.sendToPlayer(targetId, {
      type: PacketType.PARTY_INVITE,
      timestamp: Date.now(),
      data: {
        partyId: party.partyId,
        leaderName: session.characterName,
        settings: party.settings,
        memberCount: party.members.length
      }
    });

    this.sendToPlayer(characterId, {
      type: PacketType.NOTIFICATION,
      timestamp: Date.now(),
      data: { message: `Invitation sent to ${targetSession.characterName}.`, type: 'success' }
    });
  }

  private handlePartyJoinRequest(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    if (!data.partyId) return;

    if (data.accept === false) return;

    const party = this.partySys.joinByInvite(data.partyId, characterId, session);
    if (!party) {
      const joinParty = this.partySys.joinParty(data.partyId, characterId, session);
      if (!joinParty) {
        this.sendToPlayer(characterId, {
          type: PacketType.NOTIFICATION,
          timestamp: Date.now(),
          data: { message: 'Could not join party.', type: 'error' }
        });
        return;
      }
      this.sendPartyUpdate(data.partyId);
      return;
    }

    this.sendPartyUpdate(data.partyId);
  }

  private handlePartyLeave(socket: Socket): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const result = this.partySys.leaveParty(characterId);
    if (!result) return;

    if (result.party.members.length === 0) {
      this.sendToPlayer(characterId, {
        type: PacketType.PARTY_DISBAND,
        timestamp: Date.now(),
        data: {}
      });
      return;
    }

    this.sendToPlayer(characterId, {
      type: PacketType.PARTY_DISBAND,
      timestamp: Date.now(),
      data: {}
    });

    this.sendPartyUpdate(result.party.partyId);

    for (const m of result.party.members) {
      this.sendToPlayer(m.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: {
          sender: 'Party',
          message: `${this.state.players.get(characterId)?.characterName || 'Player'} has left the party.`,
          channel: 'party'
        }
      });
    }
  }

  private handlePartyKick(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const result = this.partySys.kickMember(characterId, data.targetId);
    if (!result) return;

    this.sendToPlayer(data.targetId, {
      type: PacketType.PARTY_DISBAND,
      timestamp: Date.now(),
      data: {}
    });

    const targetName = this.state.players.get(data.targetId)?.characterName || 'Player';
    this.sendPartyUpdate(result.party.partyId);
    for (const m of result.party.members) {
      this.sendToPlayer(m.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: {
          sender: 'Party',
          message: `${targetName} has been removed from the party.`,
          channel: 'party'
        }
      });
    }
  }

  private handlePartyPromote(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const party = this.partySys.promoteLeader(characterId, data.targetId);
    if (!party) return;

    this.sendPartyUpdate(party.partyId);
    for (const m of party.members) {
      this.sendToPlayer(m.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: {
          sender: 'Party',
          message: `${this.state.players.get(data.targetId)?.characterName || 'Player'} is now the party leader.`,
          channel: 'party'
        }
      });
    }
  }

  private handlePartyLootRoll(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const partyId = this.partySys.getPartyForMember(characterId)?.partyId;
    if (!partyId) return;

    const roll = data.roll || Math.floor(Math.random() * 100) + 1;
    const item = this.partySys.rollOnLoot(partyId, data.lootId, characterId, roll);
    if (!item) return;

    const party = this.partySys.getPartyForMember(characterId);
    if (!party) return;

    const allRolled = party.members.every(m => item.rolls[m.characterId] !== undefined);
    if (!allRolled) {
      this.sendPartyUpdate(partyId);
      return;
    }

    const result = this.partySys.resolveLootRoll(partyId, data.lootId);
    if (!result) return;

    for (const m of party.members) {
      this.sendToPlayer(m.characterId, {
        type: PacketType.PARTY_LOOT_RESULT,
        timestamp: Date.now(),
        data: {
          lootId: data.lootId,
          itemName: result.item.itemName,
          winnerId: result.winnerId,
          winnerName: this.state.players.get(result.winnerId)?.characterName || 'Player',
          rolls: result.item.rolls
        }
      });
    }

    const winnerSession = this.state.players.get(result.winnerId);
    if (winnerSession) {
      this.playerSys.addItemToInventory(winnerSession, result.item.itemId, result.item.quantity);
      this.sendToPlayer(result.winnerId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: winnerSession.inventory, equipment: winnerSession.equipment }
      });
    }

    this.sendPartyUpdate(partyId);
  }

  private handleEnterZone(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const targetZone = getZoneDefinition(data.zoneId);
    if (!targetZone) return;

    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_DESPAWN,
      timestamp: Date.now(),
      data: { entityId: characterId }
    });

    session.zoneId = data.zoneId;
    if (targetZone.type === ZoneType.SAFE || targetZone.type === ZoneType.NATION) {
      session.lastSafeZoneId = data.zoneId;
    }
    session.position = { ...targetZone.playerSpawn };
    session.invulnerableUntil = Date.now() + 3000;

    this.broadcastInZone(data.zoneId, {
      type: PacketType.ENTITY_SPAWN,
      timestamp: Date.now(),
      data: {
        id: characterId,
        type: 'player',
        position: session.position,
        rotation: session.rotation,
        data: { name: session.characterName, class: session.jobId, race: session.race, jobId: session.jobId, level: session.stats.level, health: session.stats.health, maxHealth: session.stats.maxHealth, modelFile: JOB_DEFINITIONS[session.jobId]?.modelFile }
      }
    });

    this.sendZoneState(socket, data.zoneId, characterId);

    this.sendToPlayer(characterId, {
      type: PacketType.ENTER_ZONE,
      timestamp: Date.now(),
      data: { zoneId: data.zoneId, position: session.position }
    });
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

  private sendZoneState(socket: Socket, zoneId: string, includePlayerId?: string): void {
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
          if (session.statusEffects.length > 0) {
            this.sendToPlayer(session.characterId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: session.statusEffects }
            });
          }
          return;
        }
        const getTargetStats = (id: string) => {
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
            const eff = getEffectiveStats(
              player.stats,
              player.statPoints,
              player.statusEffects || []
            );
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
        };

        const result = this.skillSys.executeSkill(session, castResult.skillName, castResult.targetId, getTargetStats);
        this.sendDamageDebug(session, result);
        this.playerSys.recalcStats(session);

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
              enemy.state = 'dead';
              enemy.deathTime = Date.now();

              const enemyDef = getEnemyDefinition(enemy.enemyType);
              if (enemyDef) {
                this.playerSys.grantExperience(session, enemyDef.experience);
                this.sendToPlayer(session.characterId, {
                  type: PacketType.EXPERIENCE_GAIN,
                  timestamp: Date.now(),
                  data: { experience: enemyDef.experience, totalExperience: session.stats.experience, level: session.stats.level }
                });
                this.sendToPlayer(session.characterId, {
                  type: PacketType.STATS_UPDATE,
                  timestamp: Date.now(),
            data: { characterId: session.characterId, stats: session.stats, statBreakdown: session.statBreakdown }
                });
              }

              this.broadcastInZone(session.zoneId, {
                type: PacketType.DEATH,
                timestamp: Date.now(),
                data: { entityId: castResult.targetId, killerId: session.characterId }
              });
              this.broadcastInZone(session.zoneId, {
                type: PacketType.ENTITY_DESPAWN,
                timestamp: Date.now(),
                data: { entityId: castResult.targetId }
              });
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
              playerTarget.stats.health = Math.max(0, playerTarget.stats.health - result.damage);
              if (result.elementalDamage) {
                for (const el of result.elementalDamage) {
                  playerTarget.stats.health = Math.max(0, playerTarget.stats.health - el.damage);
                }
              }
              this.broadcastInZone(session.zoneId, {
                type: PacketType.DAMAGE,
                timestamp: Date.now(),
                data: { attackerId: session.characterId, targetId: castResult.targetId, damage: result.damage, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName, elementalDamage: result.elementalDamage }
              });
              this.sendToPlayer(castResult.targetId, {
                type: PacketType.STATS_UPDATE,
                timestamp: Date.now(),
                data: { characterId: castResult.targetId, stats: playerTarget.stats }
              });
              this.broadcastInZone(session.zoneId, {
                type: PacketType.STATS_UPDATE,
                timestamp: Date.now(),
                data: { entityId: castResult.targetId, health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth }
              }, session.characterId);
              this.refreshPartyForMember(castResult.targetId);
              this.consumeDebuffsOnHit(playerTarget);
              if (playerTarget.stats.health <= 0) {
                this.handlePlayerDeath(playerTarget);
              }
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

        if (session.statusEffects.length > 0) {
          this.sendToPlayer(session.characterId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: session.statusEffects }
          });
          this.broadcastEntityEffects(session);
        }

        const castSkill = this.skillSys.findSkillDefinition(castResult.skillName);
        if (castSkill) {
          const castTargetType = SKILL_TARGET_RULES[castResult.skillName];
          if (castSkill.duration > 0 && castResult.targetId && castResult.targetId !== session.characterId) {
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
          session.stats.health = Math.max(0, session.stats.health - tick.damage);
          this.sendToPlayer(session.characterId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: { attackerId: '', targetId: session.characterId, damage: tick.damage, isCritical: false, damageType: 'magical', skillName: 'dot' }
          });
          if (session.stats.health <= 0) {
            this.handlePlayerDeath(session);
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
    });

    // Tick active pulsing AOEs
    const now2 = Date.now();
    this.tickAOEZones(now2);

    this.spawnMgr.getAllEnemies().forEach((enemy, enemyId) => {
      if (enemy.state === 'dead') return;
      if (!enemy.statusEffects || enemy.statusEffects.length === 0) return;

      const tick = this.skillSys.tickStatusEffects(
         { ...enemy, stats: { health: enemy.health, maxHealth: enemy.maxHealth, mana: 0, maxMana: 0, attack: 0, defense: 0, speed: 0, magicAttack: 0, critChance: 0, level: enemy.level, experience: 0, experienceToNext: 0 }, statPoints: { STR: 0, AGI: 0, INT: 0, SPI: 0, DEX: 0, STA: 0 }, statusEffects: enemy.statusEffects, skillCooldowns: [], activeCast: null } as any,
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

  private findCharacterBySocket(socketId: string): string | undefined {
    const playerId = this.state.socketToPlayer.get(socketId);
    if (!playerId) return undefined;

    for (const [characterId, session] of this.state.players) {
      if (session.socketId === socketId) return characterId;
    }
    return undefined;
  }

  private findPlayerByCharacterId(characterId: string): PlayerSession | undefined {
    return this.state.players.get(characterId);
  }

  private findZoneOfEntity(entityId: string): string {
    for (const [zoneId, enemies] of this.spawnMgr['spawnedEnemies']) {
      if (enemies.has(entityId)) return zoneId;
    }
    for (const [, session] of this.state.players) {
      if (session.characterId === entityId) return session.zoneId;
    }
    return 'starter_zone';
  }

  private findZoneOfEnemy(enemyId: string): string | undefined {
    for (const [zoneId, enemies] of this.spawnMgr['spawnedEnemies']) {
      if (enemies.has(enemyId)) return zoneId;
    }
    return undefined;
  }

  private sendToSocket(socketId: string, packet: Packet): void {
    this.io.to(socketId).emit('packet', packet);
  }

  private sendToPlayer(characterId: string, packet: Packet): void {
    const socketId = this.state.playerToSocket.get(characterId);
    if (socketId) {
      this.sendToSocket(socketId, packet);
    }
  }

  private broadcastInZone(zoneId: string, packet: Packet, excludeCharacterId?: string): void {
    this.state.players.forEach(session => {
      if (session.zoneId !== zoneId) return;
      if (excludeCharacterId && session.characterId === excludeCharacterId) return;
      const socketId = this.state.playerToSocket.get(session.characterId);
      if (socketId) {
        this.io.to(socketId).emit('packet', packet);
      }
    });
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

  private sendDamageDebug(session: PlayerSession, result: { debugCalc?: string }): void {
    if (result.debugCalc) {
      this.sendToPlayer(session.characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: { sender: 'Damage', message: result.debugCalc, channel: 'system' }
      });
    }
  }

  private applySingleTargetSkillDamage(
    session: PlayerSession,
    skillName: string,
    targetId: string,
    result: { damage?: number; isCritical?: boolean; damageType?: string; elementalDamage?: Array<{ element: string; damage: number }>; hits?: Array<{ damage: number; isCritical: boolean; elementalDamage?: Array<{ element: string; damage: number }> }> }
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
          }
        }
        return;
      }

      const playerTarget = this.state.players.get(targetId);
      if (playerTarget && targetId !== characterId) {
        for (const hit of hits) {
          playerTarget.stats.health = Math.max(0, playerTarget.stats.health - hit.damage);
          if (hit.elementalDamage) {
            for (const el of hit.elementalDamage) {
              playerTarget.stats.health = Math.max(0, playerTarget.stats.health - el.damage);
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
        this.sendToPlayer(targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth, mana: playerTarget.stats.mana, maxMana: playerTarget.stats.maxMana }
        });
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
        }
      }
      return;
    }

    const playerTarget = this.state.players.get(targetId);
    if (playerTarget && targetId !== characterId) {
      playerTarget.stats.health = Math.max(0, playerTarget.stats.health - (result.damage || 0));
      if (result.elementalDamage) {
        for (const el of result.elementalDamage) {
          playerTarget.stats.health = Math.max(0, playerTarget.stats.health - el.damage);
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
      this.sendToPlayer(targetId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth, mana: playerTarget.stats.mana, maxMana: playerTarget.stats.maxMana }
      });
    }
  }

  private applyAOEDamageToTargets(
    session: PlayerSession,
    skillName: string,
    aoePosition: { x: number; y: number; z: number },
    aoeRadius: number,
    primaryResult?: { damage?: number; isCritical?: boolean; damageType?: string; elementalDamage?: Array<{ element: string; damage: number }> }
  ): void {
    const characterId = session.characterId;
    const getTargetStats = (id: string) => {
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
        const eff = getEffectiveStats(
          player.stats,
          player.statPoints,
          player.statusEffects || []
        );
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
    };

    const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);

    for (const target of targets) {
      const targetResult = primaryResult && primaryResult.damage
        ? primaryResult
        : this.skillSys.calculateAOEDamage(session, skillName, target.id, getTargetStats);

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
          playerTarget.stats.health = Math.max(0, playerTarget.stats.health - targetResult.damage);
          if (targetResult.elementalDamage) {
            for (const el of targetResult.elementalDamage) {
              playerTarget.stats.health = Math.max(0, playerTarget.stats.health - el.damage);
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
          this.sendToPlayer(target.id, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: target.id, stats: playerTarget.stats }
          });
          this.broadcastInZone(session.zoneId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { entityId: target.id, health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth }
          }, characterId);
          this.refreshPartyForMember(target.id);
          this.consumeDebuffsOnHit(playerTarget);
          if (playerTarget.stats.health <= 0) {
            this.handlePlayerDeath(playerTarget);
          }
        }
      }
    }
  }

  private findClosestEntityToPosition(
    session: PlayerSession,
    pos: { x: number; y: number; z: number },
    radius: number
  ): { id: string; distance: number } | null {
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

  private findAllEntitiesInRadius(
    session: PlayerSession,
    pos: { x: number; y: number; z: number },
    radius: number
  ): Array<{ id: string; distance: number }> {
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

  private spawnAOEZone(session: PlayerSession, skillName: string, position: { x: number; y: number; z: number }, radius: number): void {
    const skill = this.skillSys.findSkillDefinition(skillName);
    const totalPulses = skill?.pulseCount || 1;
    const pulseInterval = skill?.pulseInterval || 1000;
    const lastPulseTime = Date.now() + pulseInterval * (totalPulses - 1);

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
      lastPulseAt: Date.now(),
      expiresAt: lastPulseTime + 1500,
      entitiesInside: new Map<string, number>(),
    };
    const now = Date.now();
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
      const def = getEnemyDefinition(enemy.enemyType);
      const targetStats = {
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
          enemy.state = 'dead';
          enemy.deathTime = Date.now();
          const enemyDef = getEnemyDefinition(enemy.enemyType);
          if (enemyDef) {
            this.playerSys.grantExperience(session, enemyDef.experience);
          }
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DEATH,
            timestamp: Date.now(),
            data: { entityId: targetId, killerId: session.characterId }
          });
          this.broadcastInZone(session.zoneId, {
            type: PacketType.ENTITY_DESPAWN,
            timestamp: Date.now(),
            data: { entityId: targetId }
          });
        }
      }
    }
  }

  private handleGroundAOESkillUse(
    socket: Socket,
    session: PlayerSession,
    skillName: string,
    aoePosition: { x: number; y: number; z: number }
  ): void {
    const characterId = session.characterId;

    const check = this.skillSys.canUseSkill(session, skillName, null);
    if (!check.canUse) {
      this.sendToPlayer(characterId, {
        type: PacketType.SKILL_USE,
        timestamp: Date.now(),
        data: { skillName, error: check.error }
      });
      return;
    }

    const groundSkillDef = this.skillSys.findSkillDefinition(skillName);
    if (groundSkillDef?.consumableItem) {
      const needed = groundSkillDef.consumableItemQuantity || 1;
      const count = session.inventory.filter(i => i.itemId === groundSkillDef.consumableItem).reduce((s, i) => s + i.quantity, 0);
      if (count < needed) {
        this.sendToPlayer(characterId, {
          type: PacketType.SKILL_USE,
          timestamp: Date.now(),
          data: { skillName, error: 'no_materials' }
        });
        return;
      }
      let remaining = needed;
      for (let i = session.inventory.length - 1; i >= 0 && remaining > 0; i--) {
        if (session.inventory[i].itemId === groundSkillDef.consumableItem) {
          const take = Math.min(session.inventory[i].quantity, remaining);
          session.inventory[i].quantity -= take;
          remaining -= take;
          if (session.inventory[i].quantity <= 0) session.inventory.splice(i, 1);
        }
      }
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory }
      });
    }

    const { started, castTime } = this.skillSys.beginCast(session, skillName, null, aoePosition);
    if (!started) return;

    if (castTime > 0) {
      const skill = this.skillSys.findSkillDefinition(skillName);
      this.sendToPlayer(characterId, {
        type: PacketType.COOLDOWN_UPDATE,
        timestamp: Date.now(),
        data: { skillName, castTime, type: 'cast_start', aoePosition }
      });
      return;
    }

    const getTargetStats = (id: string) => {
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
        const eff = getEffectiveStats(
          player.stats,
          player.statPoints,
          player.statusEffects || []
        );
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
    };
    const skill = this.skillSys.findSkillDefinition(skillName);
    const aoeRadius = skill?.aoeRadius || DEFAULT_AOE_RADIUS;

    const firstTarget = this.findClosestEntityToPosition(
      session, aoePosition, aoeRadius
    );
    const firstTargetId = firstTarget?.id || null;

    const result = this.skillSys.executeSkill(session, skillName, firstTargetId, getTargetStats);
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

  private handleAOECastCompletion(session: PlayerSession, castResult: { skillName: string; aoePosition: { x: number; y: number; z: number }; targetId: string | null }): void {
    const characterId = session.characterId;
    const skillName = castResult.skillName;
    const aoePosition = castResult.aoePosition;

    const skill = this.skillSys.findSkillDefinition(skillName);
    if (!skill) return;

    const getTargetStats = (id: string) => {
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
        const eff = getEffectiveStats(
          player.stats,
          player.statPoints,
          player.statusEffects || []
        );
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
    };

    const aoeRadius = skill?.aoeRadius || DEFAULT_AOE_RADIUS;

    const firstTarget = this.findClosestEntityToPosition(session, aoePosition, aoeRadius);
    const firstTargetId = firstTarget?.id || null;

    const result = this.skillSys.executeSkill(session, skillName, firstTargetId, getTargetStats);
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
            data: { entityId: target.id, statusEffects: enemy.statusEffects }
          });
        }
      }
    }
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
