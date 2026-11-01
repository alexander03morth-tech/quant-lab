"""Verifierar våra egna implementationer mot statsmodels/pykalman och mot kända egenskaper."""
import numpy as np
import pytest
from pykalman import KalmanFilter
from statsmodels.tsa.ar_model import AutoReg

from stats.core import half_life, hurst, kalman_hedge, ols

rng = np.random.default_rng(42)


def ou(n, phi, sigma=1.0):
    x = np.zeros(n)
    for t in range(1, n):
        x[t] = phi * x[t - 1] + sigma * rng.standard_normal()
    return x


def test_ols_matches_numpy_polyfit():
    x = rng.standard_normal(500); y = 2.0 + 0.7 * x + 0.1 * rng.standard_normal(500)
    a, b = ols(y, x)
    bb, aa = np.polyfit(x, y, 1)
    assert a == pytest.approx(aa, abs=1e-10) and b == pytest.approx(bb, abs=1e-10)


def test_half_life_matches_autoreg():
    s = ou(5000, phi=0.95)
    phi_hat = AutoReg(s, lags=1, trend="c").fit().params[1]
    assert half_life(s) == pytest.approx(-np.log(2) / np.log(phi_hat), rel=1e-8)
    # sann half-life för phi=0,95 är ln2/-ln0,95 ≈ 13,5 dagar
    assert half_life(s) == pytest.approx(13.5, rel=0.25)


def test_half_life_random_walk_is_long_or_inf():
    rw = np.cumsum(rng.standard_normal(3000))
    assert half_life(rw) > 100


def test_hurst_regimes():
    assert hurst(np.cumsum(rng.standard_normal(5000))) == pytest.approx(0.5, abs=0.07)
    assert hurst(ou(5000, 0.5)) < 0.2


def test_kalman_matches_pykalman():
    n = 400
    x = 100 + np.cumsum(rng.standard_normal(n))
    beta_true = np.linspace(0.8, 1.2, n)
    y = beta_true * x + 3 + rng.standard_normal(n)
    delta, ve = 1e-4, 1e-3
    ours = kalman_hedge(y, x, delta, ve)
    kf = KalmanFilter(
        n_dim_obs=1, n_dim_state=2,
        initial_state_mean=np.zeros(2), initial_state_covariance=np.zeros((2, 2)),
        transition_matrices=np.eye(2), transition_covariance=delta / (1 - delta) * np.eye(2),
        observation_matrices=np.column_stack([x, np.ones(n)])[:, None, :],
        observation_covariance=ve,
    )
    # pykalman behandlar initialtillståndet som tidpunkt 0:s a priori-skattning, utan extra
    # tillståndsövergång före första observationen. Vi lägger på Vw i varje steg, även det första.
    # Därför jämför vi efter en inkörningsperiod där skillnaden har klingat av.
    means, _ = kf.filter(y)
    np.testing.assert_allclose(ours["beta"][50:], means[50:, 0], rtol=2e-3)
    np.testing.assert_allclose(ours["alpha"][50:], means[50:, 1], rtol=2e-2, atol=0.05)
