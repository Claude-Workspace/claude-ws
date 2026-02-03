import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSocket } from '@/lib/socket-service';

interface TunnelState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  url: string | null;
  error: string | null;
  wizardOpen: boolean;
  wizardStep: number;
  selectedMethod: 'ctunnel' | 'cloudflare' | null;
  onboardingCompleted: boolean;

  setWizardOpen: (open: boolean) => void;
  setWizardStep: (step: number) => void;
  setSelectedMethod: (method: 'ctunnel' | 'cloudflare') => void;
  startTunnel: (subdomain?: string) => Promise<void>;
  stopTunnel: () => Promise<void>;
  fetchStatus: () => Promise<void>;
  checkOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  openFirstLoadModal: () => void;
  getTunnelConfig: () => Promise<{ subdomain: string | null; email: string | null; apiKey: string | null; plan: any } | null>;
  initSocketListeners: () => void;
}

// Track if socket listeners have been initialized to prevent duplicates
let socketListenersInitialized = false;

export const useTunnelStore = create<TunnelState>()(
  persist(
    (set, get) => ({
      status: 'disconnected',
      url: null,
      error: null,
      wizardOpen: false,
      wizardStep: 0,
      selectedMethod: null,
      onboardingCompleted: false,

      setWizardOpen: (open) => set({ wizardOpen: open }),
      setWizardStep: (step) => set({ wizardStep: step }),
      setSelectedMethod: (method) => set({ selectedMethod: method }),

      startTunnel: async (subdomain) => {
        set({ status: 'connecting', error: null });
        try {
          const res = await fetch('/api/tunnel/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain }),
          });
          const data = await res.json();
          if (data.success) {
            set({ status: 'connected', url: data.url });
          } else {
            set({ status: 'error', error: data.error || 'Failed to start tunnel' });
          }
        } catch (err) {
          set({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
        }
      },

      stopTunnel: async () => {
        try {
          await fetch('/api/tunnel/stop', { method: 'POST' });
          set({ status: 'disconnected', url: null, error: null });
        } catch (err) {
          console.error('Failed to stop tunnel:', err);
        }
      },

      fetchStatus: async () => {
        try {
          const res = await fetch('/api/tunnel/status');
          if (res.status === 401) {
            // Not authenticated, skip status fetch
            return;
          }
          const data = await res.json();
          set({ status: data.status, url: data.url, error: data.error });
        } catch (err) {
          console.error('Failed to fetch tunnel status:', err);
        }
      },

      checkOnboarding: async () => {
        try {
          // Check localStorage first (for Cloudflare users who don't have DB config)
          const localCompleted = localStorage.getItem('onboarding_completed') === 'true';
          if (localCompleted) {
            set({ onboardingCompleted: true });
            return;
          }

          // Check if tunnel is configured by checking for subdomain and API key in database
          const res = await fetch('/api/settings?keys=tunnel_subdomain,tunnel_apikey');
          if (res.status === 401) {
            // Not authenticated, skip onboarding check and ensure wizard is closed
            set({ wizardOpen: false });
            return;
          }
          const data = await res.json();

          // Onboarding is complete only if both subdomain and API key are set
          const completed = !!(data.tunnel_subdomain && data.tunnel_apikey);
          set({ onboardingCompleted: completed });

          // Don't auto-open wizard anymore - FirstLoadModal handles first load
          // Wizard only opens manually from settings
        } catch (err) {
          console.error('Failed to check onboarding:', err);
        }
      },

      completeOnboarding: async () => {
        // No need to store onboarding_completed - it's derived from tunnel config
        set({ onboardingCompleted: true });
      },

      resetOnboarding: async () => {
        try {
          // Stop tunnel if running
          await fetch('/api/tunnel/stop', { method: 'POST' });
          // Clear all tunnel configuration from database
          await fetch('/api/settings?keys=tunnel_subdomain,tunnel_email,tunnel_apikey,tunnel_plan,tunnel_url,tunnel_enabled', {
            method: 'DELETE',
          });
          // Clear localStorage for Cloudflare users
          localStorage.removeItem('onboarding_completed');
          // Reset firstload dismissed flag so modal shows again
          localStorage.removeItem('firstload_dismissed');
          // Reset wizard to step 0, clear tunnel state, and open wizard
          set({ onboardingCompleted: false, wizardStep: 0, wizardOpen: true, status: 'disconnected', url: null, error: null });
        } catch (err) {
          console.error('Failed to reset onboarding:', err);
        }
      },

      openFirstLoadModal: () => {
        // Reset firstload dismissed flag and open modal
        localStorage.removeItem('firstload_dismissed');
        set({ wizardStep: 0, wizardOpen: true });
      },

      getTunnelConfig: async () => {
        try {
          const res = await fetch('/api/settings?keys=tunnel_subdomain,tunnel_email,tunnel_apikey,tunnel_plan');
          if (res.status === 401) {
            // Not authenticated, return null as if no config exists
            return null;
          }
          const data = await res.json();

          // Config exists only if both subdomain and API key are set (ctunnel method)
          if (!data.tunnel_subdomain || !data.tunnel_apikey) {
            return null;
          }

          let plan = null;
          if (data.tunnel_plan) {
            try {
              plan = JSON.parse(data.tunnel_plan);
            } catch {
              plan = null;
            }
          }

          return {
            subdomain: data.tunnel_subdomain || null,
            email: data.tunnel_email || null,
            apiKey: data.tunnel_apikey || null,
            plan,
          };
        } catch (err) {
          console.error('Failed to get tunnel config:', err);
          return null;
        }
      },

      initSocketListeners: () => {
        if (socketListenersInitialized) {
          return;
        }

        const socket = getSocket();

        socket.on('tunnel:status', (data) => {
          set({ status: data.status, url: data.url, error: data.error });
        });

        socket.on('tunnel:connected', ({ url }) => {
          set({ status: 'connected', url, error: null });
        });

        socket.on('tunnel:error', ({ error }) => {
          set({ status: 'error', error });
        });

        socket.on('tunnel:closed', () => {
          set({ status: 'disconnected', url: null, error: null });
        });

        // Fetch status when socket connects or reconnects
        socket.on('connect', async () => {
          try {
            const res = await fetch('/api/tunnel/status');
            const data = await res.json();
            set({ status: data.status, url: data.url, error: data.error });
          } catch {
            // Ignore fetch errors on connect
          }
        });

        socketListenersInitialized = true;
      },
    }),
    {
      name: 'tunnel-storage',
      // Don't persist onboardingCompleted - we use separate localStorage key for that
      // to avoid conflicts between Zustand rehydration and checkOnboarding logic
      partialize: () => ({}),
    }
  )
);
