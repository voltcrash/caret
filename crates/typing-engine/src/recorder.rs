//! Session event recording: ordered capture and event log materialization.
use crate::{round2, session::Event};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone)]
pub(crate) struct Recorded {
    pub(crate) kind: String,
    pub(crate) now: f64,
    pub(crate) data: Value,
}

impl Recorded {
    /// The wire event, timed from the log's `origin`.
    pub(crate) fn at(&self, origin: f64) -> Event {
        Event {
            kind: self.kind.clone(),
            test_ms: round2(self.now - origin),
            data: self.data.clone(),
        }
    }
}

/// Sort rank among events sharing a timestamp: releases before presses before input.
fn rank(kind: &str) -> u8 {
    match kind {
        "keyup" => 0,
        "keydown" => 1,
        "input" => 2,
        "composition" => 3,
        _ => 4,
    }
}

/// A session's recorded events, with the ordering state the event log reports.
#[derive(Default)]
pub(crate) struct Recorder {
    events: Vec<Recorded>,
    last_order: Option<(f64, u8)>,
    reordered: bool,
}

impl Recorder {
    /// Records an event at `now` (rounded), noting when it precedes the latest one.
    pub(crate) fn push(&mut self, kind: &str, now: f64, data: Value) {
        let order = (round2(now), rank(kind));
        if let Some(previous) = self.last_order {
            let comparison = order
                .0
                .total_cmp(&previous.0)
                .then(order.1.cmp(&previous.1));
            if comparison.is_lt() {
                self.reordered = true;
            } else {
                self.last_order = Some(order);
            }
        } else {
            self.last_order = Some(order);
        }
        self.events.push(Recorded {
            kind: kind.into(),
            now: round2(now),
            data,
        });
    }

    /// The log's time origin: the timer start, else the earliest event.
    pub(crate) fn origin(&self) -> f64 {
        self.events
            .iter()
            .find(|e| e.kind == "timer" && e.data["event"] == "start")
            .map(|e| e.now)
            .unwrap_or_else(|| {
                self.events
                    .iter()
                    .map(|e| e.now)
                    .reduce(f64::min)
                    .unwrap_or(0.0)
            })
    }

    /// Wire events recorded after the first `count`, timed from the current origin.
    pub(crate) fn since(&self, count: usize) -> Vec<Event> {
        let origin = self.origin();
        self.events
            .get(count..)
            .unwrap_or_default()
            .iter()
            .map(|event| event.at(origin))
            .collect()
    }

    /// Every wire event in time order (ties by [`rank`]), timed from the origin.
    pub(crate) fn log_events(&self) -> Vec<Event> {
        let mut events = self.events.clone();
        events.sort_by(|a, b| {
            a.now
                .total_cmp(&b.now)
                .then(rank(&a.kind).cmp(&rank(&b.kind)))
        });
        let origin = self.origin();
        events.iter().map(|event| event.at(origin)).collect()
    }

    /// Mean press duration of matched keydown/keyup pairs; 80 ms without any.
    pub(crate) fn average_key_duration(&self) -> f64 {
        let mut down = BTreeMap::new();
        for event in &self.events {
            if event.kind == "keydown" {
                down.insert(
                    event.data["code"].as_str().unwrap_or_default().to_owned(),
                    event.now,
                );
            }
        }
        let mut durations = vec![];
        for event in &self.events {
            if event.kind != "keyup" {
                continue;
            }
            if let Some(start) = down.remove(event.data["code"].as_str().unwrap_or_default()) {
                let duration = event.now - start;
                if duration > 0.0 {
                    durations.push(duration);
                }
            }
        }
        if durations.is_empty() {
            80.0
        } else {
            round2(durations.iter().sum::<f64>() / durations.len() as f64)
        }
    }

    pub(crate) fn events(&self) -> &[Recorded] {
        &self.events
    }

    pub(crate) fn last_mut(&mut self) -> Option<&mut Recorded> {
        self.events.last_mut()
    }

    /// Whether an event arrived out of order since the last [`Self::clear_reordered`].
    pub(crate) fn reordered(&self) -> bool {
        self.reordered
    }

    pub(crate) fn clear_reordered(&mut self) {
        self.reordered = false;
    }

    /// Drops every event and the ordering they set.
    pub(crate) fn clear(&mut self) {
        self.events.clear();
        self.last_order = None;
    }

    /// Drops key and input events outside the timer: releases and all but the
    /// last press before the start; input, presses and their releases after the end.
    pub(crate) fn trim_to_timer(&mut self) {
        let start = self
            .events
            .iter()
            .find(|e| e.kind == "timer" && e.data["event"] == "start")
            .map(|e| e.now);
        let end = self
            .events
            .iter()
            .find(|e| e.kind == "timer" && e.data["event"] == "end")
            .map(|e| e.now);
        let last_pre = self
            .events
            .iter()
            .enumerate()
            .filter(|(_, e)| e.kind == "keydown" && start.is_some_and(|start| e.now < start))
            .map(|(i, _)| i)
            .next_back();
        let post_codes: Vec<_> = self
            .events
            .iter()
            .filter(|e| e.kind == "keydown" && end.is_some_and(|end| e.now > end))
            .map(|e| e.data["code"].clone())
            .collect();
        let mut index = 0;
        self.retain(|e| {
            let current = index;
            index += 1;
            if let Some(start) = start
                && e.now < start
                && (e.kind == "keyup" || (e.kind == "keydown" && Some(current) != last_pre))
            {
                return false;
            }
            if let Some(end) = end
                && e.now > end
                && (e.kind == "input"
                    || e.kind == "keydown"
                    || (e.kind == "keyup" && post_codes.contains(&e.data["code"])))
            {
                return false;
            }
            true
        });
    }

    /// Keeps the events `keep` accepts, then orders later events after the latest survivor.
    fn retain(&mut self, keep: impl FnMut(&Recorded) -> bool) {
        self.events.retain(keep);
        self.last_order = self
            .events
            .iter()
            .map(|event| (event.now, rank(&event.kind)))
            .max_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn kinds(recorder: &Recorder) -> Vec<(&str, f64)> {
        recorder
            .events()
            .iter()
            .map(|event| (event.kind.as_str(), event.now))
            .collect()
    }

    #[test]
    fn flags_events_older_than_the_latest_until_cleared() {
        let mut recorder = Recorder::default();
        recorder.push("input", 10.0, json!({}));
        // Same time, lower rank: a keydown sorts before the input it caused.
        recorder.push("keydown", 10.0, json!({"code":"KeyA"}));
        assert!(recorder.reordered());
        recorder.clear_reordered();
        recorder.push("input", 10.0, json!({}));
        assert!(!recorder.reordered());
    }

    #[test]
    fn times_wire_events_from_the_timer_start_in_rank_order() {
        let mut recorder = Recorder::default();
        recorder.push("keydown", 5.0, json!({"code":"KeyA"}));
        recorder.push("timer", 10.0, json!({"event":"start"}));
        recorder.push("input", 12.004, json!({}));
        recorder.push("keyup", 12.0, json!({"code":"KeyA"}));
        assert_eq!(recorder.origin(), 10.0);
        let log: Vec<_> = recorder
            .log_events()
            .into_iter()
            .map(|event| (event.kind, event.test_ms))
            .collect();
        assert_eq!(
            log,
            [
                ("keydown".into(), -5.0),
                ("timer".into(), 0.0),
                ("keyup".into(), 2.0),
                ("input".into(), 2.0),
            ]
        );
        assert_eq!(recorder.since(3).len(), 1);
    }

    #[test]
    fn averages_matched_presses_with_a_default() {
        let mut recorder = Recorder::default();
        assert_eq!(recorder.average_key_duration(), 80.0);
        recorder.push("keydown", 0.0, json!({"code":"KeyA"}));
        recorder.push("keyup", 40.0, json!({"code":"KeyA"}));
        recorder.push("keydown", 50.0, json!({"code":"KeyB"}));
        recorder.push("keyup", 110.0, json!({"code":"KeyB"}));
        assert_eq!(recorder.average_key_duration(), 50.0);
    }

    #[test]
    fn trims_key_events_outside_the_timer() {
        let mut recorder = Recorder::default();
        recorder.push("keydown", 1.0, json!({"code":"KeyA"}));
        recorder.push("keyup", 2.0, json!({"code":"KeyA"}));
        recorder.push("keydown", 3.0, json!({"code":"KeyB"}));
        recorder.push("timer", 4.0, json!({"event":"start"}));
        recorder.push("input", 5.0, json!({}));
        recorder.push("timer", 6.0, json!({"event":"end"}));
        recorder.push("keyup", 7.0, json!({"code":"KeyB"}));
        recorder.push("keydown", 8.0, json!({"code":"KeyC"}));
        recorder.push("input", 8.0, json!({}));
        recorder.push("keyup", 9.0, json!({"code":"KeyC"}));
        recorder.trim_to_timer();
        assert_eq!(
            kinds(&recorder),
            [
                ("keydown", 3.0),
                ("timer", 4.0),
                ("input", 5.0),
                ("timer", 6.0),
                ("keyup", 7.0),
            ]
        );
        // Later events order after the latest survivor, not the trimmed ones.
        recorder.push("keyup", 8.0, json!({"code":"KeyD"}));
        assert!(!recorder.reordered());
    }
}
