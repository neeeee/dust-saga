import { ref, onUnmounted } from 'vue';

export function useDraggable(
  handleSelector: string,
  storageKey?: string,
  defaultPos?: { x: number; y: number }
) {
  const posX = ref(defaultPos?.x ?? 0);
  const posY = ref(defaultPos?.y ?? 0);
  const isDragging = ref(false);

  let offset = { x: 0, y: 0 };
  let currentTarget: HTMLElement | null = null;

  function loadPosition(): void {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { x, y } = JSON.parse(saved);
        posX.value = x;
        posY.value = y;
      }
    } catch {}
  }

  function savePosition(): void {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ x: posX.value, y: posY.value }));
    } catch {}
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
    posX.value = e.clientX - offset.x;
    posY.value = e.clientY - offset.y;
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

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });

  return { posX, posY, isDragging, attach, detach };
}
