import { create } from 'zustand';
import { websocketService } from '../services/websocket';
import { ConnectionStatus } from '../types';

interface ConnectionState {
  status: ConnectionStatus;
  serverUrl: string;
  reconnectAttempts: number;
  lastPingTime: number | null;
  error: string | null;
}

interface ConnectionActions {
  connect: (url?: string) => void;
  disconnect: () => void;
  setServerUrl: (url: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  updatePingTime: () => void;
}

type ConnectionStore = ConnectionState & ConnectionActions;

export const useConnectionStore = create<ConnectionStore>((set, get) => {
  // Set up WebSocket event handlers
  websocketService.onConnect(() => {
    set({ status: 'connected', error: null, reconnectAttempts: 0 });
  });

  websocketService.onDisconnect(() => {
    set({ status: 'disconnected' });
  });

  websocketService.onError((error) => {
    set({
      status: 'error',
      error: error.message,
      reconnectAttempts: websocketService.getReconnectAttempts(),
    });
  });

  websocketService.onMessage((message) => {
    if (message.type === 'pong') {
      set({ lastPingTime: Date.now() });
    }
  });

  return {
    // Initial state
    status: 'disconnected',
    serverUrl: websocketService.getServerUrl(),
    reconnectAttempts: 0,
    lastPingTime: null,
    error: null,

    // Actions
    connect: (url?: string) => {
      set({ status: 'connecting', error: null });
      websocketService.connect(url);
    },

    disconnect: () => {
      websocketService.disconnect();
      set({ status: 'disconnected', error: null });
    },

    setServerUrl: (url: string) => {
      websocketService.setServerUrl(url);
      set({ serverUrl: url });
    },

    setStatus: (status: ConnectionStatus) => {
      set({ status });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    updatePingTime: () => {
      set({ lastPingTime: Date.now() });
    },
  };
});
