import { create } from 'zustand';
import { websocketService } from '../services/websocket';
import { opponentSocketService } from '../services/opponentSocket';
import { ConcentrationSignal, GameStatus, GameResults } from '../types';
import { gameConfig } from '../constants/theme';

interface GameState {
  // Game status
  status: GameStatus;
  
  // Car position (0-100 percentage)
  carPosition: number;
  
  // Current concentration signal
  currentSignal: ConcentrationSignal | null;
  
  // Consecutive concentration streak (0 to threshold)
  concentrationStreak: number;
  
  // Concentration threshold (3 or 5)
  threshold: 3 | 5;
  
  // Total number of car advances
  totalAdvances: number;
  
  // Elapsed time in milliseconds
  elapsedTime: number;
  
  // History of concentration signals (true = concentrated)
  concentrationHistory: boolean[];
  
  // Countdown value (3, 2, 1)
  countdown: number;
  
  // Game start timestamp
  startTime: number | null;
  
  // Timer interval reference
  timerInterval: NodeJS.Timeout | null;
  
  // Raw EEG data (for dev mode)
  rawEegData: number[] | null;
  
  // Average of raw EEG values
  rawEegAverage: number | null;
  
  // Alpha and beta bandpower (from signal processing)
  alphaPower: number | null;
  betaPower: number | null;
  powerSum: number | null;
  
  // Multiplayer state
  opponentPosition: number;
  opponentStatus: 'idle' | 'playing' | 'finished' | 'disconnected';
  isMultiplayer: boolean;
  
  // Multiplayer ready state (for lobby synchronization)
  isLocalReady: boolean;
  isOpponentReady: boolean;
}

interface GameActions {
  // Start a new game
  startGame: () => void;
  
  // Pause the game
  pauseGame: () => void;
  
  // Resume the game
  resumeGame: () => void;
  
  // End the game (manually or when finished)
  endGame: () => void;
  
  // Reset game state
  resetGame: () => void;
  
  // Set concentration threshold
  setThreshold: (threshold: 3 | 5) => void;
  
  // Process a concentration signal
  processSignal: (signal: ConcentrationSignal) => void;
  
  // Get game results
  getResults: () => GameResults;
  
  // Internal: advance the car
  advanceCar: () => void;
  
  // Internal: start the timer
  startTimer: () => void;
  
  // Internal: stop the timer
  stopTimer: () => void;
  
  // Internal: set countdown
  setCountdown: (value: number) => void;
  
  // Internal: set status
  setStatus: (status: GameStatus) => void;
  
  // Multiplayer: set opponent position
  setOpponentPosition: (position: number, status: 'idle' | 'playing' | 'finished') => void;
  
  // Multiplayer: enable/disable multiplayer mode
  setMultiplayer: (enabled: boolean) => void;
  
  // Multiplayer: set local ready state (sends to server)
  setLocalReady: (ready: boolean) => void;
  
  // Multiplayer: set opponent ready state (from server)
  setOpponentReady: (ready: boolean) => void;
}

type GameStore = GameState & GameActions;

const initialState: GameState = {
  status: 'idle',
  carPosition: 0,
  currentSignal: null,
  concentrationStreak: 0,
  threshold: gameConfig.defaultThreshold,
  totalAdvances: 0,
  elapsedTime: 0,
  concentrationHistory: [],
  countdown: 3,
  startTime: null,
  timerInterval: null,
  rawEegData: null,
  rawEegAverage: null,
  alphaPower: null,
  betaPower: null,
  powerSum: null,
  opponentPosition: 0,
  opponentStatus: 'disconnected',
  isMultiplayer: false,
  isLocalReady: false,
  isOpponentReady: false,
};

export const useGameStore = create<GameStore>((set, get) => {
  // Set up opponent position handler for multiplayer
  opponentSocketService.onPosition((data) => {
    set({
      opponentPosition: data.position,
      opponentStatus: data.status,
    });
  });

  opponentSocketService.onDisconnect(() => {
    set({ opponentStatus: 'disconnected', isOpponentReady: false });
  });

  // Set up opponent ready handler for multiplayer lobby
  opponentSocketService.onReady((data) => {
    set({ isOpponentReady: data.ready });
  });

  // Set up WebSocket message handler
  websocketService.onMessage((message) => {
    const state = get();
    
    switch (message.type) {
      case 'game_started':
        // Server confirmed game started
        set({
          threshold: message.payload.config.concentrationThreshold,
        });
        break;
        
      case 'concentration_update':
        // Only process signals when game is playing
        if (state.status === 'playing') {
          get().processSignal(message.payload.signal);
        }
        break;
        
      case 'eeg_data':
        // Raw EEG data from LSL stream with bandpower (for dev mode)
        const eegPayload = message.payload as any;
        if (eegPayload) {
          const eegData = eegPayload.data || eegPayload;
          if (Array.isArray(eegData) && eegData.length > 0) {
            const average = eegData.reduce((sum: number, val: number) => sum + val, 0) / eegData.length;
            set({
              rawEegData: eegData,
              rawEegAverage: average,
              alphaPower: eegPayload.alpha_power ?? null,
              betaPower: eegPayload.beta_power ?? null,
              powerSum: eegPayload.power_sum ?? null,
            });
          }
        }
        break;
        
      case 'game_end':
        get().endGame();
        break;
    }
  });

  return {
    ...initialState,

    startGame: () => {
      const state = get();
      
      // Reset game state
      set({
        ...initialState,
        threshold: state.threshold,
        status: 'countdown',
        countdown: 3,
      });
      
      // Start countdown
      let count = 3;
      const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
          set({ countdown: count });
        } else {
          clearInterval(countdownInterval);
          
          // Start the actual game
          set({
            status: 'playing',
            startTime: Date.now(),
          });
          
          // Tell server to start sending signals
          websocketService.startGame(get().threshold);
          
          // Start the elapsed time timer
          get().startTimer();
        }
      }, 1000);
    },

    pauseGame: () => {
      const state = get();
      if (state.status !== 'playing') return;
      
      set({ status: 'paused' });
      get().stopTimer();
      websocketService.pauseGame();
    },

    resumeGame: () => {
      const state = get();
      if (state.status !== 'paused') return;
      
      set({ status: 'playing' });
      get().startTimer();
      websocketService.resumeGame();
    },

    endGame: () => {
      const state = get();
      
      get().stopTimer();
      websocketService.endGame();
      
      set({ status: 'finished' });
    },

    resetGame: () => {
      get().stopTimer();
      set({ ...initialState, threshold: get().threshold });
    },

    setThreshold: (threshold: 3 | 5) => {
      set({ threshold });
    },

    processSignal: (signal: ConcentrationSignal) => {
      const state = get();
      const isConcentrated = signal === 'Concentrated';
      
      // Update concentration history
      const newHistory = [...state.concentrationHistory, isConcentrated];
      
      if (isConcentrated) {
        // Increment streak
        const newStreak = state.concentrationStreak + 1;
        
        set({
          currentSignal: signal,
          concentrationStreak: newStreak,
          concentrationHistory: newHistory,
        });
        
        // Check if we should advance the car
        if (newStreak >= state.threshold) {
          get().advanceCar();
        }
      } else {
        // Reset streak on "Not Concentrated"
        set({
          currentSignal: signal,
          concentrationStreak: 0,
          concentrationHistory: newHistory,
        });
      }
    },

    advanceCar: () => {
      const state = get();
      const newPosition = Math.min(state.carPosition + gameConfig.advancePercentage, 100);
      const newAdvances = state.totalAdvances + 1;
      
      set({
        carPosition: newPosition,
        totalAdvances: newAdvances,
        concentrationStreak: 0, // Reset streak after advancement
      });
      
      // Send position update to server for multiplayer
      websocketService.send('update_position', {
        position: newPosition,
        status: newPosition >= 100 ? 'finished' : 'playing',
      });
      
      // Check if race is finished
      if (newPosition >= 100) {
        get().endGame();
      }
    },

    getResults: (): GameResults => {
      const state = get();
      const concentratedCount = state.concentrationHistory.filter(Boolean).length;
      const totalSignals = state.concentrationHistory.length;
      
      return {
        completionTime: state.elapsedTime,
        totalAdvances: state.totalAdvances,
        concentrationPercentage: totalSignals > 0 
          ? Math.round((concentratedCount / totalSignals) * 100) 
          : 0,
        concentrationHistory: state.concentrationHistory,
      };
    },

    startTimer: () => {
      const state = get();
      
      // Clear any existing timer
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
      }
      
      const interval = setInterval(() => {
        const currentState = get();
        if (currentState.status === 'playing' && currentState.startTime) {
          set({ elapsedTime: Date.now() - currentState.startTime });
        }
      }, 100); // Update every 100ms for smooth display
      
      set({ timerInterval: interval });
    },

    stopTimer: () => {
      const state = get();
      if (state.timerInterval) {
        clearInterval(state.timerInterval);
        set({ timerInterval: null });
      }
    },

    setCountdown: (value: number) => {
      set({ countdown: value });
    },

    setStatus: (status: GameStatus) => {
      set({ status });
    },

    setOpponentPosition: (position: number, status: 'idle' | 'playing' | 'finished') => {
      set({ opponentPosition: position, opponentStatus: status });
    },

    setMultiplayer: (enabled: boolean) => {
      set({ isMultiplayer: enabled });
      if (!enabled) {
        set({ opponentPosition: 0, opponentStatus: 'disconnected', isLocalReady: false, isOpponentReady: false });
      }
    },

    setLocalReady: (ready: boolean) => {
      set({ isLocalReady: ready });
      // Send ready state to own server (which broadcasts to opponent)
      websocketService.send('set_multiplayer_ready', { ready });
    },

    setOpponentReady: (ready: boolean) => {
      set({ isOpponentReady: ready });
    },
  };
});
