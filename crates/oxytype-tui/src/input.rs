//! Terminal delivery observations, never physical keyboard telemetry.
use crate::{Result, engine::EngineHost};
use crossterm::event::{KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use serde::{Deserialize, Serialize};
use typing_engine::{Command, Text};
use unicode_segmentation::UnicodeSegmentation;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub enhanced_keyboard_negotiated: bool,
    pub release_observed: bool,
    pub repeat_observed: bool,
    pub physical_key_identity: bool,
    pub composition_lifecycle: bool,
    pub physical_key_timing: bool,
}
impl Capabilities {
    pub fn observe(&mut self, key: KeyEvent) {
        self.release_observed |= key.kind == KeyEventKind::Release;
        self.repeat_observed |= key.kind == KeyEventKind::Repeat;
    }
}
pub fn pop_grapheme(value: &mut String) {
    if let Some((offset, _)) = value.grapheme_indices(true).next_back() {
        value.truncate(offset);
    }
}
/// Mechanical text-control edit, expressed losslessly in UTF-16 for the core.
/// Core still decides deletion eligibility, regression and event accounting.
pub fn delete_observation(input: &Text) -> Result<Text> {
    let mut value = String::from_utf16(&input.0)?;
    pop_grapheme(&mut value);
    Ok(Text::from(value.as_str()))
}
pub fn apply(host: &mut EngineHost, key: KeyEvent, now: f64, date: f64) -> Result<()> {
    if key.kind == KeyEventKind::Release || host.state().ended {
        return Ok(());
    }
    let control = key.modifiers.contains(KeyModifiers::CONTROL);
    let alt = key.modifiers.contains(KeyModifiers::ALT);
    match key.code {
        KeyCode::Backspace => host.command(Command::Delete {
            kind: if control || alt {
                "deleteWordBackward"
            } else {
                "deleteContentBackward"
            }
            .into(),
            now,
            date,
            observed_input: if control || alt {
                None
            } else {
                Some(delete_observation(&host.state().input_value)?)
            },
            sentinel_removed: false,
        })?,
        KeyCode::Char(c) if !control && !alt && !c.is_control() => {
            host.insert(&c.to_string(), now, date)?
        }
        KeyCode::Enter if !control && !alt => host.insert("\n", now, date)?,
        KeyCode::Tab if !control && !alt => host.insert("\t", now, date)?,
        _ => {}
    }
    Ok(())
}
