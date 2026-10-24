//! Typing restart decisions; hosts retain loading/animation/navigation guards.
use crate::{Config, results::Limit};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Default, Deserialize, TS)]
#[serde(default, rename_all = "camelCase")]
pub struct RestartOptions {
    pub quick: bool,
    pub with_same_wordset: bool,
    pub custom_is_long: bool,
}
pub struct RestartState<'a> {
    pub active: bool,
    pub failed: bool,
    pub repeated: bool,
    pub quote_language: Option<&'a str>,
}
#[derive(Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum RestartBlock {
    NoQuit,
    LongTest,
}
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RestartDecision {
    pub allowed: bool,
    pub reason: Option<RestartBlock>,
    pub with_same_wordset: bool,
    pub record_incomplete: bool,
    pub prevent_default: bool,
    pub repeat_with_pace: bool,
}
pub fn can_quick_restart(config: &Config, limit: Option<&Limit>, custom_is_long: bool) -> bool {
    let words_long = config.mode == "words" && (config.words >= 1000 || config.words == 0);
    let time_long = config.mode == "time" && (config.time >= 900.0 || config.time == 0.0);
    let custom_long = config.mode == "custom"
        && (custom_is_long
            || limit.is_some_and(|limit| {
                ((limit.mode == "word" || limit.mode == "section")
                    && (limit.value >= 1000.0 || limit.value == 0.0))
                    || (limit.mode == "time" && (limit.value >= 900.0 || limit.value == 0.0))
            }));
    !(words_long || time_long || custom_long)
}
pub fn decide(
    config: &Config,
    state: RestartState<'_>,
    limit: Option<&Limit>,
    options: RestartOptions,
) -> RestartDecision {
    let reason = if state.active && config.funbox.iter().any(|name| name == "no_quit") {
        Some(RestartBlock::NoQuit)
    } else if state.active
        && options.quick
        && !can_quick_restart(config, limit, options.custom_is_long)
    {
        Some(RestartBlock::LongTest)
    } else {
        None
    };
    let prevent_default = reason == Some(RestartBlock::NoQuit)
        || (state.active && options.quick && config.mode != "zen");
    let same = options.with_same_wordset
        || (state.active && state.repeated)
        || (config.mode == "quote"
            && config.repeat_quotes == "typing"
            && state
                .quote_language
                .is_some_and(|language| config.language.starts_with(language))
            && (state.active || state.failed));
    RestartDecision {
        allowed: reason.is_none(),
        with_same_wordset: reason.is_none() && same,
        record_incomplete: reason.is_none() && state.active && config.result_saving,
        repeat_with_pace: reason.is_none() && config.repeated_pace && same,
        prevent_default,
        reason,
    }
}
