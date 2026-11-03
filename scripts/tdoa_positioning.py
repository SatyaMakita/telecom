#!/usr/bin/env python3
"""
TDOA (Time Difference of Arrival) Positioning Simulation
=========================================================

DISCLAIMER: This script uses ONLY synthetic/fictional data.
It does NOT locate real subscribers. All cell-site coordinates
and device positions are entirely fictional and intended solely
for educational laboratory exercises.

This script demonstrates TDOA-based geolocation, a technique
used in cellular networks to estimate a mobile device's position
by measuring the *differences* in signal arrival times at multiple
base stations.

TDOA Math Overview
------------------
Given N base stations at known positions (x_i, y_i), the range
from an unknown device position (x, y) to each station is:

    d_i = sqrt((x - x_i)^2 + (y - y_i)^2)

Choosing station 0 as the reference, the range difference is:

    delta_d_{i,0} = d_i - d_0

This range difference relates to the measured time difference via:

    delta_d_{i,0} = c * delta_t_{i,0}

where c = 3e8 m/s (speed of light).

Each TDOA measurement constrains the device to lie on a hyperbola
with foci at the two involved stations. With N-1 independent TDOA
measurements (from N stations), the device position is found at
the intersection of these hyperbolas.

Usage
-----
    python3 scripts/tdoa_positioning.py
    python3 scripts/tdoa_positioning.py --noise-sigma 30e-9 --trials 500
    python3 scripts/tdoa_positioning.py --output-dir /tmp/tdoa_plots
"""

import argparse
import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for saving plots

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import pandas as pd
from scipy.optimize import least_squares

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SPEED_OF_LIGHT = 3e8  # m/s

# Synthetic "true" device position (lat, lon)
TRUE_DEVICE_LAT = 19.0800
TRUE_DEVICE_LON = 72.8800

# Earth radius for flat-earth projection (meters)
EARTH_RADIUS = 6_371_000


# ===========================================================================
# Coordinate Conversion
# ===========================================================================

def latlon_to_xy(lat, lon, lat0, lon0):
    """
    Convert latitude/longitude to local XY coordinates (meters) using a
    flat-earth (equirectangular) approximation centred on (lat0, lon0).

    This approximation is accurate for small areas (< ~50 km).

    Formulae:
        x = R * (lon - lon0) * cos(lat0)       [East-West, meters]
        y = R * (lat - lat0)                     [North-South, meters]

    where R = 6,371,000 m is the mean Earth radius and angles are in radians.

    Parameters
    ----------
    lat, lon : float or array-like
        Latitude and longitude in decimal degrees.
    lat0, lon0 : float
        Reference origin (centroid) in decimal degrees.

    Returns
    -------
    x, y : float or ndarray
        Easting and northing in meters relative to the origin.
    """
    lat_r = np.radians(lat)
    lon_r = np.radians(lon)
    lat0_r = np.radians(lat0)
    lon0_r = np.radians(lon0)

    x = EARTH_RADIUS * (lon_r - lon0_r) * np.cos(lat0_r)
    y = EARTH_RADIUS * (lat_r - lat0_r)
    return x, y


def xy_to_latlon(x, y, lat0, lon0):
    """
    Convert local XY coordinates (meters) back to lat/lon using the
    inverse flat-earth approximation.

    Parameters
    ----------
    x, y : float or array-like
        Easting and northing in meters.
    lat0, lon0 : float
        Reference origin in decimal degrees.

    Returns
    -------
    lat, lon : float or ndarray
        Latitude and longitude in decimal degrees.
    """
    lat0_r = np.radians(lat0)

    lat = lat0 + np.degrees(y / EARTH_RADIUS)
    lon = lon0 + np.degrees(x / (EARTH_RADIUS * np.cos(lat0_r)))
    return lat, lon


# ===========================================================================
# TDOA Functions
# ===========================================================================

def compute_ranges(device_xy, site_xys):
    """
    Compute Euclidean distances from a device to each site.

    d_i = sqrt((x - x_i)^2 + (y - y_i)^2)

    Parameters
    ----------
    device_xy : array-like, shape (2,)
        Device position [x, y] in meters.
    site_xys : ndarray, shape (N, 2)
        Site positions, each row [x_i, y_i] in meters.

    Returns
    -------
    ranges : ndarray, shape (N,)
        Distances in meters from the device to each site.
    """
    dx = site_xys[:, 0] - device_xy[0]
    dy = site_xys[:, 1] - device_xy[1]
    return np.sqrt(dx**2 + dy**2)


def compute_tdoa(ranges, c=SPEED_OF_LIGHT):
    """
    Compute TDOA values (time differences) relative to the first site
    (reference site, index 0).

    delta_t_{i,0} = (d_i - d_0) / c

    Parameters
    ----------
    ranges : ndarray, shape (N,)
        Ranges from device to each site.
    c : float
        Speed of light in m/s.

    Returns
    -------
    tdoa : ndarray, shape (N-1,)
        Time differences in seconds (site i minus site 0).
    """
    range_diffs = ranges[1:] - ranges[0]
    return range_diffs / c


def add_tdoa_noise(tdoa, sigma_s):
    """
    Add Gaussian noise to TDOA measurements.

    Parameters
    ----------
    tdoa : ndarray, shape (N-1,)
        Clean TDOA values in seconds.
    sigma_s : float
        Standard deviation of timing noise in seconds.
        Example: 50e-9 s  ≈  15 m range error (50 ns × 3e8 m/s = 15 m).

    Returns
    -------
    noisy_tdoa : ndarray, shape (N-1,)
        TDOA values with additive Gaussian noise.
    """
    noise = np.random.normal(0, sigma_s, size=tdoa.shape)
    return tdoa + noise


def tdoa_residuals(params, site_xys, measured_tdoa, c=SPEED_OF_LIGHT):
    """
    Residual function for TDOA least-squares estimation.

    For each TDOA measurement i (i = 1 .. N-1, relative to reference site 0):

        predicted_delta_d_i = d_i(x, y) - d_0(x, y)
        measured_delta_d_i  = c * measured_tdoa_i
        residual_i          = predicted_delta_d_i - measured_delta_d_i

    Parameters
    ----------
    params : array-like, shape (2,)
        Estimated device position [x, y] in meters.
    site_xys : ndarray, shape (N, 2)
        Site positions in meters.
    measured_tdoa : ndarray, shape (N-1,)
        Measured time differences in seconds.
    c : float
        Speed of light.

    Returns
    -------
    residuals : ndarray, shape (N-1,)
        Differences between predicted and measured range differences.
    """
    x, y = params
    # Distances from estimated position to each site
    ranges = compute_ranges(np.array([x, y]), site_xys)

    # Predicted range differences relative to reference (site 0)
    predicted_range_diffs = ranges[1:] - ranges[0]

    # Measured range differences (convert time back to distance)
    measured_range_diffs = c * measured_tdoa

    return predicted_range_diffs - measured_range_diffs


def solve_tdoa(site_xys, measured_tdoa, initial_guess=None, c=SPEED_OF_LIGHT):
    """
    Solve the TDOA equations using nonlinear least-squares.

    Uses scipy.optimize.least_squares with the Trust Region Reflective
    algorithm (robust to poor initial guesses).

    Parameters
    ----------
    site_xys : ndarray, shape (N, 2)
        Site positions in meters.
    measured_tdoa : ndarray, shape (N-1,)
        Measured TDOA values in seconds.
    initial_guess : array-like or None
        Starting position estimate [x, y]. Defaults to centroid of sites.
    c : float
        Speed of light.

    Returns
    -------
    estimated_xy : ndarray, shape (2,)
        Estimated device position in meters.
    result : OptimizeResult
        Full result object from scipy.optimize.least_squares.
    """
    if initial_guess is None:
        initial_guess = np.mean(site_xys, axis=0)

    result = least_squares(
        tdoa_residuals,
        x0=initial_guess,
        args=(site_xys, measured_tdoa, c),
        method="trf",  # Trust Region Reflective
        loss="soft_l1",  # Robust to outliers
        max_nfev=5000,
    )

    return result.x, result


# ===========================================================================
# Monte Carlo Simulation
# ===========================================================================

def run_monte_carlo(site_xys, true_xy, n_trials, sigma_s, c=SPEED_OF_LIGHT):
    """
    Run a Monte Carlo simulation: repeat the TDOA estimation N times with
    different noise realisations and collect position errors.

    Parameters
    ----------
    site_xys : ndarray, shape (N, 2)
    true_xy : ndarray, shape (2,)
    n_trials : int
    sigma_s : float
        TDOA noise standard deviation in seconds.

    Returns
    -------
    errors : ndarray, shape (n_trials,)
        Euclidean position error for each trial (meters).
    estimates : ndarray, shape (n_trials, 2)
        Estimated [x, y] for each trial.
    n_failures : int
        Number of trials where the solver did not converge.
    """
    true_ranges = compute_ranges(true_xy, site_xys)
    true_tdoa = compute_tdoa(true_ranges, c)
    centroid = np.mean(site_xys, axis=0)

    errors = np.full(n_trials, np.nan)
    estimates = np.full((n_trials, 2), np.nan)
    n_failures = 0

    for i in range(n_trials):
        noisy_tdoa = add_tdoa_noise(true_tdoa, sigma_s)
        try:
            est_xy, result = solve_tdoa(site_xys, noisy_tdoa, centroid, c)
            if not result.success:
                n_failures += 1
                continue
            estimates[i] = est_xy
            errors[i] = np.linalg.norm(est_xy - true_xy)
        except Exception:
            n_failures += 1

    return errors, estimates, n_failures


# ===========================================================================
# Visualisation Helpers
# ===========================================================================

def plot_tdoa_hyperbolas(ax, site_xys, measured_tdoa, c=SPEED_OF_LIGHT,
                         grid_extent=2000, n_grid=500):
    """
    Overlay TDOA hyperbolas on an axis.

    For each TDOA measurement, we plot the locus of points satisfying:
        d_i(x,y) - d_0(x,y) = c * delta_t_i

    This is done by evaluating the implicit function on a grid and
    contouring the zero level-set.
    """
    centroid = np.mean(site_xys, axis=0)
    xs = np.linspace(centroid[0] - grid_extent, centroid[0] + grid_extent, n_grid)
    ys = np.linspace(centroid[1] - grid_extent, centroid[1] + grid_extent, n_grid)
    X, Y = np.meshgrid(xs, ys)

    ref = site_xys[0]
    d0 = np.sqrt((X - ref[0])**2 + (Y - ref[1])**2)

    colors = ["#e74c3c", "#2ecc71", "#9b59b6"]
    for i, tdoa_val in enumerate(measured_tdoa):
        site = site_xys[i + 1]
        di = np.sqrt((X - site[0])**2 + (Y - site[1])**2)
        F = (di - d0) - c * tdoa_val
        color = colors[i % len(colors)]
        ax.contour(X, Y, F, levels=[0], colors=[color], linewidths=1.2,
                   linestyles="--", alpha=0.8)

    # Legend proxies
    for i in range(len(measured_tdoa)):
        color = colors[i % len(colors)]
        ax.plot([], [], "--", color=color,
                label=f"TDOA hyperbola (Site {i+1} vs Ref)")


def plot_scenario(site_xys, site_labels, true_xy, est_xy, measured_tdoa,
                  output_path):
    """
    Plot 1: Scenario overview — sites, true & estimated positions, hyperbolas.
    """
    fig, ax = plt.subplots(figsize=(9, 8))

    # TDOA hyperbolas (background)
    plot_tdoa_hyperbolas(ax, site_xys, measured_tdoa)

    # Sites
    ax.scatter(site_xys[:, 0], site_xys[:, 1], s=160, c="#3498db",
               marker="^", zorder=5, edgecolors="k", linewidths=0.8,
               label="Cell Sites")
    for i, lbl in enumerate(site_labels):
        ax.annotate(lbl, (site_xys[i, 0], site_xys[i, 1]),
                    textcoords="offset points", xytext=(8, 8),
                    fontsize=8, color="#2c3e50", fontweight="bold")

    # True position
    ax.scatter(*true_xy, s=120, c="#27ae60", marker="*", zorder=6,
               edgecolors="k", linewidths=0.5, label="True Position")

    # Estimated position
    ax.scatter(*est_xy, s=100, c="#e74c3c", marker="x", zorder=6,
               linewidths=2, label="Estimated Position")

    # Error line
    ax.plot([true_xy[0], est_xy[0]], [true_xy[1], est_xy[1]],
            "k--", linewidth=0.8, alpha=0.6)

    err = np.linalg.norm(est_xy - true_xy)
    ax.set_title(f"TDOA Positioning — Single Trial (error = {err:.1f} m)",
                 fontsize=13, fontweight="bold")
    ax.set_xlabel("Easting (m)")
    ax.set_ylabel("Northing (m)")
    ax.legend(loc="upper left", fontsize=8)
    ax.set_aspect("equal")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print(f"  → Saved scenario plot: {output_path}")


def plot_monte_carlo_scatter(site_xys, site_labels, true_xy, estimates,
                             output_path):
    """
    Plot 2: Monte Carlo scatter with 2-sigma uncertainty ellipse.
    """
    valid = ~np.isnan(estimates[:, 0])
    est_valid = estimates[valid]

    fig, ax = plt.subplots(figsize=(9, 8))

    # Scatter of estimates
    ax.scatter(est_valid[:, 0], est_valid[:, 1], s=4, alpha=0.35,
               c="#3498db", label=f"Estimates (n={valid.sum()})")

    # True position
    ax.scatter(*true_xy, s=150, c="#27ae60", marker="*", zorder=6,
               edgecolors="k", linewidths=0.5, label="True Position")

    # Sites
    ax.scatter(site_xys[:, 0], site_xys[:, 1], s=100, c="#e67e22",
               marker="^", zorder=5, edgecolors="k", linewidths=0.8,
               label="Cell Sites")
    for i, lbl in enumerate(site_labels):
        ax.annotate(lbl, (site_xys[i, 0], site_xys[i, 1]),
                    textcoords="offset points", xytext=(8, 8),
                    fontsize=8, color="#2c3e50", fontweight="bold")

    # 2-sigma uncertainty ellipse
    if est_valid.shape[0] > 2:
        mean_est = np.mean(est_valid, axis=0)
        cov = np.cov(est_valid.T)
        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        # Sort descending
        order = eigenvalues.argsort()[::-1]
        eigenvalues = eigenvalues[order]
        eigenvectors = eigenvectors[:, order]

        angle = np.degrees(np.arctan2(eigenvectors[1, 0], eigenvectors[0, 0]))
        # 2-sigma ≈ 95.45% confidence for 2D Gaussian
        width = 2 * 2 * np.sqrt(eigenvalues[0])
        height = 2 * 2 * np.sqrt(eigenvalues[1])

        ellipse = patches.Ellipse(
            mean_est, width, height, angle=angle,
            fill=False, edgecolor="#e74c3c", linewidth=2,
            linestyle="--", label="2σ Uncertainty Ellipse"
        )
        ax.add_patch(ellipse)

    ax.set_title("Monte Carlo TDOA Position Estimates", fontsize=13,
                 fontweight="bold")
    ax.set_xlabel("Easting (m)")
    ax.set_ylabel("Northing (m)")
    ax.legend(loc="upper left", fontsize=8)
    ax.set_aspect("equal")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print(f"  → Saved Monte Carlo scatter plot: {output_path}")


def plot_error_cdf(errors, output_path):
    """
    Plot 3: CDF of position error across Monte Carlo trials.
    """
    valid = errors[~np.isnan(errors)]
    sorted_err = np.sort(valid)
    cdf = np.arange(1, len(sorted_err) + 1) / len(sorted_err)

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(sorted_err, cdf * 100, color="#2980b9", linewidth=2)

    # Mark CEP50 and CEP95
    cep50 = np.percentile(valid, 50)
    cep95 = np.percentile(valid, 95)
    ax.axhline(50, color="#27ae60", linestyle=":", alpha=0.7)
    ax.axvline(cep50, color="#27ae60", linestyle=":", alpha=0.7,
               label=f"CEP50 = {cep50:.1f} m")
    ax.axhline(95, color="#e74c3c", linestyle=":", alpha=0.7)
    ax.axvline(cep95, color="#e74c3c", linestyle=":", alpha=0.7,
               label=f"CEP95 = {cep95:.1f} m")

    ax.set_xlabel("Position Error (m)", fontsize=11)
    ax.set_ylabel("Cumulative Probability (%)", fontsize=11)
    ax.set_title("CDF of TDOA Position Error", fontsize=13, fontweight="bold")
    ax.legend(fontsize=10)
    ax.grid(True, alpha=0.3)
    ax.set_xlim(left=0)
    ax.set_ylim(0, 100)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print(f"  → Saved error CDF plot: {output_path}")


def plot_sensitivity(site_xys, true_xy, output_path, n_trials=100):
    """
    Plot 4: Sensitivity analysis — median position error vs. noise level.

    Sweeps TDOA noise sigma from 10 ns to 200 ns and plots the resulting
    median and 95th-percentile errors.
    """
    sigmas_ns = np.array([10, 20, 30, 50, 75, 100, 150, 200])
    sigmas_s = sigmas_ns * 1e-9
    medians = []
    p95s = []

    for sig in sigmas_s:
        errors, _, _ = run_monte_carlo(site_xys, true_xy, n_trials, sig)
        valid = errors[~np.isnan(errors)]
        if len(valid) > 0:
            medians.append(np.median(valid))
            p95s.append(np.percentile(valid, 95))
        else:
            medians.append(np.nan)
            p95s.append(np.nan)

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(sigmas_ns, medians, "o-", color="#2980b9", linewidth=2,
            markersize=6, label="Median Error")
    ax.plot(sigmas_ns, p95s, "s--", color="#e74c3c", linewidth=2,
            markersize=6, label="95th Percentile Error")

    # Reference lines for range error equivalence
    range_errors = sigmas_ns * 1e-9 * SPEED_OF_LIGHT
    ax2 = ax.twiny()
    ax2.set_xlim(ax.get_xlim())
    ax2.set_xticks(sigmas_ns)
    ax2.set_xticklabels([f"{r:.0f}" for r in range_errors], fontsize=8)
    ax2.set_xlabel("Equivalent Range Error (m)", fontsize=10)

    ax.set_xlabel("TDOA Noise σ (ns)", fontsize=11)
    ax.set_ylabel("Position Error (m)", fontsize=11)
    ax.set_title("Sensitivity: Position Error vs. Noise Level", fontsize=13,
                 fontweight="bold")
    ax.legend(fontsize=10)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    print(f"  → Saved sensitivity plot: {output_path}")


# ===========================================================================
# Main
# ===========================================================================

def main():
    # ------------------------------------------------------------------
    # Argument parsing
    # ------------------------------------------------------------------
    parser = argparse.ArgumentParser(
        description="TDOA Positioning Simulation (synthetic data only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Example: python3 scripts/tdoa_positioning.py --trials 500 --noise-sigma 30e-9",
    )
    parser.add_argument(
        "--noise-sigma", type=float, default=50e-9,
        help="TDOA noise standard deviation in seconds (default: 50e-9 = 50 ns ≈ 15 m range error)",
    )
    parser.add_argument(
        "--trials", type=int, default=200,
        help="Number of Monte Carlo trials (default: 200)",
    )
    parser.add_argument(
        "--output-dir", type=str,
        default=os.path.expanduser("~/telecom-lab/data"),
        help="Directory to save output plots (default: ~/telecom-lab/data/)",
    )
    args = parser.parse_args()

    sigma_s = args.noise_sigma
    n_trials = args.trials
    output_dir = args.output_dir

    # ------------------------------------------------------------------
    # Banner
    # ------------------------------------------------------------------
    print("=" * 70)
    print("  TDOA (Time Difference of Arrival) Positioning Simulation")
    print("  --------------------------------------------------------")
    print("  *** SYNTHETIC / FICTIONAL DATA ONLY ***")
    print("  This does NOT locate real subscribers.")
    print("=" * 70)
    print()

    # ------------------------------------------------------------------
    # Step 1: Load cell sites from CSV
    # ------------------------------------------------------------------
    print("[Step 1] Loading cell-site data from CSV ...")
    script_dir = Path(__file__).resolve().parent
    csv_path = script_dir.parent / "data" / "synthetic_sites.csv"

    if not csv_path.exists():
        print(f"  ERROR: {csv_path} not found. Exiting.")
        sys.exit(1)

    sites_df = pd.read_csv(csv_path)
    print(f"  Loaded {len(sites_df)} sites:")
    for _, row in sites_df.iterrows():
        print(f"    {row['site_id']:12s}  {row['technology']:4s}  "
              f"({row['latitude']:.4f}, {row['longitude']:.4f})  "
              f"— {row['description']}")
    print()

    # ------------------------------------------------------------------
    # Step 2: Synthetic "true" device position
    # ------------------------------------------------------------------
    print("[Step 2] Defining synthetic true device position ...")
    print(f"  True device location: ({TRUE_DEVICE_LAT}, {TRUE_DEVICE_LON})")
    print("  (This is a fictional position within the coverage area.)")
    print()

    # ------------------------------------------------------------------
    # Step 3: Convert lat/lon → local XY (meters)
    # ------------------------------------------------------------------
    print("[Step 3] Converting lat/lon to local XY coordinates (meters) ...")
    print("  Using flat-earth (equirectangular) projection centred on site centroid.")

    lat0 = sites_df["latitude"].mean()
    lon0 = sites_df["longitude"].mean()
    print(f"  Centroid: ({lat0:.4f}, {lon0:.4f})")

    site_xys = np.column_stack(
        latlon_to_xy(sites_df["latitude"].values, sites_df["longitude"].values,
                     lat0, lon0)
    )
    true_xy = np.array(latlon_to_xy(TRUE_DEVICE_LAT, TRUE_DEVICE_LON, lat0, lon0))

    print("  Site positions (meters from centroid):")
    for i, row in sites_df.iterrows():
        print(f"    {row['site_id']:12s}  x = {site_xys[i, 0]:+8.1f} m, "
              f"y = {site_xys[i, 1]:+8.1f} m")
    print(f"  True device:        x = {true_xy[0]:+8.1f} m, "
          f"y = {true_xy[1]:+8.1f} m")
    print()

    # ------------------------------------------------------------------
    # Step 4: Compute true ranges
    # ------------------------------------------------------------------
    print("[Step 4] Computing true ranges from device to each site ...")
    print("  Formula: d_i = sqrt((x - x_i)^2 + (y - y_i)^2)")
    true_ranges = compute_ranges(true_xy, site_xys)
    for i, row in sites_df.iterrows():
        print(f"    d({row['site_id']}) = {true_ranges[i]:.1f} m")
    print()

    # ------------------------------------------------------------------
    # Step 5: Compute TDOA values
    # ------------------------------------------------------------------
    print("[Step 5] Computing TDOA values (time differences relative to reference site) ...")
    print(f"  Reference site: {sites_df.iloc[0]['site_id']}")
    print(f"  Formula: delta_t_{{i,0}} = (d_i - d_0) / c,  c = {SPEED_OF_LIGHT:.0e} m/s")
    true_tdoa = compute_tdoa(true_ranges)
    for i, td in enumerate(true_tdoa):
        print(f"    TDOA({sites_df.iloc[i+1]['site_id']} − {sites_df.iloc[0]['site_id']}) "
              f"= {td*1e9:+.2f} ns  (Δd = {td * SPEED_OF_LIGHT:+.1f} m)")
    print()

    # ------------------------------------------------------------------
    # Step 6: Add Gaussian noise
    # ------------------------------------------------------------------
    print(f"[Step 6] Adding Gaussian noise (σ = {sigma_s*1e9:.1f} ns ≈ "
          f"{sigma_s * SPEED_OF_LIGHT:.1f} m range error) ...")
    np.random.seed(42)  # Reproducibility for the single-trial demo
    noisy_tdoa = add_tdoa_noise(true_tdoa, sigma_s)
    for i, (clean, noisy) in enumerate(zip(true_tdoa, noisy_tdoa)):
        print(f"    TDOA {i+1}: clean = {clean*1e9:+.2f} ns → "
              f"noisy = {noisy*1e9:+.2f} ns  "
              f"(noise = {(noisy - clean)*1e9:+.2f} ns)")
    print()

    # ------------------------------------------------------------------
    # Step 7: Solve TDOA equations
    # ------------------------------------------------------------------
    print("[Step 7] Solving TDOA equations via nonlinear least-squares ...")
    print("  Algorithm: Trust Region Reflective (scipy.optimize.least_squares)")
    print("  Initial guess: centroid of cell sites")

    est_xy, result = solve_tdoa(site_xys, noisy_tdoa)
    print(f"  Solver converged: {result.success}")
    print(f"  Cost (sum of squared residuals): {result.cost:.4f}")
    print(f"  Estimated position: x = {est_xy[0]:+.1f} m, y = {est_xy[1]:+.1f} m")
    print()

    # ------------------------------------------------------------------
    # Step 8: Error metrics
    # ------------------------------------------------------------------
    print("[Step 8] Computing error metrics ...")
    error_m = np.linalg.norm(est_xy - true_xy)
    est_lat, est_lon = xy_to_latlon(est_xy[0], est_xy[1], lat0, lon0)
    print(f"  Euclidean error: {error_m:.1f} m")
    print(f"  True position  (lat, lon): ({TRUE_DEVICE_LAT:.6f}, {TRUE_DEVICE_LON:.6f})")
    print(f"  Est. position  (lat, lon): ({est_lat:.6f}, {est_lon:.6f})")
    print()

    # ------------------------------------------------------------------
    # Step 9: Monte Carlo simulation
    # ------------------------------------------------------------------
    print(f"[Step 9] Running Monte Carlo simulation ({n_trials} trials) ...")
    print(f"  Each trial adds fresh Gaussian noise (σ = {sigma_s*1e9:.1f} ns) "
          f"and re-solves.")
    np.random.seed(None)  # Re-seed for Monte Carlo randomness

    mc_errors, mc_estimates, n_failures = run_monte_carlo(
        site_xys, true_xy, n_trials, sigma_s
    )
    valid_errors = mc_errors[~np.isnan(mc_errors)]

    mean_err = np.mean(valid_errors)
    median_err = np.median(valid_errors)
    p95_err = np.percentile(valid_errors, 95)
    cep50 = np.percentile(valid_errors, 50)
    cep95 = np.percentile(valid_errors, 95)

    print(f"\n  Monte Carlo Results ({len(valid_errors)} converged / "
          f"{n_trials} total, {n_failures} failures):")
    print(f"  {'─' * 40}")
    print(f"  Mean error:       {mean_err:8.1f} m")
    print(f"  Median error:     {median_err:8.1f} m")
    print(f"  95th percentile:  {p95_err:8.1f} m")
    print(f"  CEP50:            {cep50:8.1f} m")
    print(f"  CEP95:            {cep95:8.1f} m")
    print()

    # ------------------------------------------------------------------
    # Step 10: Generate visualisations
    # ------------------------------------------------------------------
    print(f"[Step 10] Generating visualisations → {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    site_labels = sites_df["site_id"].tolist()

    # Plot 1: Scenario overview
    plot_scenario(
        site_xys, site_labels, true_xy, est_xy, noisy_tdoa,
        os.path.join(output_dir, "tdoa_scenario.png"),
    )

    # Plot 2: Monte Carlo scatter
    plot_monte_carlo_scatter(
        site_xys, site_labels, true_xy, mc_estimates,
        os.path.join(output_dir, "tdoa_monte_carlo.png"),
    )

    # Plot 3: Error CDF
    plot_error_cdf(
        mc_errors,
        os.path.join(output_dir, "tdoa_error_cdf.png"),
    )

    # Plot 4: Sensitivity analysis
    print("  Running sensitivity sweep (this may take a moment) ...")
    plot_sensitivity(
        site_xys, true_xy,
        os.path.join(output_dir, "tdoa_sensitivity.png"),
        n_trials=min(100, n_trials),  # Use fewer trials for speed
    )

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print()
    print("=" * 70)
    print("  Simulation complete!")
    print(f"  Plots saved to: {output_dir}")
    print("  Files:")
    for fname in ["tdoa_scenario.png", "tdoa_monte_carlo.png",
                   "tdoa_error_cdf.png", "tdoa_sensitivity.png"]:
        fpath = os.path.join(output_dir, fname)
        print(f"    • {fpath}")
    print("=" * 70)


if __name__ == "__main__":
    main()
