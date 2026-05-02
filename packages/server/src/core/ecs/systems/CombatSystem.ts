import { EntityManager, System } from '../EntityManager';
import { GAME_CONFIG, COMBAT_CONFIG, PlayerSession, EnemyInstance, DamageInfo, getEnemyDefinition, applyRacialCritChance, processRacialOnDamage, getEffectiveStats } from '@dust-saga/shared';

export class CombatSystem extends System {
  private damageCallbacks: Array<(info: DamageInfo) => void> = [];
  private deathCallbacks: Array<(entityId: string, killerId: string) => void> = [];

  constructor(entityManager: EntityManager) {
    super(entityManager);
  }

  onDamage(callback: (info: DamageInfo) => void): void {
    this.damageCallbacks.push(callback);
  }

  onDeath(callback: (entityId: string, killerId: string) => void): void {
    this.deathCallbacks.push(callback);
  }

  processPlayerAttack(
    attacker: PlayerSession,
    targetId: string,
    enemies: Map<string, EnemyInstance>,
    players: Map<string, PlayerSession>
  ): DamageInfo | null {
    const now = Date.now();
    const cooldown = GAME_CONFIG.ATTACK_COOLDOWN;
    if (now - attacker.lastAttackTime < cooldown) return null;

    let targetHealth: number;
    let targetMaxHealth: number;
    let targetDefense: number;
    let targetPosition: { x: number; y: number; z: number };
    let isEnemy = false;
    let enemyRef: EnemyInstance | null = null;

    const enemy = enemies.get(targetId);
    if (enemy && enemy.state !== 'dead') {
      const def = getEnemyDefinition(enemy.enemyType);
      targetHealth = enemy.health;
      targetMaxHealth = enemy.maxHealth;
      targetDefense = def?.defense || 0;
      targetPosition = enemy.position;
      isEnemy = true;
      enemyRef = enemy;
    } else {
      const player = players.get(targetId);
      if (player) {
        targetHealth = player.stats.health;
        targetMaxHealth = player.stats.maxHealth;
        const playerEffective = getEffectiveStats(
          player.stats,
          player.statPoints,
          player.statusEffects || []
        );
        targetDefense = playerEffective.defense;
        targetPosition = player.position;
      } else {
        return null;
      }
    }

    const dx = attacker.position.x - targetPosition.x;
    const dz = attacker.position.z - targetPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > COMBAT_CONFIG.ATTACK_RANGE) return null;

    const effective = getEffectiveStats(
      attacker.stats,
      attacker.statPoints,
      attacker.statusEffects || []
    );
    const attackPower = effective.attack;

    const isCritical = Math.random() < applyRacialCritChance(attacker.race, COMBAT_CONFIG.CRITICAL_CHANCE);
    let damage = Math.max(
      COMBAT_CONFIG.MIN_DAMAGE,
      attackPower - targetDefense * COMBAT_CONFIG.DAMAGE_REDUCTION_PER_DEFENSE * 10
    );

    if (effective.physicalDamageReduction > 0 && isEnemy && enemyRef) {
      damage = Math.floor(damage * (1 - Math.min(0.9, effective.physicalDamageReduction)));
    }

    if (isCritical) {
      damage = Math.floor(damage * COMBAT_CONFIG.CRITICAL_MULTIPLIER);
    }

    damage = Math.floor(damage * (0.9 + Math.random() * 0.2));

    if (isEnemy && enemyRef) {
      enemyRef.health = Math.max(0, enemyRef.health - damage);
      if (enemyRef.health <= 0) {
        enemyRef.state = 'dead';
        enemyRef.deathTime = Date.now();
        this.deathCallbacks.forEach(cb => cb(targetId, attacker.characterId));
      }
    }

    const info: DamageInfo = {
      attackerId: attacker.characterId,
      targetId,
      damage,
      isCritical,
      damageType: 'physical'
    };

    this.damageCallbacks.forEach(cb => cb(info));
    return info;
  }

  processEnemyAttack(
    enemy: EnemyInstance,
    target: PlayerSession
  ): DamageInfo | null {
    const now = Date.now();
    if (now - enemy.lastAttackTime < GAME_CONFIG.ATTACK_COOLDOWN) return null;

    const def = getEnemyDefinition(enemy.enemyType);
    const attackRange = def?.attackRange || 2;

    const dx = enemy.position.x - target.position.x;
    const dz = enemy.position.z - target.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > attackRange) return null;

    enemy.lastAttackTime = now;

    const attackPower = def?.attack || 5;
    const isCritical = Math.random() < 0.05;
    const targetEffective = getEffectiveStats(
      target.stats,
      target.statPoints,
      target.statusEffects || []
    );
    let damage = Math.max(
      COMBAT_CONFIG.MIN_DAMAGE,
      attackPower - targetEffective.defense * COMBAT_CONFIG.DAMAGE_REDUCTION_PER_DEFENSE * 10
    );

    if (targetEffective.physicalDamageReduction > 0) {
      damage = Math.floor(damage * (1 - Math.min(0.9, targetEffective.physicalDamageReduction)));
    }

    if (isCritical) {
      damage = Math.floor(damage * COMBAT_CONFIG.CRITICAL_MULTIPLIER);
    }

    damage = Math.floor(damage * (0.85 + Math.random() * 0.3));

    const racialResult = processRacialOnDamage(target, damage, 'physical');
    damage = racialResult.finalDamage;

    target.stats.health = Math.max(0, target.stats.health - damage);

    return {
      attackerId: enemy.id,
      targetId: target.characterId,
      damage,
      isCritical,
      damageType: 'physical'
    };
  }

  update(_deltaTime: number): void {
  }
}
