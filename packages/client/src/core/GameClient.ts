import { GameEngine } from './engine/GameEngine';
import { NetworkClient } from './network/NetworkClient';
import { InputManager } from './input/InputManager';
import { ClientEntityManager, InterpolationManager } from './ecs/ClientEntityManager';
import { Vector3 as BabylonVector3 } from '@babylonjs/core';
import { PacketType } from '@dust-saga/shared';
import { GAME_CONFIG } from '@dust-saga/shared';

export class GameClient {
  private engine: GameEngine;
  private network: NetworkClient;
  private input: InputManager;
  private entityManager: ClientEntityManager;
  private interpolationManager: InterpolationManager;
  private isRunning: boolean = false;
  private lastUpdate: number = 0;
  private playerId: string | null = null;
  private playerMesh: any = null;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new GameEngine(canvas);
    this.network = new NetworkClient();
    this.input = new InputManager();
    this.entityManager = new ClientEntityManager();
    this.interpolationManager = new InterpolationManager();
  }

  async initialize(): Promise<void> {
    await this.engine.initialize();
    this.setupNetworkHandlers();
    this.network.connect();
    this.isRunning = true;
    this.lastUpdate = performance.now();
    this.gameLoop();
  }

  private setupNetworkHandlers(): void {
    this.network.onPacket(PacketType.ENTITY_SPAWN, (packet: any) => {
      this.handleEntitySpawn(packet.data);
    });

    this.network.onPacket(PacketType.ENTITY_DESPAWN, (packet: any) => {
      this.handleEntityDespawn(packet.data);
    });

    this.network.onPacket(PacketType.PLAYER_POSITION_UPDATE, (packet: any) => {
      this.handlePlayerPositionUpdate(packet.data);
    });

    this.network.onPacket(PacketType.AUTH_SUCCESS, (packet: any) => {
      console.log('Authentication successful:', packet.data);
      this.playerId = packet.data.playerId;
    });

    this.network.onPacket(PacketType.CHAT_MESSAGE, (packet: any) => {
      console.log('Chat:', packet.data);
    });
  }

  private handleEntitySpawn(data: any): void {
    const position = new BabylonVector3(data.position.x, data.position.y, data.position.z);
    const mesh = this.engine.createPlayerMesh(data.id, position);
    
    this.entityManager.createEntity(data.id, new Map());
    
    if (data.id === this.playerId) {
      this.playerMesh = mesh;
    }
  }

  private handleEntityDespawn(data: any): void {
    this.engine.removeEntity(data.entityId);
    this.entityManager.removeEntity(data.entityId);
    this.interpolationManager.clearEntity(data.entityId);
  }

  private handlePlayerPositionUpdate(data: any): void {
    if (data.socketId === this.network.getSocketId()) return;

    const position = { x: data.position.x, y: data.position.y, z: data.position.z };
    const rotation = data.rotation;

    this.interpolationManager.addPositionUpdate(data.socketId, position, Date.now());
    this.interpolationManager.addRotationUpdate(data.socketId, rotation, Date.now());
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  private update(deltaTime: number): void {
    const input = this.input.getInputState();
    const movementVector = this.input.getMovementVector();
    const mouseDelta = this.input.getMouseDelta();

    if (this.playerMesh && this.input.hasPointerLock()) {
      const speed = input.sprint ? GAME_CONFIG.PLAYER_SPEED * 1.5 : GAME_CONFIG.PLAYER_SPEED;
      
      const forward = this.playerMesh.forward;
      const right = this.playerMesh.right;
      
      const moveDirection = new BabylonVector3(0, 0, 0);
      moveDirection.addInPlace(forward.scale(movementVector.z));
      moveDirection.addInPlace(right.scale(movementVector.x));
      
      if (moveDirection.length() > 0) {
        moveDirection.normalize();
        this.playerMesh.position.addInPlace(moveDirection.scale(speed * deltaTime));
      }

      this.playerMesh.rotation.y += mouseDelta.x * 0.002;

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

      if (input.attack) {
        this.network.sendAttack('target', 10);
      }
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
        this.engine.updateEntityRotation(entity.id, new BabylonVector3(interpolatedRot.x, interpolatedRot.y, interpolatedRot.z));
      }
    });
  }

  private render(): void {
  }

  login(username: string, password: string): void {
    this.network.login(username, password);
  }

  register(username: string, email: string, password: string): void {
    this.network.register(username, email, password);
  }

  sendChatMessage(message: string): void {
    this.network.sendChatMessage(message);
  }

  dispose(): void {
    this.isRunning = false;
    this.network.disconnect();
    this.input.dispose();
    this.engine.dispose();
    this.entityManager.clear();
    this.interpolationManager.clear();
  }

  getNetworkClient(): NetworkClient {
    return this.network;
  }

  getEntityManager(): ClientEntityManager {
    return this.entityManager;
  }
}