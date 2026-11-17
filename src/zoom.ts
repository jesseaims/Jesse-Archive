import { invoke } from '@tauri-apps/api/core';

export type ZoomAction = 'in' | 'out' | 'reset' | 'set';

/** Limits in percent; must match `LEVELS` bounds in src-tauri/src/zoom.rs. */
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;

/** Changes the interface zoom of every window (backend `zoom_change`). */
export async function changeZoom(action: ZoomAction, value?: number): Promise<number> {
  const factor = await invoke<number>('zoom_change', { action, value });
  showZoomIndicator(factor);
  return factor;
}

export const getZoom = () => invoke<number>('zoom_get');

let indicator: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
/** Small transient "Zoom 110%" badge, styled with the current theme. */
function showZoomIndicator(factor: number) {
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'zoom-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    document.body.appendChild(indicator);
  }
  indicator.textContent = `Zoom ${Math.round(factor * 100)}%`;
  indicator.classList.add('visible');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => indicator?.classList.remove('visible'), 1200);
}

/**
 * Keyboard and mouse zoom for the current window:
 * Ctrl + "+" / Ctrl + "-" / Ctrl + 0 (standard Windows/browser shortcuts),
 * Ctrl + F12 / Ctrl + F11 (zoom in / out) and Ctrl + mouse wheel.
 */
export function installZoomShortcuts() {
  const run = (action: ZoomAction) => {
    void changeZoom(action).catch(() => {
      /* Zoom not available (e.g. outside the desktop app): ignore. */
    });
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      let action: ZoomAction | null = null;
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.key === 'F12')
        action = 'in';
      else if (e.key === '-' || e.code === 'NumpadSubtract' || e.key === 'F11') action = 'out';
      else if (e.key === '0' || e.code === 'Numpad0') action = 'reset';
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.repeat || action !== 'reset') run(action);
    },
    { capture: true },
  );
  let lastWheel = 0;
  window.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const now = Date.now();
      // One step per wheel "notch", even with high-resolution touchpads.
      if (now - lastWheel < 120 || e.deltaY === 0) return;
      lastWheel = now;
      run(e.deltaY < 0 ? 'in' : 'out');
    },
    { passive: false },
  );
}
