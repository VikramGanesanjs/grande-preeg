#!/usr/bin/env python3
"""
Benchmark script for EEG signal processing pipeline.

Measures processing time for different approaches to ensure real-time performance.
Target: Process each window in < 200ms (output interval)
"""

import time
import numpy as np
from scipy.signal import butter, filtfilt, lfilter, hilbert, welch

# Simulation parameters
SAMPLE_RATE = 250  # Hz
WINDOW_DURATION = 1.0  # seconds
NUM_CHANNELS = 8
WINDOW_SAMPLES = int(SAMPLE_RATE * WINDOW_DURATION)  # 250 samples
NUM_ITERATIONS = 100

# Frequency bands
ALPHA_LOW, ALPHA_HIGH = 8, 12
BETA_LOW, BETA_HIGH = 13, 30


def generate_test_data():
    """Generate synthetic EEG data."""
    return np.random.randn(WINDOW_SAMPLES, NUM_CHANNELS) * 50


# ============ CURRENT APPROACH ============

def butter_bandpass_current(lowcut, highcut, fs, order=4):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a


def compute_bandpower_current(data, fs, low_freq, high_freq):
    """Current approach: filtfilt + hilbert (slowest)."""
    b, a = butter_bandpass_current(low_freq, high_freq, fs)
    filtered = filtfilt(b, a, data, axis=0)
    analytic_signal = hilbert(filtered, axis=0)
    envelope = np.abs(analytic_signal)
    power = np.mean(envelope ** 2)
    return float(power)


def process_current(data):
    """Current full pipeline."""
    avg_signal = np.mean(data, axis=1)
    alpha = compute_bandpower_current(avg_signal, SAMPLE_RATE, ALPHA_LOW, ALPHA_HIGH)
    beta = compute_bandpower_current(avg_signal, SAMPLE_RATE, BETA_LOW, BETA_HIGH)
    return alpha, beta


# ============ OPTIMIZED APPROACH 1: Pre-computed coefficients ============

# Pre-compute filter coefficients once
def get_precomputed_coefficients():
    nyq = 0.5 * SAMPLE_RATE
    b_alpha, a_alpha = butter(4, [ALPHA_LOW/nyq, ALPHA_HIGH/nyq], btype='band')
    b_beta, a_beta = butter(4, [BETA_LOW/nyq, BETA_HIGH/nyq], btype='band')
    return (b_alpha, a_alpha), (b_beta, a_beta)


ALPHA_COEFFS, BETA_COEFFS = get_precomputed_coefficients()


def compute_bandpower_precomputed(data, coeffs):
    """Optimized: pre-computed coefficients, still using filtfilt + hilbert."""
    b, a = coeffs
    filtered = filtfilt(b, a, data)
    analytic_signal = hilbert(filtered)
    envelope = np.abs(analytic_signal)
    return float(np.mean(envelope ** 2))


def process_precomputed(data):
    avg_signal = np.mean(data, axis=1)
    alpha = compute_bandpower_precomputed(avg_signal, ALPHA_COEFFS)
    beta = compute_bandpower_precomputed(avg_signal, BETA_COEFFS)
    return alpha, beta


# ============ OPTIMIZED APPROACH 2: lfilter instead of filtfilt ============

def compute_bandpower_lfilter(data, coeffs):
    """Optimized: lfilter (single pass, faster but with phase shift)."""
    b, a = coeffs
    filtered = lfilter(b, a, data)
    analytic_signal = hilbert(filtered)
    envelope = np.abs(analytic_signal)
    return float(np.mean(envelope ** 2))


def process_lfilter(data):
    avg_signal = np.mean(data, axis=1)
    alpha = compute_bandpower_lfilter(avg_signal, ALPHA_COEFFS)
    beta = compute_bandpower_lfilter(avg_signal, BETA_COEFFS)
    return alpha, beta


# ============ OPTIMIZED APPROACH 3: Variance-based power (no Hilbert) ============

def compute_bandpower_variance(data, coeffs):
    """Optimized: bandpass + variance (skip Hilbert transform)."""
    b, a = coeffs
    filtered = lfilter(b, a, data)
    # Power as variance of filtered signal
    return float(np.var(filtered))


def process_variance(data):
    avg_signal = np.mean(data, axis=1)
    alpha = compute_bandpower_variance(avg_signal, ALPHA_COEFFS)
    beta = compute_bandpower_variance(avg_signal, BETA_COEFFS)
    return alpha, beta


# ============ OPTIMIZED APPROACH 4: Welch's method (FFT-based) ============

def compute_bandpower_welch(data, fs, low_freq, high_freq):
    """Optimized: Welch's method for spectral power estimation."""
    freqs, psd = welch(data, fs=fs, nperseg=min(256, len(data)))
    # Find indices for frequency band
    idx_band = np.logical_and(freqs >= low_freq, freqs <= high_freq)
    # Integrate power in band
    power = np.trapz(psd[idx_band], freqs[idx_band])
    return float(power)


def process_welch(data):
    avg_signal = np.mean(data, axis=1)
    alpha = compute_bandpower_welch(avg_signal, SAMPLE_RATE, ALPHA_LOW, ALPHA_HIGH)
    beta = compute_bandpower_welch(avg_signal, SAMPLE_RATE, BETA_LOW, BETA_HIGH)
    return alpha, beta


# ============ OPTIMIZED APPROACH 5: Single FFT for both bands ============

def process_fft_single(data):
    """Most optimized: single FFT, extract both bands."""
    avg_signal = np.mean(data, axis=1)
    
    # Single FFT
    fft_vals = np.fft.rfft(avg_signal)
    fft_freqs = np.fft.rfftfreq(len(avg_signal), 1.0/SAMPLE_RATE)
    psd = np.abs(fft_vals) ** 2 / len(avg_signal)
    
    # Extract alpha band power
    alpha_idx = np.logical_and(fft_freqs >= ALPHA_LOW, fft_freqs <= ALPHA_HIGH)
    alpha_power = float(np.sum(psd[alpha_idx]))
    
    # Extract beta band power
    beta_idx = np.logical_and(fft_freqs >= BETA_LOW, fft_freqs <= BETA_HIGH)
    beta_power = float(np.sum(psd[beta_idx]))
    
    return alpha_power, beta_power


# ============ BENCHMARK ============

def benchmark(name, func, iterations=NUM_ITERATIONS):
    """Run benchmark and return average time in ms."""
    times = []
    for _ in range(iterations):
        data = generate_test_data()
        start = time.perf_counter()
        result = func(data)
        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to ms
    
    avg_time = np.mean(times)
    std_time = np.std(times)
    max_time = np.max(times)
    
    return {
        'name': name,
        'avg_ms': avg_time,
        'std_ms': std_time,
        'max_ms': max_time,
        'result': result,
    }


def main():
    print("=" * 70)
    print("EEG Signal Processing Benchmark")
    print("=" * 70)
    print(f"Sample rate: {SAMPLE_RATE} Hz")
    print(f"Window: {WINDOW_DURATION}s ({WINDOW_SAMPLES} samples)")
    print(f"Channels: {NUM_CHANNELS}")
    print(f"Iterations: {NUM_ITERATIONS}")
    print(f"Target: < 200ms per window (output interval)")
    print("=" * 70)
    print()
    
    benchmarks = [
        ("1. Current (filtfilt + Hilbert)", process_current),
        ("2. Pre-computed coeffs", process_precomputed),
        ("3. lfilter + Hilbert", process_lfilter),
        ("4. lfilter + Variance", process_variance),
        ("5. Welch's method", process_welch),
        ("6. Single FFT (fastest)", process_fft_single),
    ]
    
    results = []
    for name, func in benchmarks:
        result = benchmark(name, func)
        results.append(result)
        
        status = "✓ OK" if result['avg_ms'] < 200 else "✗ TOO SLOW"
        print(f"{result['name']}")
        print(f"  Avg: {result['avg_ms']:.2f}ms | Max: {result['max_ms']:.2f}ms | {status}")
        print(f"  Alpha: {result['result'][0]:.4f} | Beta: {result['result'][1]:.4f}")
        print()
    
    print("=" * 70)
    print("RECOMMENDATION:")
    
    # Find fastest that's under 200ms
    valid = [r for r in results if r['avg_ms'] < 200]
    if valid:
        fastest = min(valid, key=lambda x: x['avg_ms'])
        print(f"Use '{fastest['name']}' - {fastest['avg_ms']:.2f}ms avg")
    else:
        print("WARNING: All methods exceed 200ms target!")
    
    print("=" * 70)


if __name__ == "__main__":
    main()
