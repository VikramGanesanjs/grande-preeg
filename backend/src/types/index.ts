// Signal types
export type ConcentrationSignal = 'Concentrated' | 'Not Concentrated';

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

// WebSocket message types (Client -> Server)
export interface JoinSessionMessage {
  type: 'join_session';
  payload: {
    sessionId?: string;
    mode: 'single' | 'two_player';
    playerId: string;
  };
}

export interface StartGameMessage {
  type: 'start_game';
  payload: {
    playerId: string;
    config: {
      concentrationThreshold: 3 | 5;
    };
  };
}

export interface PauseGameMessage {
  type: 'pause_game';
  payload: {
    playerId: string;
  };
}

export interface ResumeGameMessage {
  type: 'resume_game';
  payload: {
    playerId: string;
  };
}

export interface EndGameMessage {
  type: 'end_game';
  payload: {
    playerId: string;
  };
}

export interface PingMessage {
  type: 'ping';
  payload: {
    timestamp: number;
  };
}

// Union types
export type ServerMessage =
  | ConcentrationUpdateMessage
  | GameStartedMessage
  | GameEndedMessage
  | PongMessage
  | ErrorMessage;

export type ClientMessage =
  | JoinSessionMessage
  | StartGameMessage
  | PauseGameMessage
  | ResumeGameMessage
  | EndGameMessage
  | PingMessage;

// Session state
export interface GameSession {
  sessionId: string;
  playerId: string;
  mode: 'single' | 'two_player';
  config: {
    concentrationThreshold: 3 | 5;
    updateFrequency: number;
  };
  status: 'waiting' | 'active' | 'paused' | 'completed';
  signalInterval?: NodeJS.Timeout;
}
