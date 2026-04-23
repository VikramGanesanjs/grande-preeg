"""
EEG threshold analysis for concentration detection.

Recording structure (from user):
  0–100 s   : Eyes-open / eyes-closed baseline (alternating, no triggers)
  100 s – end: CPT task (concentration game — counting X's)

Key neuroscience:
  • Alpha (8–13 Hz)  DECREASES during concentration  (ERD)
  • Beta  (13–30 Hz) INCREASES during concentration
  → Low alpha (or high beta, or high beta/alpha ratio) = concentrated

Pipeline follows Pérez Vidal et al. (Appl. Sci. 2024, 14, 11173):
  1. Sum posterior channels (PO7=6, Oz=7, PO8=8, 0-indexed: cols 5,6,7)
  2. Baseline-correct per window
  3. Segment into 1 s windows, 100 ms hop
  4. Wavelet denoise (db4, level 2, soft threshold)
  5. Butterworth bandpass (order 6)
  6. FFT → trapezoidal area under curve

Threshold methods:
  A. GMM (unsupervised, 2-component) on alpha
  B. GMM on beta/alpha ratio
  C. Logistic regression on [alpha, beta] using pseudo-labels from
     baseline section (eyes-closed window → high alpha = "relaxed",
     CPT section mean → lower alpha = "concentrated")
"""

import numpy as np
import pandas as pd
import pywt
from scipy.signal import butter, filtfilt
from sklearn.mixture import GaussianMixture
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# ── Config ─────────────────────────────────────────────────────────────────────
CSV_PATH      = "UnicornRecorder_25_02_2026_17_35_290.csv"
FS            = 250
WIN_SIZE      = 250       # 1 s window
WIN_SHIFT     = 25        # 100 ms hop
ARTIFACT_TRIM = 2         # drop first N seconds (settle time)
BASELINE_END  = 100       # seconds — everything before this is eyes-open/closed
POSTERIOR     = [5, 6, 7] # 0-indexed: EEG 6 (PO7), EEG 7 (Oz), EEG 8 (PO8)

BANDS = {
    "theta": (4,  8),
    "alpha": (8,  13),
    "beta":  (13, 30),
}
WAVELET       = "db4"
WAVELET_LEVEL = 2
BUTTER_ORDER  = 6

# ── Signal processing helpers ──────────────────────────────────────────────────
def make_butter(low, high, fs, order=BUTTER_ORDER):
    return butter(order, [low / (fs/2), high / (fs/2)], btype='band')

def wavelet_denoise(seg):
    coeffs = pywt.wavedec(seg, WAVELET, level=WAVELET_LEVEL)
    new_c  = [coeffs[0]]
    for cd in coeffs[1:]:
        sigma = np.median(np.abs(cd)) / 0.6745
        lam   = sigma * np.sqrt(2 * np.log(max(len(seg), 1)))
        new_c.append(pywt.threshold(cd, lam, mode='soft'))
    return pywt.waverec(new_c, WAVELET)[:len(seg)]

def band_area(seg_filt, fs, low, high):
    N     = len(seg_filt)
    X     = np.abs(np.fft.fft(seg_filt))[:N//2]
    freqs = np.fft.fftfreq(N, 1/fs)[:N//2]
    mask  = (freqs >= low) & (freqs <= high)
    if mask.sum() < 2:
        return 0.0
    return float(np.trapezoid(X[mask], freqs[mask]))

# ── 1. Load & trim ─────────────────────────────────────────────────────────────
print("Loading CSV...")
df  = pd.read_csv(CSV_PATH, header=0)
df.columns = df.columns.str.strip()
raw = df.iloc[:, :8].values.astype(float)
raw = raw[ARTIFACT_TRIM * FS:]
total_s = len(raw) / FS
print(f"  Total duration : {total_s:.1f} s")
print(f"  Baseline (0–{BASELINE_END}s): {min(BASELINE_END, total_s):.0f} s")
print(f"  CPT task ({BASELINE_END}s–end): {max(0, total_s - BASELINE_END):.0f} s")

# Sample boundaries (after trim)
baseline_samples = (BASELINE_END - ARTIFACT_TRIM) * FS
task_samples_start = baseline_samples

# ── 2. Sum posterior channels ─────────────────────────────────────────────────
S = raw[:, POSTERIOR].sum(axis=1)

# ── 3. Baseline correction per window ────────────────────────────────────────
S_corr = S.copy()
for b in range(len(S) // WIN_SIZE):
    sl = slice(b * WIN_SIZE, (b + 1) * WIN_SIZE)
    S_corr[sl] = S[sl] - S[sl].mean()

# ── 4. Segment ────────────────────────────────────────────────────────────────
segs       = [S_corr[i:i+WIN_SIZE] for i in range(0, len(S_corr)-WIN_SIZE+1, WIN_SHIFT)]
segs       = np.array(segs)
seg_starts = np.array([i for i in range(0, len(S_corr)-WIN_SIZE+1, WIN_SHIFT)])
seg_times  = seg_starts / FS  # centre ≈ start + 0.5 s
print(f"  Windows: {len(segs)}")

# ── 5. Wavelet denoise ────────────────────────────────────────────────────────
print("  Denoising windows...")
segs_dn = np.array([wavelet_denoise(s) for s in segs])

# ── 6-8. Filter → FFT → area, per band ────────────────────────────────────────
print("  Computing band powers...")
features = {}
for band, (lo, hi) in BANDS.items():
    b_c, a_c = make_butter(lo, hi, FS)
    segs_f   = np.array([filtfilt(b_c, a_c, s) for s in segs_dn])
    areas    = np.array([band_area(s, FS, lo, hi) for s in segs_f])
    features[band] = areas
    print(f"    {band:6s} ({lo:2d}–{hi:2d} Hz):  mean={areas.mean():.1f}  std={areas.std():.1f}")

alpha = features["alpha"]
beta  = features["beta"]
theta = features["theta"]
ratio = beta / (alpha + 1e-6)  # beta/alpha ratio — higher = more concentrated

# ── Artifact rejection (>99th pct alpha) ─────────────────────────────────────
p99   = np.percentile(alpha, 99)
clean = alpha <= p99
print(f"  Artifact windows removed: {(~clean).sum()} / {len(alpha)}")

alpha_c = alpha[clean]
beta_c  = beta[clean]
ratio_c = ratio[clean]
times_c = seg_times[clean]

# ── Label windows by recording section ────────────────────────────────────────
# 0 = baseline (eyes-open/closed), 1 = CPT task
in_baseline = times_c < (BASELINE_END - ARTIFACT_TRIM)
in_task     = ~in_baseline
print(f"\n  Baseline windows : {in_baseline.sum()}")
print(f"  CPT task windows : {in_task.sum()}")

# ── Descriptive stats ─────────────────────────────────────────────────────────
print("\n══ Band power by section ════════════════════════════════════════")
for label, mask in [("Baseline (eyes open/closed)", in_baseline),
                    ("CPT task (concentration)",    in_task)]:
    if mask.sum() == 0:
        continue
    print(f"\n  {label}")
    print(f"    alpha:  mean={alpha_c[mask].mean():.1f}  std={alpha_c[mask].std():.1f}")
    print(f"    beta:   mean={beta_c[mask].mean():.1f}  std={beta_c[mask].std():.1f}")
    print(f"    b/a:    mean={ratio_c[mask].mean():.3f}  std={ratio_c[mask].std():.3f}")

# ── METHOD A: GMM on alpha (full recording, unsupervised) ─────────────────────
print("\n══ Method A: GMM on alpha ═══════════════════════════════════════")
gmm_a = GaussianMixture(n_components=2, random_state=0)
gmm_a.fit(alpha_c.reshape(-1, 1))
gm_means = gmm_a.means_.flatten()
gm_low, gm_high = sorted(gm_means)
thr_gmm_alpha = float(np.mean([gm_low, gm_high]))
labels_gmm = gmm_a.predict(alpha_c.reshape(-1, 1))
# component with lower mean = "concentrated"
concentrated_comp = int(np.argmin(gm_means))
print(f"  Low-alpha  cluster mean (concentrated) : {gm_low:.1f}")
print(f"  High-alpha cluster mean (relaxed)      : {gm_high:.1f}")
print(f"  Decision boundary (midpoint)           : {thr_gmm_alpha:.1f}")

# ── METHOD B: GMM on beta/alpha ratio ────────────────────────────────────────
print("\n══ Method B: GMM on beta/alpha ratio ═══════════════════════════")
gmm_b = GaussianMixture(n_components=2, random_state=0)
gmm_b.fit(ratio_c.reshape(-1, 1))
rm_means = gmm_b.means_.flatten()
rm_low, rm_high = sorted(rm_means)
thr_gmm_ratio = float(np.mean([rm_low, rm_high]))
print(f"  Low-ratio  cluster mean (relaxed)      : {rm_low:.4f}")
print(f"  High-ratio cluster mean (concentrated) : {rm_high:.4f}")
print(f"  Decision boundary (midpoint)           : {thr_gmm_ratio:.4f}")

# ── METHOD C: Logistic regression — pseudo-labels from section ────────────────
# Strategy: use baseline section alpha distribution to find high-alpha (relaxed)
# and CPT section to supply low-alpha (concentrated) examples.
# More robustly: top 25% alpha across full recording = "relaxed" (0),
#                bottom 25% alpha across full recording = "concentrated" (1)
print("\n══ Method C: Logistic regression [alpha, beta] ══════════════════")
q25, q75     = np.percentile(alpha_c, 25), np.percentile(alpha_c, 75)
mask_conc    = alpha_c <= q25   # low alpha = concentrated
mask_relax   = alpha_c >= q75   # high alpha = relaxed
y_pseudo     = np.full(len(alpha_c), -1)
y_pseudo[mask_conc]  = 1   # concentrated
y_pseudo[mask_relax] = 0   # relaxed
labeled      = y_pseudo >= 0
print(f"  Pseudo-labeled windows: {labeled.sum()}  "
      f"(concentrated={mask_conc.sum()}, relaxed={mask_relax.sum()})")

X_feat = np.column_stack([alpha_c, beta_c])
scaler = StandardScaler()
X_s    = scaler.fit_transform(X_feat)
clf    = LogisticRegression(max_iter=1000, C=1.0)
clf.fit(X_s[labeled], y_pseudo[labeled])
acc = clf.score(X_s[labeled], y_pseudo[labeled])
print(f"  Pseudo-label accuracy: {100*acc:.1f}%")

# Decision boundary on alpha axis (beta held at mean = 0 in scaled space)
w_alpha, w_beta = clf.coef_[0]
bias = clf.intercept_[0]
alpha_scaled_boundary = -bias / w_alpha   # when beta_scaled=0
alpha_std_  = scaler.scale_[0]
alpha_mean_ = scaler.mean_[0]
thr_logreg  = alpha_scaled_boundary * alpha_std_ + alpha_mean_
print(f"  Alpha coef={w_alpha:.3f}  beta coef={w_beta:.3f}  bias={bias:.3f}")
print(f"  Alpha-axis threshold: {thr_logreg:.1f}")

# Probability of concentrated for all windows
proba_all_conc = clf.predict_proba(X_s)[:, list(clf.classes_).index(1)]

# ── METHOD D: Baseline-informed — top 30% of baseline = relaxed, CPT mean = conc ─
print("\n══ Method D: Baseline section statistics ═══════════════════════")
if in_baseline.sum() > 10 and in_task.sum() > 10:
    bl_alpha  = alpha_c[in_baseline]
    cpt_alpha = alpha_c[in_task]
    # Simple: midpoint between CPT mean and baseline mean
    thr_midpoint = (bl_alpha.mean() + cpt_alpha.mean()) / 2
    print(f"  Baseline mean alpha : {bl_alpha.mean():.1f}")
    print(f"  CPT task mean alpha : {cpt_alpha.mean():.1f}")
    print(f"  Midpoint threshold  : {thr_midpoint:.1f}")
else:
    thr_midpoint = thr_gmm_alpha
    print("  (insufficient section data, falling back to GMM)")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n══ THRESHOLD SUMMARY ════════════════════════════════════════════")
print(f"  A. GMM on alpha          : {thr_gmm_alpha:.1f}")
print(f"  B. GMM on beta/alpha     : ratio >= {thr_gmm_ratio:.4f}")
print(f"  C. Logistic regression   : alpha <= {thr_logreg:.1f}")
print(f"  D. Baseline midpoint     : {thr_midpoint:.1f}")
print()
print("  Game logic (concentrated = low alpha):")
print(f"  ► Recommended: alpha area <= {thr_gmm_alpha:.0f}  →  'Concentrated'")
print(f"                 alpha area >  {thr_gmm_alpha:.0f}  →  'Not Concentrated'")

# ── Plots ─────────────────────────────────────────────────────────────────────
fig, axes = plt.subplots(4, 1, figsize=(16, 18))
fig.suptitle("EEG Concentration Analysis\n"
             "(0–100 s = baseline,  100 s+ = CPT task)", fontsize=13)

time_all = seg_times[clean]

# Panel 1: Alpha power over time + all thresholds + section shading
ax = axes[0]
ax.axvspan(0, BASELINE_END - ARTIFACT_TRIM, alpha=0.08, color='blue', label='Baseline (eyes open/closed)')
ax.axvspan(BASELINE_END - ARTIFACT_TRIM, time_all.max(), alpha=0.08, color='orange', label='CPT task')
ax.plot(time_all, alpha_c, color='steelblue', lw=0.5, alpha=0.8, label='Alpha area')
ax.axhline(thr_gmm_alpha, color='green',  ls='-',  lw=2.0, label=f'GMM alpha thr = {thr_gmm_alpha:.0f}')
ax.axhline(thr_logreg,    color='purple', ls='-.', lw=1.5, label=f'LogReg thr = {thr_logreg:.0f}')
ax.axhline(thr_midpoint,  color='red',    ls='--', lw=1.5, label=f'Midpoint thr = {thr_midpoint:.0f}')
ax.set_ylabel('Alpha area (8–13 Hz)')
ax.set_title('Alpha Band Power — all thresholds')
ax.legend(fontsize=8, ncol=2); ax.grid(alpha=0.3)
ax.set_xlim(0, time_all.max())

# Panel 2: Beta/Alpha ratio over time
ax = axes[1]
ax.axvspan(0, BASELINE_END - ARTIFACT_TRIM, alpha=0.08, color='blue')
ax.axvspan(BASELINE_END - ARTIFACT_TRIM, time_all.max(), alpha=0.08, color='orange')
ax.plot(time_all, ratio_c, color='coral', lw=0.5, alpha=0.8, label='Beta/Alpha ratio')
ax.axhline(thr_gmm_ratio, color='darkred', ls='-', lw=2.0, label=f'GMM ratio thr = {thr_gmm_ratio:.4f}')
ax.set_ylabel('Beta/Alpha ratio')
ax.set_title('Beta/Alpha Ratio (higher = more concentrated)')
ax.legend(fontsize=8); ax.grid(alpha=0.3)
ax.set_xlim(0, time_all.max())

# Panel 3: P(concentrated) from logistic regression
ax = axes[2]
ax.axvspan(0, BASELINE_END - ARTIFACT_TRIM, alpha=0.08, color='blue', label='Baseline')
ax.axvspan(BASELINE_END - ARTIFACT_TRIM, time_all.max(), alpha=0.08, color='orange', label='CPT task')
ax.plot(time_all, proba_all_conc, color='mediumseagreen', lw=0.6, alpha=0.9,
        label='P(concentrated) — LogReg')
ax.axhline(0.5, color='black', ls='--', lw=1.5, label='Decision boundary p=0.5')
ax.set_ylim(-0.05, 1.05)
ax.set_ylabel('P(concentrated)')
ax.set_title('Logistic Regression: Probability of Concentrated State')
ax.legend(fontsize=8); ax.grid(alpha=0.3)
ax.set_xlim(0, time_all.max())

# Panel 4: Alpha histograms — baseline vs CPT
ax = axes[3]
bins = np.linspace(0, p99 * 1.1, 60)
if in_baseline.sum() > 0:
    ax.hist(alpha_c[in_baseline], bins=bins, color='steelblue', alpha=0.5,
            density=True, label=f'Baseline (n={in_baseline.sum()})')
if in_task.sum() > 0:
    ax.hist(alpha_c[in_task], bins=bins, color='orange', alpha=0.5,
            density=True, label=f'CPT task (n={in_task.sum()})')
ax.axvline(thr_gmm_alpha, color='green',  ls='-',  lw=2.0, label=f'GMM thr = {thr_gmm_alpha:.0f}')
ax.axvline(thr_logreg,    color='purple', ls='-.', lw=1.5, label=f'LogReg thr = {thr_logreg:.0f}')
ax.axvline(thr_midpoint,  color='red',    ls='--', lw=1.5, label=f'Midpoint = {thr_midpoint:.0f}')
ax.set_xlabel('Alpha area (8–13 Hz)')
ax.set_ylabel('Density')
ax.set_title('Alpha Distribution: Baseline vs CPT Task')
ax.legend(fontsize=8); ax.grid(alpha=0.3)

plt.tight_layout()
out_path = "utils/eeg_threshold_results.png"
plt.savefig(out_path, dpi=150)
print(f"\n  Plot saved to {out_path}")
