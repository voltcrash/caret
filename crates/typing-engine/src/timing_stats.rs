//! Key timing statistics over the keySpacing/keyDuration arrays a result submits.
//!
//! Pure math shared by the event log viewer, backend review signals and the
//! offline calibration script. Chart-only shaping stays in the viewer.
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BTreeSet;
use ts_rs::TS;

#[derive(Clone, Copy, Debug, PartialEq, Deserialize, Serialize, TS)]
pub struct Significant {
    pub r: f64,
    pub sigmas: f64,
}
#[derive(Clone, Copy, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Quantum {
    pub period_ms: f64,
    pub strength: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DistStats {
    pub n: usize,
    pub min: f64,
    pub p10: f64,
    pub p50: f64,
    pub p90: f64,
    pub max: f64,
    pub mean: f64,
    pub sd: f64,
    pub cv: f64,
    /// The two halves of the body relative to the median. Kept apart: a mixed
    /// log widens the upper half enough to hide a pinched lower half.
    pub spread_low: Option<f64>,
    pub spread_high: Option<f64>,
    /// Only order-dependent stat; standard error under independence is 1/sqrt(n).
    pub autocorrelation: Option<Significant>,
    /// Runs above/below the median; exact null under independence.
    pub runs_z: Option<f64>,
    /// Median of the last third over the first third. 1.00 is stationary.
    pub drift: Option<f64>,
    /// Coarsest grid the values sit on. Browser clock coarsening makes a fine one normal.
    pub quantum: Option<Quantum>,
    /// A generator drawing from a small pool gives a tiny count even off-grid.
    pub distinct_count: usize,
    /// Excess kurtosis; the shape axis tail ratios cannot see.
    pub kurtosis: Option<f64>,
    pub skew: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CrossStats {
    pub lag0: Option<Significant>,
    pub lag1: Option<Significant>,
    pub overlap_rate: Option<f64>,
    pub overlap_runs_z: Option<f64>,
}

/// Values above this multiple of the median are pauses, not typing.
pub const PAUSE_CUTOFF_MULTIPLE: f64 = 2.5;

/// Ascending, stable, matching `sort((a, b) => a - b)`.
pub(crate) fn sorted(values: &[f64]) -> Vec<f64> {
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(Ordering::Equal));
    sorted
}
fn mean(values: &[f64]) -> f64 {
    values.iter().sum::<f64>() / values.len() as f64
}
fn median_of_sorted(sorted: &[f64]) -> f64 {
    sorted[sorted.len() / 2]
}

/// Lag-1 autocorrelation of the logs. Logs because one long pause has enormous
/// leverage on a covariance, and typing speed varies multiplicatively anyway.
pub fn autocorrelation(values: &[f64]) -> Option<Significant> {
    // None keeps the position, so a dropped value breaks its pair
    let logs: Vec<Option<f64>> = values.iter().map(|&v| (v > 0.0).then(|| v.ln())).collect();
    let present: Vec<f64> = logs.iter().flatten().copied().collect();
    if present.len() < 30 {
        return None;
    }
    let mean = mean(&present);
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    let mut pairs = 0usize;
    for (i, current) in logs.iter().enumerate() {
        let Some(current) = current else { continue };
        denominator += (current - mean) * (current - mean);
        if let Some(Some(previous)) = i.checked_sub(1).map(|j| logs[j]) {
            numerator += (current - mean) * (previous - mean);
            pairs += 1;
        }
    }
    if denominator <= 0.0 || pairs < 30 {
        return None;
    }
    let r = numerator / denominator;
    Some(Significant {
        r,
        sigmas: r * (pairs as f64).sqrt(),
    })
}

/// Wald-Wolfowitz runs test. Negative z: the series clumps (momentum).
pub fn runs_z_from_signs(signs: &[bool]) -> Option<f64> {
    let n = signs.len();
    if n < 30 {
        return None;
    }
    let above = signs.iter().filter(|&&s| s).count();
    let below = n - above;
    if above == 0 || below == 0 {
        return None;
    }
    let runs = 1 + signs.windows(2).filter(|w| w[0] != w[1]).count();
    let (n, above, below) = (n as f64, above as f64, below as f64);
    let expected = (2.0 * above * below) / n + 1.0;
    let variance = (2.0 * above * below * (2.0 * above * below - n)) / (n * n * (n - 1.0));
    if variance <= 0.0 {
        return None;
    }
    Some((runs as f64 - expected) / variance.sqrt())
}

pub fn runs_z(values: &[f64]) -> Option<f64> {
    if values.len() < 30 {
        return None;
    }
    let median = median_of_sorted(&sorted(values));
    let signs: Vec<bool> = values
        .iter()
        .filter(|&&v| v != median)
        .map(|&v| v > median)
        .collect();
    runs_z_from_signs(&signs)
}

/// Humans drift - warming up, tiring - so exactly 1.00 means a stationary series.
pub fn drift(values: &[f64]) -> Option<f64> {
    if values.len() < 60 {
        return None;
    }
    let third = values.len() / 3;
    let first = median_of_sorted(&sorted(&values[..third]));
    if first <= 0.0 {
        return None;
    }
    Some(median_of_sorted(&sorted(&values[values.len() - third..])) / first)
}

/// Pearson correlation of the logs of two index-aligned series.
pub fn correlate_logs(xs: &[f64], ys: &[f64]) -> Option<Significant> {
    let (log_x, log_y): (Vec<f64>, Vec<f64>) = xs
        .iter()
        .zip(ys)
        .filter(|&(&x, &y)| x > 0.0 && y > 0.0)
        .map(|(x, y)| (x.ln(), y.ln()))
        .unzip();
    if log_x.len() < 30 {
        return None;
    }
    let mean_x = mean(&log_x);
    let mean_y = mean(&log_y);
    let mut covariance = 0.0;
    let mut var_x = 0.0;
    let mut var_y = 0.0;
    for (x, y) in log_x.iter().zip(&log_y) {
        let dx = x - mean_x;
        let dy = y - mean_y;
        covariance += dx * dy;
        var_x += dx * dx;
        var_y += dy * dy;
    }
    if var_x <= 0.0 || var_y <= 0.0 {
        return None;
    }
    let r = covariance / (var_x * var_y).sqrt();
    Some(Significant {
        r,
        sigmas: r * (log_x.len() as f64).sqrt(),
    })
}

/// Stats that exist because duration[i] is the hold of key i and spacing[i] the
/// gap from key i to key i+1.
pub fn cross_stats(spacings: &[f64], durations: &[f64]) -> CrossStats {
    // one shared speed state drives holds and gaps, so a hand correlates at more
    // than one lag; a generator drawing the arrays separately sits at zero
    let lag0 = correlate_logs(durations, spacings);
    let lag1 = correlate_logs(spacings, durations.get(1..).unwrap_or_default());
    // key i is still down when key i+1 arrives iff held longer than the gap.
    // rollover comes in bursts, so this clumps for a hand
    let flags: Vec<bool> = spacings
        .iter()
        .zip(durations)
        .filter(|&(_, &hold)| hold > 0.0)
        .map(|(&gap, &hold)| hold > gap)
        .collect();
    CrossStats {
        lag0,
        lag1,
        overlap_rate: (!flags.is_empty())
            .then(|| flags.iter().filter(|&&f| f).count() as f64 / flags.len() as f64),
        overlap_runs_z: runs_z_from_signs(&flags),
    }
}

// Swept rather than guessed. Starts above sub-millisecond browser coarsening.
const QUANTUM_MIN_MS: f64 = 0.5;
const QUANTUM_MAX_MS: f64 = 30.0;
const QUANTUM_COARSE_STEP: f64 = 0.02;
const QUANTUM_MIN_STRENGTH: f64 = 0.3;
// When values barely vary every period fits, so require a spike above the
// typical sweep strength rather than absolute strength alone.
const QUANTUM_MIN_PROMINENCE: f64 = 4.0;

/// Rayleigh statistic of the phases: 0 scattered, 1 exactly on the grid.
pub fn comb_strength(values: &[f64], period: f64) -> f64 {
    let (re, im) = values.iter().fold((0.0, 0.0), |(re, im), value| {
        let angle = (2.0 * std::f64::consts::PI * value) / period;
        (re + angle.cos(), im + angle.sin())
    });
    re.hypot(im) / values.len() as f64
}

/// The grid the values sit on, found by sweeping every period.
pub fn detect_quantum(values: &[f64]) -> Option<Quantum> {
    if values.len() < 50 {
        return None;
    }
    // a grid coarser than the spread cannot be observed
    let mean = mean(values);
    let sd =
        (values.iter().map(|v| (v - mean) * (v - mean)).sum::<f64>() / values.len() as f64).sqrt();
    let max_period = QUANTUM_MAX_MS.min(sd);
    if max_period < QUANTUM_MIN_MS {
        return None;
    }
    let mut scan = vec![];
    let mut peak = 0.0;
    let mut period = QUANTUM_MIN_MS;
    while period <= max_period {
        let strength = comb_strength(values, period);
        scan.push(Quantum {
            period_ms: period,
            strength,
        });
        if strength > peak {
            peak = strength;
        }
        period += QUANTUM_COARSE_STEP;
    }
    if peak < QUANTUM_MIN_STRENGTH {
        return None;
    }
    let strengths = sorted(&scan.iter().map(|e| e.strength).collect::<Vec<_>>());
    if peak < median_of_sorted(&strengths) * QUANTUM_MIN_PROMINENCE {
        return None;
    }
    // every harmonic scores like the grid, so the fundamental is the largest
    // period still reaching the peak
    let fundamental = scan
        .iter()
        .rev()
        .find(|e| e.strength >= peak * 0.98)
        .copied()
        .unwrap_or(scan[0]);
    let mut best = fundamental;
    let mut period = fundamental.period_ms - QUANTUM_COARSE_STEP;
    while period <= fundamental.period_ms + QUANTUM_COARSE_STEP {
        let strength = comb_strength(values, period);
        if strength > best.strength {
            best = Quantum {
                period_ms: period,
                strength,
            };
        }
        period += 0.0005;
    }
    Some(best)
}

/// Excess kurtosis of typing values with pauses removed. Unfiltered, one human
/// sample reads anywhere from -0.04 to +8.9; filtered, bounded random ranges pin
/// at -1.20 while human timing lands positive.
pub fn kurtosis(values: &[f64]) -> Option<f64> {
    let positive = sorted(
        &values
            .iter()
            .copied()
            .filter(|&v| v > 0.0)
            .collect::<Vec<_>>(),
    );
    let median = *positive.get(positive.len() / 2)?;
    let typing: Vec<f64> = positive
        .into_iter()
        .filter(|&v| v < median * PAUSE_CUTOFF_MULTIPLE)
        .collect();
    if typing.len() < 8 {
        return None;
    }
    let n = typing.len() as f64;
    let mean = mean(&typing);
    let m2 = typing.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    // a fixed-interval generator has no spread to measure a shape in
    if m2 < 1e-9 {
        return None;
    }
    let m4 = typing.iter().map(|v| (v - mean).powi(4)).sum::<f64>() / n;
    Some(m4 / (m2 * m2) - 3.0)
}

// Acklam's rational approximation to the inverse normal cdf
const PROBIT_A: [f64; 6] = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
];
const PROBIT_B: [f64; 5] = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
];
const PROBIT_C: [f64; 6] = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
];
const PROBIT_D: [f64; 4] = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
];

pub fn probit(p: f64) -> f64 {
    let (a, b, c, d) = (PROBIT_A, PROBIT_B, PROBIT_C, PROBIT_D);
    let low = 0.02425;
    if p < low || p > 1.0 - low {
        let q = (-2.0 * (if p < low { p } else { 1.0 - p }).ln()).sqrt();
        let value = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
        return if p < low { value } else { -value };
    }
    let q = p - 0.5;
    let r = q * q;
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
        / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0)
}

/// Probability plot correlation coefficient: how straight the q-q plot is.
/// 1.0 is exactly normal. Gaps land near lognormal, so `use_logs` tests them on
/// their logs; holds are roughly symmetric and tested as they are.
pub fn bellness(values: &[f64], use_logs: bool) -> Option<f64> {
    let usable: Vec<f64> = values
        .iter()
        .copied()
        .filter(|&v| v > 0.0)
        .map(|v| if use_logs { v.ln() } else { v })
        .collect();
    if usable.len() < 30 {
        return None;
    }
    let sorted = sorted(&usable);
    let n = sorted.len();
    // Blom's plotting positions keep the statistic comparable across sizes
    let expected: Vec<f64> = (0..n)
        .map(|i| probit((i as f64 + 1.0 - 0.375) / (n as f64 + 0.25)))
        .collect();
    let mean_value = mean(&sorted);
    let mean_expected = mean(&expected);
    let mut covariance = 0.0;
    let mut var_value = 0.0;
    let mut var_expected = 0.0;
    for (value, expected) in sorted.iter().zip(&expected) {
        let dv = value - mean_value;
        let de = expected - mean_expected;
        covariance += dv * de;
        var_value += dv * dv;
        var_expected += de * de;
    }
    if var_value <= 0.0 || var_expected <= 0.0 {
        return None;
    }
    Some(covariance / (var_value * var_expected).sqrt())
}

/// JavaScript `toFixed(3)`: exact decimal rounding, ties away from zero.
pub(crate) fn to_fixed3(value: f64) -> String {
    // An exact tie is a multiple of 1/16 (625 | k in k/10000), where the scaled
    // value is exact too. Rust breaks ties to even, JavaScript away from zero.
    let scaled = value * 1000.0;
    if (value * 16.0).fract() == 0.0 && scaled.fract().abs() == 0.5 {
        format!("{:.3}", (scaled + 0.5f64.copysign(value)) / 1000.0)
    } else {
        format!("{value:.3}")
    }
}
pub(crate) fn distinct_count(values: &[f64]) -> usize {
    values
        .iter()
        .map(|&v| to_fixed3(v))
        .collect::<BTreeSet<_>>()
        .len()
}

pub fn dist_stats(values: &[f64]) -> Option<DistStats> {
    if values.is_empty() {
        return None;
    }
    let sorted = sorted(values);
    let quantile = |p: f64| sorted[(p * (sorted.len() - 1) as f64).floor() as usize];
    let (p10, p50, p90) = (quantile(0.1), quantile(0.5), quantile(0.9));
    let n = values.len() as f64;
    let mean = mean(values);
    let m2 = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    let m3 = values.iter().map(|v| (v - mean).powi(3)).sum::<f64>() / n;
    let sd = m2.sqrt();
    Some(DistStats {
        n: values.len(),
        min: sorted[0],
        p10,
        p50,
        p90,
        max: sorted[sorted.len() - 1],
        mean,
        sd,
        cv: if mean > 0.0 { sd / mean } else { 0.0 },
        spread_low: (p50 > 0.0).then(|| (p50 - p10) / p50),
        spread_high: (p50 > 0.0).then(|| (p90 - p50) / p50),
        autocorrelation: autocorrelation(values),
        runs_z: runs_z(values),
        drift: drift(values),
        quantum: detect_quantum(values),
        distinct_count: distinct_count(values),
        kurtosis: kurtosis(values),
        skew: if m2 > 0.0 { m3 / m2.powf(1.5) } else { 0.0 },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lcg(seed: u64) -> impl FnMut() -> f64 {
        let mut state = seed;
        move || {
            state = (state * 1_664_525 + 1_013_904_223) % (1 << 32);
            state as f64 / (1u64 << 32) as f64
        }
    }
    fn uniform(n: usize, low: f64, high: f64) -> Vec<f64> {
        let mut random = lcg(1);
        (0..n).map(|_| low + random() * (high - low)).collect()
    }

    #[test]
    fn inverts_the_normal_cdf() {
        assert!(probit(0.5).abs() < 1e-6);
        assert!((probit(0.975) - 1.96).abs() < 0.005);
        assert!((probit(0.01) + 2.326).abs() < 0.005);
    }
    #[test]
    fn pins_uniform_draws_near_negative_kurtosis() {
        let value = kurtosis(&uniform(2000, 80.0, 120.0)).unwrap();
        assert!((value + 1.2).abs() < 0.05, "{value}");
        assert_eq!(kurtosis(&[80.0; 50]), None);
    }
    #[test]
    fn finds_memory_only_in_trending_series() {
        let trending: Vec<f64> = (0..200).map(|i| 80.0 + i as f64).collect();
        assert!(autocorrelation(&trending).unwrap().sigmas > 5.0);
        assert!(
            autocorrelation(&uniform(400, 80.0, 120.0))
                .unwrap()
                .sigmas
                .abs()
                < 3.0
        );
        assert_eq!(autocorrelation(&[1.0, 2.0, 3.0]), None);
    }
    #[test]
    fn detects_a_coarse_grid() {
        let values: Vec<f64> = uniform(300, 10.0, 60.0)
            .into_iter()
            .map(|v| (v / 8.0).round() * 8.0)
            .collect();
        let quantum = detect_quantum(&values).unwrap();
        // the 8ms grid, refined to where the sampled phases cluster tightest
        assert!((quantum.period_ms - 8.0).abs() < 0.2, "{quantum:?}");
    }
    #[test]
    fn matches_javascript_to_fixed() {
        assert_eq!(to_fixed3(0.0625), "0.063");
        assert_eq!(to_fixed3(1.0005), "1.000");
        assert_eq!(to_fixed3(12.3456), "12.346");
        assert_eq!(to_fixed3(80.0), "80.000");
        assert_eq!(to_fixed3(-0.0625), "-0.063");
    }
}
