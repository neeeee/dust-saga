import { Server as SocketIOServer, Socket } from 'socket.io';
import { Packet, PacketType } from '@dust-saga/shared';
import { DatabaseManager } from '../database/DatabaseManager';

export class NetworkServer {
  private io: SocketIOServer;
  private db: DatabaseManager;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(httpServer: any) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.db = DatabaseManager.getInstance();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      socket.on('packet', (packet: Packet) => {
        this.handlePacket(socket, packet);
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
        this.handleDisconnect(socket);
      });

      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  private async handlePacket(socket: Socket, packet: Packet): Promise<void> {
    try {
      switch (packet.type) {
        case PacketType.HEARTBEAT:
          this.sendPacket(socket, {
            type: PacketType.HEARTBEAT,
            timestamp: Date.now(),
            data: {}
          });
          break;

        case PacketType.LOGIN:
          await this.handleLogin(socket, packet.data);
          break;

        case PacketType.REGISTER:
          await this.handleRegister(socket, packet.data);
          break;

        case PacketType.PLAYER_MOVE:
          await this.handlePlayerMove(socket, packet.data);
          break;

        case PacketType.CHAT_MESSAGE:
          await this.handleChatMessage(socket, packet.data);
          break;

        case PacketType.ATTACK:
          await this.handleAttack(socket, packet.data);
          break;

        default:
          console.warn(`Unknown packet type: ${packet.type}`);
      }
    } catch (error) {
      console.error(`Error handling packet ${packet.type}:`, error);
    }
  }

  private async handleLogin(socket: Socket, data: any): Promise<void> {
    const { username, password } = data;

    if (!this.db.isPostgresConnected()) {
      console.warn('Database not connected, using mock authentication');
      this.sendPacket(socket, {
        type: PacketType.AUTH_SUCCESS,
        timestamp: Date.now(),
        data: {
          playerId: 'mock_player_' + socket.id,
          username: username,
          level: 1
        }
      });
      return;
    }

    try {
      const result = await this.db.postgres!.query(
        'SELECT * FROM players WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        this.sendPacket(socket, {
          type: PacketType.AUTH_FAILURE,
          timestamp: Date.now(),
          data: { message: 'Invalid username or password' }
        });
        return;
      }

      const player = result.rows[0];
      
      this.sendPacket(socket, {
        type: PacketType.AUTH_SUCCESS,
        timestamp: Date.now(),
        data: {
          playerId: player.id,
          username: player.username,
          level: player.level
        }
      });

      await this.db.postgres!.query(
        'UPDATE players SET last_login = NOW() WHERE id = $1',
        [player.id]
      );

    } catch (error) {
      console.error('Login error:', error);
      this.sendPacket(socket, {
        type: PacketType.AUTH_FAILURE,
        timestamp: Date.now(),
        data: { message: 'Login failed' }
      });
    }
  }

  private async handleRegister(socket: Socket, data: any): Promise<void> {
    const { username, email, password } = data;

    if (!this.db.isPostgresConnected()) {
      console.warn('Database not connected, using mock registration');
      this.sendPacket(socket, {
        type: PacketType.AUTH_SUCCESS,
        timestamp: Date.now(),
        data: {
          playerId: 'mock_player_' + socket.id,
          username: username,
          level: 1
        }
      });
      return;
    }

    try {
      const existingUser = await this.db.postgres!.query(
        'SELECT id FROM players WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        this.sendPacket(socket, {
          type: PacketType.AUTH_FAILURE,
          timestamp: Date.now(),
          data: { message: 'Username or email already exists' }
        });
        return;
      }

      const result = await this.db.postgres!.query(
        'INSERT INTO players (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [username, email, password]
      );

      this.sendPacket(socket, {
        type: PacketType.AUTH_SUCCESS,
        timestamp: Date.now(),
        data: {
          playerId: result.rows[0].id,
          username: username,
          level: 1
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      this.sendPacket(socket, {
        type: PacketType.AUTH_FAILURE,
        timestamp: Date.now(),
        data: { message: 'Registration failed' }
      });
    }
  }

  private async handlePlayerMove(socket: Socket, data: any): Promise<void> {
    socket.broadcast.emit('packet', {
      type: PacketType.PLAYER_POSITION_UPDATE,
      timestamp: Date.now(),
      data: {
        socketId: socket.id,
        position: data.position,
        rotation: data.rotation
      }
    });
  }

  private async handleChatMessage(socket: Socket, data: any): Promise<void> {
    this.io.emit('packet', {
      type: PacketType.CHAT_MESSAGE,
      timestamp: Date.now(),
      data: {
        sender: data.sender,
        message: data.message,
        channel: data.channel || 'global'
      }
    });
  }

  private async handleAttack(socket: Socket, data: any): Promise<void> {
    socket.broadcast.emit('packet', {
      type: PacketType.ATTACK,
      timestamp: Date.now(),
      data: {
        attackerId: socket.id,
        targetId: data.targetId,
        damage: data.damage
      }
    });
  }

  private handleDisconnect(socket: Socket): void {
    this.io.emit('packet', {
      type: PacketType.ENTITY_DESPAWN,
      timestamp: Date.now(),
      data: { entityId: socket.id }
    });
  }

  public sendPacket(socket: Socket, packet: Packet): void {
    socket.emit('packet', packet);
  }

  public broadcastPacket(packet: Packet): void {
    this.io.emit('packet', packet);
  }

  public getConnectedClients(): Map<string, Socket> {
    return this.connectedClients;
  }
}