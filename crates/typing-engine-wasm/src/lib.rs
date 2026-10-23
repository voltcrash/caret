use typing_engine::{BINDING_VERSION, Config, Session, Text};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn binding_version() -> u32 {
    BINDING_VERSION
}

/// Thin serialization/ownership boundary. All decisions live in typing-engine.
#[wasm_bindgen]
pub struct WasmSession {
    session: Option<Session>,
}

#[wasm_bindgen]
impl WasmSession {
    #[wasm_bindgen(constructor)]
    pub fn new(config: &str, words: &str, version: u32) -> Result<WasmSession, JsError> {
        if version != BINDING_VERSION {
            return Err(JsError::new("Binding version mismatch"));
        }
        let config: Config = serde_json::from_str(config)?;
        let words: Vec<Text> = serde_json::from_str(words)?;
        Ok(Self {
            session: Some(Session::new(config, words).map_err(|message| JsError::new(&message))?),
        })
    }
    pub fn command(&mut self, command: &str) -> Result<String, JsError> {
        let command = serde_json::from_str(command)?;
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        let update = session
            .apply(command)
            .map_err(|message| JsError::new(&message))?;
        Ok(serde_json::to_string(&update)?)
    }
    pub fn preflight(&self, data: &str, layout: &str) -> Result<String, JsError> {
        let data = serde_json::from_str(data)?;
        let layout = serde_json::from_str(layout)?;
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        Ok(serde_json::to_string(&session.preflight(data, &layout))?)
    }
    pub fn pace(&mut self, command: &str) -> Result<String, JsError> {
        let command = serde_json::from_str(command)?;
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        Ok(serde_json::to_string(
            &session
                .pace_command(command)
                .map_err(|message| JsError::new(&message))?,
        )?)
    }
    pub fn restart_policy(&self, options: &str) -> Result<String, JsError> {
        let options = serde_json::from_str(options)?;
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        Ok(serde_json::to_string(&session.restart_policy(options))?)
    }
    pub fn snapshot(&self) -> Result<String, JsError> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        Ok(serde_json::to_string(&session.snapshot())?)
    }
    pub fn log(&self) -> Result<String, JsError> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        Ok(serde_json::to_string(&session.log())?)
    }
    pub fn dispose(&mut self) {
        self.session = None;
    }
}

#[wasm_bindgen]
pub struct WasmContent {
    content: Option<typing_engine::generation::Content>,
}
#[wasm_bindgen]
impl WasmContent {
    pub fn recycle_session(&mut self, session: &mut WasmSession) -> Result<(), JsError> {
        let content = self
            .content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?;
        let session = session
            .session
            .take()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        content.recycle_session(session);
        Ok(())
    }
    #[wasm_bindgen(constructor)]
    pub fn new(version: u32) -> Result<Self, JsError> {
        if version != BINDING_VERSION {
            return Err(JsError::new("Binding version mismatch"));
        }
        Ok(Self {
            content: Some(typing_engine::generation::Content::default()),
        })
    }
    pub fn prepare(&mut self, input: &str, repeating: bool) -> Result<(), JsError> {
        let input = serde_json::from_str(input)?;
        self.content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .prepare_repeating(input, repeating)
            .map_err(|message| JsError::new(&message))
    }
    pub fn generate(&mut self, repeating: bool) -> Result<String, JsError> {
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .generator()
            .map_err(|message| JsError::new(&message))?;
        let generated = generator
            .generate(repeating)
            .map_err(|message| JsError::new(&message))?;
        Ok(serde_json::to_string(&generated)?)
    }
    pub fn next(
        &mut self,
        index: usize,
        bound: usize,
        previous: &str,
        previous2: &str,
    ) -> Result<String, JsError> {
        let previous: Option<Text> = serde_json::from_str(previous)?;
        let previous2: Option<Text> = serde_json::from_str(previous2)?;
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .generator()
            .map_err(|message| JsError::new(&message))?;
        let next = generator
            .next(index, bound, previous.as_ref(), previous2.as_ref())
            .map_err(|message| JsError::new(&message))?;
        Ok(serde_json::to_string(&next)?)
    }
    pub fn metadata(&mut self) -> Result<String, JsError> {
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .generator()
            .map_err(|message| JsError::new(&message))?;
        Ok(serde_json::to_string(
            &serde_json::json!({ "allWordsGenerated": generator.all_generated(), "currentQuote": generator.current_quote }),
        )?)
    }
    pub fn request(&mut self) -> Result<String, JsError> {
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .generator()
            .map_err(|message| JsError::new(&message))?;
        Ok(serde_json::to_string(&generator.pending_request())?)
    }
    pub fn supply(&mut self, request: &str, source: &str) -> Result<(), JsError> {
        let request = serde_json::from_str(request)?;
        let source = serde_json::from_str(source)?;
        self.content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .generator()
            .map_err(|message| JsError::new(&message))?
            .supply(&request, source)
            .map_err(|message| JsError::new(&message))
    }
    pub fn session(&mut self, repeating: bool) -> Result<WasmSession, JsError> {
        let session = self
            .content
            .as_mut()
            .ok_or_else(|| JsError::new("Content disposed"))?
            .start_session(repeating)
            .map_err(|message| JsError::new(&message))?;
        Ok(WasmSession {
            session: Some(session),
        })
    }
    pub fn dispose(&mut self) {
        self.content = None;
    }
}

#[wasm_bindgen]
pub fn analyze(log: &str, query: &str) -> Result<String, JsError> {
    let log = serde_json::from_str(log)?;
    let query = serde_json::from_str(query)?;
    Ok(serde_json::to_string(&typing_engine::analysis::analyze(
        &log, query,
    ))?)
}

#[wasm_bindgen]
pub struct WasmReplay {
    playback: Option<typing_engine::replay::Playback>,
}
#[wasm_bindgen]
impl WasmReplay {
    #[wasm_bindgen(constructor)]
    pub fn new(log: &str, zen: bool, version: u32) -> Result<Self, JsError> {
        if version != BINDING_VERSION {
            return Err(JsError::new("Binding version mismatch"));
        }
        let log = serde_json::from_str(log)?;
        Ok(Self {
            playback: Some(typing_engine::replay::Playback::new(&log, zen)),
        })
    }
    pub fn snapshot(&self) -> Result<String, JsError> {
        let playback = self
            .playback
            .as_ref()
            .ok_or_else(|| JsError::new("Replay disposed"))?;
        Ok(serde_json::to_string(&playback.snapshot())?)
    }
    pub fn step(&mut self) -> Result<String, JsError> {
        let playback = self
            .playback
            .as_mut()
            .ok_or_else(|| JsError::new("Replay disposed"))?;
        Ok(serde_json::to_string(&playback.step())?)
    }
    pub fn seek(&mut self, cursor: &str) -> Result<String, JsError> {
        let cursor = serde_json::from_str(cursor)?;
        let playback = self
            .playback
            .as_mut()
            .ok_or_else(|| JsError::new("Replay disposed"))?;
        Ok(serde_json::to_string(&playback.seek(cursor))?)
    }
    pub fn dispose(&mut self) {
        self.playback = None;
    }
}
