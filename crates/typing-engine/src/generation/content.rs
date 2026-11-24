use crate::error::{EngineError, ErrorCode};
use crate::{Text, random::Random};
use serde::Deserialize;
use ts_rs::TS;

use super::Generator;
use super::types::{Assets, CustomText, Generated, GenerationConfig, Language, NextWord};

#[derive(Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Prepare {
    pub config: GenerationConfig,
    pub language: Language,
    pub custom: Option<CustomText>,
    pub random: Random,
    pub quotes: Option<crate::quotes::QuoteAsset>,
    #[serde(default)]
    pub polyglot: Vec<Language>,
    #[serde(default)]
    pub selected_quote_id: u32,
    #[serde(default)]
    pub favorite_quote_ids: Vec<u32>,
    #[serde(default)]
    pub sections: Vec<crate::content::Source>,
}

#[derive(Default)]
enum Preparation {
    #[default]
    New,
    Released,
    Prepared {
        generator: Box<Generator>,
        output: Option<(bool, Generated)>,
    },
}

/// Retains only explicitly owned content-selection state across restarts.
#[derive(Default)]
pub struct Content {
    preparation: Preparation,
    assets: Assets,
    weak_spot: crate::weak_spot::WeakSpot,
    last_pace_wpm: f64,
    previous: Vec<NextWord>,
    previous_quote: Option<crate::quotes::Quote>,
    generation: u32,
}

impl Content {
    /// Consume the prior session before preparing its replacement. Only learning
    /// survives; logs, pending replies and input state are dropped with the session.
    pub fn recycle_session(&mut self, session: crate::Session) {
        let memory = session.into_learning();
        self.weak_spot = memory.weak_spot;
        self.last_pace_wpm = memory.last_pace_wpm;
        self.previous = memory.previous;
        self.previous_quote = memory.quote;
        self.generation = self.generation.max(memory.generation);
        self.preparation = Preparation::Released;
    }

    pub fn quote_catalog(
        &mut self,
        asset: crate::quotes::QuoteAsset,
        lengths: Option<Vec<i32>>,
        mut random: Random,
    ) -> Result<crate::quotes::QuoteCollection, EngineError> {
        crate::validation::random(&random)?;
        if lengths.as_ref().is_some_and(|lengths| {
            lengths.len() > 64
                || lengths
                    .iter()
                    .any(|length| ![-3, -2, 0, 1, 2, 3].contains(length))
        }) {
            return Err(EngineError::new(
                ErrorCode::InvalidConfig,
                "Invalid quote length selection",
            ));
        }
        self.assets
            .quotes
            .load_catalog(asset, lengths.as_deref(), &mut random)
    }

    pub fn update_quote_queue(
        &mut self,
        lengths: &[i32],
        mut random: Random,
    ) -> Result<Random, EngineError> {
        if lengths.len() > 64
            || lengths
                .iter()
                .any(|length| ![-3, -2, 0, 1, 2, 3].contains(length))
        {
            return Err(EngineError::new(
                ErrorCode::InvalidConfig,
                "Invalid quote length selection",
            ));
        }
        crate::validation::random(&random)?;
        self.assets.quotes.update_queue(lengths, &mut random)?;
        Ok(random)
    }

    pub fn prepare(&mut self, input: Prepare) -> Result<(), crate::error::EngineError> {
        self.prepare_repeating(input, false)
    }

    pub fn prepare_repeating(
        &mut self,
        input: Prepare,
        repeating: bool,
    ) -> Result<(), crate::error::EngineError> {
        if repeating && input.config.mode == "quote" && self.previous_quote.is_none() {
            return Err("Missing previous quote".into());
        }
        if !matches!(self.preparation, Preparation::New) {
            self.generation = self
                .generation
                .checked_add(1)
                .ok_or("Content generation exhausted")?;
        }
        self.preparation = Preparation::Released;
        self.assets.quote_asset = input.quotes;
        self.assets.polyglot = input.polyglot;
        self.assets.selected_quote_id = input.selected_quote_id;
        self.assets.favorite_quote_ids = input.favorite_quote_ids;
        self.assets.sections = input.sections;
        let mut generator = Generator::with_repeated_quote(
            input.config,
            input.language,
            input.custom,
            input.random,
            &mut self.assets,
            if repeating {
                self.previous_quote.clone()
            } else {
                None
            },
        )?;
        generator.weak_spot = self.weak_spot.clone();
        generator.previous = self.previous.clone();
        generator.prepared_generation = self.generation;
        if let Some(queue) = &mut generator.section_queue {
            queue.set_generation(self.generation);
        }
        self.preparation = Preparation::Prepared {
            generator: Box::new(generator),
            output: None,
        };
        Ok(())
    }

    pub fn start_session(
        &mut self,
        repeating: bool,
    ) -> Result<crate::Session, crate::error::EngineError> {
        let Preparation::Prepared { generator, output } = &mut self.preparation else {
            return Err("Content not prepared".into());
        };
        let generated = match output.take() {
            Some((prepared_repeat, generated)) if prepared_repeat == repeating => generated,
            _ => generator.generate(repeating)?,
        };
        let Preparation::Prepared { generator, .. } =
            std::mem::replace(&mut self.preparation, Preparation::Released)
        else {
            unreachable!()
        };
        let mut session = crate::Session::from_generated(*generator, generated)?;
        session.pace.remember(self.last_pace_wpm, false);
        Ok(session)
    }

    /// Inspect prepared output without restarting generation or consuming RNG/source content.
    pub fn generate(&mut self, repeating: bool) -> Result<Generated, EngineError> {
        let Preparation::Prepared { generator, output } = &mut self.preparation else {
            return Err("Content not prepared".into());
        };
        *output = None;
        let generated = generator.generate(repeating)?;
        *output = Some((repeating, generated.clone()));
        Ok(generated)
    }

    pub fn prepared_generator(&self) -> Result<&Generator, EngineError> {
        match &self.preparation {
            Preparation::Prepared { generator, .. } => Ok(generator),
            _ => Err("Content not prepared".into()),
        }
    }

    /// Unlike mutable generator access, preview sampling preserves prepared output.
    pub fn preview(&mut self, seed: u32) -> Result<Vec<Text>, EngineError> {
        match &mut self.preparation {
            Preparation::Prepared { generator, .. } => generator.preview(seed),
            _ => Err("Content not prepared".into()),
        }
    }

    /// Mutable generator access invalidates any prior presentation snapshot.
    pub fn generator(&mut self) -> Result<&mut Generator, EngineError> {
        match &mut self.preparation {
            Preparation::Prepared { generator, output } => {
                *output = None;
                Ok(generator)
            }
            _ => Err("Content not prepared".into()),
        }
    }
}
