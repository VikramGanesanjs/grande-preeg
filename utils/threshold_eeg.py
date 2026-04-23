"""
Alpha-band threshold following Pérez Vidal et al. (Appl. Sci. 2024, 14, 11173).

Pipeline (equations from the paper):
  Eq 1-2  : Sum posterior channels  (PO7 + Oz + PO8)
  Eq 3-5  : Baseline correction per window
  Eq 6    : Segment into 1 s windows, 100 ms hop
  Eq 7-13 : Wavelet denoise (db4, level 2, soft threshold)
  Eq 14   : Butterworth bandpass 8–13 Hz
  Eq 15-16: FFT + trapezoidal area under alpha curve
  Threshold: µ ± σ  (above µ+σ = relaxed, below µ-σ = concentrated)
"""

import numpy as np
import pandas as pd
import pywt
from scipy.signal import butter, filtfilt
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# ── Config ─────────────────────────────────────────────────────────────────────
CSV_PATH = "UnicornRecorder_25_02_2026_17_35_290.csv"
FS       = 250          # Hz
WIN_SIZE = 250          # 1 s
WIN_SHIFT = 25          # 100 ms hop
TRIM_S   = 5            # drop first 5 s (settling)
POSTERIOR = [5, 6, 7]   # 0-indexed cols: EEG6=PO7, EEG7=Oz, EEG8=PO8

# ── Pipeline ───────────────────────────────────────────────────────────────────
# 1. Load
df = pd.read_csv(CSV_PATH, header=0)
df.columns = df.columns.str.strip()
raw = df.iloc[:, :8].values.astype(float)
raw = raw[TRIM_S * FS:]
print(f"Duration: {len(raw)/FS:.1f} s  ({len(raw)} samples)")

# 2. Sum posterior channels (Eq 1-2)
S = raw[:, POSTERIOR].sum(axis=1)

# 3. Baseline correction per 1 s block (Eq 3-5)
S_corr = S.copy()
for b in range(len(S) // WIN_SIZE):
    sl = slice(b * WIN_SIZE, (b + 1) * WIN_SIZE)
    S_corr[sl] -= S[sl].mean()

# 4. Segment (Eq 6)
segs = [S_corr[i:i+WIN_SIZE] for i in range(0, len(S_corr)-WIN_SIZE+1, WIN_SHIFT)]
segs = np.array(segs)
times = np.array([i for i in range(0, len(S_corr)-WIN_SIZE+1, WIN_SHIFT)]) / FS
print(f"Windows: {len(segs)}")

# 5. Wavelet denoise (Eq 7-13) — db4 level 2, soft threshold
def wavelet_denoise(seg):
    coeffs = pywt.wavedec(seg, 'db4', level=2)
    new_c = [coeffs[0]]
    for cd in coeffs[1:]:
        sigma = np.median(np.abs(cd)) / 0.6745
        lam = sigma * np.sqrt(2 * np.log(len(seg)))
        new_c.append(pywt.threshold(cd, lam, mode='soft'))
    return pywt.waverec(new_c, 'db4')[:len(seg)]

segs_dn = np.array([wavelet_denoise(s) for s in segs])

# 6. Butterworth bandpass 8–13 Hz (Eq 14)
b, a = butter(4, [8/(FS/2), 13/(FS/2)], btype='band')
segs_filt = np.array([filtfilt(b, a, s) for s in segs_dn])

# 7. FFT + trapezoidal area (Eq 15-16)
def alpha_area(seg):
    N = len(seg)
    X = np.abs(np.fft.fft(seg))[:N//2]
    f = np.fft.fftfreq(N, 1/FS)[:N//2]
    mask = (f >= 8) & (f <= 13)
    return float(np.trapezoid(X[mask], f[mask]))

alpha = np.array([alpha_area(s) for s in segs_filt])

# ── Threshold: µ ± σ on full recording (paper method) ─────────────────────────
# Remove extreme artifacts first (>99th pct)
clean = alpha <= np.percentile(alpha, 99)
alpha_c = alpha[clean]
times_c = times[clean]

mu  = alpha_c.mean()
sig = alpha_c.std()
thr_low  = mu - sig   # below = concentrated
thr_high = mu + sig   # above = relaxed

print(f"\nα power  µ = {mu:.1f}   σ = {sig:.1f}")
print(f"Threshold LOW  (µ-σ) = {thr_low:.1f}  → below: concentrated")
print(f"Threshold HIGH (µ+σ) = {thr_high:.1f}  → above: relaxed")
print(f"\n► For the game:  alpha <= {thr_low:.0f}  →  'Concentrated'")

# ── Plot ───────────────────────────────────────────────────────────────────────
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8))
fig.suptitle("Alpha Power Threshold — paper method (µ ± σ)", fontsize=13)

ax1.plot(times_c, alpha_c, color='steelblue', lw=0.6, alpha=0.8, label='Alpha area')
ax1.axhline(mu,       color='black',  ls=':',  lw=1.2, label=f'µ = {mu:.0f}')
ax1.axhline(thr_low,  color='green',  ls='--', lw=1.8, label=f'µ−σ = {thr_low:.0f}  (concentrated)')
ax1.axhline(thr_high, color='tomato', ls='--', lw=1.8, label=f'µ+σ = {thr_high:.0f}  (relaxed)')
ax1.axvspan(0, 95, alpha=0.07, color='blue',   label='Baseline (~0–100 s)')
ax1.axvspan(95, times_c.max(), alpha=0.07, color='orange', label='CPT task')
ax1.set_ylabel('Alpha area (8–13 Hz)')
ax1.set_xlabel('Time (s)')
ax1.legend(fontsize=9); ax1.grid(alpha=0.3)

bins = np.linspace(0, np.percentile(alpha_c, 99)*1.1, 60)
ax2.hist(alpha_c, bins=bins, color='steelblue', alpha=0.7, density=True)
ax2.axvline(mu,       color='black',  ls=':',  lw=1.2, label=f'µ = {mu:.0f}')
ax2.axvline(thr_low,  color='green',  ls='--', lw=2.0, label=f'µ−σ = {thr_low:.0f}')
ax2.axvline(thr_high, color='tomato', ls='--', lw=2.0, label=f'µ+σ = {thr_high:.0f}')
ax2.set_xlabel('Alpha area (8–13 Hz)')
ax2.set_ylabel('Density')
ax2.legend(fontsize=9); ax2.grid(alpha=0.3)

plt.tight_layout()
plt.savefig("utils/paper_method_results.png", dpi=150)
print("\nPlot saved to utils/paper_method_results.png")
