import { Server, Socket } from 'socket.io';
import { signalGenerator, SignalGenerator, SignalMode } from '../services/signalGenerator';
import {
  GameSession,
  ConcentrationUpdateMessage,
  GameStartedMessage,
  GameEndedMessage,
  PongMessage,
  ErrorMessage,
} from '../types';

// Store active sessions
const sessions = new Map<string, GameSession>();

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Start sending concentration signals to a player
 */
function startSignalStream(socket: Socket, session: GameSession): void {
  // Clear any existing interval
  if (session.signalInterval) {
    clearInterval(session.signalInterval);
  }

  // Reset signal generator for fresh game
  signalGenerator.reset();

  // Start sending signals at configured frequency
  session.signalInterval = setInterval(() => {
    if (session.status !== 'active') return;

    const signal = signalGenerator.generateSignal();
    const message: ConcentrationUpdateMessage = {
      type: 'concentration_update',
      payload: {
        signal,
        timestamp: Date.now(),
      },
    };

    socket.emit('message', message);
  }, session.config.updateFrequency);
}

/**
 * Stop sending concentration signals
 */
function stopSignalStream(session: GameSession): void {
  if (session.signalInterval) {
    clearInterval(session.signalInterval);
    session.signalInterval = undefined;
  }
}

/**
 * Set up game event handlers for a socket connection
 */
export function setupGameHandlers(io: Server, socket: Socket): void {
  console.log(`Client connected: ${socket.id}`);

  // Handle incoming messages
  socket.on('message', (data: any) => {
    try {
      handleMessage(socket, data);
    } catch (error) {
      console.error('Error handling message:', error);
      const errorMessage: ErrorMessage = {
        type: 'error',
        payload: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred processing your request',
        },
      };
      socket.emit('message', errorMessage);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Clean up any sessions for this socket
    for (const [sessionId, session] of sessions.entries()) {
      if (session.playerId === socket.id) {
        stopSignalStream(session);
        sessions.delete(sessionId);
        console.log(`Cleaned up session: ${sessionId}`);
      }
    }
  });
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(socket: Socket, data: any): void {
  const { type, payload } = data;

  switch (type) {
    case 'start_game':
      handleStartGame(socket, payload);
      break;

    case 'pause_game':
      handlePauseGame(socket, payload);
      break;

    case 'resume_game':
      handleResumeGame(socket, payload);
      break;

    case 'end_game':
      handleEndGame(socket, payload);
      break;

    case 'ping':
      handlePing(socket, payload);
      break;

    case 'set_signal_mode':
      handleSetSignalMode(socket, payload);
      break;

    case 'get_signal_mode':
      handleGetSignalMode(socket);
      break;

    default:
      console.warn(`Unknown message type: ${type}`);
  }
}

/**
 * Handle game start request
 */
function handleStartGame(socket: Socket, payload: any): void {
  const { config } = payload;
  const sessionId = generateSessionId();

  const session: GameSession = {
    sessionId,
    playerId: socket.id,
    mode: 'single',
    config: {
      concentrationThreshold: config?.concentrationThreshold || 3,
      updateFrequency: 500, // 500ms default
    },
    status: 'active',
  };

  sessions.set(sessionId, session);

  // Send game started confirmation
  const startedMessage: GameStartedMessage = {
    type: 'game_started',
    payload: {
      timestamp: Date.now(),
      config: session.config,
    },
  };
  socket.emit('message', startedMessage);

  // Start signal stream
  startSignalStream(socket, session);

  console.log(`Game started: ${sessionId} with threshold ${session.config.concentrationThreshold}`);
}

/**
 * Handle game pause request
 */
function handlePauseGame(socket: Socket, payload: any): void {
  const session = findSessionBySocket(socket.id);
  if (!session) {
    sendError(socket, 'NO_SESSION', 'No active game session found');
    return;
  }

  session.status = 'paused';
  stopSignalStream(session);
  console.log(`Game paused: ${session.sessionId}`);
}

/**
 * Handle game resume request
 */
function handleResumeGame(socket: Socket, payload: any): void {
  const session = findSessionBySocket(socket.id);
  if (!session) {
    sendError(socket, 'NO_SESSION', 'No active game session found');
    return;
  }

  session.status = 'active';
  startSignalStream(socket, session);
  console.log(`Game resumed: ${session.sessionId}`);
}

/**
 * Handle game end request
 */
function handleEndGame(socket: Socket, payload: any): void {
  const session = findSessionBySocket(socket.id);
  if (!session) {
    sendError(socket, 'NO_SESSION', 'No active game session found');
    return;
  }

  session.status = 'completed';
  stopSignalStream(session);

  const endMessage: GameEndedMessage = {
    type: 'game_end',
    payload: {
      timestamp: Date.now(),
      winner: null,
    },
  };
  socket.emit('message', endMessage);

  // Clean up session
  sessions.delete(session.sessionId);
  console.log(`Game ended: ${session.sessionId}`);
}

/**
 * Handle ping request (heartbeat)
 */
function handlePing(socket: Socket, payload: any): void {
  const pongMessage: PongMessage = {
    type: 'pong',
    payload: {
      timestamp: Date.now(),
    },
  };
  socket.emit('message', pongMessage);
}

/**
 * Find a session by socket ID
 */
function findSessionBySocket(socketId: string): GameSession | undefined {
  for (const session of sessions.values()) {
    if (session.playerId === socketId) {
      return session;
    }
  }
  return undefined;
}

/**
 * Handle set signal mode request
 */
function handleSetSignalMode(socket: Socket, payload: any): void {
  const { mode } = payload;
  
  if (!mode) {
    sendError(socket, 'INVALID_MODE', 'Mode is required');
    return;
  }
  
  const availableModes = SignalGenerator.getAvailableModes();
  if (!availableModes.includes(mode)) {
    sendError(socket, 'INVALID_MODE', `Invalid mode. Available: ${availableModes.join(', ')}`);
    return;
  }
  
  signalGenerator.setMode(mode as SignalMode);
  
  socket.emit('message', {
    type: 'signal_mode_changed',
    payload: {
      mode: signalGenerator.getMode(),
      availableModes,
    },
  });
  
  console.log(`Signal mode changed to: ${mode}`);
}

/**
 * Handle get signal mode request
 */
function handleGetSignalMode(socket: Socket): void {
  socket.emit('message', {
    type: 'signal_mode_info',
    payload: {
      mode: signalGenerator.getMode(),
      availableModes: SignalGenerator.getAvailableModes(),
    },
  });
}

/**
 * Send an error message
 */
function sendError(socket: Socket, code: string, message: string): void {
  const errorMessage: ErrorMessage = {
    type: 'error',
    payload: { code, message },
  };
  socket.emit('message', errorMessage);
}
