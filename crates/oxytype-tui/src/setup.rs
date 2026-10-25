//! Presentation controls edit a draft core configuration, validated on apply.
use crate::{Result, content::OfflineContent, engine::EngineHost, options};
use ratatui::text::Line;
use typing_engine::{Config, generation::CustomText};

pub struct Setup {
    pub config: Config,
    pub selected: usize,
    pub text: String,
    pub order: String,
    pub limit: String,
    pub length: Option<f64>,
    pub theme: String,
    pub reduced_animation: bool,
    pub record_replay: bool,
}
fn cycle(value: &mut String, values: &[&str], direction: i32) {
    let index = values.iter().position(|v| v == value).unwrap_or(0) as i32;
    *value = values[(index + direction).rem_euclid(values.len() as i32) as usize].into();
}
impl Setup {
    pub fn new(config: Config, custom: Option<&CustomText>) -> Self {
        Self {
            config,
            selected: 0,
            text: custom
                .map(|c| {
                    c.text
                        .iter()
                        .map(|t| t.display_lossy())
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .unwrap_or_default(),
            order: custom.map_or("repeat", |c| c.mode.as_str()).into(),
            limit: custom.map_or("word", |c| c.limit.mode.as_str()).into(),
            length: custom.map(|c| c.limit.value),
            theme: crate::theme::DEFAULT.into(),
            reduced_animation: true,
            record_replay: false,
        }
    }
    pub fn custom(&self) -> Result<Option<CustomText>> {
        if self.config.mode != "custom" {
            return Ok(None);
        }
        Ok(Some(options::custom_text_auto(
            &self.text,
            &self.order,
            &self.limit,
            self.length,
        )?))
    }
    pub fn build(&self, content: &OfflineContent, seed: u32) -> Result<EngineHost> {
        EngineHost::offline(self.config.clone(), content.clone(), self.custom()?, seed)
    }
    pub fn select(&mut self, direction: i32) {
        self.selected = (self.selected as i32 + direction).rem_euclid(16) as usize;
    }
    pub fn adjust(&mut self, direction: i32) {
        let c = &mut self.config;
        match self.selected {
            0 => cycle(
                &mut c.mode,
                &["time", "words", "quote", "custom", "zen"],
                direction,
            ),
            1 => {
                c.words =
                    (i64::from(c.words) + i64::from(direction) * 10).clamp(0, 1_000_000) as u32
            }
            2 => c.time = (c.time + f64::from(direction) * 15.0).clamp(0.0, 1_000_000.0),
            3 => c.punctuation = !c.punctuation,
            4 => c.numbers = !c.numbers,
            5 => cycle(
                &mut c.difficulty,
                &["normal", "expert", "master"],
                direction,
            ),
            6 => cycle(&mut c.stop_on_error, &["off", "word", "letter"], direction),
            7 => cycle(
                &mut c.delete_on_error,
                &["off", "word", "letter", "word_hard", "letter_hard"],
                direction,
            ),
            8 => cycle(&mut c.confidence_mode, &["off", "on", "max"], direction),
            9 => c.freedom_mode = !c.freedom_mode,
            10 => c.strict_space = !c.strict_space,
            11 => c.quote_length = vec![(c.quote_length[0] + direction).rem_euclid(4)],
            12 => {
                let choices: Vec<_> = std::iter::once("")
                    .chain(options::FUNBOXES.iter().copied())
                    .collect();
                let mut name = c.funbox.first().cloned().unwrap_or_default();
                cycle(&mut name, &choices, direction);
                c.funbox = if name.is_empty() { vec![] } else { vec![name] };
            }
            13 => cycle(&mut self.theme, &crate::theme::names(), direction),
            14 => self.reduced_animation = !self.reduced_animation,
            15 => self.record_replay = !self.record_replay,
            _ => {}
        }
    }
    pub fn lines(&self) -> Vec<Line<'static>> {
        let c = &self.config;
        let labels = [
            format!("Mode: {}", c.mode),
            format!("Words: {} (0 infinite)", c.words),
            format!("Time: {}s (0 infinite)", c.time),
            format!("Punctuation: {}", c.punctuation),
            format!("Numbers: {}", c.numbers),
            format!("Difficulty: {}", c.difficulty),
            format!("Stop on error: {}", c.stop_on_error),
            format!("Delete on error: {}", c.delete_on_error),
            format!("Confidence: {}", c.confidence_mode),
            format!("Freedom: {}", c.freedom_mode),
            format!("Strict space: {}", c.strict_space),
            format!("Quote group: {:?}", c.quote_length),
            format!("Funbox: {}", c.funbox.join(", ")),
            format!("Theme: {}", self.theme),
            format!("Reduced animation: {}", self.reduced_animation),
            format!(
                "Record replay (stores PRIVATE text/input): {}",
                self.record_replay
            ),
        ];
        std::iter::once(Line::from(
            "↑↓ select · ←→ change · Enter apply · F4 custom text · Esc cancel",
        ))
        .chain(labels.into_iter().enumerate().map(|(i, s)| {
            Line::from(format!(
                "{} {s}",
                if i == self.selected { ">" } else { " " }
            ))
        }))
        .collect()
    }
    pub fn editor_lines(&self) -> Vec<Line<'static>> {
        vec![
            Line::from("Private custom text · type or paste · F8 apply · Esc cancel"),
            Line::from(format!(
                "F6 order: {} · F7 limit: {} · F9 length: {}",
                self.order,
                self.limit,
                self.length
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "auto".into())
            )),
        ]
    }
    pub fn increase_length(&mut self) {
        let value = options::custom_text_auto(&self.text, &self.order, &self.limit, self.length)
            .map(|c| c.limit.value)
            .unwrap_or(0.0);
        self.length = Some(value + 1.0);
    }
    pub fn cycle_order(&mut self) {
        cycle(&mut self.order, &["repeat", "random", "shuffle"], 1);
    }
    pub fn cycle_limit(&mut self) {
        cycle(&mut self.limit, &["section", "word", "time"], 1);
    }
}
