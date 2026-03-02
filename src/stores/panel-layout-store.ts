import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TaskStatus } from '@/types';

export interface PanelWidths {
  leftSidebar: number;
  filePreview: number;
  diffPreview: number;
  taskDetail: number;
}

export interface PanelConfig {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
}

export const PANEL_CONFIGS: Record<keyof PanelWidths, PanelConfig> = {
  leftSidebar: { minWidth: 200, maxWidth: 400, defaultWidth: 280 },
  filePreview: { minWidth: 300, maxWidth: 1200, defaultWidth: 560 },
  diffPreview: { minWidth: 300, maxWidth: 1200, defaultWidth: 560 },
  taskDetail: { minWidth: 320, maxWidth: 800, defaultWidth: 560 },
};

interface PanelLayoutState {
  widths: PanelWidths;
  hiddenColumns: TaskStatus[];
}

interface PanelLayoutActions {
  setWidth: (panel: keyof PanelWidths, width: number) => void;
  resetWidths: () => void;
  toggleColumn: (status: TaskStatus) => void;
}

type PanelLayoutStore = PanelLayoutState & PanelLayoutActions;

const getDefaultWidths = (): PanelWidths => ({
  leftSidebar: PANEL_CONFIGS.leftSidebar.defaultWidth,
  filePreview: PANEL_CONFIGS.filePreview.defaultWidth,
  diffPreview: PANEL_CONFIGS.diffPreview.defaultWidth,
  taskDetail: PANEL_CONFIGS.taskDetail.defaultWidth,
});

export const usePanelLayoutStore = create<PanelLayoutStore>()(
  persist(
    (set) => ({
      widths: getDefaultWidths(),
      hiddenColumns: [] as TaskStatus[],

      setWidth: (panel, width) =>
        set((state) => {
          const config = PANEL_CONFIGS[panel];
          const clampedWidth = Math.min(
            config.maxWidth,
            Math.max(config.minWidth, width)
          );
          return {
            widths: { ...state.widths, [panel]: clampedWidth },
          };
        }),

      resetWidths: () => set({ widths: getDefaultWidths() }),

      toggleColumn: (status) =>
        set((state) => ({
          hiddenColumns: state.hiddenColumns.includes(status)
            ? state.hiddenColumns.filter((s) => s !== status)
            : [...state.hiddenColumns, status],
        })),
    }),
    {
      name: 'panel-layout-store',
      partialize: (state) => ({ widths: state.widths, hiddenColumns: state.hiddenColumns }),
    }
  )
);
