//! Terminal observations and display projection. All typing rules stay in core.
use crate::Result;
use typing_engine::{
    Command, Config, Session, Text,
    generation::{Content, CustomText, Language, Prepare},
    random::Random,
    session::{LiveMetrics, State},
    stats::{self, Log, Summary},
};

pub struct EngineHost {
    pub config: Config,
    pub words: Vec<Text>,
    pub inputs: Vec<Text>,
    pub result: Option<Summary>,
    pub result_error: Option<String>,
    pub seed: u32,
    content: Content,
    session: Option<Session>,
    language: Language,
    custom: Option<CustomText>,
}
impl EngineHost {
    pub fn new(
        config: Config,
        language: Language,
        custom: Option<CustomText>,
        seed: u32,
    ) -> Result<Self> {
        let mut host = Self {
            config,
            language,
            custom,
            seed,
            content: Content::default(),
            session: None,
            words: vec![],
            inputs: vec![],
            result: None,
            result_error: None,
        };
        host.restart(false, 0.0, 0.0)?;
        Ok(host)
    }
    pub fn session(&self) -> &Session {
        self.session.as_ref().expect("Prepared terminal session")
    }
    pub fn state(&self) -> State {
        self.session().state()
    }
    pub fn live(&self, now: f64) -> Result<LiveMetrics> {
        Ok(self.session().live_stats(now)?)
    }
    pub fn log(&self) -> Result<Log> {
        Ok(serde_json::from_value(self.session().log())?)
    }
    pub fn restart(&mut self, repeat: bool, now: f64, date: f64) -> Result<()> {
        let mut same = repeat;
        if let Some(mut session) = self.session.take() {
            let policy = session.restart_policy(typing_engine::restart::RestartOptions {
                with_same_wordset: repeat,
                ..Default::default()
            });
            if !policy.allowed {
                self.session = Some(session);
                return Err("Restart unavailable during this test".into());
            }
            same = policy.with_same_wordset;
            if session.state().active {
                session.apply(Command::Abandon { now, date })?;
            }
            self.content.recycle_session(session);
            if !same {
                self.seed = self.seed.wrapping_add(1);
            }
        }
        self.content.prepare(Prepare {
            config: self.config.clone(),
            language: self.language.clone(),
            custom: self.custom.clone(),
            random: Random::seeded(self.seed),
            quotes: None,
            polyglot: vec![],
            selected_quote_id: 0,
            favorite_quote_ids: vec![],
            sections: vec![],
        })?;
        let session = self.content.start_session(same)?;
        self.words = session.snapshot().words;
        self.inputs.clear();
        self.result = None;
        self.result_error = None;
        self.session = Some(session);
        Ok(())
    }
    pub fn command(&mut self, command: Command) -> Result<()> {
        let update = self
            .session
            .as_mut()
            .expect("Prepared terminal session")
            .apply(command)?;
        for change in update.words {
            self.words
                .resize(self.words.len().max(change.index + 1), Text::default());
            self.words[change.index] = change.word;
        }
        // Mechanical transport projection; no input reconstruction or score formulas.
        for event in update.events.iter().filter(|event| event.kind == "input") {
            let index = event.data["wordIndex"]
                .as_u64()
                .expect("Native input index") as usize;
            self.inputs
                .resize(self.inputs.len().max(index + 1), Text::default());
            self.inputs[index] = stats::text(&event.data["inputValue"]);
            if event.data["clearedNextWord"] == true
                && let Some(next) = self.inputs.get_mut(index + 1)
            {
                *next = Text::default();
            }
        }
        if update.state.ended && self.result.is_none() && self.result_error.is_none() {
            match stats::typed_summary(&self.log()?) {
                Ok(summary) => self.result = Some(summary),
                Err(error) => self.result_error = Some(error.to_string()),
            }
        }
        Ok(())
    }
    pub fn insert(&mut self, text: &str, now: f64, date: f64) -> Result<()> {
        self.command(Command::Insert {
            data: Text::from(text),
            now,
            date,
            correct_shift_used: None,
            automatic: None,
            is_composition_ending: None,
            layout: None,
        })
    }
}

/// Explicit synthetic smoke path: never records invented observations in history.
pub fn smoke() -> Result<()> {
    let mut host = EngineHost::new(
        Config {
            mode: "words".into(),
            words: 2,
            ..Default::default()
        },
        Language {
            name: "english".into(),
            words: ["one", "two", "three", "four"]
                .into_iter()
                .map(Text::from)
                .collect(),
            ..Default::default()
        },
        None,
        42,
    )?;
    for index in 0..2 {
        let word = host.words[index].display_lossy();
        host.insert(
            &word,
            100.0 + index as f64 * 1000.0,
            1_000_100.0 + index as f64 * 1000.0,
        )?;
    }
    if !host.state().ended || host.result.is_none() {
        return Err("Native smoke session did not complete".into());
    }
    let log = host.log()?;
    if log
        .events
        .iter()
        .any(|event| event.kind == "keydown" || event.kind == "keyup")
    {
        return Err("Smoke inserted unobserved keyboard telemetry".into());
    }
    println!(
        "{}",
        serde_json::json!({"syntheticSmoke":true,"completed":true,"engineVersion":typing_engine::BEHAVIOR_VERSION})
    );
    Ok(())
}
