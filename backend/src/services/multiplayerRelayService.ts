import { Server } from 'socket.io';
import { Socket, io } from 'socket.io-client';

type PlayerStatus = 'idle' | 'playing' | 'finished';

interface MultiplayerRelayConfig {
  enabled: boolean;
  serverUrl: string;
  raceId: string;
  playerId: string;
}

class MultiplayerRelayService {
  private io: Server | null = null;
  private remoteSocket: Socket | null = null;
  private lastOpponentReady: boolean | null = null;
  private lastOpponentPosition: number | null = null;
  private lastOpponentStatus: PlayerStatus | 'disconnected' = 'disconnected';
  private config: MultiplayerRelayConfig = {
    enabled: !!process.env.MULTIPLAYER_SERVER_URL,
    serverUrl: process.env.MULTIPLAYER_SERVER_URL || '',
    raceId: process.env.MULTIPLAYER_RACE_ID || 'default-race',
    playerId: process.env.MULTIPLAYER_PLAYER_ID || 'player-local',
  };

  initialize(io: Server): void {
    this.io = io;
    if (this.config.enabled) {
      this.connectRemote();
    }
  }

  getConfig(): MultiplayerRelayConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<MultiplayerRelayConfig>): MultiplayerRelayConfig {
    this.config = {
      ...this.config,
      ...partial,
      serverUrl: (partial.serverUrl ?? this.config.serverUrl).trim().replace(/\/$/, ''),
    };

    if (!this.config.enabled) {
      this.disconnectRemote();
      this.broadcastDisconnectedOpponent();
      return this.getConfig();
    }

    this.connectRemote();
    return this.getConfig();
  }

  async pushLocalReady(ready: boolean): Promise<void> {
    if (!this.canSync() || !this.remoteSocket?.connected) return;
    this.remoteSocket.emit('player_ready', {
      raceId: this.config.raceId,
      playerId: this.config.playerId,
      ready,
    });
  }

  async pushLocalPosition(position: number, status: PlayerStatus): Promise<void> {
    if (!this.canSync() || !this.remoteSocket?.connected) return;
    this.remoteSocket.emit('player_position', {
      raceId: this.config.raceId,
      playerId: this.config.playerId,
      position,
      status,
    });
  }

  private canSync(): boolean {
    return this.config.enabled && !!this.config.serverUrl && !!this.config.raceId && !!this.config.playerId;
  }

  private connectRemote(): void {
    if (!this.canSync()) return;

    this.disconnectRemote();

    this.remoteSocket = io(this.config.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.remoteSocket.on('connect', () => {
      this.remoteSocket?.emit('join_race', {
        raceId: this.config.raceId,
        playerId: this.config.playerId,
      });
    });

    this.remoteSocket.on('disconnect', () => {
      this.broadcastDisconnectedOpponent();
    });

    this.remoteSocket.on(
      'opponent_state',
      (opponent: { position: number; status: PlayerStatus; ready: boolean } | null) => {
        if (opponent == null) {
          this.broadcastDisconnectedOpponent();
          return;
        }
        this.handleOpponentState(opponent);
      }
    );
  }

  private disconnectRemote(): void {
    if (this.remoteSocket) {
      this.remoteSocket.removeAllListeners();
      this.remoteSocket.disconnect();
      this.remoteSocket = null;
    }
  }

  private broadcastDisconnectedOpponent(): void {
    if (this.lastOpponentStatus !== 'disconnected') {
      this.lastOpponentStatus = 'disconnected';
      this.lastOpponentPosition = 0;
      this.lastOpponentReady = false;
      this.io?.emit('opponent_position', {
        position: 0,
        status: 'disconnected',
        timestamp: Date.now(),
      });
      this.io?.emit('opponent_ready', {
        ready: false,
        timestamp: Date.now(),
      });
    }
  }

  private handleOpponentState(opponent: { position: number; status: PlayerStatus; ready: boolean }): void {
    if (this.lastOpponentReady !== opponent.ready) {
      this.lastOpponentReady = opponent.ready;
      this.io?.emit('opponent_ready', {
        ready: opponent.ready,
        timestamp: Date.now(),
      });
    }

    const statusChanged = this.lastOpponentStatus !== opponent.status;
    const positionChanged = this.lastOpponentPosition !== opponent.position;
    if (statusChanged || positionChanged) {
      this.lastOpponentPosition = opponent.position;
      this.lastOpponentStatus = opponent.status;
      this.io?.emit('opponent_position', {
        position: opponent.position,
        status: opponent.status,
        timestamp: Date.now(),
      });
    }
  }
}

export const multiplayerRelayService = new MultiplayerRelayService();
