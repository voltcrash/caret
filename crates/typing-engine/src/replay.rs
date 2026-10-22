//! Historical playback preserves legacy UTF-16 event positions. Prompt letters
//! use JS Array.from code-point iteration, including its indexing mismatch.
use crate::{
    Text,
    stats::{Log, input, text, word_index},
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Frame {
    pub inputs: Vec<Option<Text>>,
    pub active_index: usize,
}
pub fn frame(log: &Log, time: f64) -> Frame {
    let mut frame = Frame {
        inputs: vec![],
        active_index: 0,
    };
    for event in &log.events {
        if event.kind != "input" || event.test_ms > time {
            continue;
        }
        let Some(index) = word_index(event) else {
            continue;
        };
        frame.inputs.resize(frame.inputs.len().max(index + 1), None);
        frame.inputs[index] = Some(text(&event.data["inputValue"]));
        if event.data["clearedNextWord"] == true {
            frame.inputs.resize(frame.inputs.len().max(index + 2), None);
            frame.inputs[index + 1] = Some(Text::default());
        }
        frame.active_index = index;
        if event.data["commitsWord"] == true
            && event.data["lastWord"] != true
            && event.data["inputStopped"] != true
        {
            frame.active_index += 1;
        }
    }
    frame
}
pub fn duration(log: &Log) -> f64 {
    log.events
        .iter()
        .fold(0.0f64, |value, event| value.max(event.test_ms))
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum Action {
    CorrectLetter,
    IncorrectLetter,
    BackWord,
    SubmitCorrectWord,
    SubmitErrorWord,
    SetLetterIndex,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(untagged)]
pub enum StepValue {
    Text(Text),
    Index(usize),
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct Step {
    pub action: Action,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub value: Option<StepValue>,
    pub time: f64,
}
pub fn words(log: &Log, zen: bool) -> Vec<Text> {
    if zen {
        crate::stats::input_history(log)
    } else {
        log.context.target_words.clone()
    }
}
pub fn steps(log: &Log, zen: bool) -> Vec<Step> {
    let mut steps = vec![];
    let mut previous = None;
    for event in &log.events {
        if event.kind != "input" {
            continue;
        }
        let Some(index) = word_index(event) else {
            continue;
        };
        if let Some(previous) = previous
            && previous != index
        {
            let action = if index > previous {
                let events: Vec<_> = log
                    .events
                    .iter()
                    .filter(|e| word_index(e) == Some(previous))
                    .collect();
                let typed = input(&events);
                if zen || log.context.target_words.get(previous) == Some(&typed) {
                    Action::SubmitCorrectWord
                } else {
                    Action::SubmitErrorWord
                }
            } else {
                Action::BackWord
            };
            steps.push(Step {
                action,
                time: event.test_ms,
                value: None,
            });
        }
        if event.data["inputType"] == "insertText"
            || event.data["inputType"] == "insertCompositionText"
        {
            if event.data["inputStopped"] != true {
                steps.push(Step {
                    action: if event.data["correct"] == true {
                        Action::CorrectLetter
                    } else {
                        Action::IncorrectLetter
                    },
                    value: Some(StepValue::Text(text(&event.data["data"]))),
                    time: event.test_ms,
                });
            }
        } else if (event.data["inputType"] == "deleteContentBackward"
            || event.data["inputType"] == "deleteWordBackward")
            && !previous.is_some_and(|previous| index < previous)
        {
            let length = if event.data.get("inputValue").is_some() {
                text(&event.data["inputValue"]).len()
            } else {
                event.data["charIndex"].as_u64().unwrap_or(0) as usize
            };
            steps.push(Step {
                action: Action::SetLetterIndex,
                value: Some(StepValue::Index(length)),
                time: event.test_ms,
            });
        }
        previous = Some(index);
    }
    steps
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct Letter {
    #[serde(rename = "char")]
    pub character: Text,
    pub correct: bool,
    pub incorrect: bool,
    pub extra: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, TS)]
pub struct Word {
    pub letters: Vec<Letter>,
    pub error: bool,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Cursor {
    pub word_index: i32,
    pub letter_index: usize,
}
pub fn prompt(words: &[Text], steps: &[Step]) -> Vec<Word> {
    let count = steps.iter().fold(0i32, |count, step| match step.action {
        Action::BackWord => count - 1,
        Action::SubmitCorrectWord | Action::SubmitErrorWord => count + 1,
        _ => count,
    });
    words
        .iter()
        .take((count + 1).max(0) as usize)
        .map(|word| {
            let mut letters = vec![];
            let mut index = 0;
            while index < word.len() {
                let width = if (0xd800..=0xdbff).contains(&word.0[index])
                    && word
                        .0
                        .get(index + 1)
                        .is_some_and(|unit| (0xdc00..=0xdfff).contains(unit))
                {
                    2
                } else {
                    1
                };
                letters.push(Letter {
                    character: Text(word.0[index..index + width].to_vec()),
                    correct: false,
                    incorrect: false,
                    extra: false,
                });
                index += width;
            }
            Word {
                letters,
                error: false,
            }
        })
        .collect()
}
pub fn apply(words: &mut [Word], cursor: &mut Cursor, step: &Step) -> Option<&'static str> {
    let word = words.get_mut(usize::try_from(cursor.word_index).ok()?)?;
    match step.action {
        Action::CorrectLetter => {
            if let Some(letter) = word.letters.get_mut(cursor.letter_index) {
                letter.correct = true;
            }
            cursor.letter_index += 1;
            Some("click")
        }
        Action::IncorrectLetter => {
            if cursor.letter_index >= word.letters.len() {
                let character = match &step.value {
                    Some(StepValue::Text(text)) => text.clone(),
                    Some(StepValue::Index(index)) => Text::from(index.to_string().as_str()),
                    None => Text::default(),
                };
                word.letters.push(Letter {
                    character,
                    correct: false,
                    incorrect: false,
                    extra: true,
                });
            }
            if let Some(letter) = word.letters.get_mut(cursor.letter_index) {
                letter.incorrect = true;
            }
            cursor.letter_index += 1;
            Some("error")
        }
        Action::SetLetterIndex => {
            let Some(StepValue::Index(index)) = step.value else {
                return None;
            };
            cursor.letter_index = index;
            let mut position = 0;
            word.letters.retain_mut(|letter| {
                let before = position < index;
                position += 1;
                if before {
                    return true;
                }
                if letter.extra {
                    return false;
                }
                letter.correct = false;
                letter.incorrect = false;
                true
            });
            Some("click")
        }
        Action::SubmitCorrectWord | Action::SubmitErrorWord => {
            if step.action == Action::SubmitErrorWord {
                word.error = true;
            }
            cursor.word_index += 1;
            cursor.letter_index = 0;
            Some(if step.action == Action::SubmitErrorWord {
                "error"
            } else {
                "click"
            })
        }
        Action::BackWord => {
            cursor.word_index -= 1;
            let Some(word) = usize::try_from(cursor.word_index)
                .ok()
                .and_then(|index| words.get_mut(index))
            else {
                return Some("click");
            };
            cursor.letter_index = word.letters.len();
            while cursor.letter_index > 0
                && word
                    .letters
                    .get(cursor.letter_index - 1)
                    .is_some_and(|letter| !letter.correct && !letter.incorrect && !letter.extra)
            {
                cursor.letter_index -= 1;
            }
            word.error = false;
            Some("click")
        }
    }
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Seek {
    pub cursor: Cursor,
    pub next_index: usize,
}
pub fn seek(words: &mut [Word], steps: &[Step], target: Cursor) -> Seek {
    let mut cursor = Cursor::default();
    let mut next_index = 0;
    for (index, step) in steps.iter().enumerate() {
        if cursor.word_index < target.word_index
            || (cursor.word_index == target.word_index && cursor.letter_index < target.letter_index)
        {
            apply(words, &mut cursor, step);
            next_index = index + 1;
        }
    }
    Seek { cursor, next_index }
}
