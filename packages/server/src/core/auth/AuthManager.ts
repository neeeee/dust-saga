import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from '../database/DatabaseManager';

const JWT_SECRET = process.env.JWT_SECRET || 'dust-saga-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

export interface AuthToken {
  playerId: string;
  username: string;
}

export class AuthManager {
  private static instance: AuthManager;
  private db: DatabaseManager;

  private mockPlayers: Map<string, { id: string; username: string }> = new Map();
  private mockCharacters: Map<string, Array<{ id: string; name: string; class: string; level: number; position_x: number; position_y: number; position_z: number; zone_id: string }>> = new Map();

  private constructor() {
    this.db = DatabaseManager.getInstance();
  }

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  async register(username: string, email: string, password: string): Promise<{ success: boolean; playerId?: string; token?: string; error?: string }> {
    if (!this.db.isPostgresConnected()) {
      let player = this.mockPlayers.get(username);
      if (!player) {
        player = { id: uuidv4(), username };
        this.mockPlayers.set(username, player);
        this.mockCharacters.set(player.id, []);
      }
      return {
        success: true,
        playerId: player.id,
        token: this.generateToken(player.id, username)
      };
    }

    try {
      const existing = await this.db.postgres!.query(
        'SELECT id FROM players WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existing.rows.length > 0) {
        return { success: false, error: 'Username or email already exists' };
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await this.db.postgres!.query(
        'INSERT INTO players (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username',
        [username, email, passwordHash]
      );

      const player = result.rows[0];
      return {
        success: true,
        playerId: player.id,
        token: this.generateToken(player.id, player.username)
      };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; playerId?: string; username?: string; token?: string; level?: number; error?: string }> {
    if (!this.db.isPostgresConnected()) {
      let player = this.mockPlayers.get(username);
      if (!player) {
        player = { id: uuidv4(), username };
        this.mockPlayers.set(username, player);
        this.mockCharacters.set(player.id, []);
      }
      return {
        success: true,
        playerId: player.id,
        username,
        token: this.generateToken(player.id, username),
        level: 1
      };
    }

    try {
      const result = await this.db.postgres!.query(
        'SELECT id, username, password_hash, level FROM players WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid username or password' };
      }

      const player = result.rows[0];
      const validPassword = await bcrypt.compare(password, player.password_hash);

      if (!validPassword) {
        return { success: false, error: 'Invalid username or password' };
      }

      await this.db.postgres!.query(
        'UPDATE players SET last_login = NOW() WHERE id = $1',
        [player.id]
      );

      return {
        success: true,
        playerId: player.id,
        username: player.username,
        token: this.generateToken(player.id, player.username),
        level: player.level
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  verifyToken(token: string): AuthToken | null {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthToken;
    } catch {
      return null;
    }
  }

  async getCharacters(playerId: string): Promise<any[]> {
    if (!this.db.isPostgresConnected()) {
      return this.mockCharacters.get(playerId) || [];
    }

    try {
      const result = await this.db.postgres!.query(
        'SELECT id, name, class, level, position_x, position_y, position_z, zone_id FROM characters WHERE player_id = $1',
        [playerId]
      );
      return result.rows;
    } catch (error) {
      console.error('Get characters error:', error);
      return [];
    }
  }

  async createCharacter(playerId: string, name: string, characterClass: string): Promise<{ success: boolean; characterId?: string; error?: string }> {
    if (!this.db.isPostgresConnected()) {
      const characters = this.mockCharacters.get(playerId) || [];
      if (characters.find(c => c.name === name)) {
        return { success: false, error: 'Character name already exists' };
      }
      const newChar = { id: uuidv4(), name, class: characterClass, level: 1, position_x: 0, position_y: 0, position_z: 0, zone_id: 'starter_zone' };
      characters.push(newChar);
      this.mockCharacters.set(playerId, characters);
      return { success: true, characterId: newChar.id };
    }

    try {
      const existing = await this.db.postgres!.query(
        'SELECT id FROM characters WHERE player_id = $1 AND name = $2',
        [playerId, name]
      );

      if (existing.rows.length > 0) {
        return { success: false, error: 'Character name already exists' };
      }

      const result = await this.db.postgres!.query(
        'INSERT INTO characters (player_id, name, class, level, position_x, position_y, position_z, zone_id) VALUES ($1, $2, $3, 1, 0, 0, 0, $4) RETURNING id',
        [playerId, name, characterClass, 'starter_zone']
      );

      return { success: true, characterId: result.rows[0].id };
    } catch (error) {
      console.error('Create character error:', error);
      return { success: false, error: 'Failed to create character' };
    }
  }

  async deleteCharacter(playerId: string, characterId: string): Promise<boolean> {
    if (!this.db.isPostgresConnected()) {
      const characters = this.mockCharacters.get(playerId);
      if (characters) {
        const idx = characters.findIndex(c => c.id === characterId);
        if (idx >= 0) characters.splice(idx, 1);
      }
      return true;
    }

    try {
      await this.db.postgres!.query(
        'DELETE FROM characters WHERE id = $1 AND player_id = $2',
        [characterId, playerId]
      );
      return true;
    } catch (error) {
      console.error('Delete character error:', error);
      return false;
    }
  }

  private generateToken(playerId: string, username: string): string {
    return jwt.sign({ playerId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }
}
