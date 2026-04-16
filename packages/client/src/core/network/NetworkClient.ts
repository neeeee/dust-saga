import { io, Socket } from 'socket.io-client';
import { Packet, PacketType } from '@dust-saga/shared';

export class NetworkClient {
  private socket: Socket | null = null;
  private packetHandlers: Map<PacketType, Function[]> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private token: string | null = null;

  private pendingPackets: Packet[] = [];

  connect(serverUrl: string = 'http://localhost:3001'): void {
    if (this.socket?.connected) return;

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: this.maxReconnectAttempts,
      auth: { token: this.token }
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.flushPendingPackets();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
    });

    this.socket.on('packet', (packet: Packet) => {
      this.handlePacket(packet);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  private flushPendingPackets(): void {
    while (this.pendingPackets.length > 0) {
      const packet = this.pendingPackets.shift()!;
      if (this.socket && this.isConnected) {
        this.socket.emit('packet', packet);
      }
    }
  }

  sendPacket(packet: Packet): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('packet', packet);
    } else {
      this.pendingPackets.push(packet);
    }
  }

  onPacket(type: PacketType, handler: Function): void {
    if (!this.packetHandlers.has(type)) {
      this.packetHandlers.set(type, []);
    }
    this.packetHandlers.get(type)?.push(handler);
  }

  offPacket(type: PacketType, handler: Function): void {
    const handlers = this.packetHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  private handlePacket(packet: Packet): void {
    const handlers = this.packetHandlers.get(packet.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(packet);
        } catch (error) {
          console.error(`Error handling packet ${packet.type}:`, error);
        }
      });
    }
  }

  setToken(token: string): void {
    this.token = token;
  }

  login(username: string, password: string): void {
    this.sendPacket({
      type: PacketType.LOGIN,
      timestamp: Date.now(),
      data: { username, password }
    });
  }

  register(username: string, email: string, password: string): void {
    this.sendPacket({
      type: PacketType.REGISTER,
      timestamp: Date.now(),
      data: { username, email, password }
    });
  }

  requestCharacterList(): void {
    this.sendPacket({
      type: PacketType.CHARACTER_LIST,
      timestamp: Date.now(),
      data: {}
    });
  }

  createCharacter(name: string, characterClass: string, race: string = 'human'): void {
    this.sendPacket({
      type: PacketType.CHARACTER_CREATE,
      timestamp: Date.now(),
      data: { name, characterClass, race }
    });
  }

  selectCharacter(characterId: string): void {
    this.sendPacket({
      type: PacketType.CHARACTER_SELECT,
      timestamp: Date.now(),
      data: { characterId }
    });
  }

  deleteCharacter(characterId: string): void {
    this.sendPacket({
      type: PacketType.CHARACTER_DELETE,
      timestamp: Date.now(),
      data: { characterId }
    });
  }

  sendMovement(position: any, rotation: any): void {
    this.sendPacket({
      type: PacketType.PLAYER_MOVE,
      timestamp: Date.now(),
      data: { position, rotation }
    });
  }

  sendChatMessage(message: string, channel: string = 'global'): void {
    this.sendPacket({
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: { message, channel }
    });
  }

  sendAttack(targetId: string): void {
    this.sendPacket({
      type: PacketType.ATTACK,
      timestamp: Date.now(),
      data: { targetId }
    });
  }

  useSkill(skillName: string, targetId: string | null = null): void {
    this.sendPacket({
      type: PacketType.SKILL_USE,
      timestamp: Date.now(),
      data: { skillName, targetId }
    });
  }

  useItem(itemId: string): void {
    this.sendPacket({
      type: PacketType.ITEM_USE,
      timestamp: Date.now(),
      data: { itemId }
    });
  }

  equipItem(itemId: string): void {
    this.sendPacket({
      type: PacketType.EQUIP_ITEM,
      timestamp: Date.now(),
      data: { itemId }
    });
  }

  unequipItem(slot: string): void {
    this.sendPacket({
      type: PacketType.UNEQUIP_ITEM,
      timestamp: Date.now(),
      data: { slot }
    });
  }

  pickupLoot(lootId: string): void {
    this.sendPacket({
      type: PacketType.LOOT_PICKUP,
      timestamp: Date.now(),
      data: { lootId }
    });
  }

  acceptQuest(questId: string): void {
    this.sendPacket({
      type: PacketType.QUEST_ACCEPT,
      timestamp: Date.now(),
      data: { questId }
    });
  }

  completeQuest(questId: string): void {
    this.sendPacket({
      type: PacketType.QUEST_COMPLETE,
      timestamp: Date.now(),
      data: { questId }
    });
  }

  abandonQuest(questId: string): void {
    this.sendPacket({
      type: PacketType.QUEST_ABANDON,
      timestamp: Date.now(),
      data: { questId }
    });
  }

  interactNPC(npcId: string, dialogId?: string): void {
    this.sendPacket({
      type: PacketType.NPC_INTERACT,
      timestamp: Date.now(),
      data: { npcId, dialogId }
    });
  }

  buyFromShop(itemId: string, quantity: number = 1): void {
    this.sendPacket({
      type: PacketType.NPC_SHOP_BUY,
      timestamp: Date.now(),
      data: { itemId, quantity }
    });
  }

  changeZone(zoneId: string): void {
    this.sendPacket({
      type: PacketType.ENTER_ZONE,
      timestamp: Date.now(),
      data: { zoneId }
    });
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}
