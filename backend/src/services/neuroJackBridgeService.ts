import  WebSocket  from 'ws';
import { Server } from 'socket.io';

const EEG_SERVER_URL = 'ws://localhost:8765';

export class NeuroJackBridgeService {
  private ws: WebSocket | null = null;
  private io: Server | null = null;
  private reconnectMs = 2000;
  private isRunning = false;

  setSocketServer(io: Server) {
    this.io = io;
  }

  start() {
    this.isRunning = true;
    this.connect();
  }

  stop() {
    this.isRunning = false;
    this.ws?.close();
  }

  private connect() {
    if (!this.isRunning) return;
    console.log('[NeuroJack Bridge] Connecting to eeg_server.py...');

    this.ws = new WebSocket(EEG_SERVER_URL);

    this.ws.on('open', () => {
      console.log('[NeuroJack Bridge] Connected to eeg_server.py');
      this.reconnectMs = 2000;
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.type === 'eeg_prediction' && this.io) {
          // Emit as concentration_update so the mobile app game store handles it
          const signal = data.trigger ? 'slap' : 'baseline';
          const concentrationSignal = data.trigger ? 'Concentrated' : 'Not Concentrated';

          this.io.emit('message', {
            type: 'concentration_update',
            payload: {
              signal: concentrationSignal,
              timestamp: Date.now(),
              // Extra data for NeuroJack display
              p_slap: data.p_slap,
              ratio: data.ratio,
              trigger: data.trigger,
            },
          });

          // Also emit raw eeg_prediction for the slapjack game screen
          this.io.emit('neurojack_prediction', data);
        }
      } catch (e) { /* ignore */ }
    });

    this.ws.on('close', () => {
      console.log('[NeuroJack Bridge] Disconnected. Reconnecting...');
      setTimeout(() => this.connect(), this.reconnectMs);
      this.reconnectMs = Math.min(this.reconnectMs * 1.5, 15000);
    });

    this.ws.on('error', () => { /* onclose handles reconnect */ });
  }
}

export const neuroJackBridgeService = new NeuroJackBridgeService();