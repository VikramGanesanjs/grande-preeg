import { spawn, ChildProcess } from 'child_process';
import { Server } from 'socket.io';
import * as path from 'path';
import * as readline from 'readline';
import * as fs from 'fs';

/**
 * LSL Stream configuration
 */
export interface LslConfig {
  sourceType: string;
  sourceValue: string;
  numEegChannels: number;
  timeout: number;
  pythonPath: string;
}

/**
 * Default configuration matching the Unicorn headset
 */
export const DEFAULT_LSL_CONFIG: LslConfig = {
  sourceType: 'type',
  sourceValue: 'Data',
  numEegChannels: 8,
  timeout: 10,
  pythonPath: 'python3',
};

/**
 * Message types from the Python LSL reader
 */
interface LslMessage {
  type: 'data' | 'status' | 'error' | 'ready';
  data?: number[];
  timestamp?: number;
  message?: string;
  stream_name?: string;
  stream_type?: string;
  channel_count?: number;
  sample_rate?: number;
}

/**
 * LSL Service - Manages connection to LSL EEG stream via Python subprocess
 * 
 * Spawns a Python process that uses pylsl to read EEG data from the LSL stream.
 * The Python script outputs JSON messages to stdout which this service parses
 * and emits via Socket.IO to connected clients.
 */
export class LslService {
  private pythonProcess: ChildProcess | null = null;
  private io: Server | null = null;
  private config: LslConfig;
  private isRunning = false;
  private streamInfo: {
    name?: string;
    type?: string;
    channelCount?: number;
    sampleRate?: number;
  } = {};

  constructor(config: Partial<LslConfig> = {}) {
    this.config = { ...DEFAULT_LSL_CONFIG, ...config };
  }

  /**
   * Set the Socket.IO server instance for emitting data
   */
  setSocketServer(io: Server): void {
    this.io = io;
  }

  /**
   * Get the path to the Python script
   */
  private getScriptPath(): string {
    // Try multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '../../scripts/lsl_reader.py'),  // When running from src/
      path.join(__dirname, '../../../scripts/lsl_reader.py'),  // When running from dist/
      path.join(process.cwd(), 'scripts/lsl_reader.py'),  // Relative to working dir
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Default to first option
    return possiblePaths[0];
  }

  /**
   * Start the Python LSL reader subprocess
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.warn('[LSL] Service is already running');
      return true;
    }

    console.log('\n[LSL] Starting Python LSL reader...');

    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath();
      
      console.log('[LSL] Python path:', this.config.pythonPath);
      console.log('[LSL] Script path:', scriptPath);
      console.log('[LSL] Script exists:', fs.existsSync(scriptPath));
      console.log('[LSL] Current dir:', process.cwd());
      console.log('[LSL] __dirname:', __dirname);
      
      if (!fs.existsSync(scriptPath)) {
        console.error('[LSL] ERROR: Python script not found at:', scriptPath);
        resolve(false);
        return;
      }
      
      const args = [
        scriptPath,
        '--source-type', this.config.sourceType,
        '--source-value', this.config.sourceValue,
        '--channels', this.config.numEegChannels.toString(),
        '--timeout', this.config.timeout.toString(),
      ];

      console.log('[LSL] Spawning Python with args:', args.join(' '));

      this.pythonProcess = spawn(this.config.pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let resolved = false;
      const resolveOnce = (value: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(value);
        }
      };

      // Set up readline to parse JSON messages from Python stdout
      const rl = readline.createInterface({
        input: this.pythonProcess.stdout!,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        this.handlePythonMessage(line, resolveOnce);
      });

      // Handle stderr for debugging
      let stderrBuffer = '';
      this.pythonProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        stderrBuffer += message;
        const trimmed = message.trim();
        if (trimmed) {
          console.error('[LSL Python stderr]', trimmed);
        }
      });

      // Handle process exit
      this.pythonProcess.on('close', (code) => {
        console.log(`[LSL] Python process exited with code ${code}`);
        if (stderrBuffer.trim()) {
          console.error('[LSL] Full stderr output:', stderrBuffer);
        }
        this.isRunning = false;
        this.pythonProcess = null;
        resolveOnce(false);
      });

      this.pythonProcess.on('error', (err) => {
        console.error('[LSL] Failed to start Python process:', err.message);
        console.error('[LSL] Make sure Python 3 is installed and accessible');
        console.error('[LSL] Try: which python3 (or where python on Windows)');
        this.isRunning = false;
        resolveOnce(false);
      });

      // Timeout for stream discovery
      setTimeout(() => {
        if (!resolved) {
          console.error('[LSL] Timeout waiting for LSL stream');
          this.stop();
          resolveOnce(false);
        }
      }, (this.config.timeout + 5) * 1000);
    });
  }

  /**
   * Handle messages from the Python subprocess
   */
  private handlePythonMessage(line: string, onReady?: (success: boolean) => void): void {
    try {
      const message: LslMessage = JSON.parse(line);

      switch (message.type) {
        case 'status':
          console.log('[LSL]', message.message);
          if (message.stream_name) {
            this.streamInfo = {
              name: message.stream_name,
              type: message.stream_type,
              channelCount: message.channel_count,
              sampleRate: message.sample_rate,
            };
            console.log('[LSL] Stream info:', this.streamInfo);
          }
          break;

        case 'ready':
          console.log('[LSL]', message.message);
          this.isRunning = true;
          onReady?.(true);
          break;

        case 'data':
          if (this.io && message.data) {
            this.io.emit('eeg_data', {
              data: message.data,
              timestamp: message.timestamp || Date.now(),
            });
          }
          break;

        case 'error':
          console.error('[LSL] Error:', message.message);
          onReady?.(false);
          break;

        default:
          console.warn('[LSL] Unknown message type:', message);
      }
    } catch (err) {
      console.warn('[LSL] Failed to parse message:', line);
    }
  }

  /**
   * Stop the Python LSL reader subprocess
   */
  stop(): void {
    if (this.pythonProcess) {
      console.log('[LSL] Stopping Python LSL reader...');
      this.pythonProcess.kill('SIGTERM');
      this.pythonProcess = null;
      this.isRunning = false;
      this.streamInfo = {};
      console.log('[LSL] LSL stream stopped');
    }
  }

  /**
   * Check if the service is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get current configuration
   */
  getConfig(): LslConfig {
    return { ...this.config };
  }

  /**
   * Get stream information (available after connection)
   */
  getStreamInfo(): typeof this.streamInfo {
    return { ...this.streamInfo };
  }

  /**
   * Update configuration (requires restart to take effect)
   */
  updateConfig(config: Partial<LslConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[LSL] Configuration updated. Restart service to apply changes.');
  }
}

// Singleton instance
export const lslService = new LslService();
