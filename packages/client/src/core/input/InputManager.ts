import { Vector3 } from '@babylonjs/core';

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  manualAttack: boolean;
  sprint: boolean;
  attack: boolean;
  interact: boolean;
}

export type SkillBarKeyHandler = (barIndex: number, slotIndex: number) => void;

const SKILL_BAR_KEYS = [
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'
];

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private mouseDelta: { x: number; y: number } = { x: 0, y: 0 };
  private pointerLocked: boolean = false;
  private chatFocused: boolean = false;
  private skillBarHandler: SkillBarKeyHandler | null = null;
  private dialogActive: boolean = false;
  private static readonly _zeroVec = new Vector3(0, 0, 0);
  private static readonly _cachedMovement = new Vector3(0, 0, 0);

  constructor() {
    this.setupEventListeners();
  }

  setChatFocused(focused: boolean): void {
    this.chatFocused = focused;
  }

  setDialogActive(active: boolean): void {
    this.dialogActive = active;
  }

  isDialogActive(): boolean {
    return this.dialogActive;
  }

  setSkillBarHandler(handler: SkillBarKeyHandler): void {
    this.skillBarHandler = handler;
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
    if (this.chatFocused) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    this.keys.set(e.code, true);

    if (e.code === 'Escape' && this.pointerLocked) {
      document.exitPointerLock();
    }

    const skillIdx = SKILL_BAR_KEYS.indexOf(e.code);
    if (skillIdx >= 0 && this.skillBarHandler) {
      if (e.shiftKey) {
        this.skillBarHandler(1, skillIdx);
      } else if (e.ctrlKey || e.metaKey) {
        this.skillBarHandler(2, skillIdx);
      } else {
        this.skillBarHandler(0, skillIdx);
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (this.chatFocused) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
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

  private handleMouseDown(_e: MouseEvent): void {
  }

  private handleMouseUp(_e: MouseEvent): void {
  }

  private handlePointerLockChange(): void {
  }

  getInputState(): InputState {
    if (this.dialogActive) {
      return {
        forward: false,
        backward: false,
        left: false,
        right: false,
        manualAttack: false,
        sprint: false,
        attack: false,
        interact: false
      };
    }
    return {
      forward: this.keys.get('KeyW') || false,
      backward: this.keys.get('KeyS') || false,
      left: this.keys.get('KeyA') || false,
      right: this.keys.get('KeyD') || false,
      manualAttack: this.keys.get('Space') || false,
      sprint: false,
      attack: this.keys.get('KeyF') || false,
      interact: this.keys.get('KeyE') || false
    };
  }

  getMovementVector(): Vector3 {
    if (this.dialogActive) return InputManager._zeroVec;
    const input = this.getInputState();
    const movement = InputManager._cachedMovement;
    movement.x = 0;
    movement.y = 0;
    movement.z = 0;

    if (input.forward) movement.z += 1;
    if (input.backward) movement.z -= 1;
    if (input.left) movement.x -= 1;
    if (input.right) movement.x += 1;

    if (movement.lengthSquared() > 0) {
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