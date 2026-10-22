use crate::Text;
use serde::Serialize;
use std::collections::BTreeSet;
use ts_rs::TS;

#[derive(Clone, Debug, Serialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub word_index: usize,
    pub letter_index: usize,
    pub wpm: f64,
}
#[derive(Default)]
pub struct Pace {
    wpm: Option<f64>,
    word_index: usize,
    letter_index: usize,
    correction: isize,
    mistakes: BTreeSet<usize>,
    start_ms: f64,
    steps: u64,
    last_wpm: f64,
}
impl Pace {
    pub fn reset(&mut self, wpm: Option<f64>) -> bool {
        self.wpm = wpm.filter(|value| value.is_finite() && *value >= 1.0);
        self.word_index = 0;
        self.letter_index = 0;
        self.correction = 0;
        self.mistakes.clear();
        self.start_ms = 0.0;
        self.steps = 0;
        self.wpm.is_some()
    }
    pub fn start(&mut self, now: f64) {
        self.start_ms = now;
        self.steps = 0;
    }
    pub fn position(&self) -> Option<Position> {
        self.wpm.map(|wpm| Position {
            word_index: self.word_index,
            letter_index: self.letter_index,
            wpm,
        })
    }
    pub fn correct(&mut self, index: usize, correct: bool, word: &Text, blind: bool) {
        if self.wpm.is_none() || blind {
            return;
        }
        if correct {
            if self.mistakes.remove(&index) {
                self.correction -= word.len() as isize;
            }
        } else if self.mistakes.insert(index) {
            self.correction += word.len() as isize;
        }
    }
    pub fn step(&mut self, words: &[Text], blind: bool) -> Option<Position> {
        self.wpm?;
        let Some(word) = words.get(self.word_index) else {
            self.wpm = None;
            return None;
        };
        if self.letter_index >= word.len() {
            self.letter_index = 0;
            self.word_index += 1;
        } else {
            self.letter_index += 1;
        }
        if !blind {
            while self.correction < 0 {
                if self.letter_index == 0 {
                    let Some(previous) = self
                        .word_index
                        .checked_sub(1)
                        .and_then(|index| words.get(index))
                    else {
                        self.wpm = None;
                        return None;
                    };
                    self.word_index -= 1;
                    self.letter_index = previous.len();
                } else {
                    self.letter_index -= 1;
                }
                self.correction += 1;
            }
            while self.correction > 0 {
                let Some(word) = words.get(self.word_index) else {
                    self.wpm = None;
                    return None;
                };
                self.letter_index += 1;
                if self.letter_index > word.len() {
                    self.letter_index = 0;
                    self.word_index += 1;
                }
                self.correction -= 1;
            }
        }
        self.steps += 1;
        self.position()
    }
    pub fn advance(&mut self, now: f64, words: &[Text], blind: bool) -> Option<Position> {
        let speed = self.wpm?;
        let due = ((now - self.start_ms) / (60.0 / (speed * 5.0) * 1000.0)).floor();
        while (self.steps as f64) < due {
            self.step(words, blind)?;
        }
        self.position()
    }
    pub fn step_end(&self) -> f64 {
        self.start_ms
            + self.steps as f64 * self.wpm.map(|wpm| 60.0 / (wpm * 5.0)).unwrap_or(0.0) * 1000.0
    }
    pub fn remember(&mut self, wpm: f64, repeating: bool) {
        if !repeating || wpm > self.last_wpm {
            self.last_wpm = wpm;
        }
    }
    pub fn last_wpm(&self) -> f64 {
        self.last_wpm
    }
}

#[derive(Default)]
pub struct TypingTime {
    seconds: f64,
    day: Option<i64>,
}
impl TypingTime {
    /// The host supplies its local-calendar day token; no hidden system clock.
    pub fn add(&mut self, seconds: f64, today: i64) {
        if self.day.is_some_and(|day| day != today) {
            self.day = Some(today);
            self.seconds = seconds;
        } else {
            self.seconds += seconds;
        }
    }
    pub fn load_today(&mut self, seconds: f64, today: i64) {
        self.day = Some(today);
        self.seconds = seconds;
    }
    pub fn seconds(&self) -> f64 {
        self.seconds
    }
    pub fn is_today(&self) -> bool {
        self.day.is_some()
    }
}
