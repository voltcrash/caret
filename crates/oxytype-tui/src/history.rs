//! Historical summaries are displayed/exported as stored, never recalculated.
use crate::{Result, storage::Store};
use serde_json::Value;

const MODES: &[Option<&str>] = &[
    None,
    Some("time"),
    Some("words"),
    Some("quote"),
    Some("custom"),
    Some("zen"),
];
/// UTC `d Mon yyyy hh:mm` from Unix milliseconds (days-to-civil, Howard Hinnant).
pub fn date(ms: f64) -> String {
    let seconds = (ms / 1000.0).floor() as i64;
    let days = seconds.div_euclid(86_400);
    let time = seconds.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    format!(
        "{day} {} {year} {:02}:{:02}",
        MONTHS[(month - 1) as usize],
        time / 3600,
        time % 3600 / 60
    )
}
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
        self.details = false;
        self.scroll = 0;
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
    pub fn page_number(&self) -> usize {
        self.page + 1
    }
    /// Whether `row` holds its group's stored personal best.
    pub fn best(row: &Value, store: &Store) -> bool {
        row["formatVersion"] == 1
            && row["personalBestEligible"] == true
            && row["personalBestGroup"]
                .as_str()
                .and_then(|g| store.best(g).ok().flatten())
                == row["summary"]["wpm"].as_f64()
    }
    pub fn current(&self) -> Option<&Value> {
        self.rows.get(self.selected)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn dates_render_in_utc() {
        assert_eq!(super::date(0.0), "1 Jan 1970 00:00");
        assert_eq!(super::date(1_793_000_000_000.0), "26 Oct 2026 07:33");
        assert_eq!(super::date(951_782_400_000.0), "29 Feb 2000 00:00");
    }
}
