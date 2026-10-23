use typing_engine::error::{EngineError, ErrorCode};
use typing_engine::{BINDING_VERSION, Config, Session, Text};
use wasm_bindgen::prelude::*;

fn bind_error(error: EngineError) -> JsError {
    let payload = serde_json::to_string(&error)
        .expect("Engine errors contain serializable strings and actions");
    JsError::new(&payload)
}
fn failure(code: ErrorCode, message: &str) -> JsError {
    bind_error(EngineError::new(code, message))
}
fn parse<'a, T: serde::Deserialize<'a>>(source: &'a str) -> Result<T, JsError> {
    serde_json::from_str(source).map_err(|error| bind_error(EngineError::from(error.to_string())))
}
fn serialize<T: serde::Serialize>(value: &T) -> Result<String, JsError> {
    serde_json::to_string(value).map_err(|error| bind_error(EngineError::from(error.to_string())))
}

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
            return Err(failure(
                ErrorCode::BindingMismatch,
                "Binding version mismatch",
            ));
        }
        let config: Config = parse(config)?;
        let words: Vec<Text> = parse(words)?;
        Ok(Self {
            session: Some(Session::new(config, words).map_err(bind_error)?),
        })
    }
    pub fn command(&mut self, command: &str) -> Result<String, JsError> {
        let command = parse(command)?;
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        let update = session.apply(command).map_err(bind_error)?;
        serialize(&update)
    }
    pub fn preflight(&self, data: &str, layout: &str) -> Result<String, JsError> {
        let data = parse(data)?;
        let layout = parse(layout)?;
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        serialize(&session.preflight(data, &layout))
    }
    pub fn pace(&mut self, command: &str) -> Result<String, JsError> {
        let command = parse(command)?;
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        serialize(&session.pace_command(command).map_err(bind_error)?)
    }
    pub fn restart_policy(&self, options: &str) -> Result<String, JsError> {
        let options = parse(options)?;
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        serialize(&session.restart_policy(options))
    }
    pub fn snapshot(&self) -> Result<String, JsError> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        serialize(&session.snapshot())
    }
    pub fn log(&self) -> Result<String, JsError> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        serialize(&session.log())
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
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?;
        let session = session
            .session
            .take()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Session disposed"))?;
        content.recycle_session(session);
        Ok(())
    }
    #[wasm_bindgen(constructor)]
    pub fn new(version: u32) -> Result<Self, JsError> {
        if version != BINDING_VERSION {
            return Err(failure(
                ErrorCode::BindingMismatch,
                "Binding version mismatch",
            ));
        }
        Ok(Self {
            content: Some(typing_engine::generation::Content::default()),
        })
    }
    pub fn prepare(&mut self, input: &str, repeating: bool) -> Result<(), JsError> {
        let input = parse(input)?;
        self.content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .prepare_repeating(input, repeating)
            .map_err(bind_error)
    }
    pub fn generate(&mut self, repeating: bool) -> Result<String, JsError> {
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .generator()
            .map_err(bind_error)?;
        let generated = generator.generate(repeating).map_err(bind_error)?;
        serialize(&generated)
    }
    pub fn next(
        &mut self,
        index: usize,
        bound: usize,
        previous: &str,
        previous2: &str,
    ) -> Result<String, JsError> {
        let previous: Option<Text> = parse(previous)?;
        let previous2: Option<Text> = parse(previous2)?;
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .generator()
            .map_err(bind_error)?;
        let next = generator
            .next(index, bound, previous.as_ref(), previous2.as_ref())
            .map_err(bind_error)?;
        serialize(&next)
    }
    pub fn metadata(&mut self) -> Result<String, JsError> {
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .generator()
            .map_err(bind_error)?;
        serialize(
            &serde_json::json!({ "allWordsGenerated": generator.all_generated(), "currentQuote": generator.current_quote }),
        )
    }
    pub fn request(&mut self) -> Result<String, JsError> {
        let generator = self
            .content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .generator()
            .map_err(bind_error)?;
        serialize(&generator.pending_request())
    }
    pub fn supply(&mut self, request: &str, source: &str) -> Result<(), JsError> {
        let request = parse(request)?;
        let source = parse(source)?;
        self.content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .generator()
            .map_err(bind_error)?
            .supply(&request, source)
            .map_err(bind_error)
    }
    pub fn session(&mut self, repeating: bool) -> Result<WasmSession, JsError> {
        let session = self
            .content
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Content disposed"))?
            .start_session(repeating)
            .map_err(bind_error)?;
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
    let log = parse(log)?;
    let query = parse(query)?;
    serialize(&typing_engine::analysis::analyze(&log, query))
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
            return Err(failure(
                ErrorCode::BindingMismatch,
                "Binding version mismatch",
            ));
        }
        let log = parse(log)?;
        Ok(Self {
            playback: Some(typing_engine::replay::Playback::new(&log, zen)),
        })
    }
    pub fn snapshot(&self) -> Result<String, JsError> {
        let playback = self
            .playback
            .as_ref()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Replay disposed"))?;
        serialize(&playback.snapshot())
    }
    pub fn step(&mut self) -> Result<String, JsError> {
        let playback = self
            .playback
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Replay disposed"))?;
        serialize(&playback.step())
    }
    pub fn seek(&mut self, cursor: &str) -> Result<String, JsError> {
        let cursor = parse(cursor)?;
        let playback = self
            .playback
            .as_mut()
            .ok_or_else(|| failure(ErrorCode::Disposed, "Replay disposed"))?;
        serialize(&playback.seek(cursor))
    }
    pub fn dispose(&mut self) {
        self.playback = None;
    }
}
