import { Vector3 } from '@babylonjs/core';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  attack: boolean;
}

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private mouseDelta: { x: number; y: number } = { x: 0, y: 0 };
  private pointerLocked: boolean = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keys.set(e.code, true);

    if (e.code === 'Escape' && this.pointerLocked) {
      document.exitPointerLock();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys.set(e.code, false);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.pointerLocked) {
      this.mouseDelta.x = e.movementX;
      this.mouseDelta.y = e.movementY;
    }
    this.mousePosition.x = e.clientX;
    this.mousePosition.y = e.clientY;
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0 && !this.pointerLocked) {
      this.requestPointerLock();
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
    }
  }

  private handlePointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement !== null;
  }

  private requestPointerLock(): void {
    document.body.requestPointerLock();
  }

  getInputState(): InputState {
    return {
      forward: this.keys.get('KeyW') || false,
      backward: this.keys.get('KeyS') || false,
      left: this.keys.get('KeyA') || false,
      right: this.keys.get('KeyD') || false,
      jump: this.keys.get('Space') || false,
      sprint: this.keys.get('ShiftLeft') || false,
      attack: this.keys.get('KeyF') || false
    };
  }

  getMovementVector(): Vector3 {
    const input = this.getInputState();
    const movement = new Vector3(0, 0, 0);

    if (input.forward) movement.z -= 1;
    if (input.backward) movement.z += 1;
    if (input.left) movement.x -= 1;
    if (input.right) movement.x += 1;

    if (movement.length() > 0) {
      movement.normalize();
    }

    return movement;
  }

  getMouseDelta(): { x: number; y: number } {
    const delta = { ...this.mouseDelta };
    this.mouseDelta = { x: 0, y: 0 };
    return delta;
  }

  isKeyPressed(key: string): boolean {
    return this.keys.get(key) || false;
  }

  hasPointerLock(): boolean {
    return this.pointerLocked;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown as any);
    window.removeEventListener('keyup', this.handleKeyUp as any);
    window.removeEventListener('mousemove', this.handleMouseMove as any);
    window.removeEventListener('mousedown', this.handleMouseDown as any);
    window.removeEventListener('mouseup', this.handleMouseUp as any);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange as any);
  }
}