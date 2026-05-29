import { EntityManager, System } from '../EntityManager';
import { EnemyInstance, StatusEffectType } from '@dust-saga/shared';
import { getEnemyDefinition } from '@dust-saga/shared';

export class AISystem extends System {
  private attackCallbacks: Array<(enemyId: string, targetId: string, damage: number) => void> = [];
  private respawnCallbacks: Array<(enemyId: string) => void> = [];
  private aggroCallbacks: Array<(enemyId: string, enemyType: string, targetId: string, enemyPos: { x: number; y: number; z: number }, spawnPos: { x: number; y: number; z: number }) => void> = [];

  constructor(entityManager: EntityManager) {
    super(entityManager);
  }

  onEnemyAttack(callback: (enemyId: string, targetId: string, damage: number) => void): void {
    this.attackCallbacks.push(callback);
  }

  onEnemyRespawn(callback: (enemyId: string) => void): void {
    this.respawnCallbacks.push(callback);
  }

  onEnemyAggro(callback: (enemyId: string, enemyType: string, targetId: string, enemyPos: { x: number; y: number; z: number }, spawnPos: { x: number; y: number; z: number }) => void): void {
    this.aggroCallbacks.push(callback);
  }

  private getSpeedMultiplier(enemy: EnemyInstance): number {
    let multiplier = 1;
    const now = Date.now();
    for (const effect of enemy.statusEffects || []) {
      if (effect.appliedAt + effect.duration < now) continue;
      if (effect.type === StatusEffectType.DEBUFF_SPEED_DOWN) {
        multiplier *= (1 - (effect.potency || 0.15));
      } else if (effect.type === StatusEffectType.SLOW) {
        multiplier *= (1 - (effect.potency || 0.3));
      } else if (effect.type === StatusEffectType.ROOT || effect.type === StatusEffectType.FREEZE || effect.type === StatusEffectType.STUN) {
        return 0;
      }
    }
    return Math.max(0, multiplier);
  }

  updateEnemies(
    enemies: Map<string, EnemyInstance>,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    deltaTime: number
  ): void {
    enemies.forEach((enemy) => {
      if (enemy.state === 'dead') {
        this.checkRespawn(enemy);
        return;
      }

      const def = getEnemyDefinition(enemy.enemyType);
      if (!def) return;

      switch (enemy.state) {
        case 'idle':
          this.updateIdle(enemy, players, def, deltaTime);
          break;
        case 'patrol':
          this.updatePatrol(enemy, def, deltaTime);
          break;
        case 'chase':
          this.updateChase(enemy, players, def, deltaTime);
          break;
        case 'attack':
          this.updateAttack(enemy, players, def, deltaTime);
          break;
        case 'return':
          this.updateReturn(enemy, def, deltaTime);
          break;
      }
    });
  }

  private updateIdle(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    def: ReturnType<typeof getEnemyDefinition>,
    deltaTime: number
  ): void {
    if (!def) return;

    for (const [, player] of players) {
      const dx = enemy.position.x - player.position.x;
      const dz = enemy.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < def.aggroRange) {
        enemy.state = 'chase';
        enemy.targetId = player.characterId;
        this.aggroCallbacks.forEach(cb => cb(enemy.id, enemy.enemyType, player.characterId, { ...enemy.position }, { ...enemy.spawnPosition }));
        return;
      }
    }

    if (Math.random() < 0.01) {
      if (enemy.patrolPoints.length > 0) {
        enemy.state = 'patrol';
        enemy.currentPatrolIndex = Math.floor(Math.random() * enemy.patrolPoints.length);
      }
    }
  }

  private updatePatrol(enemy: EnemyInstance, def: ReturnType<typeof getEnemyDefinition>, deltaTime: number): void {
    if (!def || enemy.patrolPoints.length === 0) {
      enemy.state = 'idle';
      return;
    }

    const target = enemy.patrolPoints[enemy.currentPatrolIndex];
    const dx = target.x - enemy.position.x;
    const dz = target.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 1) {
      enemy.currentPatrolIndex = (enemy.currentPatrolIndex + 1) % enemy.patrolPoints.length;
      enemy.state = 'idle';
      return;
    }

    const speed = (def.patrolSpeed || 1) * deltaTime * this.getSpeedMultiplier(enemy);
    enemy.position.x += (dx / dist) * speed;
    enemy.position.z += (dz / dist) * speed;
    enemy.rotation = Math.atan2(dx, dz);
  }

  private updateChase(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    def: ReturnType<typeof getEnemyDefinition>,
    deltaTime: number
  ): void {
    if (!def || !enemy.targetId) {
      enemy.state = 'return';
      return;
    }

    let targetPos: { x: number; y: number; z: number } | null = null;
    for (const [, player] of players) {
      if (player.characterId === enemy.targetId) {
        targetPos = player.position;
        break;
      }
    }

    if (!targetPos) {
      enemy.state = 'return';
      enemy.targetId = null;
      return;
    }

    const dx = targetPos.x - enemy.position.x;
    const dz = targetPos.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const spawnDx = enemy.spawnPosition.x - enemy.position.x;
    const spawnDz = enemy.spawnPosition.z - enemy.position.z;
    const spawnDist = Math.sqrt(spawnDx * spawnDx + spawnDz * spawnDz);

    if (spawnDist > def.leashRange) {
      enemy.state = 'return';
      enemy.targetId = null;
      return;
    }

    if (dist <= def.attackRange) {
      enemy.state = 'attack';
      return;
    }

    const speed = def.speed * deltaTime * this.getSpeedMultiplier(enemy);
    enemy.position.x += (dx / dist) * speed;
    enemy.position.z += (dz / dist) * speed;
    enemy.rotation = Math.atan2(dx, dz);
  }

  private updateAttack(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    def: ReturnType<typeof getEnemyDefinition>,
    _deltaTime: number
  ): void {
    if (!def || !enemy.targetId) {
      enemy.state = 'return';
      return;
    }

    let targetPos: { x: number; y: number; z: number } | null = null;
    for (const [, player] of players) {
      if (player.characterId === enemy.targetId) {
        targetPos = player.position;
        break;
      }
    }

    if (!targetPos) {
      enemy.state = 'return';
      enemy.targetId = null;
      return;
    }

    const dx = targetPos.x - enemy.position.x;
    const dz = targetPos.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > def.attackRange * 1.5) {
      enemy.state = 'chase';
      return;
    }

    enemy.rotation = Math.atan2(dx, dz);

    const now = Date.now();
    if (now - enemy.lastAttackTime >= 1000) {
      enemy.lastAttackTime = now;
      this.attackCallbacks.forEach(cb => cb(enemy.id, enemy.targetId!, def.attack));
    }
  }

  private updateReturn(enemy: EnemyInstance, def: ReturnType<typeof getEnemyDefinition>, deltaTime: number): void {
    if (!def) return;

    const dx = enemy.spawnPosition.x - enemy.position.x;
    const dz = enemy.spawnPosition.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 1) {
      enemy.state = 'idle';
      enemy.targetId = null;
      const def2 = getEnemyDefinition(enemy.enemyType);
      if (def2) {
        enemy.health = def2.health;
        enemy.statusEffects = [];
      }
      return;
    }

    const speed = def.speed * 1.5 * deltaTime;
    enemy.position.x += (dx / dist) * speed;
    enemy.position.z += (dz / dist) * speed;
    enemy.rotation = Math.atan2(dx, dz);
  }

  private checkRespawn(enemy: EnemyInstance): void {
    const def = getEnemyDefinition(enemy.enemyType);
    if (!def) return;

    if (Date.now() - enemy.deathTime >= def.respawnTime) {
      enemy.health = def.health;
      enemy.state = 'idle';
      enemy.targetId = null;
      enemy.position = { ...enemy.spawnPosition };
      enemy.currentPatrolIndex = 0;
      enemy.statusEffects = [];
      this.respawnCallbacks.forEach(cb => cb(enemy.id));
    }
  }

  update(deltaTime: number): void {
  }
}
