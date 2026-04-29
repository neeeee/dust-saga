import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  Packet, PacketType, PlayerSession, Validator,
  JOB_DEFINITIONS, RACE_DATA, createDefaultStatPoints, createDefaultSkillProficiencies,
  getBaseClassForJob, calculateDerivedStats, getExperienceToNextLevel, getStatPointsGainedAtLevel,
  StatType, JobId, Race, processRacialOnDamage, applyRacialPotionHealing,
  REGEN_CONFIG, SKILL_TARGET_RULES, SkillTargetType,
  PartyVisibility, LootRule, MAX_LOOT_POOL,
  GROUND_TARGETED_AOE_SKILLS, DEFAULT_AOE_RADIUS,
  StatusEffectType
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
import { getEnemyDefinition, getZoneDefinition, NPC_DATABASE, getNPCsInZone, getItem, getQuest, QUEST_DATABASE } from '@dust-saga/shared';
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

      const actualDamage = Math.max(1, damage - target.stats.defense * 0.2);
      const racialResult = processRacialOnDamage(target, Math.floor(actualDamage), 'physical');
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
    const zoneDef = getZoneDefinition(session.zoneId);
    const spawnPoint = zoneDef?.playerSpawn || { x: 0, y: 0, z: 0 };

    session.stats.health = session.stats.maxHealth;
    session.stats.mana = session.stats.maxMana;
    session.position = { ...spawnPoint };
    session.invulnerableUntil = Date.now() + 5000;

    this.spawnMgr.getAllEnemies().forEach(enemy => {
      if (enemy.targetId === session.characterId) {
        enemy.state = 'return';
        enemy.targetId = null;
      }
    });

    this.sendToPlayer(session.characterId, {
      type: PacketType.DEATH,
      timestamp: Date.now(),
      data: { entityId: session.characterId, respawnPosition: spawnPoint }
    });

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
          this.handlePlayerMove(socket, packet.data);
          break;

        case PacketType.ATTACK:
          this.handleAttack(socket, packet.data);
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

        case PacketType.JOB_ADVANCE:
          this.handleJobAdvance(socket, packet.data);
          break;

        case PacketType.PARTY_CREATE_REQUEST:
          this.handlePartyCreateRequest(socket, packet.data);
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
      char.experience || 0
    );

    session.zoneId = char.zone_id || 'starter_zone';

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
        quests: session.quests,
        statPoints: session.statPoints,
        unspentStatPoints: session.unspentStatPoints,
        unspentSkillPoints: session.unspentSkillPoints,
        skillProficiencies: session.skillProficiencies
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
        this.broadcastInZone(session.zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: data.targetId, health: enemy.health, maxHealth: enemy.maxHealth }
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
      this.sendToPlayer(characterId, {
        type: PacketType.CHAT_MESSAGE,
        timestamp: Date.now(),
        data: {
          sender: 'Debug',
          message: `[Cast] ${skillName}: base=${baseCastMs}ms castSpd=${100 + Math.floor(session.statPoints.DEX / 10) * 5}% effective=${castTime}ms | cooldown base=${skill?.cooldown || 0}s multiplier=${cooldownPct}% effective=${(effectiveCd / 1000).toFixed(1)}s`,
          channel: 'system'
        }
      });
      return;
    }

    const getTargetStats = (id: string) => {
      const enemy = this.spawnMgr.getEnemy(id);
      if (enemy) {
        const def = getEnemyDefinition(enemy.enemyType);
        return {
          defense: def?.defense || 0,
          magicDefense: Math.floor((def?.defense || 0) * 0.3),
          health: enemy.health,
          level: enemy.level,
          dodge: Math.floor(enemy.level * 0.5)
        };
      }
      const player = this.state.players.get(id);
      if (player) {
        return {
          defense: player.stats.defense,
          magicDefense: Math.floor(player.stats.defense * 0.3),
          health: player.stats.health,
          level: player.stats.level,
          dodge: player.statPoints.AGI
        };
      }
      return null;
    };

    const result = this.skillSys.executeSkill(session, skillName, targetId || null, getTargetStats);

    this.sendToPlayer(characterId, {
      type: PacketType.COOLDOWN_UPDATE,
      timestamp: Date.now(),
      data: {
        skillName,
        type: 'used',
        mpCost: this.skillSys.findSkillDefinition(skillName)?.mpCost || 0,
        cooldownRemaining: session.skillCooldowns.find(c => c.skillName === skillName)?.readyAt
          ? Math.max(0, (session.skillCooldowns.find(c => c.skillName === skillName)!.readyAt - Date.now()))
          : 0
      }
    });

    this.sendToPlayer(characterId, {
      type: PacketType.STATS_UPDATE,
      timestamp: Date.now(),
      data: { characterId, stats: session.stats }
    });

    if (session.statusEffects.length > 0) {
      this.sendToPlayer(characterId, {
        type: PacketType.STATUS_EFFECT_UPDATE,
        timestamp: Date.now(),
        data: { effects: session.statusEffects }
      });
      this.broadcastEntityEffects(session);
    }

    const skill = this.skillSys.findSkillDefinition(skillName);
    if (skill && skill.duration > 0 && targetId && targetId !== characterId) {
      const targetType = SKILL_TARGET_RULES[skillName];
      const shouldApplyToTarget = !targetType
        || targetType === SkillTargetType.SELF_OR_TARGET
        || targetType === SkillTargetType.PARTY
        || targetType === SkillTargetType.OTHER_ONLY;
      if (shouldApplyToTarget) {
        const targetSession = this.state.players.get(targetId);
        if (targetSession) {
          this.skillSys.applyBuffToTarget(targetSession, session.characterId, skill);
          this.sendToPlayer(targetId, {
            type: PacketType.STATUS_EFFECT_UPDATE,
            timestamp: Date.now(),
            data: { effects: targetSession.statusEffects }
          });
          this.broadcastEntityEffects(targetSession);
        }
      }
    }

    if (result.statusEffects && result.statusEffects.length > 0 && targetId) {
      const targetSession = this.state.players.get(targetId);
      if (targetSession) {
        for (const effect of result.statusEffects) {
          effect.targetId = targetId;
          targetSession.statusEffects.push(effect);
        }
        this.sendToPlayer(targetId, {
          type: PacketType.STATUS_EFFECT_UPDATE,
          timestamp: Date.now(),
          data: { effects: targetSession.statusEffects }
        });
        this.broadcastEntityEffects(targetSession);
      }
    }

    if (skill) {
      const targetType = SKILL_TARGET_RULES[skillName];
      if (targetType === SkillTargetType.PARTY) {
        const partyMembers = this.partySys.getPartyMembers(characterId);
        for (const memberId of partyMembers) {
          if (memberId === characterId) continue;
          const memberSession = this.state.players.get(memberId);
          if (!memberSession || memberSession.stats.health <= 0) continue;
          if (memberSession.zoneId !== session.zoneId) continue;

          if (skill.duration > 0) {
            this.skillSys.applyBuffToTarget(memberSession, session.characterId, skill);
            this.sendToPlayer(memberId, {
              type: PacketType.STATUS_EFFECT_UPDATE,
              timestamp: Date.now(),
              data: { effects: memberSession.statusEffects }
            });
            this.broadcastEntityEffects(memberSession);
          }

          if (result.healing) {
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
            }, characterId);
            this.refreshPartyForMember(memberId);
          }

          if (result.maxHpIncrease) {
            const hpIncrease = this.skillSys.calculateMaxHpBuff(memberSession, skill);
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
            }, characterId);
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

    if (result.missed && targetId) {
      this.broadcastInZone(session.zoneId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: {
          attackerId: characterId,
          targetId,
          damage: 0,
          isCritical: false,
          damageType: result.damageType || 'physical',
          skillName,
          missed: true
        }
      });
    } else if (result.damage && targetId) {
      const enemy = this.spawnMgr.getEnemy(targetId);
      if (enemy) {
        enemy.health = Math.max(0, enemy.health - result.damage);
        this.broadcastInZone(session.zoneId, {
          type: PacketType.DAMAGE,
          timestamp: Date.now(),
          data: {
            attackerId: characterId,
            targetId,
            damage: result.damage,
            isCritical: result.isCritical || false,
            damageType: result.damageType || 'physical',
            skillName
          }
        });
        if (enemy.health <= 0) {
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
            data: { entityId: targetId, killerId: characterId }
          });

          this.broadcastInZone(session.zoneId, {
            type: PacketType.ENTITY_DESPAWN,
            timestamp: Date.now(),
            data: { entityId: targetId }
          });
        } else {
          this.broadcastInZone(session.zoneId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { entityId: targetId, health: enemy.health, maxHealth: enemy.maxHealth }
          });
        }
      } else {
        const playerTarget = this.state.players.get(targetId);
        if (playerTarget) {
          playerTarget.stats.health = Math.max(0, playerTarget.stats.health - result.damage);
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: characterId,
              targetId,
              damage: result.damage,
              isCritical: result.isCritical || false,
              damageType: result.damageType || 'physical',
              skillName
            }
          });
          this.sendToPlayer(targetId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { characterId: targetId, stats: playerTarget.stats }
          });
          this.broadcastInZone(session.zoneId, {
            type: PacketType.STATS_UPDATE,
            timestamp: Date.now(),
            data: { entityId: targetId, health: playerTarget.stats.health, maxHealth: playerTarget.stats.maxHealth }
          }, characterId);
          this.refreshPartyForMember(targetId);
          if (playerTarget.stats.health <= 0) {
            this.handlePlayerDeath(playerTarget);
          }
        }
      }
    }

    if (result.healing) {
      const healTarget = targetId && targetId !== characterId ? this.state.players.get(targetId) : null;
      if (healTarget) {
        healTarget.stats.health = Math.min(healTarget.stats.maxHealth, healTarget.stats.health + result.healing);
        this.broadcastInZone(session.zoneId, {
          type: PacketType.HEAL,
          timestamp: Date.now(),
          data: { targetId, amount: result.healing }
        });
        this.sendToPlayer(targetId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId: targetId, stats: healTarget.stats }
        });
        this.broadcastInZone(session.zoneId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { entityId: targetId, health: healTarget.stats.health, maxHealth: healTarget.stats.maxHealth }
        }, characterId);
        this.refreshPartyForMember(targetId);
      } else {
        session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + result.healing);
        this.sendToPlayer(characterId, {
          type: PacketType.HEAL,
          timestamp: Date.now(),
          data: { targetId: characterId, amount: result.healing }
        });
        this.sendToPlayer(characterId, {
          type: PacketType.STATS_UPDATE,
          timestamp: Date.now(),
          data: { characterId, stats: session.stats }
        });
        this.refreshPartyForMember(characterId);
      }
    }

    if (result.mpRestored) {
      this.sendToPlayer(characterId, {
        type: PacketType.HEAL,
        timestamp: Date.now(),
        data: { targetId: characterId, amount: result.mpRestored, mpRestore: true }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats }
      });
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
          defense: def?.defense || 0,
          magicDefense: Math.floor((def?.defense || 0) * 0.3),
          health: enemy.health,
          level: enemy.level,
          dodge: Math.floor(enemy.level * 0.5)
        };
      }
      const player = this.state.players.get(id);
      if (player) {
        return {
          defense: player.stats.defense,
          magicDefense: Math.floor(player.stats.defense * 0.3),
          health: player.stats.health,
          level: player.stats.level,
          dodge: player.statPoints.AGI
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
      data: { characterId, stats: session.stats }
    });

    if (session.statusEffects.length > 0) {
      this.sendToPlayer(characterId, {
        type: PacketType.STATUS_EFFECT_UPDATE,
        timestamp: Date.now(),
        data: { effects: session.statusEffects }
      });
    }

    if (result.damage && firstTargetId) {
      const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);

      for (const target of targets) {
        const targetResult = target.id === firstTargetId
          ? result
          : this.skillSys.calculateAOEDamage(session, skillName, target.id, getTargetStats);

        if (!targetResult.damage) continue;

        const enemy = this.spawnMgr.getEnemy(target.id);
        if (enemy) {
          enemy.health = Math.max(0, enemy.health - targetResult.damage);
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: characterId,
              targetId: target.id,
              damage: targetResult.damage,
              isCritical: targetResult.isCritical || false,
              damageType: targetResult.damageType || 'physical',
              skillName
            }
          });

          if (enemy.health <= 0) {
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
            this.broadcastInZone(session.zoneId, {
              type: PacketType.DAMAGE,
              timestamp: Date.now(),
              data: {
                attackerId: characterId,
                targetId: target.id,
                damage: targetResult.damage,
                isCritical: targetResult.isCritical || false,
                damageType: targetResult.damageType || 'physical',
                skillName
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
            if (playerTarget.stats.health <= 0) {
              this.handlePlayerDeath(playerTarget);
            }
          }
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
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats }
      });
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

  private handleAOECastCompletion(
    session: PlayerSession,
    castResult: { skillName: string; targetId: string | null; aoePosition?: { x: number; y: number; z: number } }
  ): void {
    const characterId = session.characterId;
    const { skillName } = castResult;
    const aoePosition = castResult.aoePosition!;

    const getTargetStats = (id: string) => {
      const enemy = this.spawnMgr.getEnemy(id);
      if (enemy) {
        const def = getEnemyDefinition(enemy.enemyType);
        return {
          defense: def?.defense || 0,
          magicDefense: Math.floor((def?.defense || 0) * 0.3),
          health: enemy.health,
          level: enemy.level,
          dodge: Math.floor(enemy.level * 0.5)
        };
      }
      const player = this.state.players.get(id);
      if (player) {
        return {
          defense: player.stats.defense,
          magicDefense: Math.floor(player.stats.defense * 0.3),
          health: player.stats.health,
          level: player.stats.level,
          dodge: player.statPoints.AGI
        };
      }
      return null;
    };

    const skill = this.skillSys.findSkillDefinition(skillName);
    const aoeRadius = skill?.aoeRadius || DEFAULT_AOE_RADIUS;

    const firstTarget = this.findClosestEntityToPosition(session, aoePosition, aoeRadius);
    const firstTargetId = firstTarget?.id || null;

    const result = this.skillSys.executeSkill(session, skillName, firstTargetId, getTargetStats);

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

    if (result.damage) {
      const targets = this.findAllEntitiesInRadius(session, aoePosition, aoeRadius);

      for (const target of targets) {
        const targetResult = target.id === firstTargetId
          ? result
          : this.skillSys.calculateAOEDamage(session, skillName, target.id, getTargetStats);

        if (!targetResult.damage) continue;

        const enemy = this.spawnMgr.getEnemy(target.id);
        if (enemy) {
          enemy.health = Math.max(0, enemy.health - targetResult.damage);
          this.broadcastInZone(session.zoneId, {
            type: PacketType.DAMAGE,
            timestamp: Date.now(),
            data: {
              attackerId: characterId,
              targetId: target.id,
              damage: targetResult.damage,
              isCritical: targetResult.isCritical || false,
              damageType: targetResult.damageType || 'physical',
              skillName
            }
          });
          if (enemy.health <= 0) {
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
            this.broadcastInZone(session.zoneId, {
              type: PacketType.DAMAGE,
              timestamp: Date.now(),
              data: {
                attackerId: characterId,
                targetId: target.id,
                damage: targetResult.damage,
                isCritical: targetResult.isCritical || false,
                damageType: targetResult.damageType || 'physical',
                skillName
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
            if (playerTarget.stats.health <= 0) {
              this.handlePlayerDeath(playerTarget);
            }
          }
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
    const visibleEffects = session.statusEffects.filter(e =>
      e.type !== StatusEffectType.BUFF_DEFENSE &&
      e.type !== StatusEffectType.BUFF_CAST_SPEED &&
      e.type !== StatusEffectType.BUFF_MAX_HP &&
      e.type !== StatusEffectType.BUFF_MP_REGEN &&
      e.type !== StatusEffectType.BUFF_ATTACK &&
      e.type !== StatusEffectType.BUFF_GENERIC &&
      e.type !== StatusEffectType.HASTE
    );
    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_STATUS_EFFECTS,
      timestamp: Date.now(),
      data: { entityId: session.characterId, effects: visibleEffects }
    }, session.characterId);
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
        data: { characterId: session.characterId, stats: session.stats, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints }
      });
      if (currentLevel < session.stats.level) {
        this.sendToPlayer(session.characterId, {
          type: PacketType.LEVEL_UP,
          timestamp: Date.now(),
          data: { level: session.stats.level, statPoints: session.statPoints, unspentStatPoints: session.unspentStatPoints, unspentSkillPoints: session.unspentSkillPoints }
        });
      }
    } else if (cmd === '/killallenemies') {
      const enemies = this.spawnMgr.getEnemiesInZone(session.zoneId);
      let killed = 0;
      enemies.forEach((enemy, enemyId) => {
        if (enemy.state === 'dead') return;
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
        data: { inventory: session.inventory }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId, stats: session.stats }
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
        data: { characterId, stats: session.stats }
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
        data: { characterId, stats: session.stats }
      });
    }
  }

  private handleLootPickup(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

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
        data: { inventory: session.inventory }
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
        data: { inventory: session.inventory }
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
  }

  private handleShopBuy(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const itemDef = getItem(data.itemId);
    if (!itemDef) return;

    const added = this.playerSys.addItemToInventory(session, data.itemId, data.quantity || 1);
    if (added) {
      this.sendToPlayer(characterId, {
        type: PacketType.INVENTORY_UPDATE,
        timestamp: Date.now(),
        data: { inventory: session.inventory }
      });
      this.sendToPlayer(characterId, {
        type: PacketType.NOTIFICATION,
        timestamp: Date.now(),
        data: { message: `Purchased ${itemDef.name}`, type: 'success' }
      });
    }
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
        unspentSkillPoints: session.unspentSkillPoints
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
          jobId: session.jobId
        }).catch(err => console.error('Failed to save character on disconnect:', err));

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
      this.skillSys.updateCooldowns(session);

      const castResult = this.skillSys.checkCasting(session);
      if (castResult?.completed) {
        if (castResult.aoePosition) {
          this.handleAOECastCompletion(session, castResult);
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
              defense: def?.defense || 0,
              magicDefense: Math.floor((def?.defense || 0) * 0.3),
              health: enemy.health,
              level: enemy.level,
              dodge: Math.floor(enemy.level * 0.5)
            };
          }
          const player = this.state.players.get(id);
          if (player) {
            return {
              defense: player.stats.defense,
              magicDefense: Math.floor(player.stats.defense * 0.3),
              health: player.stats.health,
              level: player.stats.level,
              dodge: player.statPoints.AGI
            };
          }
          return null;
        };

        const result = this.skillSys.executeSkill(session, castResult.skillName, castResult.targetId, getTargetStats);

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
            enemy.health = Math.max(0, enemy.health - result.damage);
            this.broadcastInZone(session.zoneId, {
              type: PacketType.DAMAGE,
              timestamp: Date.now(),
              data: { attackerId: session.characterId, targetId: castResult.targetId, damage: result.damage, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName }
            });
            if (enemy.health <= 0) {
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
                  data: { characterId: session.characterId, stats: session.stats }
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
              this.broadcastInZone(session.zoneId, {
                type: PacketType.DAMAGE,
                timestamp: Date.now(),
                data: { attackerId: session.characterId, targetId: castResult.targetId, damage: result.damage, isCritical: result.isCritical || false, damageType: result.damageType || 'physical', skillName: castResult.skillName }
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
              if (playerTarget.stats.health <= 0) {
                this.handlePlayerDeath(playerTarget);
              }
            }
          }
        }

        if (result.healing) {
          const healTargetId = castResult.targetId && castResult.targetId !== session.characterId ? castResult.targetId : null;
          const healTarget = healTargetId ? this.state.players.get(healTargetId) : null;
          if (healTarget) {
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
            session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + result.healing);
            this.sendToPlayer(session.characterId, {
              type: PacketType.HEAL,
              timestamp: Date.now(),
              data: { targetId: session.characterId, amount: result.healing }
            });
            this.refreshPartyForMember(session.characterId);
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
                this.skillSys.applyBuffToTarget(tSession, session.characterId, castSkill);
                this.sendToPlayer(castResult.targetId, {
                  type: PacketType.STATUS_EFFECT_UPDATE,
                  timestamp: Date.now(),
                  data: { effects: tSession.statusEffects }
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
              if (!memberSession || memberSession.stats.health <= 0) continue;
              if (memberSession.zoneId !== session.zoneId) continue;

              if (castSkill.duration > 0) {
                this.skillSys.applyBuffToTarget(memberSession, session.characterId, castSkill);
                this.sendToPlayer(memberId, {
                  type: PacketType.STATUS_EFFECT_UPDATE,
                  timestamp: Date.now(),
                  data: { effects: memberSession.statusEffects }
                });
                this.broadcastEntityEffects(memberSession);
              }

              if (result.healing) {
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
        if (tick.expired.length > 0) {
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

    for (const zoneId of this.spawnMgr.getZoneIds()) {
      const zonePlayers = new Map<string, { position: { x: number; y: number; z: number }; characterId: string }>();
      this.state.players.forEach(session => {
        if (session.zoneId !== zoneId) return;
        if (session.invulnerableUntil > now) return;
        zonePlayers.set(session.characterId, { position: session.position, characterId: session.characterId });
      });

      this.ai.updateEnemies(this.spawnMgr.getEnemiesInZone(zoneId), zonePlayers, 1 / this.tickRate);
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
        jobId: session.jobId
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
