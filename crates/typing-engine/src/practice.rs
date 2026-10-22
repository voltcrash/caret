use crate::{
    Text, js_round,
    stats::{self, Log},
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct PracticeWords {
    pub text: Vec<Text>,
    pub section_limit: usize,
}
#[derive(Serialize, TS)]
pub struct Selection {
    pub result: Option<PracticeWords>,
    pub notifications: Vec<String>,
}
pub fn select(log: &Log, words: &[Text], missed: &str, slow: bool, now: f64) -> Selection {
    let mut selection = Selection {
        result: None,
        notifications: vec![],
    };
    if log.context.mode == "zen" {
        return selection;
    }
    let limit = if (missed == "words" && !slow) || (missed == "off" && slow) {
        20
    } else {
        10
    };
    let missed_words = stats::missed_words(log);
    let mut missed_items = if missed == "words" {
        missed_words.clone()
    } else {
        vec![]
    };
    missed_items.sort_by_key(|a| std::cmp::Reverse(a.1));
    missed_items.truncate(limit);
    let mut biwords = vec![];
    if missed == "biwords" {
        for (index, word) in words.iter().enumerate() {
            if let Some((_, count)) = missed_words.iter().find(|(text, _)| text == word) {
                biwords.push((
                    word.clone(),
                    index
                        .checked_sub(1)
                        .and_then(|index| words.get(index))
                        .cloned()
                        .unwrap_or_default(),
                    *count,
                ));
            }
        }
        biwords.sort_by_key(|a| std::cmp::Reverse(a.2));
        biwords.truncate(limit);
    }
    if ((missed == "words" && missed_items.is_empty())
        || (missed == "biwords" && biwords.is_empty()))
        && !slow
    {
        selection
            .notifications
            .push("You haven't missed any words".into());
        return selection;
    }
    let mut slow_items = vec![];
    if slow {
        // Array.slice(0,-1) on an empty history still slices the input words.
        let history_len = stats::input_history(log).len();
        let length = if history_len == 0 {
            words.len().saturating_sub(1)
        } else {
            (history_len - 1).min(words.len())
        };
        let bursts = stats::word_burst_history(log, now);
        slow_items = words
            .iter()
            .take(length)
            .enumerate()
            .map(|(index, word)| (word.clone(), bursts.get(index).copied().unwrap_or(0.0)))
            .collect();
        slow_items.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
        slow_items.truncate(limit.min(js_round(length as f64 * 0.2) as usize));
        if slow_items.is_empty() {
            selection
                .notifications
                .push("Test too short to classify slow words.".into());
        }
    }
    if missed_items.is_empty() && biwords.is_empty() && slow_items.is_empty() {
        selection
            .notifications
            .push("Could not start a new custom test".into());
        return selection;
    }
    let mut text = vec![];
    for (word, count) in &missed_items {
        text.extend(std::iter::repeat_n(word.clone(), *count));
    }
    for (word, previous, count) in &biwords {
        let mut word = word.clone();
        if !previous.is_empty() {
            let mut joined = previous.clone();
            joined.0.push(32);
            joined.0.extend(word.0);
            word = joined;
        }
        text.extend(std::iter::repeat_n(word, *count));
    }
    for (index, (word, _)) in slow_items.iter().enumerate() {
        text.extend(std::iter::repeat_n(word.clone(), slow_items.len() - index));
    }
    selection.result = Some(PracticeWords {
        text,
        section_limit: (slow_items.len() + missed_items.len() + biwords.len()) * 5,
    });
    selection
}
