//! Web-style word stream: whole words wrap, three lines show, caret line stays near the top.
use crate::{render::TextView, theme::Palette};
use ratatui::{
    style::{Modifier, Style},
    text::{Line, Span},
};
use typing_engine::Text;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Letter {
    Untyped,
    Correct,
    Incorrect,
    Extra,
}
fn shown(grapheme: &str) -> String {
    let mut shown = match grapheme {
        "\t" => "→   ".to_string(),
        "\n" => "↵".to_string(),
        _ => grapheme.to_string(),
    };
    if UnicodeWidthStr::width(shown.as_str()) == 0 {
        shown.insert(0, '◌');
    }
    shown
}
/// Grapheme states for one word, plus the grapheme index the caret precedes.
pub fn letters(target: &Text, input: &Text, language: &str) -> (Vec<(String, Letter)>, usize) {
    let mut result = vec![];
    let mut caret = None;
    let mut offset = 0;
    for grapheme in target.display_lossy().graphemes(true) {
        let units = grapheme.encode_utf16().count();
        if caret.is_none() && offset + units > input.len() {
            caret = Some(result.len());
        }
        let typed_end = (offset + units).min(input.len());
        let state = if typed_end <= offset {
            Letter::Untyped
        } else if (offset..typed_end).any(|i| {
            typing_engine::text::normalize(input.0[i], Some(target.0[i]), language) != target.0[i]
        }) {
            Letter::Incorrect
        } else {
            Letter::Correct
        };
        result.push((grapheme.to_string(), state));
        offset += units;
    }
    if input.len() > target.len() {
        let mut units = 0;
        for grapheme in input.display_lossy().graphemes(true) {
            units += grapheme.encode_utf16().count();
            if units > target.len() {
                result.push((grapheme.to_string(), Letter::Extra));
            }
        }
    }
    let caret = caret.unwrap_or(result.len());
    (result, caret)
}
fn style(palette: &Palette, letter: Letter, committed_error: bool) -> Style {
    let style = Style::new().fg(match letter {
        Letter::Untyped => palette.sub,
        Letter::Correct => palette.text,
        Letter::Incorrect => palette.error,
        Letter::Extra => palette.error_extra,
    });
    if committed_error {
        style.add_modifier(Modifier::UNDERLINED)
    } else {
        style
    }
}
pub struct Stream<'a> {
    pub words: &'a [Text],
    pub inputs: &'a [Text],
    pub index: usize,
    pub input: &'a Text,
    pub language: &'a str,
    pub palette: &'a Palette,
}
/// Lay words out like the web test. Zen (no targets) renders typed text only.
pub fn view(stream: Stream<'_>, width: u16, height: u16) -> TextView {
    let width = width.max(2) as usize;
    let mut lines: Vec<Line<'static>> = vec![Line::default()];
    let mut x = 0;
    let mut caret = (0, 0);
    let mut errors = false;
    let count = stream.words.len().max(stream.index + 1);
    for index in 0..count {
        let target = stream.words.get(index).cloned().unwrap_or_default();
        let empty = Text::default();
        let input = match index.cmp(&stream.index) {
            std::cmp::Ordering::Less => stream.inputs.get(index).unwrap_or(&empty),
            std::cmp::Ordering::Equal => stream.input,
            std::cmp::Ordering::Greater => &empty,
        };
        let (mut letters, at) = if target.is_empty() {
            let typed: Vec<_> = input
                .display_lossy()
                .graphemes(true)
                .map(|g| (g.to_string(), Letter::Correct))
                .collect();
            let at = typed.len();
            (typed, at)
        } else {
            letters(&target, input, stream.language)
        };
        let wrong = letters
            .iter()
            .any(|(_, l)| matches!(l, Letter::Incorrect | Letter::Extra));
        let committed = index < stream.index && !target.is_empty();
        // A committed word typed short of its target is an error on the web too.
        let missed = committed && letters.iter().any(|(_, l)| *l == Letter::Untyped);
        if index <= stream.index {
            errors |= wrong;
        }
        if letters.is_empty() && index == stream.index {
            letters.push((String::new(), Letter::Untyped));
        }
        let cells: Vec<_> = letters
            .iter()
            .map(|(g, _)| UnicodeWidthStr::width(shown(g).as_str()).max(1).min(width))
            .collect();
        let total: usize = cells.iter().sum();
        if x > 0 && x + total > width {
            lines.push(Line::default());
            x = 0;
        }
        for (position, ((grapheme, letter), cells)) in letters.iter().zip(&cells).enumerate() {
            if x + cells > width {
                lines.push(Line::default());
                x = 0;
            }
            if index == stream.index && position == at {
                caret = (x, lines.len() - 1);
            }
            if !grapheme.is_empty() {
                lines.last_mut().unwrap().spans.push(Span::styled(
                    shown(grapheme),
                    style(stream.palette, *letter, committed && (wrong || missed)),
                ));
            }
            x += cells;
            if grapheme == "\n" {
                lines.push(Line::default());
                x = 0;
            }
        }
        if index == stream.index && at >= letters.len() {
            caret = (x, lines.len() - 1);
        }
        if x > 0 && x < width {
            lines.last_mut().unwrap().spans.push(Span::raw(" "));
            x += 1;
        }
        // Lookahead is bounded to what can be shown below the caret line.
        if index > stream.index && lines.len() > caret.1 + height as usize {
            break;
        }
    }
    if caret.0 >= width {
        lines.push(Line::default());
        caret = (0, caret.1 + 1);
    }
    let start = caret.1.saturating_sub(1);
    let lines = lines
        .into_iter()
        .skip(start)
        .take(height.max(1) as usize)
        .collect();
    TextView {
        lines,
        caret: (caret.0 as u16, (caret.1 - start) as u16),
        errors,
    }
}
