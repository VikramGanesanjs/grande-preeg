import { create } from 'zustand';
import { websocketService } from '../services/websocket';
import { opponentSocketService } from '../services/opponentSocket';
import { colors } from '../constants/theme';

interface SlapjackMultiplayerState {
  isMultiplayer: boolean;
  isLocalReady: boolean;
  isOpponentReady: boolean;
  opponentScore: number;
  opponentStatus: 'disconnected' | 'idle' | 'playing' | 'finished';
  inLobby: boolean;
  lastSlapWinner: 'local' | 'opponent' | null;
}

interface SlapjackMultiplayerActions {
  setMultiplayer: (enabled: boolean) => void;
  setLocalReady: (ready: boolean) => void;
  setInLobby: (inLobby: boolean) => void;
  broadcastScore: (score: number) => void;
  resetMultiplayer: () => void;
}

const initialState: SlapjackMultiplayerState = {
  isMultiplayer: false,
  isLocalReady: false,
  isOpponentReady: false,
  opponentScore: 0,
  opponentStatus: 'disconnected',
  inLobby: true,
  lastSlapWinner: null,
};

export const useSlapjackMultiplayerStore = create<SlapjackMultiplayerState & SlapjackMultiplayerActions>((set, get) => {

  // Opponent connects to our server
  opponentSocketService.onConnect(() => {
    set({ opponentStatus: 'idle' });
  });

  opponentSocketService.onDisconnect(() => {
    set({ opponentStatus: 'disconnected', isOpponentReady: false });
  });

  // Opponent pressed Ready — comes via opponent_ready event
  opponentSocketService.onReady((data) => {
    set({ isOpponentReady: data.ready });
  });

  // Opponent score update — reusing opponent_position event
  // position field = their current score
  opponentSocketService.onPosition((data) => {
    set({
      opponentScore: data.position,
      opponentStatus: data.status,
      lastSlapWinner: 'opponent',
    });
  });

  return {
    ...initialState,

    setMultiplayer: (enabled) => {
      set({ isMultiplayer: enabled });
      if (!enabled) set({ ...initialState });
    },

    setLocalReady: (ready) => {
      set({ isLocalReady: ready });
      // Send to OUR server via websocketService — same as racing game
      websocketService.send('set_multiplayer_ready', { ready });
    },

    setInLobby: (inLobby) => set({ inLobby }),

    broadcastScore: (score) => {
      // Reuse update_position to broadcast score to opponent
      // Their server forwards this as opponent_position to the other player
      websocketService.send('update_position', {
        position: score,        // score as "position"
        status: 'playing',
      });
      set({ lastSlapWinner: 'local' });
    },

    resetMultiplayer: () => set({ ...initialState }),
  };
});