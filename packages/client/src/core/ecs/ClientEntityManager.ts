import { Entity, Component } from '@dust-saga/shared';

export class ClientEntityManager {
  private entities: Map<string, Entity> = new Map();
  private localEntities: Map<string, Entity> = new Map();

  createEntity(id: string, components?: Map<string, Component>): Entity {
    const entity: Entity = {
      id,
      components: components || new Map()
    };
    this.entities.set(id, entity);
    return entity;
  }

  createLocalEntity(components?: Map<string, Component>): Entity {
    const id = `local_${Date.now()}_${Math.random()}`;
    const entity: Entity = {
      id,
      components: components || new Map()
    };
    this.localEntities.set(id, entity);
    return entity;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id) || this.localEntities.get(id);
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
    this.localEntities.delete(id);
  }

  getAllEntities(): Entity[] {
    return [
      ...Array.from(this.entities.values()),
      ...Array.from(this.localEntities.values())
    ];
  }

  addComponent(entityId: string, component: Component): void {
    const entity = this.getEntity(entityId);
    if (entity) {
      entity.components.set(component.type, component);
    }
  }

  removeComponent(entityId: string, componentType: string): void {
    const entity = this.getEntity(entityId);
    if (entity) {
      entity.components.delete(componentType);
    }
  }

  getComponent<T extends Component>(entityId: string, componentType: string): T | undefined {
    const entity = this.getEntity(entityId);
    if (!entity) return undefined;
    return entity.components.get(componentType) as T;
  }

  clear(): void {
    this.entities.clear();
    this.localEntities.clear();
  }
}

export class InterpolationManager {
  private positionBuffer: Map<string, Array<{ position: any; timestamp: number }>> = new Map();
  private rotationBuffer: Map<string, Array<{ rotation: any; timestamp: number }>> = new Map();
  private interpolationDelay: number = 100;

  addPositionUpdate(entityId: string, position: any, timestamp: number): void {
    if (!this.positionBuffer.has(entityId)) {
      this.positionBuffer.set(entityId, []);
    }
    const buffer = this.positionBuffer.get(entityId)!;
    buffer.push({ position, timestamp });
    
    if (buffer.length > 20) {
      buffer.shift();
    }
  }

  addRotationUpdate(entityId: string, rotation: any, timestamp: number): void {
    if (!this.rotationBuffer.has(entityId)) {
      this.rotationBuffer.set(entityId, []);
    }
    const buffer = this.rotationBuffer.get(entityId)!;
    buffer.push({ rotation, timestamp });
    
    if (buffer.length > 20) {
      buffer.shift();
    }
  }

  getInterpolatedPosition(entityId: string, currentTime: number): any | null {
    const buffer = this.positionBuffer.get(entityId);
    if (!buffer || buffer.length < 2) return null;

    const targetTime = currentTime - this.interpolationDelay;

    for (let i = 1; i < buffer.length; i++) {
      const current = buffer[i];
      const previous = buffer[i - 1];

      if (current.timestamp >= targetTime && previous.timestamp <= targetTime) {
        const t = (targetTime - previous.timestamp) / (current.timestamp - previous.timestamp);
        return {
          x: this.lerp(previous.position.x, current.position.x, t),
          y: this.lerp(previous.position.y, current.position.y, t),
          z: this.lerp(previous.position.z, current.position.z, t)
        };
      }
    }

    return buffer[buffer.length - 1].position;
  }

  getInterpolatedRotation(entityId: string, currentTime: number): any | null {
    const buffer = this.rotationBuffer.get(entityId);
    if (!buffer || buffer.length < 2) return null;

    const targetTime = currentTime - this.interpolationDelay;

    for (let i = 1; i < buffer.length; i++) {
      const current = buffer[i];
      const previous = buffer[i - 1];

      if (current.timestamp >= targetTime && previous.timestamp <= targetTime) {
        return this.slerp(previous.rotation, current.rotation, (targetTime - previous.timestamp) / (current.timestamp - previous.timestamp));
      }
    }

    return buffer[buffer.length - 1].rotation;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private slerp(q1: any, q2: any, t: number): any {
    const dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;
    
    if (dot < 0) {
      q2 = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w };
    }

    const angle = Math.acos(Math.min(Math.max(dot, -1), 1));
    const sinAngle = Math.sin(angle);

    if (sinAngle < 0.001) {
      return q1;
    }

    const a = Math.sin((1 - t) * angle) / sinAngle;
    const b = Math.sin(t * angle) / sinAngle;

    return {
      x: a * q1.x + b * q2.x,
      y: a * q1.y + b * q2.y,
      z: a * q1.z + b * q2.z,
      w: a * q1.w + b * q2.w
    };
  }

  clearEntity(entityId: string): void {
    this.positionBuffer.delete(entityId);
    this.rotationBuffer.delete(entityId);
  }

  clear(): void {
    this.positionBuffer.clear();
    this.rotationBuffer.clear();
  }
}