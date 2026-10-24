//! Historical summaries are displayed/exported as stored, never recalculated.
use crate::{Result, storage::Store};
use ratatui::text::Line;
use serde_json::Value;

const MODES: &[Option<&str>] = &[
    None,
    Some("time"),
    Some("words"),
    Some("quote"),
    Some("custom"),
    Some("zen"),
];
#[derive(Default)]
pub struct History {
    pub rows: Vec<Value>,
    pub selected: usize,
    pub details: bool,
    pub scroll: usize,
    filter: usize,
    page: usize,
}
impl History {
    pub fn mode(&self) -> Option<&'static str> {
        MODES[self.filter]
    }
    pub fn refresh(&mut self, store: &Store) -> Result<()> {
        self.rows = store.history_page(self.mode(), 100, self.page * 100)?;
        self.selected = self.selected.min(self.rows.len().saturating_sub(1));
        Ok(())
    }
    pub fn filter(&mut self, store: &Store) -> Result<()> {
        self.filter = (self.filter + 1) % MODES.len();
        self.page = 0;
        self.selected = 0;
        self.details = false;
        self.refresh(store)
    }
    pub fn page(&mut self, direction: i32, store: &Store) -> Result<()> {
        let page = self.page;
        self.page = (self.page as i64 + i64::from(direction)).max(0) as usize;
        self.refresh(store)?;
        if self.rows.is_empty() && self.page > 0 {
            self.page = page;
            self.refresh(store)?;
        }
        self.selected = 0;
        Ok(())
    }
    pub fn select(&mut self, direction: i32) {
        if self.details {
            self.scroll = (self.scroll as i64 + i64::from(direction)).max(0) as usize;
        } else {
            self.selected = (self.selected as i64 + i64::from(direction))
                .clamp(0, self.rows.len().saturating_sub(1) as i64)
                as usize;
        }
    }
    pub fn current(&self) -> Option<&Value> {
        self.rows.get(self.selected)
    }
    pub fn lines(&self, store: &Store, height: usize) -> Vec<Line<'static>> {
        let mut lines = vec![
            Line::from(format!(
                "Local history · {} · page {}",
                self.mode().unwrap_or("all modes"),
                self.page + 1
            )),
            Line::from(
                "↑↓ select/scroll · Enter details · m filter · PgUp/PgDn · F7 export · F8 replay",
            ),
        ];
        if self.details {
            if let Some(row) = self.current() {
                let details = serde_json::to_string_pretty(row).unwrap_or_default();
                lines.extend(
                    details
                        .lines()
                        .skip(self.scroll)
                        .take(height.saturating_sub(2))
                        .map(|s| Line::from(s.to_string())),
                );
            }
        } else {
            let visible = height.saturating_sub(2).max(1);
            let skip = self.selected.saturating_sub(visible - 1);
            for (index, row) in self.rows.iter().enumerate().skip(skip).take(visible) {
                let summary = &row["summary"];
                let best = row["formatVersion"] == 1
                    && row["personalBestEligible"] == true
                    && row["personalBestGroup"]
                        .as_str()
                        .and_then(|g| store.best(g).ok().flatten())
                        == summary["wpm"].as_f64();
                lines.push(Line::from(format!(
                    "{} {} {} · {} WPM / {}% · {}{}",
                    if index == self.selected { ">" } else { " " },
                    row["createdMs"],
                    row["config"]["mode"].as_str().unwrap_or("unknown"),
                    summary["wpm"],
                    summary["acc"],
                    row["invalidReason"].as_str().unwrap_or("valid"),
                    if best { " · PB" } else { "" }
                )));
            }
            if self.rows.is_empty() {
                lines.push(Line::from("No saved results for this filter."));
            }
        }
        lines
    }
}
