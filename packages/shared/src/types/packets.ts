export enum PacketType {
  CONNECT = 0,
  DISCONNECT = 1,
  HEARTBEAT = 2,
  LOGIN = 10,
  REGISTER = 11,
  AUTH_SUCCESS = 12,
  AUTH_FAILURE = 13,
  PLAYER_MOVE = 20,
  PLAYER_POSITION_UPDATE = 21,
  PLAYER_ROTATION_UPDATE = 22,
  ATTACK = 30,
  DAMAGE = 31,
  HEAL = 32,
  DEATH = 33,
  CHAT_MESSAGE = 40,
  ENTER_ZONE = 50,
  LEAVE_ZONE = 51,
  ENTITY_SPAWN = 52,
  ENTITY_DESPAWN = 53
}

export interface Packet {
  type: PacketType;
  timestamp: number;
  data: any;
}

export interface PositionData {
  x: number;
  y: number;
  z: number;
}

export interface RotationData {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface MovementData {
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  speed: number;
  direction: number;
}

export interface PlayerData {
  id: string;
  name: string;
  position: PositionData;
  rotation: RotationData;
  level: number;
  health: number;
  maxHealth: number;
}

export interface EntityData {
  id: string;
  type: 'player' | 'npc' | 'enemy' | 'item';
  position: PositionData;
  rotation: RotationData;
  data: any;
}