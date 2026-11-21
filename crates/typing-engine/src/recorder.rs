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

    /// Keeps the events `keep` accepts, then orders later events after the latest survivor.
    pub(crate) fn retain(&mut self, keep: impl FnMut(&Recorded) -> bool) {
        self.events.retain(keep);
        self.last_order = self
            .events
            .iter()
            .map(|event| (event.now, rank(&event.kind)))
            .max_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
    }
}
