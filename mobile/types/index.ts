// Signal types
export type ConcentrationSignal = 'Concentrated' | 'Not Concentrated';

// Game status types
export type GameStatus = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished';

// Connection status types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// WebSocket message types (Server -> Client)
export interface ConcentrationUpdateMessage {
  type: 'concentration_update';
  payload: {
    signal: ConcentrationSignal;
    timestamp: number;
  };
}

export interface GameStartedMessage {
  type: 'game_started';
  payload: {
    timestamp: number;
    config: {
      concentrationThreshold: 3 | 5;
      updateFrequency: number;
    };
  };
}

export interface GameEndedMessage {
  type: 'game_end';
  payload: {
    timestamp: number;
    winner: 'self' | 'opponent' | null;
  };
}

export interface PongMessage {
  type: 'pong';
  payload: {
    timestamp: number;
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    code: string;
    message: string;
  };
}

export interface EEGDataMessage {
  type: 'eeg_data';
  payload: number[]; // Array of 8 numbers
}

// Union type for all server messages
export type ServerMessage =
  | ConcentrationUpdateMessage
  | GameStartedMessage
  | GameEndedMessage
  | PongMessage
  | ErrorMessage
  | EEGDataMessage;

// Game results
export interface GameResults {
  completionTime: number;
  totalAdvances: number;
  concentrationPercentage: number;
  concentrationHistory: boolean[];
}
