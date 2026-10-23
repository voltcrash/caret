//! Indexed live derivation; storage grows with words, never with repeated edits.
//! Stable timestamp/rank ordering matches explicit legacy log reads, even for delayed input.
use crate::{
    Text, round2,
    stats::{self, Chars},
};
use serde_json::Value;
use std::{
    cmp::Ordering,
    collections::{BTreeMap, BTreeSet},
};
#[derive(Clone, Copy, Debug)]
struct Stamp {
    at: f64,
    rank: u8,
    sequence: usize,
}
impl PartialEq for Stamp {
    fn eq(&self, other: &Self) -> bool {
        self.cmp(other) == Ordering::Equal
    }
}
impl Eq for Stamp {}
impl PartialOrd for Stamp {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for Stamp {
    fn cmp(&self, other: &Self) -> Ordering {
        self.at
            .total_cmp(&other.at)
            .then(self.rank.cmp(&other.rank))
            .then(self.sequence.cmp(&other.sequence))
    }
}
struct Word {
    first: Stamp,
    last: Stamp,
    last_space: bool,
    last_input: Option<Stamp>,
    input: Text,
    first_key: Option<Stamp>,
    last_insert: Option<Stamp>,
    full: Chars,
    partial: Chars,
}
impl Word {
    fn new(stamp: Stamp) -> Self {
        Self {
            first: stamp,
            last: stamp,
            last_space: false,
            last_input: None,
            input: Text::default(),
            first_key: None,
            last_insert: None,
            full: Chars::default(),
            partial: Chars::default(),
        }
    }
    fn recount(&mut self, target: Option<&Text>, korean: bool) {
        let typed = Text(
            self.input
                .0
                .iter()
                .map(|unit| {
                    if crate::text::is_space(*unit) {
                        32
                    } else {
                        *unit
                    }
                })
                .collect(),
        );
        let target = target.unwrap_or(&typed);
        let (typed, target) = if korean {
            (
                crate::text::disassemble_hangul(&typed),
                crate::text::disassemble_hangul(target),
            )
        } else {
            (typed.clone(), target.clone())
        };
        self.full = stats::count_chars(&typed, &target, false);
        self.partial = stats::count_chars(&typed, &target, true);
    }
}
#[derive(Default)]
pub(crate) struct Live {
    words: BTreeMap<usize, Word>,
    order: BTreeSet<(Stamp, usize)>,
    nonempty: BTreeSet<usize>,
    correct: usize,
    total: usize,
    sequence: usize,
    last_input_at: Option<f64>,
}
impl Live {
    pub fn record(&mut self, kind: &str, now: f64, data: &Value, targets: &[Text], korean: bool) {
        let stamp = Stamp {
            at: round2(now),
            rank: match kind {
                "keyup" => 0,
                "keydown" => 1,
                "input" => 2,
                "composition" => 3,
                _ => 4,
            },
            sequence: self.sequence,
        };
        self.sequence += 1;
        if kind == "input" {
            self.last_input_at = Some(stamp.at);
            if data.get("correct").is_some() {
                self.total += 1;
                self.correct += usize::from(data["correct"] == true);
            }
        }
        let Some(index) = data["wordIndex"].as_u64().map(|index| index as usize) else {
            return;
        };
        let word = self.words.entry(index).or_insert_with(|| Word::new(stamp));
        self.order.remove(&(word.first, index));
        word.first = word.first.min(stamp);
        self.order.insert((word.first, index));
        if stamp >= word.last {
            word.last = stamp;
            word.last_space =
                data["inputType"] == "insertText" && stats::text(&data["data"]).0 == [32];
        }
        if kind == "input" && word.last_input.is_none_or(|last| stamp >= last) {
            word.last_input = Some(stamp);
            word.input = stats::input_value(data);
            if word.input.is_empty() {
                self.nonempty.remove(&index);
            } else {
                self.nonempty.insert(index);
            }
        }
        let insert = kind == "input"
            && (data["inputType"] == "insertText" || data["inputType"] == "insertCompositionText");
        if (kind == "composition" && data["event"] == "start") || (insert && data["charIndex"] == 0)
        {
            word.first_key = Some(word.first_key.map_or(stamp, |first| first.min(stamp)));
        }
        if insert {
            word.last_insert = Some(word.last_insert.map_or(stamp, |last| last.max(stamp)));
        }
        word.recount(targets.get(index), korean);
    }
    pub fn recount(&mut self, index: usize, target: Option<&Text>, korean: bool) {
        if let Some(word) = self.words.get_mut(&index) {
            word.recount(target, korean);
        }
    }
    pub fn recount_all(&mut self, targets: &[Text], korean: bool) {
        for (index, word) in &mut self.words {
            word.recount(targets.get(*index), korean);
        }
    }
    pub fn last_input_at(&self) -> Option<f64> {
        self.last_input_at
    }
    pub fn has_input(&self) -> bool {
        self.total > 0
    }
    pub fn accuracy(&self) -> f64 {
        if self.total == 0 {
            0.0
        } else {
            self.correct as f64 / self.total as f64 * 100.0
        }
    }
    pub fn chars(&self, partial: bool) -> Chars {
        let active = self.nonempty.last().map_or(0, |index| {
            *index + usize::from(self.words[index].last_space)
        });
        let mut total = Chars::default();
        for (_, index) in &self.order {
            let word = &self.words[index];
            let counts = if *index == active && partial {
                &word.partial
            } else {
                &word.full
            };
            total.all_correct += counts.all_correct;
            total.correct_word += counts.correct_word;
            total.incorrect += counts.incorrect;
            total.extra += counts.extra;
            total.missed += counts.missed;
            if *index == active {
                break;
            }
        }
        total
    }
    pub fn burst(&self, index: usize, origin: f64, now: f64) -> f64 {
        let Some(word) = self.words.get(&index) else {
            return 0.0;
        };
        let first = word.first_key;
        let last = word
            .last_insert
            .filter(|last| first.is_some_and(|first| *last >= first));
        stats::burst(
            &word.input,
            first.map(|first| round2(first.at - origin)),
            last.map(|last| round2(last.at - origin)),
            now,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn root() -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/typing-fixtures")
    }
    #[test]
    fn every_recording_prefix_matches_frozen_typescript_live_stats() {
        let references: Vec<Value> =
            serde_json::from_slice(&std::fs::read(root().join("oracle/live-stats.json")).unwrap())
                .unwrap();
        let files: Vec<Value> = std::fs::read_dir(root().join("reference/keystrokes"))
            .unwrap()
            .filter_map(|entry| {
                let path = entry.unwrap().path();
                (path.extension().is_some_and(|ext| ext == "json"))
                    .then(|| serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap())
            })
            .collect();
        for reference in references {
            let fixture = files
                .iter()
                .find(|fixture| fixture["name"] == reference["name"])
                .unwrap();
            let mut neutral = fixture["eventLog"].clone();
            neutral["context"]["targetWords"] = json!(
                fixture["eventLog"]["context"]["targetWords"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|word| Text::from(word.as_str().unwrap()))
                    .collect::<Vec<_>>()
            );
            let log: stats::Log = serde_json::from_value(neutral).unwrap();
            let mut live = Live::default();
            let mut cursor = 0;
            for frame in reference["frames"].as_array().unwrap() {
                let length = frame["length"].as_u64().unwrap() as usize;
                for event in &log.events[cursor..length] {
                    live.record(
                        &event.kind,
                        event.test_ms,
                        &event.data,
                        &log.context.target_words,
                        log.context.korean_status,
                    );
                }
                cursor = length;
                assert_eq!(
                    json!(live.chars(true)),
                    frame["chars"],
                    "{} prefix {length}",
                    reference["name"]
                );
                assert_eq!(
                    live.accuracy(),
                    frame["accuracy"].as_f64().unwrap(),
                    "{} prefix {length}",
                    reference["name"]
                );
                for pair in frame["bursts"].as_array().unwrap() {
                    assert_eq!(
                        json!(live.burst(
                            pair[0].as_u64().unwrap() as usize,
                            0.0,
                            frame["now"].as_f64().unwrap()
                        ))
                        .as_f64(),
                        pair[1].as_f64(),
                        "{} prefix {length} word {}",
                        reference["name"],
                        pair[0]
                    );
                }
            }
        }
    }
    #[test]
    fn delayed_observations_keep_sorted_log_semantics_and_cache_size_depends_on_words() {
        let targets = vec![Text::from("one "), Text::from("two")];
        let events:Vec<crate::session::Event>=serde_json::from_value(json!([
            {"type":"input","testMs":4.0,"data":{"inputType":"insertText","wordIndex":0,"charIndex":0,"inputValue":[111],"data":[111],"correct":true}},
            {"type":"input","testMs":7.0,"data":{"inputType":"insertText","wordIndex":0,"charIndex":3,"inputValue":[111,110,101,32],"data":[32],"correct":true}},
            {"type":"composition","testMs":2.0,"data":{"event":"start","wordIndex":0}},
            {"type":"input","testMs":7.0,"data":{"inputType":"deleteContentBackward","wordIndex":0,"charIndex":4,"inputValue":[111,110,101]}},
            {"type":"input","testMs":10.0,"data":{"inputType":"insertCompositionText","wordIndex":1,"charIndex":0,"inputValue":[116],"data":[116],"correct":false}}
        ])).unwrap();
        for indices in [
            vec![0, 1, 2, 3, 4],
            vec![4, 3, 2, 1, 0],
            vec![2, 0, 4, 1, 3],
        ] {
            let mut live = Live::default();
            let mut log = stats::Log {
                version: 1,
                context: stats::Context {
                    target_words: targets.clone(),
                    mode: "time".into(),
                    mode2: "0".into(),
                    bailed_out: false,
                    korean_status: false,
                    custom_text_limit_mode: None,
                    custom_text_limit_value: None,
                },
                events: vec![],
            };
            for index in indices {
                let event = &events[index];
                live.record(&event.kind, event.test_ms, &event.data, &targets, false);
                log.events.push(event.clone());
                log.events.sort_by(|a, b| a.test_ms.total_cmp(&b.test_ms));
                assert_eq!(live.chars(true), stats::chars(&log, true, None));
                assert_eq!(live.accuracy(), stats::accuracy(&log, None));
                for word in 0..2 {
                    assert_eq!(
                        live.burst(word, 0.0, 20.0),
                        stats::word_burst(&log, word, 20.0)
                    );
                }
            }
            for _ in 0..10000 {
                let event = &events[0];
                live.record(&event.kind, event.test_ms, &event.data, &targets, false);
            }
            assert_eq!(live.words.len(), 2);
            assert_eq!(live.order.len(), 2);
            assert!(live.nonempty.len() <= 2);
        }
    }
}
