import { GameEngine } from './engine/GameEngine';
import { NetworkClient } from './network/NetworkClient';
import { InputManager, SkillBarKeyHandler } from './input/InputManager';
import { ClientEntityManager, InterpolationManager } from './ecs/ClientEntityManager';
import { Vector3 as BabylonVector3, PointerEventTypes } from '@babylonjs/core';
import {
  PacketType,
  GAME_CONFIG,
  PlayerStats,
  ZoneDefinition,
  getZoneDefinition,
  StatPoints,
  GROUND_TARGETED_AOE_SKILLS,
  DEFAULT_AOE_RADIUS,
} from '@dust-saga/shared';

export interface GameCallbacks {
  onStatsUpdate: (stats: PlayerStats) => void;
  onStatPointsUpdate: (statPoints: StatPoints | null, unspentStatPoints: number, unspentSkillPoints: number, statBreakdown?: any) => void;
  onSkillProficienciesUpdate: (skillProficiencies: any, skillAdeptness?: any) => void;
  onInventoryUpdate: (inventory: any, equipment: any) => void;
  onQuestUpdate: (quests: any) => void;
  onChatMessage: (sender: string, message: string, channel?: string) => void;
  onNotification: (message: string, type: string) => void;
  onStatusEffects: (effects: any[]) => void;
  onDeath: (data: any) => void;
  onExperienceGain: (data: any) => void;
  onLevelUp: (level: number) => void;
  onNPCDialog: (data: any) => void;
  onTargetChange: (id: string | null, data?: { name: string; level: number; health: number; maxHealth: number; type?: string; class?: string } | null) => void;
  onZoneChange: (zoneId: string, zoneName: string) => void;
  onEnemyListUpdate: (enemies: any[]) => void;
  onCastStart: (skillName: string, castTime: number) => void;
  onCastComplete: (skillName: string) => void;
  onSkillUsed: (skillName: string, mpCost: number, cooldownRemaining: number) => void;
  onSkillError: (skillName: string, error: string) => void;
  onEntityStatusEffects: (entityId: string, effects: any[]) => void;
}

export class GameClient {
  private engine: GameEngine;
  private network: NetworkClient;
  private input: InputManager | null = null;
  private entityManager: ClientEntityManager;
  private interpolationManager: InterpolationManager;
  private isRunning: boolean = false;
  private lastUpdate: number = 0;
  private lastTeleportTime: number = 0;
  private zoneLoading: boolean = false;
  private pendingSpawns: Array<{ id: string; type: string; position: any; data: any }> = [];
  private playerId: string | null = null;
  private playerMesh: any = null;
  private callbacks: Partial<GameCallbacks> = {};
  private stats: PlayerStats | null = null;
  private statPoints: StatPoints | null = null;
  private unspentStatPoints: number = 0;
  private unspentSkillPoints: number = 0;
  private skillProficiencies: any = null;
  private skillAdeptness: any = null;
  private statBreakdown: any = null;
  private currentJobId: string = 'warrior';
  private currentBaseClass: string = 'warrior';
  private currentZoneId: string | null = null;
  private targetId: string | null = null;
  private lastMoveSend: number = 0;
  private enemies: Map<string, any> = new Map();
  private lootBeacons: Map<string, any> = new Map();
  private knownEntities: Map<string, { type: string; data: any }> = new Map();
  private aoeTargetingActive: boolean = false;
  private aoeTargetingSkillName: string | null = null;
  private aoeLastPosition: { x: number; y: number; z: number } | null = null;

  constructor(canvas: HTMLCanvasElement | null) {
    this.engine = new GameEngine(canvas);
    this.network = new NetworkClient();
    this.entityManager = new ClientEntityManager();
    this.interpolationManager = new InterpolationManager();
  }

  setCallbacks(callbacks: Partial<GameCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  async initialize(): Promise<void> {
    this.setupNetworkHandlers();
    this.network.connect();
    this.isRunning = true;
    this.lastUpdate = performance.now();
    this.gameLoop();
  }

  async initEngine(canvas: HTMLCanvasElement): Promise<void> {
    this.engine = new GameEngine(canvas);
    this.input = new InputManager();
    await this.engine.initialize();
    this.setupClickHandler();
    this.setupAOETargeting(canvas);
  }

  private setupClickHandler(): void {
    this.engine.onClickEntity((entityId) => {
      if (this.aoeTargetingActive) return;
      const entity = this.knownEntities.get(entityId);
      if (entity?.type === 'enemy') {
        this.targetId = entityId;
        this.engine.setTargetIndicator(entityId);
        const enemyData = this.enemies.get(entityId);
        this.callbacks.onTargetChange?.(entityId, enemyData ? { name: enemyData.name || 'Enemy', level: enemyData.level || 1, health: enemyData.health || 0, maxHealth: enemyData.maxHealth || 1, type: 'enemy' } : null);
      } else if (entity?.type === 'npc') {
        this.targetId = entityId;
        this.engine.setTargetIndicator(entityId);
        this.callbacks.onTargetChange?.(entityId, { name: entity.data.name || 'NPC', level: 0, health: 0, maxHealth: 0, type: 'npc' });
      } else if (entity?.type === 'player') {
        this.targetId = entityId;
        this.engine.setTargetIndicator(entityId);
        this.callbacks.onTargetChange?.(entityId, {
          name: entity.data.name || 'Player',
          level: entity.data.level || 0,
          health: entity.data.health || 0,
          maxHealth: entity.data.maxHealth || 0,
          type: 'player',
          class: entity.data.class || entity.data.jobId || ''
        });
      } else {
        this.targetId = null;
        this.engine.setTargetIndicator(null);
        this.callbacks.onTargetChange?.(null);
      }
    });
  }

  private setupAOETargeting(_canvas: HTMLCanvasElement): void {
    let mouseMoveThrottle = 0;

    const scene = this.engine.getScene();

    scene?.onPointerObservable.add((pointerInfo) => {
      if (!this.aoeTargetingActive) return;

      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        const now = Date.now();
        if (now - mouseMoveThrottle < 16) return;
        mouseMoveThrottle = now;
        const result = this.engine.updateAOETargetCircle(scene.pointerX, scene.pointerY);
        if (result) {
          this.aoeLastPosition = result.position;
          // Debug: AOE cursor position
          // const pp = this.playerMesh?.position;
        } else {
          // this.callbacks.onChatMessage?.(
          //   'Debug',
          //   `[AOE] pick missed scene.xy=(${scene.pointerX.toFixed(0)}, ${scene.pointerY.toFixed(0)})`,
          //   'system'
          // );
        }
      }

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        const evt = pointerInfo.event;
        if (evt.button === 0) {
          if (!this.aoeLastPosition) {
            const result = this.engine.updateAOETargetCircle(scene.pointerX, scene.pointerY);
            if (result) {
              this.aoeLastPosition = result.position;
            }
          }
          // this.callbacks.onChatMessage?.(
          //   'Debug',
          //   `[AOE Click] pos=${this.aoeLastPosition ? `(${this.aoeLastPosition.x.toFixed(1)},${this.aoeLastPosition.y.toFixed(1)},${this.aoeLastPosition.z.toFixed(1)})` : 'null'} valid=${this.engine.isAOETargetValid()}`,
          //   'system'
          // );
          if (!this.aoeLastPosition || !this.engine.isAOETargetValid()) return;
          const pos = this.aoeLastPosition;
          const skillName = this.aoeTargetingSkillName!;
          this.cancelAOETargeting();
          this.network.useSkill(
            skillName,
            this.targetId,
            { x: pos.x, y: pos.y, z: pos.z }
          );
        } else if (evt.button === 2) {
          this.cancelAOETargeting();
        }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (!this.aoeTargetingActive) return;
      if (e.key === 'Escape') {
        this.cancelAOETargeting();
      }
    });

    scene?.onPointerObservable.add((pointerInfo) => {
      if (this.aoeTargetingActive && pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if ((pointerInfo.event as PointerEvent).button === 2) {
          pointerInfo.event.preventDefault();
        }
      }
    });
  }

  startAOETargeting(skillName: string, radius: number): void {
    this.aoeTargetingActive = true;
    this.aoeTargetingSkillName = skillName;
    this.aoeLastPosition = null;
    this.engine.showAOETargetCircle(radius);
    // Debug: AOE start position
    // const pp = this.playerMesh?.position;
  }

  cancelAOETargeting(): void {
    this.aoeTargetingActive = false;
    this.aoeTargetingSkillName = null;
    this.aoeLastPosition = null;
    this.engine.hideAOETargetCircle();
  }

  isAOETargeting(): boolean {
    return this.aoeTargetingActive;
  }

  private setupNetworkHandlers(): void {
    this.network.onPacket(PacketType.AUTH_SUCCESS, (packet: any) => {
      this.playerId = packet.data.playerId;
      if (packet.data.token) {
        this.network.setToken(packet.data.token);
      }
    });

    this.network.onPacket(PacketType.CHARACTER_SELECT, (packet: any) => {
      const data = packet.data;
      this.playerId = data.characterId;
      this.stats = data.stats;
      this.statPoints = data.statPoints;
      this.unspentStatPoints = data.unspentStatPoints || 0;
      this.unspentSkillPoints = data.unspentSkillPoints || 0;
      this.currentZoneId = data.zoneId;
      this.currentJobId = data.jobId || 'warrior';
      this.currentBaseClass = data.baseClass || 'warrior';
      if (data.skillProficiencies) {
        this.skillProficiencies = data.skillProficiencies;
        this.skillAdeptness = data.skillAdeptness || null;
        this.callbacks.onSkillProficienciesUpdate?.(data.skillProficiencies, data.skillAdeptness);
      }
      if (data.statBreakdown) this.statBreakdown = data.statBreakdown;
      this.callbacks.onStatsUpdate?.(data.stats);
      this.callbacks.onStatPointsUpdate?.(this.statPoints, this.unspentStatPoints, this.unspentSkillPoints, this.statBreakdown);
      this.callbacks.onInventoryUpdate?.(data.inventory, data.equipment);
      this.callbacks.onQuestUpdate?.(data.quests);
    });

    this.network.onPacket(PacketType.WORLD_STATE, async (packet: any) => {
      const { zoneId, zoneDef, enemies, npcs, players } = packet.data;
      this.currentZoneId = zoneId;
      this.zoneLoading = true;

      await this.engine.loadZone(zoneDef as ZoneDefinition);
      this.callbacks.onZoneChange?.(zoneId, (zoneDef as ZoneDefinition).name);

      for (const npc of npcs) {
        await this.engine.createNPCEntity(
          npc.id,
          new BabylonVector3(npc.position.x, npc.position.y, npc.position.z),
          npc.data.modelFile,
          npc.data.name
        );
        this.knownEntities.set(npc.id, { type: 'npc', data: npc.data });
        this.entityManager.createEntity(npc.id);
      }

      for (const enemy of enemies) {
        await this.engine.createEnemyEntity(
          enemy.id,
          new BabylonVector3(enemy.position.x, enemy.position.y, enemy.position.z),
          enemy.data.modelFile,
          enemy.data.health,
          enemy.data.maxHealth,
          enemy.data.name
        );
        this.knownEntities.set(enemy.id, { type: 'enemy', data: enemy.data });
        this.enemies.set(enemy.id, enemy.data);
        this.entityManager.createEntity(enemy.id);
      }

      for (const player of players) {
        await this.engine.createPlayerEntity(
          player.id,
          new BabylonVector3(player.position.x, player.position.y, player.position.z),
          player.data.modelFile,
          player.data.name
        );
        this.knownEntities.set(player.id, { type: 'player', data: player.data });
        this.entityManager.createEntity(player.id);
      }

      if (this.playerId) {
        this.engine.setPlayerMesh(this.playerId);
        this.playerMesh = this.engine.getPlayerMesh();
        if (this.playerMesh) {
          this.engine.attachCameraToEntity(this.playerId);
        }
      }

      this.zoneLoading = false;
      const pending = [...this.pendingSpawns];
      this.pendingSpawns = [];
      for (const spawn of pending) {
        await this.processEntitySpawn(spawn.id, spawn.type, spawn.position, spawn.data);
      }

      this.callbacks.onEnemyListUpdate?.(Array.from(this.enemies.values()));
    });

    this.network.onPacket(PacketType.ENTITY_SPAWN, async (packet: any) => {
      const { id, type, position, data } = packet.data;

      this.callbacks.onEntityStatusEffects?.(id, []);

      if (this.zoneLoading) {
        this.pendingSpawns.push({ id, type, position, data });
        return;
      }

      await this.processEntitySpawn(id, type, position, data);
    });

    this.network.onPacket(PacketType.ENTITY_DESPAWN, (packet: any) => {
      const { entityId } = packet.data;
      this.engine.removeEntity(entityId);
      this.entityManager.removeEntity(entityId);
      this.interpolationManager.clearEntity(entityId);
      this.knownEntities.delete(entityId);
      this.enemies.delete(entityId);
      this.lootBeacons.delete(entityId);
      if (this.targetId === entityId) {
        this.targetId = null;
        this.callbacks.onTargetChange?.(null);
      }
    });

    this.network.onPacket(PacketType.PLAYER_POSITION_UPDATE, (packet: any) => {
      const data = packet.data;

      if (data.entities) {
        data.entities.forEach((entity: any) => {
          if (entity.id === this.playerId) return;
          const pos = { x: entity.position.x, y: entity.position.y, z: entity.position.z };
          this.interpolationManager.addPositionUpdate(entity.id, pos, Date.now());

          if (entity.health !== undefined) {
            this.engine.updateEntityHealth(entity.id, entity.health, entity.maxHealth);
            const enemyData = this.enemies.get(entity.id);
            if (enemyData && entity.maxHealth) {
              enemyData.health = entity.health;
              enemyData.maxHealth = entity.maxHealth;
            }
          }
          if (entity.state) {
            const enemyData = this.enemies.get(entity.id);
            if (enemyData) {
              const prevState = enemyData.state;
              enemyData.state = entity.state;
              if (prevState === 'dead' && entity.state !== 'dead') {
                this.engine.startAnimation(entity.id, 'Idle');
              }
            }
          }
        });
        return;
      }

      if (data.characterId === this.playerId) return;

      const pos = { x: data.position.x, y: data.position.y, z: data.position.z };
      this.interpolationManager.addPositionUpdate(data.characterId || data.socketId, pos, Date.now());
      if (data.rotation) {
        this.interpolationManager.addRotationUpdate(data.characterId || data.socketId, data.rotation, Date.now());
      }
    });

    this.network.onPacket(PacketType.DAMAGE, (packet: any) => {
      const { targetId, damage, isCritical } = packet.data;
      this.engine.showDamageNumber(targetId, damage, isCritical);

      const entity = this.knownEntities.get(targetId);
      if (entity?.type === 'enemy') {
        const enemyData = this.enemies.get(targetId);
        if (enemyData) {
          enemyData.health = Math.max(0, enemyData.health - damage);
        }
      }
      if (entity?.type === 'player') {
        entity.data.health = Math.max(0, (entity.data.health || 0) - damage);
      }

      if (targetId === this.playerId && this.stats) {
        this.stats.health = Math.max(0, this.stats.health - damage);
        this.callbacks.onStatsUpdate?.(this.stats);
      }
    });

    this.network.onPacket(PacketType.STATS_UPDATE, (packet: any) => {
      const data = packet.data;
      if (data.stats && data.characterId === this.playerId) {
        this.stats = data.stats;
        this.callbacks.onStatsUpdate?.(data.stats);
      }
      if (data.statBreakdown && data.characterId === this.playerId) {
        this.statBreakdown = data.statBreakdown;
        this.callbacks.onStatPointsUpdate?.(this.statPoints, this.unspentStatPoints, this.unspentSkillPoints, this.statBreakdown);
      }
      if (data.statPoints && data.characterId === this.playerId) {
        this.statPoints = data.statPoints;
        this.unspentStatPoints = data.unspentStatPoints ?? this.unspentStatPoints;
        this.unspentSkillPoints = data.unspentSkillPoints ?? this.unspentSkillPoints;
        this.callbacks.onStatPointsUpdate?.(this.statPoints, this.unspentStatPoints, this.unspentSkillPoints, this.statBreakdown);
      }
      if (data.skillProficiencies && data.characterId === this.playerId) {
        this.skillProficiencies = data.skillProficiencies;
        this.skillAdeptness = data.skillAdeptness || this.skillAdeptness;
        this.callbacks.onSkillProficienciesUpdate?.(data.skillProficiencies, this.skillAdeptness);
      }
      if (data.baseClass && data.characterId === this.playerId) {
        this.currentBaseClass = data.baseClass;
      }
      if (data.jobId && data.characterId === this.playerId) {
        this.currentJobId = data.jobId;
      }
      if (data.health !== undefined && data.maxHealth) {
        const eid = data.entityId || data.characterId;
        this.engine.updateEntityHealth(eid, data.health, data.maxHealth);
        const entity = this.knownEntities.get(eid);
        if (entity?.type === 'player') {
          entity.data.health = data.health;
          entity.data.maxHealth = data.maxHealth;
          if (data.level !== undefined) entity.data.level = data.level;
        }
      }
    });

    this.network.onPacket(PacketType.HEAL, (packet: any) => {
      const { targetId, amount } = packet.data;
      if (targetId === this.playerId && this.stats) {
        if (packet.data.mpRestore) {
          this.stats.mana = Math.min(this.stats.maxMana, this.stats.mana + amount);
        } else {
          this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount);
        }
        this.callbacks.onStatsUpdate?.(this.stats);
      }
      if (!packet.data.mpRestore) {
        const entity = this.knownEntities.get(targetId);
        if (entity?.type === 'player') {
          entity.data.health = Math.min(entity.data.maxHealth || 0, (entity.data.health || 0) + amount);
        }
      }
    });

    this.network.onPacket(PacketType.INVENTORY_UPDATE, (packet: any) => {
      this.callbacks.onInventoryUpdate?.(packet.data.inventory, packet.data.equipment);
    });

    this.network.onPacket(PacketType.CHAT_MESSAGE, (packet: any) => {
      this.callbacks.onChatMessage?.(packet.data.sender, packet.data.message, packet.data.channel);
    });

    this.network.onPacket(PacketType.NOTIFICATION, (packet: any) => {
      this.callbacks.onNotification?.(packet.data.message, packet.data.type);
    });

    this.network.onPacket(PacketType.EXPERIENCE_GAIN, (packet: any) => {
      this.callbacks.onExperienceGain?.(packet.data);
    });

    this.network.onPacket(PacketType.LEVEL_UP, (packet: any) => {
      const data = packet.data;
      if (this.stats) {
        this.stats.level = data.level;
        if (data.stats) {
          this.stats = data.stats;
        }
        this.callbacks.onStatsUpdate?.(this.stats!);
      }
      if (data.statPoints) {
        this.statPoints = data.statPoints;
        this.unspentStatPoints = data.unspentStatPoints ?? this.unspentStatPoints;
        this.unspentSkillPoints = data.unspentSkillPoints ?? this.unspentSkillPoints;
        this.callbacks.onStatPointsUpdate?.(this.statPoints, this.unspentStatPoints, this.unspentSkillPoints, this.statBreakdown);
      }
      this.callbacks.onLevelUp?.(data.level);
    });

    this.network.onPacket(PacketType.DEATH, (packet: any) => {
      const { entityId, isDead, respawnPosition } = packet.data;
      if (entityId === this.playerId) {
        if (isDead) {
          if (this.playerMesh && this.playerId) {
            this.engine.startAnimationOnce(this.playerId, 'Death');
          }
          this.callbacks.onDeath?.(packet.data);
        } else if (respawnPosition) {
          if (this.playerMesh) {
            this.playerMesh.position = new BabylonVector3(respawnPosition.x, respawnPosition.y, respawnPosition.z);
          }
        }
      }
      if (entityId !== this.playerId) {
        this.engine.startAnimationOnce(entityId, 'Death');
        if (this.targetId === entityId) {
          this.targetId = null;
          this.callbacks.onTargetChange?.(null);
        }
      }
    });

    this.network.onPacket(PacketType.PLAYER_REVIVED, (packet: any) => {
      const { characterId, zoneId, position, revivedBy } = packet.data;
      if (characterId === this.playerId) {
        if (this.playerMesh) {
          if (zoneId && this.callbacks.onZoneChange) {
            this.callbacks.onZoneChange(zoneId, '');
          }
          this.playerMesh.position = new BabylonVector3(position.x, position.y, position.z);
        }
        if (this.playerId) {
          this.engine.startAnimationOnce(this.playerId, 'Idle');
        }
        this.callbacks.onDeath?.({ isDead: false, revivedBy });
      } else {
        this.engine.startAnimationOnce(characterId, 'Idle');
      }
    });

    this.network.onPacket(PacketType.LOOT_SPAWN, (packet: any) => {
      const loot = packet.data;
      this.engine.createLootBeacon(new BabylonVector3(loot.position.x, loot.position.y, loot.position.z));
      this.lootBeacons.set(loot.id, loot);
    });

    this.network.onPacket(PacketType.LOOT_PICKUP, (packet: any) => {
      this.lootBeacons.delete(packet.data.lootId);
    });

    this.network.onPacket(PacketType.QUEST_ACCEPT, (_packet: any) => {
      this.callbacks.onNotification?.(`Quest accepted!`, 'success');
    });

    this.network.onPacket(PacketType.QUEST_PROGRESS, (packet: any) => {
      this.callbacks.onNotification?.(packet.data.message, 'info');
    });

    this.network.onPacket(PacketType.QUEST_COMPLETE, (packet: any) => {
      const rewards = packet.data.rewards;
      this.callbacks.onNotification?.(
        `Quest completed! +${rewards.experience} XP, +${rewards.gold} gold`,
        'success'
      );
    });

    this.network.onPacket(PacketType.NPC_DIALOG, (packet: any) => {
      this.callbacks.onNPCDialog?.(packet.data);
    });

    this.network.onPacket(PacketType.ERROR, (packet: any) => {
      this.callbacks.onNotification?.(packet.data.message, 'error');
    });

    this.network.onPacket(PacketType.SKILL_USE, (packet: any) => {
      const data = packet.data;
      if (data.error) {
        this.callbacks.onSkillError?.(data.skillName || '', data.error);
      }
    });

    this.network.onPacket(PacketType.COOLDOWN_UPDATE, (packet: any) => {
      const data = packet.data;
      if (data.type === 'cast_start') {
        this.callbacks.onCastStart?.(data.skillName, data.castTime);
      } else if (data.type === 'used') {
        this.callbacks.onSkillUsed?.(data.skillName, data.mpCost || 0, data.cooldownRemaining || 0);
        this.playSkillAnimation(data.skillName);
      }
    });

    this.network.onPacket(PacketType.STATUS_EFFECT_UPDATE, (packet: any) => {
      this.callbacks.onStatusEffects?.(packet.data.effects || []);
    });

    this.network.onPacket(PacketType.ENTITY_STATUS_EFFECTS, (packet: any) => {
      const { entityId, effects } = packet.data;
      const entity = this.knownEntities.get(entityId);
      if (entity) {
        entity.data.statusEffects = effects || [];
      }
      this.callbacks.onEntityStatusEffects?.(entityId, effects || []);
    });

    this.network.onPacket(PacketType.ENTER_ZONE, (packet: any) => {
      this.currentZoneId = packet.data.zoneId;
    });
  }

  private async processEntitySpawn(id: string, type: string, position: any, data: any): Promise<void> {
    const pos = new BabylonVector3(position.x, position.y, position.z);

    this.knownEntities.set(id, { type, data });
    this.entityManager.createEntity(id);

    if (type === 'player') {
      await this.engine.createPlayerEntity(id, pos, data.modelFile, data.name);

      if (id === this.playerId) {
        this.engine.setPlayerMesh(id);
        this.playerMesh = this.engine.getPlayerMesh();
        if (this.playerMesh) {
          this.engine.attachCameraToEntity(id);
        }
      }
    } else if (type === 'enemy') {
      await this.engine.createEnemyEntity(id, pos, data.modelFile, data.health, data.maxHealth, data.name);
      this.enemies.set(id, data);
      this.callbacks.onEnemyListUpdate?.(Array.from(this.enemies.values()));
    } else if (type === 'npc') {
      await this.engine.createNPCEntity(id, pos, data.modelFile, data.name);
    }
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    this.update(deltaTime);
    requestAnimationFrame(() => this.gameLoop());
  }

  private update(deltaTime: number): void {
    if (!this.input || !this.playerMesh) return;

    const input = this.input.getInputState();
    const movementVector = this.input.getMovementVector();

    const speedMultiplier = (this.stats as any)?.speedMultiplier ?? 1;
    const speed = input.sprint ? GAME_CONFIG.PLAYER_SPEED * 1.5 * speedMultiplier : GAME_CONFIG.PLAYER_SPEED * speedMultiplier;

    const camera = this.engine.getScene()?.activeCamera;
    let camForward = BabylonVector3.Forward();
    let camRight = BabylonVector3.Right();

    if (camera) {
      camera.getDirectionToRef(BabylonVector3.Forward(), camForward);
      camForward.y = 0;
      camForward.normalize();
      camera.getDirectionToRef(BabylonVector3.Right(), camRight);
      camRight.y = 0;
      camRight.normalize();
    }

    const moveDirection = new BabylonVector3(0, 0, 0);
    moveDirection.addInPlace(camForward.scale(movementVector.z));
    moveDirection.addInPlace(camRight.scale(movementVector.x));

    const isMoving = moveDirection.length() > 0.001;

    if (isMoving) {
      moveDirection.normalize();
      this.playerMesh.position.addInPlace(moveDirection.scale(speed * deltaTime));
      const angle = Math.atan2(moveDirection.x, moveDirection.z);
      this.playerMesh.rotation.y = angle;
      this.engine.startAnimation(this.playerId!, 'Walk');
      this.engine.updateEntityPosition(this.playerId!, this.playerMesh.position);
    } else {
      this.engine.startAnimation(this.playerId!, 'Idle');
      this.engine.updateEntityPosition(this.playerId!, this.playerMesh.position);
    }

    const now = Date.now();
    if (now - this.lastMoveSend > 50) {
      this.network.sendMovement(
        {
          x: this.playerMesh.position.x,
          y: this.playerMesh.position.y,
          z: this.playerMesh.position.z
        },
        {
          x: this.playerMesh.rotation.x,
          y: this.playerMesh.rotation.y,
          z: this.playerMesh.rotation.z,
          w: 1
        }
      );
      this.lastMoveSend = now;
    }

    if (input.attack && this.targetId) {
      this.network.sendAttack(this.targetId);
    }

    const entities = this.entityManager.getAllEntities();
    const currentTime = Date.now();

    entities.forEach(entity => {
      if (entity.id === this.playerId) return;

      const interpolatedPos = this.interpolationManager.getInterpolatedPosition(entity.id, currentTime);
      const interpolatedRot = this.interpolationManager.getInterpolatedRotation(entity.id, currentTime);

      if (interpolatedPos) {
        this.engine.updateEntityPosition(entity.id, new BabylonVector3(interpolatedPos.x, interpolatedPos.y, interpolatedPos.z));
      }
      if (interpolatedRot) {
        this.engine.updateEntityRotation(entity.id, interpolatedRot.y || 0);
      }
    });

    if (this.currentZoneId && this.playerMesh) {
      const zoneDef = getZoneDefinition(this.currentZoneId);
      if (zoneDef) {
        this.engine.updateMinimapPlayerDot(
          this.playerMesh.position.x,
          this.playerMesh.position.z,
          zoneDef.size
        );
      }
    }

    if (this.playerMesh) {
      const now = Date.now();
      if (now - this.lastTeleportTime > 3000) {
        const mapBuilder = this.engine.getMapBuilder();
        const tp = mapBuilder?.checkTeleport(this.playerMesh.position);
        if (tp) {
          this.lastTeleportTime = now;
          this.network.sendPacket({
            type: PacketType.ENTER_ZONE,
            timestamp: now,
            data: { zoneId: tp.targetZone, spawnId: tp.targetSpawn }
          });
        }
      }
    }
  }

  login(username: string, password: string): void {
    this.network.login(username, password);
  }

  register(username: string, email: string, password: string): void {
    this.network.register(username, email, password);
  }

  requestCharacterList(): void {
    this.network.requestCharacterList();
  }

  createCharacter(name: string, characterClass: string, race: string = 'human'): void {
    this.network.createCharacter(name, characterClass, race);
  }

  selectCharacter(characterId: string): void {
    this.network.selectCharacter(characterId);
  }

  deleteCharacter(characterId: string): void {
    this.network.deleteCharacter(characterId);
  }

  sendChatMessage(message: string): void {
    this.network.sendChatMessage(message);
  }

  setChatFocused(focused: boolean): void {
    this.input?.setChatFocused(focused);
  }

  useItem(itemId: string): void {
    this.network.useItem(itemId);
  }

  equipItem(itemId: string): void {
    this.network.equipItem(itemId);
  }

  unequipItem(slot: string): void {
    this.network.unequipItem(slot);
  }

  acceptQuest(questId: string): void {
    this.network.acceptQuest(questId);
  }

  completeQuest(questId: string): void {
    this.network.completeQuest(questId);
  }

  abandonQuest(questId: string): void {
    this.network.abandonQuest(questId);
  }

  interactNPC(npcId: string, dialogId?: string): void {
    this.network.interactNPC(npcId, dialogId);
  }

  buyFromShop(itemId: string, quantity: number = 1): void {
    this.network.buyFromShop(itemId, quantity);
  }

  changeZone(zoneId: string): void {
    this.network.changeZone(zoneId);
  }

  setTarget(targetId: string | null): void {
    this.targetId = targetId;
    this.engine.setTargetIndicator(targetId);
    this.callbacks.onTargetChange?.(targetId);
  }

  setMinimapCanvas(canvas: HTMLCanvasElement): void {
    this.engine.setMinimapCanvas(canvas);
  }

  getStats(): PlayerStats | null {
    return this.stats;
  }

  getStatPoints(): StatPoints | null {
    return this.statPoints;
  }

  getUnspentStatPoints(): number {
    return this.unspentStatPoints;
  }

  getUnspentSkillPoints(): number {
    return this.unspentSkillPoints;
  }

  getSkillProficiencies(): any {
    return this.skillProficiencies;
  }

  getSkillAdeptness(): any {
    return this.skillAdeptness;
  }

  getJobId(): string {
    return this.currentJobId;
  }

  getBaseClass(): string {
    return this.currentBaseClass;
  }

  allocateStatPoint(stat: string): void {
    this.network.allocateStatPoint(stat);
  }

  allocateStatBatch(allocations: Record<string, number>): void {
    this.network.allocateStatBatch(allocations);
  }

  allocateSkillPoint(subCategoryName: string, count: number = 1): void {
    this.network.allocateSkillPoint(subCategoryName, count);
  }

  getCurrentZoneId(): string | null {
    return this.currentZoneId;
  }

  getNetworkClient(): NetworkClient {
    return this.network;
  }

  getPlayerId(): string | null {
    return this.playerId;
  }

  useSkill(skillName: string, targetId: string | null): void {
    if (GROUND_TARGETED_AOE_SKILLS.has(skillName)) {
      if (this.aoeTargetingActive && this.aoeTargetingSkillName === skillName) {
        return;
      }
      this.startAOETargeting(skillName, DEFAULT_AOE_RADIUS);
      return;
    }
    if (this.aoeTargetingActive) {
      this.cancelAOETargeting();
    }
    this.network.useSkill(skillName, targetId || this.targetId);
  }

  sendPartyCreate(targetId: string, visibility: string, lootRule: string): void {
    this.network.sendPacket({ type: PacketType.PARTY_CREATE_REQUEST, timestamp: Date.now(), data: { targetId, visibility, lootRule } });
  }

  sendPartyInviteRequest(targetId: string): void {
    this.network.sendPacket({ type: PacketType.PARTY_INVITE_REQUEST, timestamp: Date.now(), data: { targetId } });
  }

  sendPartyJoin(partyId: string): void {
    this.network.sendPacket({ type: PacketType.PARTY_JOIN_REQUEST, timestamp: Date.now(), data: { partyId, accept: true } });
  }

  sendPartyLeave(): void {
    this.network.sendPacket({ type: PacketType.PARTY_LEAVE, timestamp: Date.now(), data: {} });
  }

  sendPartyKick(targetId: string): void {
    this.network.sendPacket({ type: PacketType.PARTY_KICK, timestamp: Date.now(), data: { targetId } });
  }

  sendPartyPromote(targetId: string): void {
    this.network.sendPacket({ type: PacketType.PARTY_PROMOTE, timestamp: Date.now(), data: { targetId } });
  }

  sendPartyLootRoll(lootId: string): void {
    this.network.sendPacket({ type: PacketType.PARTY_LOOT_ROLL, timestamp: Date.now(), data: { lootId } });
  }

  sendRespawnRequest(): void {
    this.network.sendPacket({ type: PacketType.RESPAWN_REQUEST, timestamp: Date.now(), data: {} });
  }

  sendRevivePlayer(targetId: string): void {
    this.network.sendPacket({ type: PacketType.REVIVE_PLAYER, timestamp: Date.now(), data: { targetId } });
  }

  setSkillBarHandler(handler: SkillBarKeyHandler): void {
    this.input?.setSkillBarHandler(handler);
  }

  private playSkillAnimation(_skillName: string): void {
    if (!this.playerId || !this.engine) return;
    this.engine.startAnimationOnce(this.playerId, 'Attack', () => {
      this.engine?.startAnimation(this.playerId!, 'Idle');
    });
  }

  getEngine(): GameEngine {
    return this.engine;
  }

  dispose(): void {
    this.isRunning = false;
    this.network.disconnect();
    this.input?.dispose();
    this.engine.dispose();
    this.entityManager.clear();
    this.interpolationManager.clear();
  }
}
