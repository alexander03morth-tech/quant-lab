/**
 * Spreadmodell och signaler för pairs trading. Delas av Paranalys och Backtest.
 *
 * Tidskonvention (viktig för att undvika look-ahead):
 *   - beta[t], spread[t], z[t] och signal[t] använder bara data t.o.m. stängningen dag t.
 *   - position[t] = innehavet UNDER dag t (avkastning från stängning t−1 till t)
 *     och bestäms av signal[t − lag], där lag ≥ 1. Med lag = 1 får dagens position bara
 *     använda data t.o.m. igår.
 */
import { kalman, kalmanInit, rollingOls, rollingZ, staticSpread } from "./meanrev";

export type HedgeMethod = "static" | "rolling" | "kalman";

export interface SpreadParams {
  hedge: HedgeMethod;
  /** fönster för rullande OLS (dagar) */
  hedgeWindow: number;
  /** Kalman: hur snabbt β får ändras */
  delta: number;
  /** fönster för z-score (dagar) */
  zWindow: number;
}

export interface SpreadModel {
  alpha: Float64Array;
  beta: Float64Array;
  spread: Float64Array;
  z: Float64Array;
  /** true om modellen använder framtida data (statisk OLS över hela perioden) */
  lookAhead: boolean;
}

export function spreadModel(ly: ArrayLike<number>, lx: ArrayLike<number>, p: SpreadParams): SpreadModel {
  const n = ly.length;
  let alpha: Float64Array, beta: Float64Array;
  if (p.hedge === "static") {
    const s = staticSpread(ly, lx);
    alpha = new Float64Array(n).fill(s.alpha);
    beta = new Float64Array(n).fill(s.beta);
  } else if (p.hedge === "rolling") {
    ({ alpha, beta } = rollingOls(ly, lx, p.hedgeWindow));
  } else {
    const k = kalmanSeries(ly, lx, p.delta);
    alpha = k.alpha; beta = k.beta;
    // Kalman: spreaden är prediktionsfelet e_t = y_t − (β_{t−1}x_t + α_{t−1}), som bara använder gårdagens skattning.
    return { alpha, beta, spread: k.e, z: rollingZ(k.e, p.zWindow), lookAhead: false };
  }
  const spread = new Float64Array(n);
  for (let t = 0; t < n; t++) spread[t] = ly[t] - alpha[t] - beta[t] * lx[t];
  return { alpha, beta, spread, z: rollingZ(spread, p.zWindow), lookAhead: p.hedge === "static" };
}

export const KALMAN_BURN = 60;

/**
 * Kalmanfilter med startvärden från OLS på de första KALMAN_BURN dagarna. Värden före dess är NaN
 * (de dagarna har använts för att starta filtret och får inte användas för signaler).
 */
export function kalmanSeries(ly: ArrayLike<number>, lx: ArrayLike<number>, delta: number) {
  const n = ly.length;
  const out = { alpha: new Float64Array(n).fill(NaN), beta: new Float64Array(n).fill(NaN), e: new Float64Array(n).fill(NaN) };
  if (n <= KALMAN_BURN + 5) return out;
  const init = kalmanInit(ly, lx, KALMAN_BURN);
  const k = kalman(Array.prototype.slice.call(ly, KALMAN_BURN), Array.prototype.slice.call(lx, KALMAN_BURN), delta, init.ve, init);
  out.alpha.set(k.alpha, KALMAN_BURN); out.beta.set(k.beta, KALMAN_BURN); out.e.set(k.e, KALMAN_BURN);
  return out;
}

export interface SignalParams {
  entry: number;
  exit: number;
  /** stop-loss i |z|; Infinity = ingen stop */
  stop: number;
}

export type Side = -1 | 0 | 1;

export interface SignalEvent {
  t: number;
  kind: "long" | "short" | "exit" | "stop";
  z: number;
}

/**
 * Tillståndsmaskin. +1 = lång spread (köp y, sälj β·x) när z ≤ −entry,
 * −1 = kort spread när z ≥ entry. Stäng när |z| ≤ exit eller |z| ≥ stop.
 * Efter en stop väntar vi tills |z| har gått under entry innan ny position tillåts
 * (annars öppnar man direkt igen i samma trend).
 */
export function signals(z: ArrayLike<number>, p: SignalParams): { state: Int8Array; events: SignalEvent[] } {
  const n = z.length;
  const state = new Int8Array(n);
  const events: SignalEvent[] = [];
  let s: Side = 0;
  let cooldown = false;
  for (let t = 0; t < n; t++) {
    const v = z[t];
    if (!Number.isFinite(v)) { state[t] = s; continue; }
    if (cooldown && Math.abs(v) < p.entry) cooldown = false;
    if (s === 0) {
      if (!cooldown && v <= -p.entry && v > -p.stop) { s = 1; events.push({ t, kind: "long", z: v }); }
      else if (!cooldown && v >= p.entry && v < p.stop) { s = -1; events.push({ t, kind: "short", z: v }); }
    } else {
      const stopHit = Math.abs(v) >= p.stop && Math.sign(v) === -s;
      const exitHit = s === 1 ? v >= -p.exit : v <= p.exit;
      if (stopHit) { s = 0; cooldown = true; events.push({ t, kind: "stop", z: v }); }
      else if (exitHit) { s = 0; events.push({ t, kind: "exit", z: v }); }
    }
    state[t] = s;
  }
  return { state, events };
}

/** position[t] = state[t − lag]. Första `lag` dagarna är platta. */
export function positionsFromState(state: Int8Array, lag = 1): Int8Array {
  const pos = new Int8Array(state.length);
  for (let t = lag; t < state.length; t++) pos[t] = state[t - lag];
  return pos;
}
