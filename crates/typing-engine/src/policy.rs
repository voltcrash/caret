//! Shared setting policies; hosts retain labels, preference migration and persistence.
use crate::{
    error::{EngineError, ErrorCode},
    funboxes,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;
#[derive(Deserialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
#[ts(rename = "PolicyQuery")]
pub enum Query {
    Compatible {
        names: Vec<String>,
    },
    Forced {
        key: String,
        value: Value,
        names: Vec<String>,
    },
    CanSet {
        key: String,
        value: Value,
        names: Vec<String>,
    },
}
#[derive(Serialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
#[ts(rename = "PolicyResponse")]
pub enum Response {
    Compatible { result: bool },
    Forced { result: funboxes::Forced },
    CanSet { result: bool },
}
pub fn evaluate(query: Query) -> Result<Response, EngineError> {
    let names = match &query {
        Query::Compatible { names } | Query::Forced { names, .. } | Query::CanSet { names, .. } => {
            names
        }
    };
    if names.len() > 64 || names.iter().any(|name| name.len() > 128) {
        return Err(EngineError::new(
            ErrorCode::InvalidConfig,
            "Funbox policy input exceeds bound",
        ));
    }
    if let Query::Forced { key, value, .. } | Query::CanSet { key, value, .. } = &query {
        if key.len() > 128 {
            return Err(EngineError::new(
                ErrorCode::InvalidConfig,
                "Setting key exceeds bound",
            ));
        }
        crate::validation::json_value(value)?;
    }
    let error = |message| EngineError::new(ErrorCode::InvalidConfig, message);
    Ok(match query {
        Query::Compatible { names } => Response::Compatible {
            result: funboxes::compatible(&names),
        },
        Query::Forced { key, value, names } => Response::Forced {
            result: funboxes::forced(&key, &value, &names).map_err(error)?,
        },
        Query::CanSet { key, value, names } => Response::CanSet {
            result: funboxes::can_set(&key, &value, &names).map_err(error)?,
        },
    })
}
