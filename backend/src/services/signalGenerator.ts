import { ConcentrationSignal } from '../types';

/**
 * Signal generation modes
 */
export type SignalMode = 
  | 'realistic'  // Simulates real focus patterns with streaks
  | 'random'     // Pure random 50/50
  | 'easy'       // Higher concentration probability (70%)
  | 'hard'       // Lower concentration probability (40%)
  | 'demo'       // Predictable pattern for demos
  | 'always_focused'    // Always concentrated (for testing)
  | 'always_unfocused'; // Never concentrated (for testing)

/**
 * Mock EEG Signal Generator
 * 
 * Generates synthetic concentration patterns for testing.
 * Supports multiple modes to simulate different scenarios.
 */
export class SignalGenerator {
  private mode: SignalMode = 'realistic';
  private concentrationProbability: number = 0.6;
  private inFocusStreak: boolean = false;
  private streakLength: number = 0;
  private maxStreakLength: number = 8;
  private minStreakLength: number = 2;
  
  // Demo mode state
  private demoCounter: number = 0;
  private demoPattern: ConcentrationSignal[] = [
    'Concentrated', 'Concentrated', 'Concentrated', 'Concentrated',
    'Not Concentrated', 'Not Concentrated',
    'Concentrated', 'Concentrated', 'Concentrated', 'Concentrated', 'Concentrated',
    'Not Concentrated',
    'Concentrated', 'Concentrated', 'Concentrated',
    'Not Concentrated', 'Not Concentrated', 'Not Concentrated',
  ];

  constructor(mode: SignalMode = 'realistic') {
    this.setMode(mode);
  }

  /**
   * Set the generation mode
   */
  setMode(mode: SignalMode): void {
    this.mode = mode;
    this.reset();
    
    // Set probability based on mode
    switch (mode) {
      case 'easy':
        this.concentrationProbability = 0.7;
        break;
      case 'hard':
        this.concentrationProbability = 0.4;
        break;
      case 'random':
        this.concentrationProbability = 0.5;
        break;
      case 'realistic':
      default:
        this.concentrationProbability = 0.6;
        break;
    }
    
    console.log(`Signal generator mode set to: ${mode}`);
  }

  /**
   * Get the current mode
   */
  getMode(): SignalMode {
    return this.mode;
  }

  /**
   * Generate the next concentration signal based on current mode
   */
  generateSignal(): ConcentrationSignal {
    switch (this.mode) {
      case 'always_focused':
        return 'Concentrated';
        
      case 'always_unfocused':
        return 'Not Concentrated';
        
      case 'demo':
        return this.generateDemoSignal();
        
      case 'random':
        return this.generateRandomSignal();
        
      case 'easy':
      case 'hard':
      case 'realistic':
      default:
        return this.generateRealisticSignal();
    }
  }

  /**
   * Generate a purely random signal (50/50)
   */
  private generateRandomSignal(): ConcentrationSignal {
    return Math.random() < this.concentrationProbability ? 'Concentrated' : 'Not Concentrated';
  }

  /**
   * Generate a demo signal following a predictable pattern
   */
  private generateDemoSignal(): ConcentrationSignal {
    const signal = this.demoPattern[this.demoCounter % this.demoPattern.length];
    this.demoCounter++;
    return signal;
  }

  /**
   * Generate a realistic signal with streaks
   */
  private generateRealisticSignal(): ConcentrationSignal {
    // If in a streak, continue it for a realistic duration
    if (this.inFocusStreak) {
      this.streakLength++;
      
      // End streak after random duration
      if (this.streakLength >= this.minStreakLength) {
        const endProbability = (this.streakLength - this.minStreakLength) / 
                              (this.maxStreakLength - this.minStreakLength);
        if (Math.random() < endProbability) {
          this.inFocusStreak = false;
          this.streakLength = 0;
          return 'Not Concentrated';
        }
      }
      
      return 'Concentrated';
    }

    // Not in a streak - decide whether to start one
    if (Math.random() < this.concentrationProbability) {
      this.inFocusStreak = true;
      this.streakLength = 1;
      return 'Concentrated';
    }

    return 'Not Concentrated';
  }

  /**
   * Set the probability of concentration (0-1)
   * Only affects realistic, easy, hard, and random modes
   */
  setConcentrationProbability(probability: number): void {
    this.concentrationProbability = Math.max(0, Math.min(1, probability));
  }

  /**
   * Reset the generator state
   */
  reset(): void {
    this.inFocusStreak = false;
    this.streakLength = 0;
    this.demoCounter = 0;
  }

  /**
   * Get available modes
   */
  static getAvailableModes(): SignalMode[] {
    return ['realistic', 'random', 'easy', 'hard', 'demo', 'always_focused', 'always_unfocused'];
  }
}

// Singleton instance - default to realistic mode, can be changed via env var
const defaultMode = (process.env.SIGNAL_MODE as SignalMode) || 'realistic';
export const signalGenerator = new SignalGenerator(defaultMode);
