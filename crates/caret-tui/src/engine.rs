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
    pub visual_input: Option<Text>,
    pub result: Option<Summary>,
    pub result_error: Option<String>,
    pub seed: u32,
    pub content_identity: String,
    pub repeated: bool,
    content: Content,
    session: Option<Session>,
    language: Language,
    custom: Option<CustomText>,
    quotes: Option<typing_engine::quotes::QuoteAsset>,
}
impl EngineHost {
    pub fn new(
        config: Config,
        language: Language,
        custom: Option<CustomText>,
        seed: u32,
    ) -> Result<Self> {
        Self::with_assets(config, language, custom, seed, None)
    }
    pub fn offline(
        config: Config,
        content: crate::content::OfflineContent,
        custom: Option<CustomText>,
        seed: u32,
    ) -> Result<Self> {
        crate::options::validate(&config, &content, custom.as_ref())?;
        Self::with_assets(config, content.language, custom, seed, Some(content.quotes))
    }
    fn with_assets(
        config: Config,
        language: Language,
        custom: Option<CustomText>,
        seed: u32,
        quotes: Option<typing_engine::quotes::QuoteAsset>,
    ) -> Result<Self> {
        let mut host = Self {
            config,
            language,
            custom,
            quotes,
            seed,
            content_identity: String::new(),
            repeated: false,
            content: Content::default(),
            session: None,
            words: vec![],
            inputs: vec![],
            visual_input: None,
            result: None,
            result_error: None,
        };
        host.content_identity = crate::storage::hash(&(
            &host.language.words,
            &host.quotes.as_ref().map(|q| &q.quotes),
            &host.custom.as_ref().map(|c| &c.text),
        ))?;
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
    pub fn custom_limit(&self) -> Option<typing_engine::results::Limit> {
        self.custom.as_ref().map(|c| typing_engine::results::Limit {
            mode: c.limit.mode.clone(),
            value: c.limit.value,
        })
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
            quotes: self.quotes.clone(),
            polyglot: vec![],
            selected_quote_id: 0,
            favorite_quote_ids: vec![],
            sections: vec![],
        })?;
        let session = self.content.start_session(same)?;
        self.repeated = same;
        self.words = session.snapshot().words;
        for word in &self.words {
            terminal_text(word)?;
        }
        self.inputs.clear();
        self.visual_input = None;
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
        self.visual_input = update.visual_input_override;
        for change in update.words {
            terminal_text(&change.word)?;
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
    let modes = ["time", "words", "quote", "custom", "zen"];
    for mode in modes {
        let custom = if mode == "custom" {
            Some(crate::options::custom_text_auto(
                "alpha beta",
                "repeat",
                "word",
                None,
            )?)
        } else {
            None
        };
        let mut host = EngineHost::offline(
            Config {
                mode: mode.into(),
                words: 2,
                time: 1.0,
                ..Default::default()
            },
            crate::content::OfflineContent::bundled()?,
            custom,
            42,
        )?;
        if mode == "zen" {
            host.insert("alpha ", 100.0, 1000.0)?;
            host.command(Command::Bailout {
                now: 1100.0,
                date: 2000.0,
            })?;
        } else if mode == "time" {
            let word = host.words[0].display_lossy();
            host.insert(&word, 100.0, 1000.0)?;
            host.command(Command::Advance {
                now: 1200.0,
                date: 2100.0,
            })?;
        } else {
            for i in 0..1000 {
                if host.state().ended {
                    break;
                }
                let word = host.words[i].display_lossy();
                host.insert(&word, 100.0 + i as f64 * 1000.0, 1000.0 + i as f64 * 1000.0)?;
            }
        }
        if !host.state().ended || host.result.is_none() {
            return Err(format!("Bundled offline {mode} smoke did not complete").into());
        }
    }
    println!(
        "{}",
        serde_json::json!({"syntheticSmoke":true,"completed":true,"bundledModes":modes,"engineVersion":typing_engine::BEHAVIOR_VERSION})
    );
    Ok(())
}

fn terminal_text(text: &Text) -> Result<()> {
    let text = String::from_utf16(&text.0).map_err(
        |_| "Generated content contains isolated UTF-16 surrogates; unavailable in terminal input",
    )?;
    crate::content::safe_text(&text)
}
