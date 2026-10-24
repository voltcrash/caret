use crate::Text;
use std::collections::BTreeMap;

#[derive(Clone, Default)]
pub struct WeakSpot {
    scores: BTreeMap<Vec<u16>, Score>,
}
#[derive(Clone, Default)]
struct Score {
    average: f64,
    count: u32,
}
impl WeakSpot {
    pub fn update(&mut self, text: &Text, correct: bool, spacing: Option<f64>) {
        let Some(spacing) = spacing else {
            return;
        };
        let score = self.scores.entry(text.0.clone()).or_default();
        score.count = (score.count + 1).min(50);
        let rate = 1.0 / f64::from(score.count);
        let value = spacing + if correct { 0.0 } else { 5000.0 };
        score.average = value * rate + score.average * (1.0 - rate);
    }
    fn score(&self, word: &Text) -> f64 {
        let mut total = 0.0;
        let mut count = 0;
        let mut index = 0;
        // Match JS for-of code-point iteration when scoring candidate words.
        while index < word.len() {
            let width = if (0xd800..=0xdbff).contains(&word.0[index])
                && word
                    .0
                    .get(index + 1)
                    .is_some_and(|c| (0xdc00..=0xdfff).contains(c))
            {
                2
            } else {
                1
            };
            if let Some(score) = self.scores.get(&word.0[index..index + width]) {
                total += score.average;
                count += 1;
            }
            index += width;
        }
        if count == 0 {
            0.0
        } else {
            total / f64::from(count)
        }
    }
    /// Generator supplies the same twenty RNG-selected candidates; ties retain
    /// the earliest sample, exactly as the browser learner does.
    pub fn best<'a>(&self, candidates: &'a [Text]) -> Option<&'a Text> {
        let mut best = None;
        let mut high = 0.0;
        for candidate in candidates {
            let score = self.score(candidate);
            if best.is_none() || score > high {
                best = Some(candidate);
                high = score;
            }
        }
        best
    }
}
