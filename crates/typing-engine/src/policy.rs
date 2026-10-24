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
    #[serde(rename_all = "camelCase")]
    QuickRestart {
        config: Box<crate::Config>,
        limit: Option<crate::results::Limit>,
        custom_is_long: bool,
    },
    SettingConflicts {
        names: Vec<String>,
        values: Vec<(String, Value)>,
    },
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
    QuickRestart { result: bool },
    SettingConflicts { keys: Vec<String> },
    Compatible { result: bool },
    Forced { result: funboxes::Forced },
    CanSet { result: bool },
}
pub fn evaluate(query: Query) -> Result<Response, EngineError> {
    if let Query::QuickRestart {
        config,
        limit,
        custom_is_long,
    } = &query
    {
        config
            .validate()
            .map_err(|message| EngineError::new(ErrorCode::InvalidConfig, message))?;
        if limit.as_ref().is_some_and(|limit| {
            !limit.value.is_finite()
                || limit.value < 0.0
                || !["word", "time", "section"].contains(&limit.mode.as_str())
        }) {
            return Err(EngineError::new(
                ErrorCode::InvalidConfig,
                "Invalid custom limit",
            ));
        }
        return Ok(Response::QuickRestart {
            result: crate::restart::can_quick_restart(config, limit.as_ref(), *custom_is_long),
        });
    }
    let names = match &query {
        Query::QuickRestart { .. } => unreachable!(),
        Query::SettingConflicts { names, .. }
        | Query::Compatible { names }
        | Query::Forced { names, .. }
        | Query::CanSet { names, .. } => names,
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
        Query::QuickRestart { .. } => unreachable!(),
        Query::SettingConflicts { names, values } => {
            if values.len() > 1024 {
                return Err(error("Setting count exceeds bound".into()));
            }
            let mut keys = vec![];
            for (key, value) in values {
                if key.len() > 128 {
                    return Err(error("Setting key exceeds bound".into()));
                }
                crate::validation::json_value(&value)?;
                if !funboxes::can_set(&key, &value, &names).map_err(error)? {
                    keys.push(key);
                }
            }
            Response::SettingConflicts { keys }
        }
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
