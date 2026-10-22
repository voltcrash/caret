use crate::{
    Config, Text,
    text::{is_space, normalize},
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Clone, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Input {
    pub data: Text,
    pub input_value: Text,
    pub target_word: Text,
    pub nospace: bool,
    pub correct_shift_used: Option<bool>,
}
#[derive(Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Decision {
    pub data: Text,
    pub correct: bool,
    pub stopped: bool,
    pub advance: bool,
    pub input_value: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub visual_input_override: Option<Text>,
}
fn space(data: &Text) -> bool {
    data.len() == 1 && is_space(data.0[0])
}
pub fn normalize_data(config: &Config, input: &Input) -> Text {
    if input.data.len() == 1 {
        Text(vec![normalize(
            input.data.0[0],
            input.target_word.0.get(input.input_value.len()).copied(),
            &config.language,
        )])
    } else {
        input.data.clone()
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Commit {
    Separator,
    Nospace,
}
pub fn commit(input: &Input) -> Option<Commit> {
    if space(&input.data) || input.data.0 == [10] {
        Some(Commit::Separator)
    } else if input.nospace && input.input_value.len() + input.data.len() == input.target_word.len()
    {
        Some(Commit::Nospace)
    } else {
        None
    }
}
pub fn should_advance(config: &Config, input: &Input) -> bool {
    let Some(commit) = commit(input) else {
        return false;
    };
    if config.mode == "zen" {
        return true;
    }
    if input.input_value.is_empty()
        && commit == Commit::Separator
        && (config.strict_space || config.difficulty != "normal")
    {
        return false;
    }
    let mut next = input.input_value.clone();
    next.0.extend_from_slice(&input.data.0);
    next == input.target_word || (config.stop_on_error == "off" && config.delete_on_error == "off")
}
pub fn evaluate(config: &Config, input: &Input) -> Decision {
    let data = normalize_data(config, input);
    let input = Input {
        data: data.clone(),
        ..input.clone()
    };
    let correct = config.mode == "zen"
        || (input.correct_shift_used != Some(false)
            && input.data.len() == 1
            && input.target_word.0.get(input.input_value.len()) == input.data.0.first());
    let stopped =
        (config.stop_on_error == "letter" && !correct) || input.correct_shift_used == Some(false);
    let mut next = input.input_value.clone();
    next.0.extend_from_slice(&data.0);
    Decision {
        data,
        correct,
        stopped,
        advance: !stopped && should_advance(config, &input),
        input_value: if stopped {
            input.input_value.clone()
        } else {
            next.clone()
        },
        visual_input_override: if stopped
            && input.correct_shift_used != Some(false)
            && !config.blind_mode
        {
            Some(next)
        } else {
            None
        },
    }
}
pub fn blocked(config: &Config, input: &Input, has_newline: bool) -> bool {
    if input.data.0 == [10] && !has_newline && config.mode != "zen" {
        return true;
    }
    if space(&input.data) && input.nospace {
        return true;
    }
    let data = normalize_data(config, input);
    let hard = config.mode != "zen" && config.delete_on_error.contains("hard");
    if space(&data)
        && input.input_value.is_empty()
        && !config.strict_space
        && config.difficulty == "normal"
        && !hard
    {
        return true;
    }
    let limit = if config.mode == "zen" {
        30
    } else {
        input.target_word.len() + 20
    };
    input.input_value.len() >= limit
        && !should_advance(
            config,
            &Input {
                data,
                ..input.clone()
            },
        )
}
pub fn can_delete(
    config: &Config,
    input: &Text,
    index: usize,
    previous_correct: bool,
    previous_available: bool,
) -> bool {
    let empty = input.is_empty();
    if empty && (index == 0 || !previous_available) {
        return false;
    }
    if config.freedom_mode {
        return true;
    }
    if config.confidence_mode == "max" {
        return false;
    }
    !(empty && (config.confidence_mode == "on" || previous_correct))
}
