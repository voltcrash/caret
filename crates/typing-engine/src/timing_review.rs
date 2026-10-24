//! Statistical review signals over submitted key timings. None is proof: each
//! describes a property synthetic generators commonly have and human samples
//! rarely show. Hosts log them for review and calibration, never reject on them.
use crate::{
    js_round,
    timing_stats::{
        PAUSE_CUTOFF_MULTIPLE, autocorrelation, comb_strength, cross_stats, distinct_count,
        kurtosis, sorted,
    },
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Fewer interior samples than this describe too little typing to review.
pub const MIN_TIMING_SAMPLES: usize = 100;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "kebab-case")]
pub enum ReviewSignal {
    /// Bounded random ranges have excess kurtosis near -1.2; human timing is
    /// peaked with a long right tail.
    UniformGaps,
    UniformHolds,
    /// Near-constant timing that still escapes the exact fixed-timing check.
    LowGapVariation,
    LowHoldVariation,
    /// No memory within gaps and no hold/gap coupling, which a hand sharing one
    /// speed state between both rarely manages.
    MemorylessTiming,
    /// Values drawn from a small pool that clock coarsening cannot explain.
    SmallValuePool,
}

const UNIFORM_KURTOSIS: f64 = -1.0;
const MIN_GAP_CV: f64 = 0.1;
const MIN_HOLD_CV: f64 = 0.08;
// |r| * sqrt(n) below this in every channel is indistinguishable from noise
const MEMORYLESS_SIGMAS: f64 = 1.5;
const MEMORYLESS_MIN_SAMPLES: usize = 200;
const MAX_DISTINCT_RATIO: f64 = 0.05;
// clocks coarsened to at least this grid explain a small set of values
const COARSE_CLOCK_MS: f64 = 2.0;
const MIN_GRID_STRENGTH: f64 = 0.9;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChannelFeatures {
    pub n: usize,
    pub p50: f64,
    pub cv: f64,
    pub kurtosis: Option<f64>,
    pub autocorrelation_sigmas: Option<f64>,
    pub distinct: usize,
    /// Present only once the small-pool check examined this channel.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub grid_ms: Option<Option<f64>>,
}
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TimingFeatures {
    pub gaps: ChannelFeatures,
    pub holds: ChannelFeatures,
    pub lag0_sigmas: Option<f64>,
    pub lag1_sigmas: Option<f64>,
    pub overlap_rate: Option<f64>,
}
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, TS)]
pub struct TimingReview {
    pub signals: Vec<ReviewSignal>,
    pub features: TimingFeatures,
}

fn round3(value: Option<f64>) -> Option<f64> {
    value.map(|v| js_round(v * 1000.0) / 1000.0)
}
fn median(sorted: &[f64]) -> f64 {
    sorted.get(sorted.len() / 2).copied().unwrap_or(0.0)
}
// variation of the typing itself; pauses would otherwise dominate the spread
fn typing_cv(values: &[f64]) -> f64 {
    let sorted = sorted(values);
    let cutoff = median(&sorted) * PAUSE_CUTOFF_MULTIPLE;
    let typing: Vec<f64> = sorted.into_iter().filter(|&v| v < cutoff).collect();
    if typing.is_empty() {
        return 0.0;
    }
    let n = typing.len() as f64;
    let mean = typing.iter().sum::<f64>() / n;
    if mean <= 0.0 {
        return 0.0;
    }
    let variance = typing.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n;
    variance.sqrt() / mean
}
fn channel(values: &[f64]) -> ChannelFeatures {
    ChannelFeatures {
        n: values.len(),
        p50: median(&sorted(values)),
        cv: round3(Some(typing_cv(values))).unwrap_or(0.0),
        kurtosis: round3(kurtosis(values)),
        autocorrelation_sigmas: round3(autocorrelation(values).map(|a| a.sigmas)),
        distinct: distinct_count(values),
        grid_ms: None,
    }
}
// A coarsened clock puts every value on multiples of one period, the smallest
// step between distinct values. A hardcoded pool has no such grid, and with a
// handful of distinct values every period fits, so a sweep cannot answer this.
fn clock_grid(values: &[f64]) -> Option<f64> {
    let mut distinct = sorted(values);
    distinct.dedup();
    let step = distinct
        .windows(2)
        .map(|w| w[1] - w[0])
        .fold(f64::INFINITY, f64::min);
    if !step.is_finite() || step < COARSE_CLOCK_MS {
        return None;
    }
    (comb_strength(values, step) >= MIN_GRID_STRENGTH).then_some(step)
}
fn has_small_pool(values: &[f64], features: &mut ChannelFeatures) -> bool {
    if features.distinct as f64 > features.n as f64 * MAX_DISTINCT_RATIO {
        return false;
    }
    let grid = round3(clock_grid(values));
    features.grid_ms = Some(grid);
    grid.is_none()
}
fn quiet(sigmas: Option<f64>) -> bool {
    sigmas.is_some_and(|s| s.abs() < MEMORYLESS_SIGMAS)
}

/// Review interior key timings, or None when there are too few to describe.
pub fn review(key_spacing: &[f64], key_duration: &[f64]) -> Option<TimingReview> {
    // endpoints may predate the start or be estimated; zero holds are
    // placeholders for releases that were never observed
    let interior = |values: &[f64]| -> Vec<f64> {
        let end = values.len().saturating_sub(1);
        values
            .get(1..end)
            .unwrap_or_default()
            .iter()
            .copied()
            .filter(|&v| v > 0.0)
            .collect()
    };
    let gaps = interior(key_spacing);
    let holds = interior(key_duration);
    if gaps.len() < MIN_TIMING_SAMPLES {
        return None;
    }
    let cross = cross_stats(key_spacing, key_duration);
    let mut features = TimingFeatures {
        gaps: channel(&gaps),
        holds: channel(&holds),
        lag0_sigmas: round3(cross.lag0.map(|s| s.sigmas)),
        lag1_sigmas: round3(cross.lag1.map(|s| s.sigmas)),
        overlap_rate: round3(cross.overlap_rate),
    };
    let holds_measured = holds.len() >= MIN_TIMING_SAMPLES;
    let uniform = |kurtosis: Option<f64>| kurtosis.is_some_and(|k| k <= UNIFORM_KURTOSIS);
    let mut signals = vec![];
    if uniform(features.gaps.kurtosis) {
        signals.push(ReviewSignal::UniformGaps);
    }
    if holds_measured && uniform(features.holds.kurtosis) {
        signals.push(ReviewSignal::UniformHolds);
    }
    if features.gaps.cv < MIN_GAP_CV {
        signals.push(ReviewSignal::LowGapVariation);
    }
    if holds_measured && features.holds.cv < MIN_HOLD_CV {
        signals.push(ReviewSignal::LowHoldVariation);
    }
    if gaps.len() >= MEMORYLESS_MIN_SAMPLES
        && holds_measured
        && quiet(features.gaps.autocorrelation_sigmas)
        && quiet(features.lag0_sigmas)
        && quiet(features.lag1_sigmas)
    {
        signals.push(ReviewSignal::MemorylessTiming);
    }
    if has_small_pool(&gaps, &mut features.gaps)
        || (holds_measured && has_small_pool(&holds, &mut features.holds))
    {
        signals.push(ReviewSignal::SmallValuePool);
    }
    Some(TimingReview { signals, features })
}
