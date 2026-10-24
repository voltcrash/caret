use crate::{
    Text, practice, replay, results,
    stats::{self, Log},
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Deserialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Query {
    Stats {
        now: f64,
    },
    Completed {
        context: Box<results::CompletedContext>,
    },
    Validity {
        input: results::Validity,
    },
    Replay {
        zen: bool,
    },
    Frame {
        time: f64,
    },
    CustomProgress {
        previous: u32,
    },
    Practice {
        words: Vec<Text>,
        missed: String,
        slow: bool,
        now: f64,
    },
}
#[derive(Serialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Response {
    Stats {
        stats: Box<Overview>,
    },
    Completed {
        result: Box<results::CompletedMetrics>,
    },
    Validity {
        reason: Option<String>,
        afk: bool,
    },
    Replay {
        words: Vec<Text>,
        steps: Vec<replay::Step>,
        duration: f64,
    },
    Frame {
        frame: replay::Frame,
    },
    CustomProgress {
        progress: crate::custom_progress::LongProgress,
    },
    Practice {
        selection: practice::Selection,
    },
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub summary: stats::Summary,
    pub input_history: Vec<Text>,
    pub corrected_words_history: Vec<Text>,
    pub missed_words: Vec<(Text, usize)>,
    pub word_burst_history: Vec<f64>,
    pub raw_history: Vec<f64>,
    pub keypresses_per_second: Vec<usize>,
    pub incomplete_test_seconds: f64,
    pub boundaries: Vec<f64>,
    pub lagged_boundaries: Vec<f64>,
    pub boundary_labels: Vec<String>,
    pub date_duration_ms: f64,
    pub word_indexes_per_second: Vec<Vec<usize>>,
}
pub fn analyze(log: &Log, query: Query) -> Result<Response, crate::error::EngineError> {
    crate::validation::log(log)?;
    match &query {
        Query::Stats { now } | Query::Practice { now, .. } | Query::Frame { time: now }
            if !now.is_finite() || now.abs() > 9_007_199_254_740_991.0 =>
        {
            return Err("Invalid query timestamp".into());
        }
        Query::Practice { words, missed, .. } => {
            crate::validation::words(words)?;
            if !["off", "words", "biwords"].contains(&missed.as_str()) {
                return Err("Invalid practice selection".into());
            }
        }
        Query::Completed { context } => {
            context.config.validate().map_err(|message| {
                crate::error::EngineError::new(crate::error::ErrorCode::InvalidConfig, message)
            })?;
            if !context.timestamp.is_finite()
                || !context.incomplete_seconds.is_finite()
                || context.tags.len() > 10000
                || context.tags.iter().any(|tag| tag.len() > 128)
                || context.incomplete_tests.len() > 10000
            {
                return Err("Invalid result metadata".into());
            }
        }
        _ => {}
    }
    Ok(match query {
        Query::Stats { now } => Response::Stats {
            stats: Box::new(Overview {
                summary: stats::typed_summary(log)?,
                input_history: stats::input_history(log),
                corrected_words_history: stats::corrected_history(log),
                missed_words: stats::missed_words(log),
                word_burst_history: stats::word_burst_history(log, now),
                raw_history: stats::speed_history(log, true),
                keypresses_per_second: stats::keypresses_per_second(log),
                incomplete_test_seconds: stats::incomplete_seconds(log),
                boundaries: stats::boundaries(log),
                lagged_boundaries: stats::lagged_boundaries(log),
                boundary_labels: stats::boundary_labels(log, true),
                date_duration_ms: results::date_duration(log),
                word_indexes_per_second: (0..stats::boundaries(log).len())
                    .map(|index| stats::word_indexes_for_second(log, index))
                    .collect(),
            }),
        },
        Query::Completed { context } => Response::Completed {
            result: Box::new(results::typed_completed(log, &context)?),
        },
        Query::Validity { input } => Response::Validity {
            reason: results::invalid_reason(log, &input).map(String::from),
            afk: results::is_afk(log, input.bailed_out),
        },
        Query::Replay { zen } => Response::Replay {
            words: replay::words(log, zen),
            steps: replay::steps(log, zen),
            duration: replay::duration(log),
        },
        Query::Frame { time } => Response::Frame {
            frame: replay::frame(log, time),
        },
        Query::CustomProgress { previous } => Response::CustomProgress {
            progress: crate::custom_progress::calculate(log, previous),
        },
        Query::Practice {
            words,
            missed,
            slow,
            now,
        } => Response::Practice {
            selection: practice::select(log, &words, &missed, slow, now),
        },
    })
}
