import { spawn, ChildProcess } from 'child_process';
import { Server } from 'socket.io';
import * as path from 'path';
import * as readline from 'readline';
import * as fs from 'fs';

/**
 * LSL Stream configuration
 */
export interface LslConfig {
  // LSL connection
  sourceType: string;
  sourceValue: string;
  timeout: number;
  pythonPath: string;
  
  // Signal processing (no downsampling - process at native rate)
  sampleRate: number;
  windowDuration: number;
  outputInterval: number;
  numEegChannels: number;
  
  // Frequency bands
  alphaLow: number;
  alphaHigh: number;
  betaLow: number;
  betaHigh: number;
  
  // Thresholds
  alphaThreshold: number;
  betaThreshold: number;
}

/**
 * Default configuration
 */
/**
 * Get default Python path - reads env var at runtime, not module load time
 */
function getDefaultPythonPath(): string {
  return process.env.PYTHON_PATH || 'python';
}

export const DEFAULT_LSL_CONFIG: LslConfig = {
  // LSL connection
  sourceType: 'type',
  sourceValue: 'Data',
  timeout: 10,
  pythonPath: '', // Will be set at runtime via getDefaultPythonPath()
  
  // Signal processing - process at native rate, output at reduced frequency
  sampleRate: 250,          // Native sample rate (auto-detected from stream)
  windowDuration: 1.0,      // 1 second window for bandpower calculation
  outputInterval: 0.2,      // Output every 200ms (5 Hz) to client
  numEegChannels: 8,
  
  // Frequency bands (Hz)
  alphaLow: 8,
  alphaHigh: 12,
  betaLow: 13,
  betaHigh: 30,
  
  // Thresholds for sum of alpha + beta power
  // Concentrated when: alphaThreshold < (alpha + beta) < betaThreshold
  alphaThreshold: 30.0,  // Min sum threshold
  betaThreshold: 50.0,   // Max sum threshold
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
  // Signal processing results
  alpha_power?: number;
  beta_power?: number;
  power_sum?: number;
  mean_eeg?: number;
  signal?: 'Concentrated' | 'Not Concentrated';
}

/**
 * LSL Service - Manages connection to LSL EEG stream via Python subprocess
 * 
 * Spawns a Python process that:
 * 1. Reads raw EEG data from LSL stream
 * 2. Downsamples from native rate (250 Hz) to target rate (50 Hz)
 * 3. Applies Hilbert transform to extract alpha and beta bandpower
 * 4. Determines concentration state based on thresholds
 * 5. Outputs processed signals at configured interval (e.g., 5 Hz)
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
    // Apply runtime default for pythonPath if not explicitly set
    if (!this.config.pythonPath) {
      this.config.pythonPath = getDefaultPythonPath();
    }
    console.log('[LSL] Python path configured:', this.config.pythonPath, '(from env:', process.env.PYTHON_PATH || 'not set', ')');
  }

  /**
   * Get the path to the Python script
   */
  private getScriptPath(): string {
    const possiblePaths = [
      path.join(__dirname, '../../scripts/lsl_reader.py'),
      path.join(__dirname, '../../../scripts/lsl_reader.py'),
      path.join(process.cwd(), 'scripts/lsl_reader.py'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return possiblePaths[0];
  }

  /**
   * Set the Socket.IO server instance for emitting data
   */
  setSocketServer(io: Server): void {
    this.io = io;
  }

  /**
   * Start the Python LSL reader subprocess
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.warn('[LSL] Service is already running');
      return true;
    }

    console.log('\n[LSL] Starting Python LSL reader with signal processing...');

    return new Promise((resolve) => {
      const scriptPath = this.getScriptPath();
      
      console.log('[LSL] Python path:', this.config.pythonPath);
      console.log('[LSL] Script path:', scriptPath);
      console.log('[LSL] Script exists:', fs.existsSync(scriptPath));
      
      if (!fs.existsSync(scriptPath)) {
        console.error('[LSL] ERROR: Python script not found at:', scriptPath);
        resolve(false);
        return;
      }
      
      const args = [
        scriptPath,
        '--source-type', this.config.sourceType,
        '--source-value', this.config.sourceValue,
        '--timeout', this.config.timeout.toString(),
        '--sample-rate', this.config.sampleRate.toString(),
        '--window', this.config.windowDuration.toString(),
        '--interval', this.config.outputInterval.toString(),
        '--channels', this.config.numEegChannels.toString(),
        '--alpha-low', this.config.alphaLow.toString(),
        '--alpha-high', this.config.alphaHigh.toString(),
        '--beta-low', this.config.betaLow.toString(),
        '--beta-high', this.config.betaHigh.toString(),
        '--alpha-threshold', this.config.alphaThreshold.toString(),
        '--beta-threshold', this.config.betaThreshold.toString(),
      ];

      console.log('[LSL] Config:', {
        sampleRate: this.config.sampleRate,
        outputInterval: this.config.outputInterval,
        windowDuration: this.config.windowDuration,
        alphaThreshold: this.config.alphaThreshold,
        betaThreshold: this.config.betaThreshold,
      });

      console.log('[LSL] Running command:', this.config.pythonPath, args.join(' '));

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

      const rl = readline.createInterface({
        input: this.pythonProcess.stdout!,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        this.handlePythonMessage(line, resolveOnce);
      });

      let stderrBuffer = '';
      this.pythonProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        stderrBuffer += message;
        const trimmed = message.trim();
        if (trimmed) {
          console.error('[LSL Python stderr]', trimmed);
        }
      });

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
        console.error('[LSL] Make sure Python 3, pylsl, scipy, and numpy are installed');
        this.isRunning = false;
        resolveOnce(false);
      });

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
            // Log processed signal data with power sum
            const powerSum = message.power_sum ?? ((message.alpha_power ?? 0) + (message.beta_power ?? 0));
            console.log(`[LSL] Sum: ${powerSum.toFixed(2)} (α:${message.alpha_power?.toFixed(2)} + β:${message.beta_power?.toFixed(2)}) | Signal: ${message.signal}`);
            
            // Emit raw EEG data for dev mode display
            this.io.emit('eeg_data', {
              data: message.data,
              alpha_power: message.alpha_power,
              beta_power: message.beta_power,
              power_sum: powerSum,
              timestamp: message.timestamp || Date.now(),
            });
            
            // Emit concentration signal for game logic
            if (message.signal) {
              this.io.emit('message', {
                type: 'concentration_update',
                payload: {
                  signal: message.signal,
                  timestamp: message.timestamp || Date.now(),
                  alpha_power: message.alpha_power,
                  beta_power: message.beta_power,
                  power_sum: powerSum,
                },
              });
            }
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
