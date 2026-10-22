use serde::Serialize;
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
    pub fn log(&self) -> Result<String, JsError> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        Ok(serde_json::to_string(&session.log())?)
    }
    pub fn command_value(&mut self, command: JsValue) -> Result<JsValue, JsError> {
        let command = serde_wasm_bindgen::from_value(command)?;
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| JsError::new("Session disposed"))?;
        let update = session
            .apply(command)
            .map_err(|message| JsError::new(&message))?;
        Ok(update
            .serialize(&serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true))?)
    }
    pub fn dispose(&mut self) {
        self.session = None;
    }
}
