use crate::{
    Text,
    stats::{self, Log},
};
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, PartialEq, Eq, Serialize, TS)]
pub struct LongProgress {
    pub completed: bool,
    // u32 prior progress + bounded word count stays exactly representable in JS.
    #[ts(type = "number")]
    pub progress: u64,
}
/// Matches completion.client.ts: newline commits belong to display length;
/// space commits do not. Hosts retain the book text and persist this result.
pub fn from_history(
    previous: u32,
    bailed_out: bool,
    history: &[Text],
    targets: &[Text],
) -> LongProgress {
    if !bailed_out && history.len() >= targets.len() {
        return LongProgress {
            completed: true,
            progress: 0,
        };
    }
    let incomplete = history.last().is_some_and(|typed| {
        let target = targets.get(history.len() - 1);
        let display_length = target.map_or(0, |word| {
            word.len() - usize::from(word.0.last() == Some(&32))
        });
        typed.len() < display_length
    });
    LongProgress {
        completed: false,
        progress: u64::from(previous) + (history.len() - usize::from(incomplete)) as u64,
    }
}
pub fn calculate(log: &Log, previous: u32) -> LongProgress {
    from_history(
        previous,
        log.context.bailed_out,
        &stats::input_history(log),
        &log.context.target_words,
    )
}
