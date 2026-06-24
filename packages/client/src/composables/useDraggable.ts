import { ref, computed, watch, onUnmounted } from 'vue';
import { useViewport, REF_WIDTH, REF_HEIGHT, clamp01 } from './useViewport';

const STORAGE_VERSION = 2;

const uiResetTrigger = ref(0);

export function resetAllDraggablePositions(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('panel-')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  uiResetTrigger.value++;
}

export function useDraggable(
  handleSelector: string,
  storageKey?: string,
  defaultPos?: { x: number; y: number }
) {
  const { viewportWidth, viewportHeight } = useViewport();

  const normX = ref(clamp01((defaultPos?.x ?? 0) / REF_WIDTH));
  const normY = ref(clamp01((defaultPos?.y ?? 0) / REF_HEIGHT));

  const isDragging = ref(false);

  let offset = { x: 0, y: 0 };
  let currentTarget: HTMLElement | null = null;

  const posX = computed(() => normX.value * viewportWidth.value);
  const posY = computed(() => normY.value * viewportHeight.value);

  function loadPosition(): void {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.v === STORAGE_VERSION && typeof parsed.nx === 'number' && typeof parsed.ny === 'number') {
        normX.value = clamp01(parsed.nx);
        normY.value = clamp01(parsed.ny);
        return;
      }
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        normX.value = clamp01(parsed.x / (viewportWidth.value || REF_WIDTH));
        normY.value = clamp01(parsed.y / (viewportHeight.value || REF_HEIGHT));
        return;
      }
    } catch {}
  }

  function savePosition(): void {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ v: STORAGE_VERSION, nx: normX.value, ny: normY.value })
      );
    } catch {}
  }

  function clampToViewport(px: number, py: number): { x: number; y: number } {
    const w = viewportWidth.value || REF_WIDTH;
    const h = viewportHeight.value || REF_HEIGHT;
    let x = px;
    let y = py;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (currentTarget) {
      const maxX = Math.max(0, w - currentTarget.offsetWidth);
      const maxY = Math.max(0, h - currentTarget.offsetHeight);
      if (x > maxX) x = maxX;
      if (y > maxY) y = maxY;
    } else {
      if (x > w) x = w;
      if (y > h) y = h;
    }
    return { x, y };
  }

  function onMouseDown(e: MouseEvent): void {
    const handle = (e.target as HTMLElement).closest(handleSelector) as HTMLElement;
    if (!handle) return;

    currentTarget = handle.closest('[data-draggable]') as HTMLElement;
    if (!currentTarget) return;

    isDragging.value = true;
    offset.x = e.clientX - posX.value;
    offset.y = e.clientY - posY.value;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isDragging.value) return;
    const clamped = clampToViewport(e.clientX - offset.x, e.clientY - offset.y);
    normX.value = clamp01(clamped.x / (viewportWidth.value || REF_WIDTH));
    normY.value = clamp01(clamped.y / (viewportHeight.value || REF_HEIGHT));
  }

  function onMouseUp(): void {
    if (!isDragging.value) return;
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    savePosition();
    currentTarget = null;
  }

  function attach(rootEl: HTMLElement | null): void {
    loadPosition();
    rootEl?.addEventListener('mousedown', onMouseDown);
  }

  function detach(rootEl: HTMLElement | null): void {
    rootEl?.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  watch(uiResetTrigger, () => {
    if (!storageKey) return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      normX.value = clamp01((defaultPos?.x ?? 0) / REF_WIDTH);
      normY.value = clamp01((defaultPos?.y ?? 0) / REF_HEIGHT);
      savePosition();
    } else {
      loadPosition();
    }
  });

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });

  return { posX, posY, isDragging, attach, detach };
}
