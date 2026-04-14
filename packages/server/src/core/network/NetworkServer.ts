import { Server as SocketIOServer, Socket } from 'socket.io';
import { Packet, PacketType, PlayerSession, CharacterClass, CLASS_DEFINITIONS, Validator } from '@dust-saga/shared';
import { AuthManager } from '../auth/AuthManager';
import { CombatSystem } from '../ecs/systems/CombatSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { LootSystem } from '../ecs/systems/LootSystem';
import { PlayerSystem } from '../ecs/systems/PlayerSystem';
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
    this.spawnMgr = new SpawnManager();
    this.questSys = new QuestSystem();
    this.state = {
      players: new Map(),
      socketToPlayer: new Map(),
      playerToSocket: new Map()
    };

    this.setupCallbacks();
    this.setupEventHandlers();
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

        const completedQuests = this.questSys.onEnemyKill(killer, enemy.enemyType);
        completedQuests.forEach(questId => {
          this.sendToPlayer(killer.characterId, {
            type: PacketType.QUEST_PROGRESS,
            timestamp: Date.now(),
            data: { questId, status: 'completed', message: `Quest "${getQuest(questId)?.title}" completed! Return to the NPC.` }
          });
        });

        const lootItems = this.loot.generateLoot(enemyDef.lootTable, enemy.position, killerId);
        lootItems.forEach(loot => {
          this.broadcastInZone(killer.zoneId, {
            type: PacketType.LOOT_SPAWN,
            timestamp: Date.now(),
            data: loot
          });
        });
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
    });

    this.ai.onEnemyAttack((enemyId, targetId, damage) => {
      const target = this.findPlayerByCharacterId(targetId);
      if (!target) return;

      if (target.invulnerableUntil > Date.now()) return;

      const enemy = this.spawnMgr.getEnemy(enemyId);
      if (!enemy) return;

      const actualDamage = Math.max(1, damage - target.stats.defense * 0.2);
      target.stats.health = Math.max(0, target.stats.health - actualDamage);

      this.sendToPlayer(targetId, {
        type: PacketType.DAMAGE,
        timestamp: Date.now(),
        data: { attackerId: enemyId, targetId, damage: Math.floor(actualDamage), isCritical: false, damageType: 'physical' }
      });

      this.broadcastInZone(target.zoneId, {
        type: PacketType.STATS_UPDATE,
        timestamp: Date.now(),
        data: { characterId: targetId, stats: target.stats }
      });

      if (target.stats.health <= 0) {
        this.handlePlayerDeath(target);
      }
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
      const classDef = CLASS_DEFINITIONS[c.class as CharacterClass];
      return {
        id: c.id,
        name: c.name,
        class: c.class,
        level: c.level,
        zoneId: c.zone_id || 'starter_zone',
        modelFile: classDef?.modelFile || 'Adventurer.glb'
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

    const result = await this.auth.createCharacter(playerId, data.name, data.characterClass);

    if (result.success) {
      const classDef = CLASS_DEFINITIONS[data.characterClass as CharacterClass];
      this.sendToSocket(socket.id, {
        type: PacketType.CHARACTER_CREATE,
        timestamp: Date.now(),
        data: {
          character: {
            id: result.characterId,
            name: data.name,
            class: data.characterClass,
            level: 1,
            zoneId: 'starter_zone',
            modelFile: classDef?.modelFile || 'Adventurer.glb'
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
      char.username || playerId,
      char.id,
      char.name,
      char.class as CharacterClass,
      char.level
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
        characterClass: session.characterClass,
        stats: session.stats,
        position: session.position,
        rotation: session.rotation,
        zoneId: session.zoneId,
        inventory: session.inventory,
        equipment: session.equipment,
        quests: session.quests
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
        data: { name: session.characterName, class: session.characterClass, level: session.stats.level, modelFile: CLASS_DEFINITIONS[session.characterClass as CharacterClass]?.modelFile }
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

    socket.broadcast.emit('packet', {
      type: PacketType.PLAYER_POSITION_UPDATE,
      timestamp: Date.now(),
      data: {
        socketId: socket.id,
        characterId,
        position: data.position,
        rotation: data.rotation || session.rotation
      }
    });
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

  private handleChatMessage(socket: Socket, data: any): void {
    const characterId = this.findCharacterBySocket(socket.id);
    if (!characterId) return;

    const session = this.state.players.get(characterId);
    if (!session) return;

    const message = typeof data.message === 'string' ? data.message.substring(0, 200) : '';
    if (!message.trim()) return;

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
        session.stats.health = Math.min(session.stats.maxHealth, session.stats.health + (itemDef.stats.health || 0));
      }
      if (itemDef.stats.mana && itemDef.type === 'consumable') {
        session.stats.mana = Math.min(session.stats.maxMana, session.stats.mana + (itemDef.stats.mana || 0));
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

    this.sendZoneState(socket, data.zoneId);

    this.broadcastInZone(session.zoneId, {
      type: PacketType.ENTITY_SPAWN,
      timestamp: Date.now(),
      data: {
        id: characterId,
        type: 'player',
        position: session.position,
        rotation: session.rotation,
        data: { name: session.characterName, class: session.characterClass, level: session.stats.level, modelFile: CLASS_DEFINITIONS[session.characterClass as CharacterClass]?.modelFile }
      }
    });

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
        this.broadcastInZone(session.zoneId, {
          type: PacketType.ENTITY_DESPAWN,
          timestamp: Date.now(),
          data: { entityId: characterId }
        });
      }
      this.state.players.delete(characterId);
      this.state.playerToSocket.delete(characterId);
    }
    this.state.socketToPlayer.delete(socket.id);
  }

  private sendZoneState(socket: Socket, zoneId: string): void {
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
      if (player.characterId !== this.findCharacterBySocket(socket.id) && player.zoneId === zoneId) {
        otherPlayers.push({
          id: player.characterId,
          type: 'player',
          position: player.position,
          rotation: player.rotation,
          data: { name: player.characterName, class: player.characterClass, level: player.stats.level, modelFile: CLASS_DEFINITIONS[player.characterClass as CharacterClass]?.modelFile }
        });
      }
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
    const playerPositions = new Map<string, { position: { x: number; y: number; z: number }; characterId: string }>();
    this.state.players.forEach(session => {
      if (session.invulnerableUntil > now) return;
      playerPositions.set(session.characterId, { position: session.position, characterId: session.characterId });
    });

    this.ai.updateEnemies(this.spawnMgr.getAllEnemies(), playerPositions, 1 / this.tickRate);

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

  private broadcastInZone(zoneId: string, packet: Packet): void {
    this.state.players.forEach(session => {
      if (session.zoneId === zoneId) {
        const socketId = this.state.playerToSocket.get(session.characterId);
        if (socketId) {
          this.io.to(socketId).emit('packet', packet);
        }
      }
    });
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
