import { EntityManager, System } from '../EntityManager';
import { EnemyInstance, StatusEffectType, distance2D } from '@dust-saga/shared';
import { getEnemyDefinition } from '@dust-saga/shared';
import type { EnmitySystem } from './EnmitySystem';

type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'return' | 'dead';

export class AISystem extends System {
  private attackCallbacks: Array<(enemyId: string, targetId: string, damage: number) => void> = [];
  private respawnCallbacks: Array<(enemyId: string) => void> = [];
  private aggroCallbacks: Array<(enemyId: string, enemyType: string, targetId: string, enemyPos: { x: number; y: number; z: number }, spawnPos: { x: number; y: number; z: number }) => void> = [];
  enmitySys: EnmitySystem | null = null;

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

  private moveEntity(enemy: EnemyInstance, target: { x: number; z: number }, speed: number): void {
    const dx = target.x - enemy.position.x;
    const dz = target.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.01) {
      enemy.position.x += (dx / dist) * speed;
      enemy.position.z += (dz / dist) * speed;
      enemy.rotation = Math.atan2(dx, dz);
    }
  }

  private pickAggroTarget(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    aggroRange: number,
    strategy: 'first' | 'closest' | 'lowestHp'
  ): { characterId: string; position: { x: number; y: number; z: number } } | null {
    const candidates: Array<{ characterId: string; position: { x: number; y: number; z: number }; dist: number }> = [];

    for (const [, player] of players) {
      const dist = distance2D(enemy.position, player.position);
      if (dist < aggroRange) {
        candidates.push({ characterId: player.characterId, position: player.position, dist });
      }
    }

    if (candidates.length === 0) return null;

    switch (strategy) {
      case 'closest':
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates[0];
      case 'lowestHp':
        const playerMap = this['entityManager'] as any;
        candidates.sort((a, b) => {
          const pA = playerMap?.players?.get?.(a.characterId);
          const pB = playerMap?.players?.get?.(b.characterId);
          return (pA?.stats?.health ?? 999999) - (pB?.stats?.health ?? 999999);
        });
        return candidates[0];
      case 'first':
      default:
        return candidates[0];
    }
  }

  private pickPatrolIndex(enemy: EnemyInstance, strategy: 'random' | 'sequential'): number {
    if (strategy === 'sequential') {
      return (enemy.currentPatrolIndex + 1) % enemy.patrolPoints.length;
    }
    return Math.floor(Math.random() * enemy.patrolPoints.length);
  }

  private findPlayerTarget(
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    targetId: string
  ): { x: number; y: number; z: number } | null {
    return players.get(targetId)?.position || null;
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

      const stateHandlers: Record<Exclude<EnemyState, 'dead'>, () => void> = {
        idle: () => this.updateIdle(enemy, enemies, players, def),
        patrol: () => this.updatePatrol(enemy, enemies, players, def, deltaTime),
        chase: () => this.updateChase(enemy, players, def, deltaTime),
        attack: () => this.updateAttack(enemy, players, def, deltaTime),
        return: () => this.updateReturn(enemy, enemies, players, def, deltaTime),
      };

      const handler = stateHandlers[enemy.state as Exclude<EnemyState, 'dead'>];
      if (handler) handler();
    });
  }

  private transitionTo(enemy: EnemyInstance, state: EnemyState): void {
    if (state === 'dead' || state === enemy.state) return;
    enemy.state = state;
    if (state === 'idle') {
      enemy.targetId = null;
    }
  }

  private checkLinkedAggro(
    enemy: EnemyInstance,
    enemies: Map<string, EnemyInstance>,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    linkRange: number
  ): boolean {
    for (const [, other] of enemies) {
      if (other.id === enemy.id) continue;
      if (other.enemyType !== enemy.enemyType) continue;
      if (other.state !== 'chase' && other.state !== 'attack') continue;
      if (!other.targetId) continue;

      const dist = distance2D(enemy.position, other.position);
      if (dist > linkRange) continue;

      const targetPos = this.findPlayerTarget(players, other.targetId);
      if (!targetPos) continue;

      enemy.state = 'chase';
      enemy.targetId = other.targetId;
      if (this.enmitySys) {
        this.enmitySys.addEnmity(enemy, other.targetId, 1, 0);
      }
      return true;
    }
    return false;
  }

  private tryEngageFromEnmity(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>
  ): boolean {
    if (!this.enmitySys || !enemy.enmityTable || Object.keys(enemy.enmityTable).length === 0) return false;
    const topTarget = this.enmitySys.getTopTarget(enemy);
    if (!topTarget) return false;
    const targetPos = this.findPlayerTarget(players, topTarget.characterId);
    if (!targetPos) return false;
    enemy.state = 'chase';
    enemy.targetId = topTarget.characterId;
    return true;
  }

  private updateIdle(
    enemy: EnemyInstance,
    enemies: Map<string, EnemyInstance>,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    def: ReturnType<typeof getEnemyDefinition>,
  ): void {
    if (!def) return;

    if (this.tryEngageFromEnmity(enemy, players)) return;

    if (this.checkLinkedAggro(enemy, enemies, players, def.aggroRange)) return;

    const target = this.pickAggroTarget(enemy, players, def.aggroRange, def.aggroStrategy || 'first');
    if (target) {
      enemy.state = 'chase';
      enemy.targetId = target.characterId;
      this.aggroCallbacks.forEach(cb => cb(enemy.id, enemy.enemyType, target.characterId, { ...enemy.position }, { ...enemy.spawnPosition }));
      return;
    }

    if (Math.random() < 0.01 && enemy.patrolPoints.length > 0) {
      this.transitionTo(enemy, 'patrol');
      enemy.currentPatrolIndex = this.pickPatrolIndex(enemy, def.patrolStrategy || 'random');
    }
  }

  private updatePatrol(enemy: EnemyInstance, enemies: Map<string, EnemyInstance>, players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>, def: ReturnType<typeof getEnemyDefinition>, deltaTime: number): void {
    if (!def || enemy.patrolPoints.length === 0) {
      this.transitionTo(enemy, 'idle');
      return;
    }

    if (this.tryEngageFromEnmity(enemy, players)) return;

    if (this.checkLinkedAggro(enemy, enemies, players, def.aggroRange)) return;

    const target = enemy.patrolPoints[enemy.currentPatrolIndex];
    const dist = distance2D(enemy.position, target);

    if (dist < 1) {
      enemy.currentPatrolIndex = this.pickPatrolIndex(enemy, def.patrolStrategy || 'random');
      this.transitionTo(enemy, 'idle');
      return;
    }

    const speed = (def.patrolSpeed || 1) * deltaTime * this.getSpeedMultiplier(enemy);
    this.moveEntity(enemy, target, speed);
  }

  private updateChase(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    def: ReturnType<typeof getEnemyDefinition>,
    deltaTime: number
  ): void {
    if (!def || !enemy.targetId) {
      this.transitionTo(enemy, 'return');
      return;
    }

    if (this.enmitySys) {
      this.enmitySys.decay(enemy, deltaTime, true);
      const topTarget = this.enmitySys.getTopTarget(enemy);
      if (topTarget && topTarget.characterId !== enemy.targetId) {
        const newTarget = this.findPlayerTarget(players, topTarget.characterId);
        if (newTarget) {
          enemy.targetId = topTarget.characterId;
        }
      }
    }

    const targetPos = this.findPlayerTarget(players, enemy.targetId);
    if (!targetPos) {
      this.transitionTo(enemy, 'return');
      return;
    }

    const dist = distance2D(enemy.position, targetPos);

    if (dist <= def.attackRange) {
      this.transitionTo(enemy, 'attack');
      return;
    }

    const speed = def.speed * deltaTime * this.getSpeedMultiplier(enemy);
    this.moveEntity(enemy, targetPos, speed);
  }

  private updateAttack(
    enemy: EnemyInstance,
    players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>,
    def: ReturnType<typeof getEnemyDefinition>,
    deltaTime: number
  ): void {
    if (!def || !enemy.targetId) {
      this.transitionTo(enemy, 'return');
      return;
    }

    if (this.enmitySys) {
      this.enmitySys.decay(enemy, deltaTime, true);
      const topTarget = this.enmitySys.getTopTarget(enemy);
      if (topTarget && topTarget.characterId !== enemy.targetId) {
        const newTarget = this.findPlayerTarget(players, topTarget.characterId);
        if (newTarget) {
          enemy.targetId = topTarget.characterId;
        }
      }
    }

    const targetPos = this.findPlayerTarget(players, enemy.targetId);
    if (!targetPos) {
      this.transitionTo(enemy, 'return');
      return;
    }

    const dist = distance2D(enemy.position, targetPos);

    if (dist > def.attackRange * 1.5) {
      this.transitionTo(enemy, 'chase');
      return;
    }

    enemy.rotation = Math.atan2(targetPos.x - enemy.position.x, targetPos.z - enemy.position.z);

    const now = Date.now();
    const cooldown = def.attackCooldown || 1000;
    if (now - enemy.lastAttackTime >= cooldown) {
      enemy.lastAttackTime = now;
      this.attackCallbacks.forEach(cb => cb(enemy.id, enemy.targetId!, def.attack));
    }
  }

  private updateReturn(enemy: EnemyInstance, enemies: Map<string, EnemyInstance>, players: Map<string, { position: { x: number; y: number; z: number }; characterId: string }>, def: ReturnType<typeof getEnemyDefinition>, deltaTime: number): void {
    if (!def) return;

    if (this.tryEngageFromEnmity(enemy, players)) return;

    if (this.checkLinkedAggro(enemy, enemies, players, def.aggroRange)) return;

    if (this.enmitySys) {
      this.enmitySys.decay(enemy, deltaTime, false);
    }

    const dist = distance2D(enemy.position, enemy.spawnPosition);

    if (dist < 1) {
      if (this.enmitySys) {
        this.enmitySys.clearEnmity(enemy);
      }
      this.transitionTo(enemy, 'idle');
      const def2 = getEnemyDefinition(enemy.enemyType);
      if (def2) {
        enemy.health = def2.health;
        enemy.statusEffects = [];
      }
      return;
    }

    const speed = def.speed * 1.5 * deltaTime;
    this.moveEntity(enemy, enemy.spawnPosition, speed);
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
      if (this.enmitySys) {
        this.enmitySys.clearEnmity(enemy);
      }
      this.respawnCallbacks.forEach(cb => cb(enemy.id));
    }
  }

  update(_deltaTime: number): void {
  }
}
