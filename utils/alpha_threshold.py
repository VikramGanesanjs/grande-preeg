"""
Alpha/Beta threshold calculation — extended from:
"Development of RelaxQuest: A Serious EEG-Controlled Game..."
(Pérez Vidal et al., Appl. Sci. 2024, 14, 11173)

Same signal pipeline as paper (sum → baseline → segment → wavelet →
Butterworth → FFT → trapezoidal area), but computed for three bands:
  • Theta  4–8  Hz
  • Alpha  8–13 Hz  (paper's primary band)
  • Beta  13–30 Hz

Threshold finding:
  1. Paper method  — µ ± σ on alpha area (baseline)
  2. GMM (2-component) — unsupervised, finds natural relaxed/active split
  3. Logistic regression — pseudo-labels from top/bottom 25% alpha power,
     trained on [alpha, beta] features; decision boundary = optimal threshold

Unicorn Hybrid Black default channel map:
  EEG1=Fz  EEG2=C3  EEG3=Cz  EEG4=C4  EEG5=Pz
  EEG6=PO7  EEG7=Oz  EEG8=PO8
"""

import numpy as np
import pandas as pd
import pywt
from scipy.signal import butter, filtfilt
from sklearn.mixture import GaussianMixture
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# ── Config ────────────────────────────────────────────────────────────────────
CSV_PATH      = "UnicornRecorder_25_02_2026_17_35_290.csv"
FS            = 250
WIN_SIZE      = 250        # 1 s
WIN_SHIFT     = 25         # 100 ms
ARTIFACT_TRIM = 5          # drop first N seconds

BANDS = {
    "theta": (4,  8),
    "alpha": (8,  13),
    "beta":  (13, 30),
}

ALPHA_CHANNELS = [5, 6, 7]   # PO7, Oz, PO8

WAVELET       = "db4"
WAVELET_LEVEL = 2
BUTTER_ORDER  = 6

# ── Helpers ───────────────────────────────────────────────────────────────────
def make_butter(low, high, fs, order=BUTTER_ORDER):
    return butter(order, [low / (fs/2), high / (fs/2)], btype='band')

def wavelet_denoise(seg):
    coeffs = pywt.wavedec(seg, WAVELET, level=WAVELET_LEVEL)
    new_c  = [coeffs[0]]
    for cd in coeffs[1:]:
        R   = np.median(np.abs(cd)) / 0.6745
        lam = R * np.sqrt(2 * np.log(len(seg)))
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

# ── 1. Load & trim ────────────────────────────────────────────────────────────
print("Loading CSV...")
df   = pd.read_csv(CSV_PATH, header=0)
df.columns = df.columns.str.strip()
raw  = df.iloc[:, :8].values.astype(float)
raw  = raw[ARTIFACT_TRIM * FS:]
print(f"  Samples: {len(raw)}  ({len(raw)/FS:.1f} s)")

# ── 2. Sum posterior channels (Eq. 1-2) ──────────────────────────────────────
S = raw[:, ALPHA_CHANNELS].sum(axis=1)

# ── 3. Baseline correction (Eq. 3-5) ─────────────────────────────────────────
S_corr = S.copy()
for b in range(len(S) // WIN_SIZE):
    sl = slice(b*WIN_SIZE, (b+1)*WIN_SIZE)
    S_corr[sl] = S[sl] - S[sl].mean()

# ── 4. Segment (Eq. 6) ────────────────────────────────────────────────────────
segs = [S_corr[i:i+WIN_SIZE]
        for i in range(0, len(S_corr)-WIN_SIZE+1, WIN_SHIFT)]
segs = np.array(segs)
print(f"  Windows: {len(segs)}")

# ── 5. Wavelet denoise (Eq. 7-13) ────────────────────────────────────────────
print("  Denoising...")
segs_dn = np.array([wavelet_denoise(s) for s in segs])

# ── 6-8. Filter → FFT → trapezoidal area, for each band ──────────────────────
print("  Computing band powers...")
features = {}
for band, (lo, hi) in BANDS.items():
    b_c, a_c = make_butter(lo, hi, FS)
    segs_f   = np.array([filtfilt(b_c, a_c, s) for s in segs_dn])
    areas    = np.array([band_area(s, FS, lo, hi) for s in segs_f])
    features[band] = areas
    print(f"    {band:6s} ({lo}-{hi} Hz): mean={areas.mean():.1f}  std={areas.std():.1f}")

alpha = features["alpha"]
beta  = features["beta"]
theta = features["theta"]

# ── Artifact rejection (>99th pct on alpha) ───────────────────────────────────
p99        = np.percentile(alpha, 99)
clean      = alpha <= p99
alpha_c    = alpha[clean]
beta_c     = beta[clean]
theta_c    = theta[clean]
time_clean = np.arange(len(alpha))[clean] * WIN_SHIFT / FS
print(f"  Artifact windows removed: {(~clean).sum()} / {len(alpha)}")

# ── METHOD 1: Paper's µ ± σ on alpha ─────────────────────────────────────────
mu_a    = alpha_c.mean()
sig_a   = alpha_c.std()
thr_paper_low  = mu_a - sig_a
thr_paper_high = mu_a + sig_a

# ── METHOD 2: GMM (unsupervised, 2 components) on alpha ──────────────────────
gmm = GaussianMixture(n_components=2, random_state=0)
gmm.fit(alpha_c.reshape(-1, 1))
means_gmm = gmm.means_.flatten()
# decision boundary: midpoint between the two Gaussian means
thr_gmm = float(np.mean(means_gmm))
# label 0 = lower-alpha (active), label 1 = higher-alpha (relaxed)
relaxed_mean = means_gmm.max()
active_mean  = means_gmm.min()

# ── METHOD 3: Logistic regression on [alpha, beta] ───────────────────────────
# Pseudo-labels: top 25% alpha = relaxed (1), bottom 25% alpha = active (0)
q25, q75     = np.percentile(alpha_c, 25), np.percentile(alpha_c, 75)
mask_active  = alpha_c <= q25
mask_relaxed = alpha_c >= q75
X_feat = np.column_stack([alpha_c, beta_c])
y_pseudo = np.full(len(alpha_c), -1)
y_pseudo[mask_active]  = 0
y_pseudo[mask_relaxed] = 1
labeled = y_pseudo != -1

scaler = StandardScaler()
X_s    = scaler.fit_transform(X_feat)
clf    = LogisticRegression(max_iter=1000)
clf.fit(X_s[labeled], y_pseudo[labeled])

# Decision boundary in original alpha units (holding beta at its mean)
w0, w1   = clf.coef_[0]
bias     = clf.intercept_[0]
beta_mid = 0.0
alpha_scaled_boundary = (-bias - w1 * beta_mid) / w0
alpha_std, alpha_mean = scaler.scale_[0], scaler.mean_[0]
thr_logreg = alpha_scaled_boundary * alpha_std + alpha_mean

# Accuracy on pseudo-labeled windows
acc = clf.score(X_s[labeled], y_pseudo[labeled])
proba_clean = clf.predict_proba(X_s)[:, 1]   # P(relaxed), len = len(alpha_c)

# Build full-length proba array (NaN for rejected windows)
proba_all = np.full(len(alpha), np.nan)
proba_all[clean] = proba_clean

# ── Report ────────────────────────────────────────────────────────────────────
print("\n══ Threshold Results ════════════════════════════════════════════")
print(f"\n  [1] Paper method  (µ ± σ on alpha)")
print(f"      µ = {mu_a:.1f},  σ = {sig_a:.1f}")
print(f"      Active/Relaxed boundary  (µ−σ) : {thr_paper_low:.1f}")
print(f"      Relaxed/Deep   boundary  (µ+σ) : {thr_paper_high:.1f}")

print(f"\n  [2] GMM  (2-component, unsupervised)")
print(f"      Active cluster mean  : {active_mean:.1f}")
print(f"      Relaxed cluster mean : {relaxed_mean:.1f}")
print(f"      Decision boundary    : {thr_gmm:.1f}")

print(f"\n  [3] Logistic Regression  (alpha + beta features)")
print(f"      alpha coef={w0:.3f}  beta coef={w1:.3f}  bias={bias:.3f}")
print(f"      Alpha-axis threshold  : {thr_logreg:.1f}")
print(f"      Pseudo-label accuracy : {100*acc:.1f}%")

print(f"\n  ► Recommended threshold for game: alpha area ≥ {thr_gmm:.0f}  →  relaxed")
print(f"                                     alpha area <  {thr_gmm:.0f}  →  active/focused")

# ── Plot ──────────────────────────────────────────────────────────────────────
time_all = np.arange(len(alpha)) * WIN_SHIFT / FS
y_max    = p99 * 1.2

fig, axes = plt.subplots(3, 1, figsize=(15, 12))

# — panel 1: alpha power + all thresholds
ax = axes[0]
ax.plot(time_all, alpha, color='steelblue', lw=0.6, alpha=0.7, label='Alpha area')
ax.axhline(thr_paper_low,  color='orange', ls='--', lw=1.3,
           label=f'Paper µ−σ = {thr_paper_low:.0f}')
ax.axhline(thr_paper_high, color='tomato',  ls='--', lw=1.3,
           label=f'Paper µ+σ = {thr_paper_high:.0f}')
ax.axhline(thr_gmm,        color='green',  ls='-',  lw=1.5,
           label=f'GMM boundary = {thr_gmm:.0f}')
ax.axhline(thr_logreg,     color='purple', ls='-.',  lw=1.3,
           label=f'LogReg boundary = {thr_logreg:.0f}')
ax.set_ylim(0, y_max)
ax.set_ylabel('Alpha area (8–13 Hz)')
ax.set_title('Alpha Band Power — all three thresholds')
ax.legend(fontsize=8); ax.grid(alpha=0.3)

# — panel 2: all three bands
ax = axes[1]
for band, col in [("theta","gold"), ("alpha","steelblue"), ("beta","coral")]:
    vals = features[band]
    vals_norm = vals / np.percentile(vals[clean], 99)   # normalise to 1 for comparison
    ax.plot(time_all, vals_norm, color=col, lw=0.6, alpha=0.7,
            label=f'{band} (norm to 99th pct)')
ax.set_ylabel('Normalised power')
ax.set_title('Theta / Alpha / Beta power over time (normalised)')
ax.legend(fontsize=8); ax.grid(alpha=0.3)
ax.set_ylim(0, 2)

# — panel 3: P(relaxed) from logistic regression
ax = axes[2]
ax.plot(time_all, proba_all, color='mediumseagreen', lw=0.7,
        label='P(relaxed) — LogReg')
ax.axhline(0.5, color='black', ls='--', lw=1.2, label='Decision boundary p=0.5')
ax.set_ylim(-0.05, 1.05)
ax.set_xlabel('Time (s)')
ax.set_ylabel('P(relaxed)')
ax.set_title('Logistic Regression: Probability of Relaxed State')
ax.legend(fontsize=8); ax.grid(alpha=0.3)

plt.tight_layout()
plt.savefig("alpha_threshold_results.png", dpi=150)
print("\n  Plot saved to alpha_threshold_results.png")
