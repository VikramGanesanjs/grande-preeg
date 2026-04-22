"""
NeuroJack — Unicorn Hybrid Black EEG Server (Threshold-Based SSVEP)
====================================================================
Detects SSVEP slap intent using a pure power-ratio threshold —
no ML model needed, works directly on your real brain signal.

HOW IT WORKS:
  Every 250ms we compute a 1-second FFT window on Pz/PO7/Oz/PO8.
  We compute: ratio = P(10 Hz) / P(2 Hz)
  If ratio > RATIO_THRESHOLD  →  trigger slap

HOW TO CALIBRATE YOUR THRESHOLD:
  1. Start the server and open the game
  2. Watch the console — it prints live ratio values every second:
       [EEG] ratio=0.82  p10=1234  p2=1502  → BASELINE
       [EEG] ratio=3.41  p10=4821  p2=1412  → SLAP
  3. Stare at the SLAP box for 5 sec → note your ratio range (e.g. 2.5–4.0)
  4. Stare at cards for 5 sec → note your baseline ratio (e.g. 0.6–1.2)
  5. Set RATIO_THRESHOLD to the midpoint between those ranges
  6. Restart the server

TUNABLE PARAMETERS (edit these to match your signal):
  RATIO_THRESHOLD  — main trigger threshold, START HERE
  EPOCH_SEC        — longer = more frequency resolution but more lag
  SMOOTH_N         — number of epochs to average over (reduces jitter)
  SSVEP_CHANNELS   — which channels to use (Pz=4, PO7=5, Oz=6, PO8=7)
"""

import asyncio
import json
import numpy as np
import websockets
import threading
import time
import queue
import traceback
import os
import sys
from collections import deque

# ═══════════════════════════════════════════════════════════
#  ★ TUNE THESE PARAMETERS TO MATCH YOUR BRAIN SIGNAL ★
# ═══════════════════════════════════════════════════════════

# Main trigger: fire slap when P(10Hz)/P(2Hz) exceeds this value.
# Start at 2.0. Increase if too many false triggers. Decrease if not firing.
# Typical real values: baseline ~0.5–1.5, slap intent ~2.5–5.0
RATIO_THRESHOLD = 0.45

# Number of consecutive 250ms windows that must exceed threshold before trigger.
# Higher = fewer false positives but more lag. Start at 2.
CONSECUTIVE_N = 2

# Smoothing: average ratio over this many windows (reduces noise)
SMOOTH_N = 3

# Epoch length in seconds. 1.0 = 1Hz FFT resolution (good for 2/10 Hz)
EPOCH_SEC = 1.0

# Channels to use for SSVEP detection (0-indexed in the 8-ch EEG stream)
# Unicorn layout: Fz=0, C3=1, Cz=2, C4=3, Pz=4, PO7=5, Oz=6, PO8=7
# Best for SSVEP: all four parieto-occipital channels
SSVEP_CHANNELS = [4, 5, 6, 7]   # Pz, PO7, Oz, PO8

# Print live ratio values to console (set False to quiet the output)
DEBUG_PRINT = True
DEBUG_INTERVAL_SEC = 0.5   # how often to print (seconds)

# ═══════════════════════════════════════════════════════════

FS                  = 250
EPOCH_N             = int(FS * EPOCH_SEC)
STEP_N              = int(FS * 0.25)          # new epoch every 250ms

FREQ_BASELINE       = 2.0    # Hz — card flicker
FREQ_SLAP           = 10.0   # Hz — SLAP button flicker
FREQ_BW             = 0.4    # ±Hz band around each target (FFT bin = 1Hz, so 0.4 grabs the exact bin)

WS_HOST             = 'localhost'
WS_PORT             = 8765
UNICORN_STREAM_TYPE = 'EEG'
UNICORN_EEG_SLICE   = slice(0, 8)
CHANNELS            = ['Fz', 'C3', 'Cz', 'C4', 'Pz', 'PO7', 'Oz', 'PO8']

COOLDOWN_SEC        = 0.8    # seconds before another trigger can fire


# ── SSVEP Power Ratio Detector ────────────────────────────────────────────────
class SSVEPDetector:
    """
    Threshold-based SSVEP detector.
    Computes P(10Hz) / P(2Hz) on each epoch and triggers when ratio > RATIO_THRESHOLD
    for CONSECUTIVE_N windows in a row.
    """

    def __init__(self, result_queue, loop):
        self.result_queue   = result_queue
        self.loop           = loop
        self.buffer         = deque()
        self.buf_len        = 0
        self.ratio_history  = deque(maxlen=SMOOTH_N)
        self.above_count    = 0          # consecutive windows above threshold
        self.last_trigger   = 0.0
        self.last_debug_t   = 0.0
        self.freqs          = np.fft.rfftfreq(EPOCH_N, d=1.0 / FS)

    def band_power(self, fft_mag, target_hz):
        """Mean power in ±FREQ_BW Hz around target_hz."""
        mask = (self.freqs >= target_hz - FREQ_BW) & (self.freqs <= target_hz + FREQ_BW)
        return float(np.mean(fft_mag[mask] ** 2)) if mask.any() else 1e-10

    def compute_ratio(self, epoch):
        """
        Compute mean P(10Hz)/P(2Hz) across all SSVEP channels.
        Returns (ratio, mean_p10, mean_p2).
        """
        p10_all, p2_all = [], []
        for ch in SSVEP_CHANNELS:
            if ch >= epoch.shape[1]:
                continue
            # Detrend (remove DC + slow drift) before FFT
            sig     = epoch[:, ch] - np.mean(epoch[:, ch])
            fft_mag = np.abs(np.fft.rfft(sig * np.hanning(len(sig))))
            p10_all.append(self.band_power(fft_mag, FREQ_SLAP))
            p2_all.append(self.band_power(fft_mag, FREQ_BASELINE))

        mean_p10 = max(np.mean(p10_all), 1e-10)
        mean_p2  = max(np.mean(p2_all),  1e-10)
        return mean_p10 / mean_p2, mean_p10, mean_p2

    def push(self, chunk, fs):
        """Add a chunk of EEG samples and process when enough data buffered."""
        # Basic resample if fs differs
        if abs(fs - FS) > 2:
            factor  = FS / fs
            n_new   = max(1, int(len(chunk) * factor))
            indices = np.linspace(0, len(chunk) - 1, n_new).astype(int)
            chunk   = chunk[indices]

        self.buffer.append(chunk.copy())
        self.buf_len += len(chunk)

        while self.buf_len >= EPOCH_N:
            epoch = np.concatenate(list(self.buffer), axis=0)[-EPOCH_N:]
            self._process(epoch)

            # Slide forward by STEP_N
            to_drop = STEP_N
            while to_drop > 0 and self.buffer:
                bl = len(self.buffer[0])
                if bl <= to_drop:
                    self.buf_len -= bl
                    to_drop      -= bl
                    self.buffer.popleft()
                else:
                    self.buffer[0] = self.buffer[0][to_drop:]
                    self.buf_len  -= to_drop
                    to_drop        = 0

    def _process(self, epoch):
        try:
            ratio, mean_p10, mean_p2 = self.compute_ratio(epoch)

            # Smooth ratio over last N windows
            self.ratio_history.append(ratio)
            smooth_ratio = float(np.mean(self.ratio_history))

            # Consecutive threshold logic
            if smooth_ratio >= RATIO_THRESHOLD:
                self.above_count += 1
            else:
                self.above_count = 0

            now     = time.time()
            trigger = (
                self.above_count >= CONSECUTIVE_N
                and (now - self.last_trigger) > COOLDOWN_SEC
            )

            if trigger:
                self.last_trigger = now
                self.above_count  = 0  # reset so it doesn't fire every window

            # Normalize ratio to 0–1 for the browser confidence bar
            # Map [0, RATIO_THRESHOLD*2] → [0, 1]  (>0.5 means above threshold)
            p_slap = min(smooth_ratio / (RATIO_THRESHOLD * 2), 1.0)

            result = {
                'prediction':   'slap' if smooth_ratio >= RATIO_THRESHOLD else 'baseline',
                'p_slap':       round(p_slap, 3),
                'p_baseline':   round(1.0 - p_slap, 3),
                'ratio':        round(smooth_ratio, 3),
                'raw_ratio':    round(ratio, 3),
                'p10_uv2':      round(mean_p10, 2),
                'p2_uv2':       round(mean_p2,  2),
                'threshold':    RATIO_THRESHOLD,
                'trigger':      trigger,
                'confidence':   round(p_slap, 3),
            }

            # Debug print to console
            if DEBUG_PRINT and (now - self.last_debug_t) >= DEBUG_INTERVAL_SEC:
                self.last_debug_t = now
                bar     = '█' * int(smooth_ratio * 4)
                status  = '🟢 SLAP' if smooth_ratio >= RATIO_THRESHOLD else '⬜ base'
                trig    = ' ← TRIGGER!' if trigger else ''
                print(f"[EEG] ratio={smooth_ratio:5.2f}  {bar:<20s}  {status}{trig}"
                      f"  (p10={mean_p10:.0f} p2={mean_p2:.0f})")

            asyncio.run_coroutine_threadsafe(
                self.result_queue.put(result), self.loop
            )

        except Exception:
            traceback.print_exc()


# ── Unicorn LSL Reader ────────────────────────────────────────────────────────
class UnicornLSLReader:

    def __init__(self, data_queue):
        self.data_queue = data_queue
        self.running    = False

    def find_unicorn_stream(self):
        try:
            from pylsl import resolve_byprop
        except ImportError as e:
            print(f"⚠  pylsl import failed: {e}")
            print("   Fix: pip install --upgrade pylsl")
            return None
        except Exception as e:
            print(f"⚠  pylsl load error (missing liblsl?): {e}")
            print("   Fix: pip install --upgrade pylsl  (v1.17+ bundles liblsl)")
            return None

        print("🔍 Searching for Unicorn LSL stream...")
        streams = resolve_byprop('type', UNICORN_STREAM_TYPE, timeout=8.0)
        if not streams:
            print("⚠  No Unicorn stream found — switching to simulation mode")
            print("   Open Unicorn Suite → UnicornLSL → Start, then restart server")
            return None

        unicorn = [s for s in streams if s.name().startswith('UN-')]
        stream  = unicorn[0] if unicorn else streams[0]
        print(f"✓ Unicorn stream: {stream.name()}  ({stream.channel_count()} ch @ {stream.nominal_srate()} Hz)")
        return stream

    def run(self):
        self.running = True
        stream = self.find_unicorn_stream()
        if stream is None:
            self._run_simulation()
            return

        try:
            from pylsl import StreamInlet
            inlet  = StreamInlet(stream, max_buflen=30)
            actual_fs = inlet.info().nominal_srate()
            print(f"\n🧠 Unicorn live EEG — {actual_fs} Hz  |  SSVEP channels: {[CHANNELS[i] for i in SSVEP_CHANNELS]}")
            print(f"   Ratio threshold: {RATIO_THRESHOLD}  (tune in eeg_server.py)")
            print(f"   Watch the console for live ratio values...\n")

            while self.running:
                samples, _ = inlet.pull_chunk(timeout=0.1, max_samples=32)
                if samples:
                    full  = np.array(samples, dtype=np.float32)
                    eeg   = full[:, UNICORN_EEG_SLICE]
                    self.data_queue.put(('eeg', eeg, float(actual_fs)))

        except Exception as e:
            print(f"LSL error: {e}")
            self._run_simulation()

    def _run_simulation(self):
        """Synthetic Unicorn signal for testing without headset."""
        print("\n🎮 SIMULATION MODE")
        CHUNK      = 25
        state      = 'baseline'
        state_t    = time.time()
        STATE_DUR  = 5.0
        t          = 0.0

        while self.running:
            now = time.time()
            if now - state_t >= STATE_DUR:
                state   = 'slap' if state == 'baseline' else 'baseline'
                state_t = now
                print(f"[SIM] → {state.upper()}")

            chunk = np.zeros((CHUNK, 8), dtype=np.float32)
            ts    = np.linspace(t, t + CHUNK / FS, CHUNK, endpoint=False)
            f     = FREQ_SLAP if state == 'slap' else FREQ_BASELINE
            snr   = 15.0
            for ch in SSVEP_CHANNELS:
                chunk[:, ch] = snr * np.sin(2 * np.pi * f * ts) + np.random.randn(CHUNK) * 1.5

            self.data_queue.put(('eeg', chunk, float(FS)))
            t += CHUNK / FS
            time.sleep(CHUNK / FS)

    def stop(self):
        self.running = False


# ── WebSocket Server ──────────────────────────────────────────────────────────
connected_clients = set()


async def ws_handler(websocket):
    global RATIO_THRESHOLD
    connected_clients.add(websocket)
    print(f"🌐 Browser connected  [{len(connected_clients)} client(s)]")
    try:
        await websocket.send(json.dumps({
            'type':              'connected',
            'device':            'Unicorn Hybrid Black',
            'mode':              'threshold',
            'ratio_threshold':   RATIO_THRESHOLD,
            'ssvep_channels':    [CHANNELS[i] for i in SSVEP_CHANNELS],
            'fs':                FS,
        }))
        async for msg in websocket:
            try:
                d = json.loads(msg)
                if d.get('type') == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
                elif d.get('type') == 'set_threshold':
                    RATIO_THRESHOLD = float(d['value'])
                    print(f"[CONFIG] Ratio threshold updated → {RATIO_THRESHOLD}")
            except Exception:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"🌐 Browser disconnected [{len(connected_clients)} client(s)]")



async def broadcast_loop(result_queue):
    while True:
        result = await result_queue.get()
        if connected_clients:
            msg = json.dumps({'type': 'eeg_prediction', **result})
            await asyncio.gather(*[c.send(msg) for c in connected_clients], return_exceptions=True)


async def main():
    data_queue   = queue.Queue()
    result_queue = asyncio.Queue()
    loop         = asyncio.get_running_loop()

    detector = SSVEPDetector(result_queue, loop)
    reader   = UnicornLSLReader(data_queue)

    threading.Thread(target=reader.run, daemon=True).start()

    def process_loop():
        while True:
            try:
                kind, chunk, fs = data_queue.get(timeout=1.0)
                if kind == 'eeg':
                    detector.push(chunk, fs)
            except queue.Empty:
                pass
            except Exception:
                traceback.print_exc()

    threading.Thread(target=process_loop, daemon=True).start()

    print(f"\n{'='*60}")
    print(f"  NeuroJack Threshold-Based SSVEP Server")
    print(f"  ws://{WS_HOST}:{WS_PORT}")
    print(f"  RATIO_THRESHOLD = {RATIO_THRESHOLD}  (edit eeg_server.py to tune)")
    print(f"  CONSECUTIVE_N   = {CONSECUTIVE_N}    windows must exceed threshold")
    print(f"  SMOOTH_N        = {SMOOTH_N}    ratio averaged over N windows")
    print(f"{'='*60}\n")

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await broadcast_loop(result_queue)


if __name__ == '__main__':
    asyncio.run(main())