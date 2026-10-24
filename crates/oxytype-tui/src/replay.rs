//! Optional recorded replay; core owns every step, cursor and correctness flag.
use crate::Result;
use ratatui::{
    style::{Color, Modifier, Style},
    text::{Line, Span},
};
use serde_json::Value;
use typing_engine::{
    Text,
    replay::{Cursor, Playback, PlaybackSnapshot},
    stats::Log,
};
use unicode_segmentation::UnicodeSegmentation;

pub struct Replay {
    playback: Playback,
    pub frame: PlaybackSnapshot,
}
impl Replay {
    pub fn new(record: &Value) -> Result<Self> {
        if record["formatVersion"] != 1
            || record["engineBehaviorVersion"] != typing_engine::BEHAVIOR_VERSION
            || record["eventLogVersion"] != typing_engine::EVENT_LOG_VERSION
        {
            return Err(
                "Replay needs a compatible engine/log version; stored summary remains available"
                    .into(),
            );
        }
        if record["replayLog"].is_null() {
            return Err(
                "Replay unavailable: this result did not record its private input log".into(),
            );
        }
        let log: Log = serde_json::from_value(record["replayLog"].clone())?;
        let playback = Playback::new(&log, record["config"]["mode"] == "zen")?;
        let frame = playback.snapshot();
        Ok(Self { playback, frame })
    }
    pub fn step(&mut self) {
        let update = self.playback.step();
        for change in update.words {
            self.frame.words[change.index] = change.word;
        }
        self.frame.cursor = update.cursor;
        self.frame.next_index = update.next_index;
        self.frame.next_time = update.next_time;
    }
    pub fn seek(&mut self, cursor: Cursor) {
        self.frame = self.playback.seek(cursor);
    }
    pub fn lines(&self) -> Vec<Line<'static>> {
        let cursor = self.frame.cursor;
        let mut lines = vec![
            Line::from(format!(
                "Recorded replay · word {} / UTF-16 unit {} · step {}",
                cursor.word_index, cursor.letter_index, self.frame.next_index
            )),
            Line::from("→ / Space step · Home restart · PgUp/PgDn seek word · Esc history"),
        ];
        let mut spans = vec![];
        for (index, word) in self
            .frame
            .words
            .iter()
            .enumerate()
            .skip(cursor.word_index.max(0) as usize)
            .take(35)
        {
            let units: Vec<_> = word
                .letters
                .iter()
                .flat_map(|l| l.character.0.iter().copied())
                .collect();
            let text = Text(units).display_lossy();
            let mut unit = 0;
            for grapheme in text.graphemes(true) {
                let len = grapheme.encode_utf16().count();
                let letters = &word.letters
                    [unit.min(word.letters.len())..(unit + len).min(word.letters.len())];
                let wrong = letters.iter().any(|l| l.incorrect || l.extra);
                let correct = letters.iter().all(|l| l.correct);
                let mut style = if wrong {
                    Style::new()
                        .fg(Color::Red)
                        .add_modifier(Modifier::UNDERLINED)
                } else if correct {
                    Style::new().fg(Color::Green)
                } else {
                    Style::default()
                };
                if index as i32 == cursor.word_index
                    && unit <= cursor.letter_index
                    && cursor.letter_index < unit + len
                {
                    style = style.add_modifier(Modifier::REVERSED);
                }
                spans.push(Span::styled(
                    grapheme.replace('\t', "→   ").replace('\n', "↵\n"),
                    style,
                ));
                unit += len;
            }
            if word.error {
                spans.push(Span::from("! "));
            }
        }
        lines.push(Line::from(spans));
        lines
    }
}
