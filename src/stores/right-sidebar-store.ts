import { create } from 'zustand';

interface RightSidebarStore {
  isOpen: boolean;
  toggleRightSidebar: () => void;
  openRightSidebar: () => void;
  closeRightSidebar: () => void;
}

export const useRightSidebarStore = create<RightSidebarStore>((set) => ({
  isOpen: false,
  toggleRightSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
  openRightSidebar: () => set({ isOpen: true }),
  closeRightSidebar: () => set({ isOpen: false }),
}));
