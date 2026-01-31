import { create } from 'zustand';

/**
 * Global z-index manager for modals and floating windows.
 * Uses two separate layers:
 * - Floating windows: BASE_Z_INDEX (50) and above
 * - Modal dialogs: MODAL_LAYER_OFFSET (10000) and above
 * This ensures modal dialogs are ALWAYS above floating windows.
 */

const BASE_Z_INDEX = 50;
const MODAL_LAYER_OFFSET = 10000;

interface ZIndexStore {
  windowZIndex: number;  // For floating windows
  modalZIndex: number;   // For modal dialogs

  // Get next z-index for floating windows
  getNextWindowZIndex: () => number;

  // Get next z-index for modal dialogs (always above windows)
  getNextModalZIndex: () => number;

  // Legacy: get next z-index (uses window layer for backwards compatibility)
  getNextZIndex: () => number;

  // Bring to front - returns the new z-index (window layer)
  bringToFront: () => number;
}

export const useZIndexStore = create<ZIndexStore>((set, get) => ({
  windowZIndex: BASE_Z_INDEX,
  modalZIndex: MODAL_LAYER_OFFSET,

  getNextWindowZIndex: () => {
    const next = get().windowZIndex + 1;
    set({ windowZIndex: next });
    return next;
  },

  getNextModalZIndex: () => {
    const next = get().modalZIndex + 1;
    set({ modalZIndex: next });
    return next;
  },

  // Legacy function - uses window layer
  getNextZIndex: () => {
    return get().getNextWindowZIndex();
  },

  bringToFront: () => {
    return get().getNextWindowZIndex();
  },
}));

// Export base z-index values for reference
export const BASE_WINDOW_Z_INDEX = BASE_Z_INDEX;
export const BASE_MODAL_Z_INDEX = MODAL_LAYER_OFFSET;
