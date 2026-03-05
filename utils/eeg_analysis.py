#!/usr/bin/env python3
"""
EEG BDF Analysis Script

Reads a .bdf file using MNE Python, preprocesses EEG signals, computes theta,
alpha, beta, and gamma band power at each timepoint, and performs logistic regression
to classify pre-task vs task periods.

Uses MNE's bandpass filtering, fixed-length epoching, and Hilbert transform
(see https://mne.tools/stable/auto_examples/time_frequency/time_frequency_global_field_power.html).

Usage:
    python utils/eeg_analysis.py path/to/recording.bdf
    python utils/eeg_analysis.py path/to/recording.bdf --output-dir ./plots
"""

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import mne
import numpy as np
from mne.baseline import rescale
from mne.io import read_raw_bdf
from mne import make_fixed_length_epochs
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler


# Frequency bands (Hz): theta 4-7, alpha 8-13, beta 13-30, gamma 30-50
BANDS = {
    "theta": (4, 7),
    "alpha": (8, 13),
    "beta": (13, 30),
    # "gamma": (30, 50),
}
CROP_START = 25  # seconds to trim from start
CROP_END = 160  # seconds to trim from end
PRE_TASK_DURATION = 60  # seconds (first 90s after crop = pre-task, rest = task)
NORM_START = 0  # seconds (relative to cropped data)
NORM_END = 10  # seconds (use 0-10s of cropped segment for normalization)
WINDOW_LEN = 0.3  # seconds for band power estimation
WINDOW_STRIDE = 0.15  # seconds between timepoints
DROP_CHANNELS = [2, 3]  # channel indices (0-based) to exclude


def load_and_preprocess(bdf_path: str) -> mne.io.Raw:
    """Load BDF, crop first/last 10s, pick EEG, normalize using 0-10s max amplitude."""
    raw = read_raw_bdf(bdf_path, preload=True, verbose=False)
    raw.pick_types(eeg=True, exclude="bads")

    # Drop electrodes 3 and 4 (0-based indices)
    ch_to_drop = [raw.ch_names[i] for i in DROP_CHANNELS if i < len(raw.ch_names)]
    if ch_to_drop:
        raw.drop_channels(ch_to_drop)

    # Crop first and last 10 seconds
    raw.crop(tmin=CROP_START, tmax=raw.times[-1] - CROP_END, verbose=False)

    data = raw.get_data()
    times = raw.times

    # Normalize between 0 and 1 using max amplitude from first 10 seconds (0-10s)
    # t_start = np.searchsorted(times, NORM_START)
    # t_end = np.searchsorted(times, NORM_END)
    # norm_segment = data[:, t_start:t_end]
    # data_min = norm_segment.min()
    # data_max = norm_segment.max()
    # if data_max - data_min > 0:
    #     data = (data - data_min) / (data_max - data_min)
    # else:
    #     data = np.zeros_like(data)
    # raw._data[:] = data
    return raw


def compute_bandpower_timeseries_mne(
    raw: mne.io.Raw, band_name: str, band: tuple[float, float]
) -> np.ndarray:
    """
    Compute band power at each timepoint using MNE: bandpass filter, epoch,
    Hilbert envelope, and mean GFP per epoch (following time_frequency_global_field_power).
    Returns shape (n_epochs,) - average band power across EEG channels per epoch.
    """
    raw_band = raw.copy()
    fmin, fmax = band

    # Bandpass filter (same params as MNE time-frequency example)
    raw_band.filter(
        fmin,
        fmax,
        l_trans_bandwidth=1,
        h_trans_bandwidth=1,
        verbose=False,
    )

    # Create fixed-length epochs with overlap
    overlap = WINDOW_LEN - WINDOW_STRIDE
    epochs = make_fixed_length_epochs(
        raw_band,
        duration=WINDOW_LEN,
        overlap=overlap,
        preload=True,
        reject_by_annotation=False,
        verbose=False,
    )

    # Hilbert transform for envelope (analytic signal magnitude)
    epochs.apply_hilbert(envelope=True)

    # GFP per timepoint: sum of squares across channels, then mean across time per epoch
    data = epochs.get_data()  # (n_epochs, n_channels, n_times)
    gfp = np.sum(data**2, axis=1)  # (n_epochs, n_times)
    bandpower = np.mean(gfp, axis=1)  # (n_epochs,)

    return bandpower


def compute_std_per_epoch(raw: mne.io.Raw) -> np.ndarray:
    """Compute standard deviation of each epoch (across channels and time)."""
    overlap = WINDOW_LEN - WINDOW_STRIDE
    epochs = make_fixed_length_epochs(
        raw,
        duration=WINDOW_LEN,
        overlap=overlap,
        preload=True,
        reject_by_annotation=False,
        verbose=False,
    )
    data = epochs.get_data()  # (n_epochs, n_channels, n_times)
    return np.std(data, axis=(1, 2))


def filter_amplitude_outliers(x: np.ndarray, percentile: float = 95)-> np.ndarray:
    """Replace amplitudes whose absolute value exceeds the given percentile with the previous amplitude."""
    threshold = np.nanpercentile(np.abs(x), percentile)
    out = x.copy().astype(float)
    for i in range(len(out)):
        if np.abs(out[i]) > threshold:
            out[i] = out[i - 1] if i > 0 else np.sign(out[i]) * threshold
    return out


def get_section_labels(n_windows: int, sfreq: float) -> tuple[np.ndarray, np.ndarray]:
    """Return time array and binary labels: 0=pre-task (0-90s), 1=task (90s+)."""
    times = np.arange(n_windows) * WINDOW_STRIDE + WINDOW_LEN / 2
    labels = (times >= PRE_TASK_DURATION).astype(int)
    return times, labels


def main():
    parser = argparse.ArgumentParser(description="EEG BDF analysis and classification")
    parser.add_argument("bdf_path", type=str, help="Path to .bdf file")
    parser.add_argument(
        "--output-dir",
        type=str,
        default=".",
        help="Directory for output plots (default: current directory)",
    )
    args = parser.parse_args()

    bdf_path = Path(args.bdf_path)
    if not bdf_path.exists():
        raise FileNotFoundError(f"BDF file not found: {bdf_path}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Loading and preprocessing BDF...")
    raw = load_and_preprocess(str(bdf_path))
    print(f"  EEG channels: {len(raw.ch_names)}, samples: {raw.n_times}, sfreq: {raw.info['sfreq']} Hz")
    print(f"  Duration: {raw.times[-1] - raw.times[0]:.1f} s")

    sfreq = raw.info['sfreq']
    # Compute band power time series for each band (MNE: filter, epoch, Hilbert)
    band_data = {}
    for band_name, band_range in BANDS.items():
        band_data[band_name] = compute_bandpower_timeseries_mne(raw, band_name, band_range)

    n_windows = len(next(iter(band_data.values())))
    time_arr, labels = get_section_labels(n_windows, sfreq)

    # Std per epoch
    epoch_std = compute_std_per_epoch(raw)

    # Split into pre-task and task
    pre_mask = labels == 0
    task_mask = labels == 1
    print(f"\nPre-task (0-90s): {pre_mask.sum()} windows")
    print(f"Task (90s+): {task_mask.sum()} windows")

    # Band power plots (MNE GFP style: baseline rescale, winter_r colors)
    baseline_end = min(PRE_TASK_DURATION, time_arr[-1])
    band_data_rescaled = {}
    for band_name, power in band_data.items():
        rescaled = rescale(
            power.reshape(1, -1), time_arr, baseline=(0, baseline_end)
        ).ravel()
        band_data_rescaled[band_name] = filter_amplitude_outliers(rescaled)

    # # Filter epoch std outliers
    # epoch_std = filter_amplitude_outliers(epoch_std)

    frequency_map = [
        ((name, band[0], band[1]), band_data_rescaled[name])
        for (name, _), (_, band) in zip(band_data.items(), BANDS.items())
    ]

    n_bands = len(BANDS)
    n_axes = n_bands + 1  # +1 for std plot
    fig_raw, axes_raw = plt.subplots(n_axes, 1, figsize=(10, 8), sharex=True)
    colors = plt.colormaps["winter_r"](np.linspace(0, 1, n_bands))
    times_ms = time_arr * 1e3
    axes_bands = list(axes_raw[:-1])[::-1]  # gamma top, theta bottom
    for ((freq_name, fmin, fmax), gfp_rescaled), color, ax in zip(
        frequency_map, colors, axes_bands
    ):
        ax.plot(times_ms, gfp_rescaled, label=freq_name, color=color, linewidth=2.5)
        ax.axhline(0, linestyle="--", color="grey", linewidth=2)
        ax.axvline(PRE_TASK_DURATION * 1e3, linestyle=":", color="grey", alpha=0.7)
        ax.grid(True)
        ax.set_ylabel("GFP (rescaled)")
        ax.annotate(
            f"{freq_name.capitalize()} ({int(fmin)}-{int(fmax)} Hz)",
            xy=(0.95, 0.8),
            horizontalalignment="right",
            xycoords="axes fraction",
        )
    # Epoch std plot (bottom)
    ax_std = axes_raw[-1]
    ax_std.plot(times_ms, epoch_std, color="black", linewidth=2.5)
    ax_std.axvline(PRE_TASK_DURATION * 1e3, linestyle=":", color="grey", alpha=0.7)
    ax_std.grid(True)
    ax_std.set_ylabel("Std")
    ax_std.set_xlabel("Time [ms]")
    ax_std.annotate(
        "Epoch std",
        xy=(0.95, 0.8),
        horizontalalignment="right",
        xycoords="axes fraction",
    )
    fig_raw.tight_layout()
    fig_raw.savefig(output_dir / "bandpower_raw.png", dpi=150, bbox_inches="tight")
    plt.close(fig_raw)
    print(f"Saved: {output_dir / 'bandpower_raw.png'}")

    # Logistic regression per band (using rescaled / baseline-corrected data)
    for band_name, power in band_data_rescaled.items():
        X = power.reshape(-1, 1)
        y = labels

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        clf = LogisticRegression(random_state=42, max_iter=1000)
        clf.fit(X_scaled, y)

        # Decision boundary plot
        fig, ax = plt.subplots(figsize=(10, 6))
        x_min, x_max = power.min(), power.max()
        xx = np.linspace(x_min, x_max, 200).reshape(-1, 1)
        xx_scaled = scaler.transform(xx)
        probs = clf.predict_proba(xx_scaled)[:, 1]

        ax.scatter(
            power[pre_mask],
            np.zeros(pre_mask.sum()) + 0.05,
            c="blue",
            alpha=0.5,
            label="Pre-task",
            s=20,
        )
        ax.scatter(
            power[task_mask],
            np.ones(task_mask.sum()) - 0.05,
            c="red",
            alpha=0.5,
            label="Task",
            s=20,
        )
        ax.plot(xx, probs, "k-", linewidth=2, label="P(task)")
        ax.axhline(0.5, color="gray", linestyle=":", alpha=0.7)
        ax.set_xlabel(f"{band_name.capitalize()} band power (rescaled)")
        ax.set_ylabel("Probability / Label")
        ax.set_ylim(-0.1, 1.1)
        ax.set_title(f"Logistic Regression: Pre-task vs Task ({band_name} band)")
        ax.legend()

        acc = (clf.predict(X_scaled) == y).mean() * 100
        ax.text(
            0.02,
            0.98,
            f"Accuracy: {acc:.1f}%",
            transform=ax.transAxes,
            fontsize=12,
            verticalalignment="top",
            bbox=dict(boxstyle="round", facecolor="wheat", alpha=0.5),
        )

        fig.tight_layout()
        fig.savefig(
            output_dir / f"logistic_regression_{band_name}.png",
            dpi=150,
            bbox_inches="tight",
        )
        plt.close(fig)
        print(f"Saved: {output_dir / f'logistic_regression_{band_name}.png'} ({band_name} accuracy: {acc:.1f}%)")

    print("\nDone.")


if __name__ == "__main__":
    main()
