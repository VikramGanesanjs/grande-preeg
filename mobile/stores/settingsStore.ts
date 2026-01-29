import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // Concentration threshold (3 or 5 consecutive signals)
  concentrationThreshold: 3 | 5;
  
  // Server URL for development
  serverUrl: string;
  
  // Sound enabled
  soundEnabled: boolean;
  
  // Haptic feedback enabled
  hapticsEnabled: boolean;
  
  // Has completed tutorial
  hasCompletedTutorial: boolean;
}

interface SettingsActions {
  setConcentrationThreshold: (threshold: 3 | 5) => void;
  setServerUrl: (url: string) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setHasCompletedTutorial: (completed: boolean) => void;
  resetSettings: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

const defaultSettings: SettingsState = {
  concentrationThreshold: 3,
  serverUrl: 'http://localhost:3001',
  soundEnabled: true,
  hapticsEnabled: true,
  hasCompletedTutorial: false,
};

// Note: AsyncStorage needs to be installed separately
// For now, we'll use a simple in-memory store
export const useSettingsStore = create<SettingsStore>((set) => ({
  ...defaultSettings,

  setConcentrationThreshold: (threshold: 3 | 5) => {
    set({ concentrationThreshold: threshold });
  },

  setServerUrl: (url: string) => {
    set({ serverUrl: url });
  },

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled });
  },

  setHapticsEnabled: (enabled: boolean) => {
    set({ hapticsEnabled: enabled });
  },

  setHasCompletedTutorial: (completed: boolean) => {
    set({ hasCompletedTutorial: completed });
  },

  resetSettings: () => {
    set(defaultSettings);
  },
}));
