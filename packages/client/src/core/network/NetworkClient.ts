import { io, Socket } from 'socket.io-client';
import { Packet, PacketType } from '@dust-saga/shared';

export class NetworkClient {
  private socket: Socket | null = null;
  private packetHandlers: Map<PacketType, Function[]> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  connect(serverUrl: string = 'http://localhost:3001'): void {
    if (this.socket?.connected) {
      console.log('Already connected to server');
      return;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('packet', (packet: Packet) => {
      this.handlePacket(packet);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  sendPacket(packet: Packet): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('packet', packet);
    } else {
      console.warn('Cannot send packet: not connected to server');
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
      if (index > -1) {
        handlers.splice(index, 1);
      }
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

  sendAttack(targetId: string, damage: number): void {
    this.sendPacket({
      type: PacketType.ATTACK,
      timestamp: Date.now(),
      data: { targetId, damage }
    });
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}