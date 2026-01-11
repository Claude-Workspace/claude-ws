import { create } from 'zustand';

// Interactive command types
export type InteractiveCommandType = 'rewind' | 'model' | 'config' | 'clear' | 'compact';

export type InteractiveCommand =
  | { type: 'rewind'; taskId: string }
  | { type: 'model'; currentModel: string }
  | { type: 'config'; section?: string }
  | { type: 'clear'; taskId: string }
  | { type: 'compact'; taskId: string };

interface InteractiveCommandState {
  activeCommand: InteractiveCommand | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

interface InteractiveCommandActions {
  openCommand: (command: InteractiveCommand) => void;
  closeCommand: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

type InteractiveCommandStore = InteractiveCommandState & InteractiveCommandActions;

const initialState: InteractiveCommandState = {
  activeCommand: null,
  isOpen: false,
  isLoading: false,
  error: null,
};

export const useInteractiveCommandStore = create<InteractiveCommandStore>((set) => ({
  ...initialState,

  openCommand: (command) =>
    set({
      activeCommand: command,
      isOpen: true,
      isLoading: false,
      error: null,
    }),

  closeCommand: () =>
    set({
      activeCommand: null,
      isOpen: false,
      isLoading: false,
      error: null,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => set(initialState),
}));

// Helper to get command title for display
export function getCommandTitle(command: InteractiveCommand): string {
  switch (command.type) {
    case 'rewind':
      return 'Rewind Conversation';
    case 'model':
      return 'Select Model';
    case 'config':
      return 'Configuration';
    case 'clear':
      return 'Clear Conversation';
    case 'compact':
      return 'Compact Conversation';
    default:
      return 'Command';
  }
}

// Helper to get command description
export function getCommandDescription(command: InteractiveCommand): string {
  switch (command.type) {
    case 'rewind':
      return 'Select a checkpoint to rewind the conversation';
    case 'model':
      return 'Choose which AI model to use';
    case 'config':
      return 'View and edit configuration settings';
    case 'clear':
      return 'This will clear all messages in this conversation';
    case 'compact':
      return 'Compress conversation history to save context';
    default:
      return '';
  }
}
