#!/usr/bin/env python3
"""
LSL EEG Reader with Signal Processing

This script reads EEG data from an LSL stream, applies signal processing to extract
alpha and beta bandpower, and outputs concentration signals based on thresholds.

Signal Processing Pipeline:
1. Collect samples at native rate (e.g., 250 Hz) - NO downsampling
2. Apply bandpass filtering for alpha (8-12 Hz) and beta (13-30 Hz)
3. Use Hilbert transform to extract signal envelope (instantaneous amplitude)
4. Calculate bandpower as mean squared amplitude
5. Compare to thresholds to determine concentration state
6. Output at reduced frequency to avoid overwhelming the client

Output format (one JSON object per line):
    {"type": "data", "data": [...], "alpha_power": 1.23, "beta_power": 4.56, "signal": "Concentrated"}
    {"type": "status", "message": "..."}
    {"type": "error", "message": "..."}
"""

import sys
import json
import time
import argparse
import numpy as np
from collections import deque
from pylsl import StreamInlet, resolve_byprop

try:
    from scipy.signal import butter, filtfilt, hilbert
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print(json.dumps({"type": "error", "message": "scipy not installed. Run: pip install scipy"}), flush=True)
    sys.exit(1)


def send_message(msg_type: str, **kwargs):
    """Send a JSON message to stdout for Node.js to consume."""
    message = {"type": msg_type, **kwargs}
    print(json.dumps(message), flush=True)


def butter_bandpass(lowcut: float, highcut: float, fs: float, order: int = 4):
    """Design a Butterworth bandpass filter."""
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    
    # Clamp to valid range (0, 1)
    low = max(0.001, min(0.999, low))
    high = max(0.001, min(0.999, high))
    
    if low >= high:
        raise ValueError(f"Invalid frequency range: {lowcut}-{highcut} Hz for sample rate {fs} Hz")
    
    b, a = butter(order, [low, high], btype='band')
    return b, a


def bandpass_filter(data: np.ndarray, lowcut: float, highcut: float, fs: float, order: int = 4):
    """Apply bandpass filter to data."""
    b, a = butter_bandpass(lowcut, highcut, fs, order)
    return filtfilt(b, a, data, axis=0)


def compute_bandpower(data: np.ndarray, fs: float, low_freq: float, high_freq: float) -> float:
    """
    Compute bandpower using Hilbert transform.
    
    1. Bandpass filter the signal
    2. Apply Hilbert transform to get analytic signal
    3. Compute instantaneous amplitude (envelope)
    4. Return mean squared amplitude as power
    """
    try:
        # Bandpass filter
        filtered = bandpass_filter(data, low_freq, high_freq, fs)
        
        # Hilbert transform to get envelope
        analytic_signal = hilbert(filtered, axis=0)
        envelope = np.abs(analytic_signal)
        
        # Bandpower as mean squared amplitude
        power = np.mean(envelope ** 2)
        return float(power)
    except Exception as e:
        # Return 0 if filtering fails
        return 0.0


class EEGProcessor:
    """
    Process EEG data at native sample rate, output at reduced frequency.
    
    No downsampling - processes at full native rate (e.g., 250 Hz) to preserve
    frequency content for bandpass filtering, but only outputs to client at
    reduced interval (e.g., every 0.2s = 5 Hz output).
    """
    
    def __init__(
        self,
        sample_rate: float = 250.0,
        window_duration: float = 1.0,
        output_interval: float = 0.2,
        alpha_low: float = 8.0,
        alpha_high: float = 12.0,
        beta_low: float = 13.0,
        beta_high: float = 30.0,
        alpha_threshold: float = 1.0,
        beta_threshold: float = 1.0,
        num_channels: int = 8,
    ):
        self.sample_rate = sample_rate
        self.window_duration = window_duration
        self.output_interval = output_interval
        
        # Frequency bands
        self.alpha_low = alpha_low
        self.alpha_high = alpha_high
        self.beta_low = beta_low
        self.beta_high = beta_high
        
        # Thresholds
        self.alpha_threshold = alpha_threshold
        self.beta_threshold = beta_threshold
        
        self.num_channels = num_channels
        
        # Calculate buffer sizes at native rate
        self.window_samples = int(sample_rate * window_duration)
        self.output_samples = int(sample_rate * output_interval)
        
        # Buffer for processing (sliding window at native rate)
        self.process_buffer = deque(maxlen=self.window_samples)
        
        # Counter for output timing
        self.samples_since_output = 0
        
        # Validate frequency bands against Nyquist
        nyquist = sample_rate / 2
        if self.beta_high > nyquist:
            send_message("status", 
                         message=f"Warning: Beta high ({self.beta_high} Hz) exceeds Nyquist ({nyquist} Hz). Clamping to {nyquist - 1} Hz")
            self.beta_high = nyquist - 1
        
        send_message("status", 
                     message=f"EEG Processor initialized",
                     sample_rate=sample_rate,
                     window_duration=window_duration,
                     output_interval=output_interval,
                     window_samples=self.window_samples,
                     output_samples=self.output_samples,
                     nyquist=nyquist)
    
    def add_sample(self, sample: list) -> dict | None:
        """
        Add a sample and return processed result if output interval reached.
        
        Returns None if not enough data or not time to output yet.
        """
        # Add to buffer at native rate
        self.process_buffer.append(sample[:self.num_channels])
        self.samples_since_output += 1
        
        # Check if we should output
        if self.samples_since_output >= self.output_samples and len(self.process_buffer) >= self.window_samples:
            self.samples_since_output = 0
            return self.process_window()
        
        return None
    
    def process_window(self) -> dict:
        """Process the current window and return results."""
        # Convert buffer to numpy array
        data = np.array(list(self.process_buffer))  # Shape: (window_samples, num_channels)
        
        # Average across channels for bandpower calculation
        avg_signal = np.mean(data, axis=1)
        
        # Compute bandpower at native sample rate
        alpha_power = compute_bandpower(avg_signal, self.sample_rate, self.alpha_low, self.alpha_high)
        beta_power = compute_bandpower(avg_signal, self.sample_rate, self.beta_low, self.beta_high)
        
        # Determine concentration state
        is_concentrated = (alpha_power > self.alpha_threshold) or (beta_power > self.beta_threshold)
        signal = "Concentrated" if is_concentrated else "Not Concentrated"
        
        # Get latest sample for raw data display
        latest_sample = data[-1].tolist()
        
        # Calculate mean for logging
        mean_eeg = float(np.mean(latest_sample))
        
        return {
            "data": latest_sample,
            "mean_eeg": mean_eeg,
            "alpha_power": alpha_power,
            "beta_power": beta_power,
            "signal": signal,
            "is_concentrated": is_concentrated,
        }


def main():
    parser = argparse.ArgumentParser(description='Read and process EEG data from LSL stream')
    
    # LSL connection settings
    parser.add_argument('--source-type', default='type', 
                        help='Property type to search for (default: type)')
    parser.add_argument('--source-value', default='Data',
                        help='Property value to search for (default: Data)')
    parser.add_argument('--timeout', type=float, default=10.0,
                        help='Stream discovery timeout in seconds (default: 10)')
    
    # Signal processing settings
    parser.add_argument('--sample-rate', type=float, default=250.0,
                        help='Sample rate of LSL stream in Hz (default: 250, auto-detected if available)')
    parser.add_argument('--window', type=float, default=1.0,
                        help='Window duration in seconds for bandpower calculation (default: 1.0)')
    parser.add_argument('--interval', type=float, default=0.2,
                        help='Output interval in seconds (default: 0.2)')
    parser.add_argument('--channels', type=int, default=8,
                        help='Number of EEG channels to process (default: 8)')
    
    # Frequency band settings
    parser.add_argument('--alpha-low', type=float, default=8.0,
                        help='Alpha band low frequency in Hz (default: 8)')
    parser.add_argument('--alpha-high', type=float, default=12.0,
                        help='Alpha band high frequency in Hz (default: 12)')
    parser.add_argument('--beta-low', type=float, default=13.0,
                        help='Beta band low frequency in Hz (default: 13)')
    parser.add_argument('--beta-high', type=float, default=30.0,
                        help='Beta band high frequency in Hz (default: 30)')
    
    # Threshold settings
    parser.add_argument('--alpha-threshold', type=float, default=1.0,
                        help='Alpha power threshold for concentration (default: 1.0)')
    parser.add_argument('--beta-threshold', type=float, default=1.0,
                        help='Beta power threshold for concentration (default: 1.0)')
    
    args = parser.parse_args()

    send_message("status", message="Looking for LSL stream...")
    
    try:
        streams = resolve_byprop(args.source_type, args.source_value, timeout=args.timeout)
        
        if not streams:
            send_message("error", message=f"No LSL stream found with {args.source_type}='{args.source_value}'. Make sure the headset software is running!")
            sys.exit(1)
        
        inlet = StreamInlet(streams[0])
        stream_info = streams[0]
        
        # Get actual sample rate from stream if available
        actual_rate = stream_info.nominal_srate()
        if actual_rate > 0:
            args.sample_rate = actual_rate
        
        send_message("status", 
                     message="Connected to LSL stream",
                     stream_name=stream_info.name(),
                     stream_type=stream_info.type(),
                     channel_count=stream_info.channel_count(),
                     sample_rate=actual_rate)
        
        # Initialize processor at native sample rate (no downsampling)
        processor = EEGProcessor(
            sample_rate=args.sample_rate,
            window_duration=args.window,
            output_interval=args.interval,
            alpha_low=args.alpha_low,
            alpha_high=args.alpha_high,
            beta_low=args.beta_low,
            beta_high=args.beta_high,
            alpha_threshold=args.alpha_threshold,
            beta_threshold=args.beta_threshold,
            num_channels=args.channels,
        )
        
        send_message("ready", message="Stream ready, starting data flow")
        
        while True:
            sample, timestamp = inlet.pull_sample(timeout=1.0)
            
            if sample:
                result = processor.add_sample(sample)
                
                if result:
                    send_message("data", 
                                 data=result["data"],
                                 mean_eeg=result["mean_eeg"],
                                 alpha_power=result["alpha_power"],
                                 beta_power=result["beta_power"],
                                 signal=result["signal"],
                                 timestamp=timestamp)
            
    except KeyboardInterrupt:
        send_message("status", message="Stream stopped by user")
        sys.exit(0)
    except Exception as e:
        send_message("error", message=str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
