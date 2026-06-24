import { ref } from 'vue';

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const viewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 720);

let wired = false;
function ensureListener(): void {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('resize', () => {
    viewportWidth.value = window.innerWidth;
    viewportHeight.value = window.innerHeight;
  });
}
ensureListener();

export function useViewport() {
  return { viewportWidth, viewportHeight };
}

export const REF_WIDTH = 1280;
export const REF_HEIGHT = 720;

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
