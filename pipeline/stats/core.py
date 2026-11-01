"""Gemensamma statistikfunktioner. Samma definitioner är porterade till web/src/lib/stats
och verifieras mot varandra med golden-filer (pipeline/make_golden.py)."""
from __future__ import annotations

import numpy as np


def ols(y: np.ndarray, x: np.ndarray) -> tuple[float, float]:
    """y = alpha + beta * x + e. Returnerar (alpha, beta)."""
    X = np.column_stack([np.ones_like(x), x])
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    return float(coef[0]), float(coef[1])


def half_life(spread: np.ndarray) -> float:
    """Half-life via diskretiserad Ornstein-Uhlenbeck: Δs_t = a + b s_{t-1} + e,  HL = -ln 2 / ln(1+b).

    ln(1+b) i stället för b är den exakta diskreta formen (AR(1)-koefficient φ = 1+b).
    Returnerar inf om spreaden inte är mean-reverting (b >= 0).
    """
    s = np.asarray(spread, dtype=float)
    ds = np.diff(s)
    _, b = ols(ds, s[:-1])
    if b >= 0 or b <= -1:
        return float("inf")
    return float(-np.log(2) / np.log1p(b))


def hurst(x: np.ndarray, min_lag: int = 2, max_lag: int = 100) -> float:
    """Hurst-exponent via skalning av standardavvikelsen för laggade differenser:
    std(x_{t+τ} - x_t) ∝ τ^H.  H<0,5 mean-reverting, ≈0,5 slumpvandring, >0,5 trendande."""
    x = np.asarray(x, dtype=float)
    max_lag = min(max_lag, len(x) // 2)
    lags = np.arange(min_lag, max_lag)
    tau = np.array([np.std(x[lag:] - x[:-lag]) for lag in lags])
    ok = tau > 0
    _, slope = ols(np.log(tau[ok]), np.log(lags[ok]))
    return float(slope)


def kalman_init(y: np.ndarray, x: np.ndarray, burn: int = 60) -> dict:
    """Startvärden för Kalmanfiltret från OLS på de första `burn` dagarna (bara början av fönstret).
    Utan detta startar θ i 0 och β tar upp prisnivån i stället för α."""
    alpha, beta = ols(y[:burn], x[:burn])
    r = y[:burn] - alpha - beta * x[:burn]
    ve = float(r.var())
    X = np.column_stack([x[:burn], np.ones(burn)])
    return {"theta": np.array([beta, alpha]), "P": ve * np.linalg.inv(X.T @ X), "ve": ve, "burn": burn}


def kalman_hedge(y: np.ndarray, x: np.ndarray, delta: float = 1e-4, ve: float = 1e-3,
                 theta0: np.ndarray | None = None, P0: np.ndarray | None = None) -> dict:
    """Dynamisk hedge ratio med Kalmanfilter. Tillstånd θ_t = [β_t, α_t] följer en slumpvandring:
        θ_t = θ_{t-1} + w_t,   w ~ N(0, Vw),  Vw = δ/(1-δ) · I
        y_t = [x_t, 1] θ_t + v_t,  v ~ N(0, Ve)
    Returnerar filtrerade (inte utjämnade!) skattningar – β_t använder bara data t.o.m. t,
    så det finns ingen look-ahead. Prediktionsfelet e_t och dess varians Q_t ger en
    naturlig z-score: e_t / sqrt(Q_t).
    """
    n = len(y)
    vw = delta / (1 - delta) * np.eye(2)
    theta = np.zeros(2) if theta0 is None else np.array(theta0, dtype=float)
    P = np.zeros((2, 2)) if P0 is None else np.array(P0, dtype=float)
    beta = np.empty(n); alpha = np.empty(n); e = np.empty(n); Q = np.empty(n)
    for t in range(n):
        F = np.array([x[t], 1.0])
        R = P + vw                       # a priori kovarians
        yhat = F @ theta                 # prediktion med θ_{t-1}
        Q[t] = F @ R @ F + ve
        e[t] = y[t] - yhat
        K = R @ F / Q[t]                 # Kalman gain
        theta = theta + K * e[t]
        P = R - np.outer(K, F) @ R
        beta[t], alpha[t] = theta
    return {"beta": beta, "alpha": alpha, "e": e, "Q": Q}
