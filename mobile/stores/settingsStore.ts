import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
  // Concentration threshold (3 or 5 consecutive signals)
  concentrationThreshold: 3 | 5;
  
  // Server URL for development
  serverUrl: string;
  
  // Shared multiplayer relay server URL (Vercel deployment)
  multiplayerServerUrl: string;
  multiplayerRaceId: string;
  multiplayerPlayerId: string;
  
  // Multiplayer mode enabled
  multiplayerEnabled: boolean;
  
  // Sound enabled
  soundEnabled: boolean;
  
  // Haptic feedback enabled
  hapticsEnabled: boolean;
  
  // Has completed tutorial
  hasCompletedTutorial: boolean;
  
  // Dev mode - shows raw EEG data
  devModeEnabled: boolean;
}

interface SettingsActions {
  setConcentrationThreshold: (threshold: 3 | 5) => void;
  setServerUrl: (url: string) => void;
  setMultiplayerServerUrl: (url: string) => void;
  setMultiplayerRaceId: (raceId: string) => void;
  setMultiplayerPlayerId: (playerId: string) => void;
  setMultiplayerEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setHasCompletedTutorial: (completed: boolean) => void;
  setDevModeEnabled: (enabled: boolean) => void;
  resetSettings: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

const defaultSettings: SettingsState = {
  concentrationThreshold: 3,
  serverUrl: 'http://localhost:3001',
  multiplayerServerUrl: '',
  multiplayerRaceId: 'default-race',
  multiplayerPlayerId: 'player-local',
  multiplayerEnabled: false,
  soundEnabled: true,
  hapticsEnabled: true,
  hasCompletedTutorial: false,
  devModeEnabled: false,
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

  setMultiplayerServerUrl: (url: string) => {
    set({ multiplayerServerUrl: url });
  },

  setMultiplayerRaceId: (raceId: string) => {
    set({ multiplayerRaceId: raceId });
  },

  setMultiplayerPlayerId: (playerId: string) => {
    set({ multiplayerPlayerId: playerId });
  },

  setMultiplayerEnabled: (enabled: boolean) => {
    set({ multiplayerEnabled: enabled });
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

  setDevModeEnabled: (enabled: boolean) => {
    set({ devModeEnabled: enabled });
  },

  resetSettings: () => {
    set(defaultSettings);
  },
}));
