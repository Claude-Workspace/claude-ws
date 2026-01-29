import { create } from 'zustand';

interface AuthState {
  apiKeyDialogOpen: boolean;
  setApiKeyDialogOpen: (open: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  apiKeyDialogOpen: false,
  setApiKeyDialogOpen: (open) => set({ apiKeyDialogOpen: open }),
}));
