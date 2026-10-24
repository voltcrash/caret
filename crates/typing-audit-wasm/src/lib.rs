use typing_engine::BINDING_VERSION;
use typing_engine::error::{EngineError, ErrorCode};
use wasm_bindgen::prelude::*;

fn bind_error(error: EngineError) -> JsError {
    let payload = serde_json::to_string(&error)
        .expect("Engine errors contain serializable strings and actions");
    JsError::new(&payload)
}

#[wasm_bindgen]
pub fn binding_version() -> u32 {
    BINDING_VERSION
}

/// Thin serialization boundary. All decisions live in typing-engine.
#[wasm_bindgen]
pub fn audit(query: &str) -> Result<String, JsError> {
    if query.len() > typing_engine::validation::MAX_JSON_BYTES {
        return Err(bind_error(EngineError::new(
            ErrorCode::InvalidInput,
            "Binding JSON exceeds byte bound",
        )));
    }
    let query = serde_json::from_str(query)
        .map_err(|error| bind_error(EngineError::from(error.to_string())))?;
    let response = typing_engine::audit::audit(query).map_err(bind_error)?;
    serde_json::to_string(&response)
        .map_err(|error| bind_error(EngineError::from(error.to_string())))
}
