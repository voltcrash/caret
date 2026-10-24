//! Display coordinates are cells; engine/event positions remain UTF-16 units.
use ratatui::{
    style::{Color, Modifier, Style},
    text::{Line, Span},
};
use typing_engine::Text;
use unicode_segmentation::UnicodeSegmentation;
use unicode_width::UnicodeWidthStr;

pub struct TextView {
    pub lines: Vec<Line<'static>>,
    pub caret: (u16, u16),
    pub errors: bool,
}
pub fn clip_cells(value: &str, width: usize) -> String {
    let mut result = String::new();
    let mut used = 0;
    for grapheme in value.graphemes(true) {
        let cells = UnicodeWidthStr::width(grapheme);
        if used + cells > width {
            break;
        }
        result.push_str(grapheme);
        used += cells;
    }
    result
}
/// Expand controls visibly and wrap whole graphemes without splitting wide cells.
pub fn text_view(target: &Text, input: &Text, language: &str, width: u16, height: u16) -> TextView {
    let width = width.max(2) as usize;
    let mut lines = vec![Line::default()];
    let mut x = 0usize;
    let mut offset_utf16 = 0;
    let mut caret = None;
    let mut errors = false;
    let target_string = target.display_lossy();
    let input_string = input.display_lossy();
    let source = if target.is_empty() {
        &input_string
    } else {
        &target_string
    };
    for grapheme in source.graphemes(true) {
        let units = grapheme.encode_utf16().count();
        let mut shown = match grapheme {
            "\t" => "→   ".to_string(),
            "\n" => "↵".to_string(),
            _ => grapheme.to_string(),
        };
        if UnicodeWidthStr::width(shown.as_str()) == 0 {
            shown.insert(0, '◌');
        }
        let cells = UnicodeWidthStr::width(shown.as_str()).max(1).min(width);
        if x + cells > width {
            lines.push(Line::default());
            x = 0;
        }
        if caret.is_none() && offset_utf16 + units > input.len() {
            caret = Some((x, lines.len() - 1));
        }
        let typed_end = (offset_utf16 + units).min(input.len());
        let wrong = (offset_utf16..typed_end).any(|i| {
            target.0.get(i).is_some_and(|t| {
                typing_engine::text::normalize(input.0[i], Some(*t), language) != *t
            })
        });
        errors |= wrong;
        let style = if wrong {
            Style::new()
                .fg(Color::Red)
                .add_modifier(Modifier::UNDERLINED)
        } else if typed_end > offset_utf16 {
            Style::new().fg(Color::Green)
        } else {
            Style::default()
        };
        lines
            .last_mut()
            .unwrap()
            .spans
            .push(Span::styled(shown, style));
        x += cells;
        offset_utf16 += units;
        if grapheme == "\n" {
            lines.push(Line::default());
            x = 0;
        }
    }
    // Extra input is visible and marked; it never changes the target or score.
    if !target.is_empty() && input.len() > target.len() {
        errors = true;
        let mut utf16 = 0;
        for grapheme in input_string.graphemes(true) {
            utf16 += grapheme.encode_utf16().count();
            if utf16 <= target.len() {
                continue;
            }
            let cells = UnicodeWidthStr::width(grapheme).max(1).min(width);
            if x + cells > width {
                lines.push(Line::default());
                x = 0;
            }
            lines.last_mut().unwrap().spans.push(Span::styled(
                grapheme.to_string(),
                Style::new()
                    .fg(Color::Red)
                    .add_modifier(Modifier::UNDERLINED),
            ));
            x += cells;
        }
    }
    let (mut cx, mut cy) = caret.unwrap_or((x, lines.len() - 1));
    if cx >= width {
        lines.push(Line::default());
        cx = 0;
        cy += 1;
    }
    let start = cy.saturating_sub(height.max(1) as usize - 1);
    let lines = lines
        .into_iter()
        .skip(start)
        .take(height as usize)
        .collect();
    TextView {
        lines,
        caret: (cx as u16, (cy - start) as u16),
        errors,
    }
}
