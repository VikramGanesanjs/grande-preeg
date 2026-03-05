import { io, Socket } from 'socket.io-client';
import { ServerMessage } from '../types';

// Default server URL (can be changed in settings)
import Constants from 'expo-constants';

// Grab the Expo bundler's URI (e.g., "192.168.137.1:8081")
const debuggerHost = Constants.expoConfig?.hostUri;

// Strip the Expo port and attach the Node.js server's port (3001)
const computerIp = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';
const DEFAULT_SERVER_URL = `http://${computerIp}:3001`;

type MessageHandler = (message: ServerMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private serverUrl: string = DEFAULT_SERVER_URL;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private pingInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to the WebSocket server
   */
  connect(url?: string): void {
    if (url) {
      this.serverUrl = url;
    }

    if (this.socket?.connected) {
      console.log('Already connected');
      return;
    }

    console.log(`Connecting to ${this.serverUrl}...`);

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.stopPingInterval();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.reconnectAttempts = 0;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Send a message to the server
   */
  send(type: string, payload: any): void {
    if (!this.socket?.connected) {
      console.warn('Cannot send message: not connected');
      return;
    }

    this.socket.emit('message', { type, payload });
  }

  /**
   * Start a game session
   */
  startGame(threshold: 3 | 5): void {
    this.send('start_game', {
      playerId: this.socket?.id,
      config: { concentrationThreshold: threshold },
    });
  }

  /**
   * Pause the current game
   */
  pauseGame(): void {
    this.send('pause_game', { playerId: this.socket?.id });
  }

  /**
   * Resume the current game
   */
  resumeGame(): void {
    this.send('resume_game', { playerId: this.socket?.id });
  }

  /**
   * End the current game
   */
  endGame(): void {
    this.send('end_game', { playerId: this.socket?.id });
  }

  /**
   * Register a message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Register a connection handler
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * Register a disconnection handler
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /**
   * Register an error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Get the current server URL
   */
  getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Set the server URL
   */
  setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  /**
   * Get reconnection attempts
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.connectHandlers.forEach((handler) => handler());
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.stopPingInterval();
      this.disconnectHandlers.forEach((handler) => handler());
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      this.reconnectAttempts++;
      this.errorHandlers.forEach((handler) => handler(error));
    });

    this.socket.on('message', (data: ServerMessage) => {
      this.messageHandlers.forEach((handler) => handler(data));
    });

    this.socket.on('eeg_data', (payload: { data: number[] }) => {
      const serverMsg = { type: 'eeg_data', payload: payload.data } as ServerMessage;
      this.messageHandlers.forEach((handler) => handler(serverMsg));
    });
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Send ping every 5 seconds
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, 5000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
