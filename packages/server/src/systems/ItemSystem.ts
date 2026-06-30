import * from '@dust-saga/shared/src/types/items';
import { DatabaseManager } from '../core/database/DatabaseManager';

export class ItemSystem {

  private db: DatabaseManager | null = null;
  private dbAvailable = false;

  async initialize(db: DatabaseManager): Promise<void> {
    this.db = db;
    this.dbAvailable = db.isPostgresConnected();
    await this.loadFromDb();
  }
}
