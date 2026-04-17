import { io, Socket } from 'socket.io-client';

interface OpponentPositionData {
  position: number;
  status: 'idle' | 'playing' | 'finished';
  timestamp: number;
}

interface OpponentReadyData {
  ready: boolean;
  timestamp: number;
}

type PositionHandler = (data: OpponentPositionData) => void;
type ReadyHandler = (data: OpponentReadyData) => void;
type ConnectionHandler = () => void;

class OpponentSocketService {
  private socket: Socket | null = null;
  private serverUrl: string | null = null;
  private positionHandlers: Set<PositionHandler> = new Set();
  private readyHandlers: Set<ReadyHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private isConnected = false;

  /**
   * Connect to opponent's server
   */
  connect(url: string): void {
    if (this.socket?.connected && this.serverUrl === url) {
      console.log('[Opponent] Already connected to:', url);
      return;
    }

    // Disconnect from previous server if different
    if (this.socket) {
      this.disconnect();
    }

    this.serverUrl = url;
    console.log(`[Opponent] Connecting to opponent server: ${url}`);

    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  /**
   * Disconnect from opponent's server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.emit('unsubscribe_opponent');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.serverUrl = null;
      console.log('[Opponent] Disconnected from opponent server');
    }
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current server URL
   */
  getServerUrl(): string | null {
    return this.serverUrl;
  }

  /**
   * Register handler for opponent position updates
   */
  onPosition(handler: PositionHandler): () => void {
    this.positionHandlers.add(handler);
    return () => this.positionHandlers.delete(handler);
  }

  /**
   * Register handler for opponent ready state updates
   */
  onReady(handler: ReadyHandler): () => void {
    this.readyHandlers.add(handler);
    return () => this.readyHandlers.delete(handler);
  }

  /**
   * Register handler for connection events
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * Register handler for disconnection events
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Opponent] Connected to opponent server');
      this.isConnected = true;
      
      // Subscribe to opponent position updates
      this.socket?.emit('subscribe_opponent');
      
      this.connectHandlers.forEach((handler) => handler());
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Opponent] Disconnected from opponent server:', reason);
      this.isConnected = false;
      this.disconnectHandlers.forEach((handler) => handler());
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Opponent] Connection error:', error.message);
      this.isConnected = false;
    });

    // Listen for opponent position updates
    this.socket.on('opponent_position', (data: OpponentPositionData) => {
      this.positionHandlers.forEach((handler) => handler(data));
    });

    // Listen for opponent ready state updates
    this.socket.on('opponent_ready', (data: OpponentReadyData) => {
      console.log('[Opponent] Ready state update:', data.ready);
      this.readyHandlers.forEach((handler) => handler(data));
    });
  }
}

// Singleton instance
export const opponentSocketService = new OpponentSocketService();
