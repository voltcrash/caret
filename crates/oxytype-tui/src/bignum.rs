//! Three-row block numerals for the result screen's large wpm/acc.

fn glyph(c: char) -> Option<[&'static str; 3]> {
    Some(match c {
        '0' => ["█▀█", "█ █", "▀▀▀"],
        '1' => ["▀█ ", " █ ", "▀▀▀"],
        '2' => ["▀▀█", "█▀▀", "▀▀▀"],
        '3' => ["▀▀█", " ▀█", "▀▀▀"],
        '4' => ["█ █", "▀▀█", "  ▀"],
        '5' => ["█▀▀", "▀▀█", "▀▀▀"],
        '6' => ["█▀▀", "█▀█", "▀▀▀"],
        '7' => ["▀▀█", "  █", "  ▀"],
        '8' => ["█▀█", "█▀█", "▀▀▀"],
        '9' => ["█▀█", "▀▀█", "▀▀▀"],
        '%' => ["▀ █", " █ ", "█ ▄"],
        '.' => [" ", " ", "▀"],
        '-' => ["   ", "▀▀▀", "   "],
        _ => return None,
    })
}
/// Rows for `text`, or `None` when it holds a character without a glyph.
pub fn rows(text: &str) -> Option<[String; 3]> {
    let mut rows = [String::new(), String::new(), String::new()];
    for (index, c) in text.chars().enumerate() {
        let glyph = glyph(c)?;
        for (row, part) in rows.iter_mut().zip(glyph) {
            if index > 0 {
                row.push(' ');
            }
            row.push_str(part);
        }
    }
    Some(rows)
}
pub fn width(text: &str) -> usize {
    rows(text).map_or(text.chars().count(), |rows| rows[0].chars().count())
}

#[cfg(test)]
mod tests {
    #[test]
    fn rows_join_glyphs_with_one_column_gap() {
        let rows = super::rows("10").unwrap();
        assert_eq!(rows[0], "▀█  █▀█");
        assert_eq!(rows[2], "▀▀▀ ▀▀▀");
        assert_eq!(super::width("96%"), 11);
        assert!(super::rows("x").is_none());
    }
}
