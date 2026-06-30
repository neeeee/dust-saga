import { Router } from 'express';
import type { QuestSystem } from '../../systems/QuestSystem';
import type { CutsceneSystem } from '../../systems/CutsceneSystem';
import type { ItemSystem } from '../../systems/ItemSystem.ts';
import { createAdminRouter } from './routes/admin';

/**
 * Game systems and services the HTTP API needs. Resolved once at boot in
 * `index.ts` and passed down to each router, so route handlers stay pure
 * (no reaching into singletons / god objects from inside the route files).
 *
 * Add new fields here as the admin UI grows to cover more systems
 * (items, npcs, zones, spawns, etc.).
 */
export interface ApiServices {
  questSys: QuestSystem;
  cutsceneSys: CutsceneSystem;
  itemSys: ItemSystem;
}

/**
 * Builds the entire `/api` router tree. Mount the result once:
 *
 *   app.use('/api', createApiRouter({ questSys, cutsceneSys }))
 */
export function createApiRouter(services: ApiServices): Router {
  const api = Router();
  api.use('/admin', createAdminRouter(services));
  return api;
}
