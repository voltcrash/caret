/// Tracks timer render-drift and slow-timer detection within a session.
#[derive(Default)]
pub(super) struct DriftTracker {
    monitor_render_drift: bool,
    slow_timer: bool,
    slow_timer_count: u8,
    last_drift: Option<f64>,
}

impl DriftTracker {
    pub(super) fn set_monitoring(&mut self, enabled: bool) {
        self.monitor_render_drift = enabled;
    }

    pub(super) fn reset_run(&mut self) {
        self.slow_timer = false;
        self.slow_timer_count = 0;
    }

    pub(super) fn clear_last(&mut self) {
        self.last_drift = None;
    }

    pub(super) fn slow_timer(&self) -> bool {
        self.slow_timer
    }

    pub(super) fn last_drift(&self) -> Option<f64> {
        self.last_drift
    }

    /// Records an observed positive timer drift. Returns `true` when the session
    /// should fail due to excessive slow-timer drift.
    pub(super) fn record(&mut self, drift: f64, eligible: bool) -> bool {
        self.last_drift = Some(drift);
        if self.monitor_render_drift && eligible {
            if drift > 125.0 {
                self.slow_timer = true;
            }
            if drift > 250.0 {
                self.slow_timer_count = self.slow_timer_count.saturating_add(1);
            }
            return drift > 500.0 || self.slow_timer_count > 5;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::DriftTracker;

    #[test]
    fn records_last_drift_without_flagging_when_disabled_or_ineligible() {
        let mut tracker = DriftTracker::default();
        assert!(!tracker.record(600.0, true));
        assert_eq!(tracker.last_drift(), Some(600.0));
        assert!(!tracker.slow_timer());

        tracker.set_monitoring(true);
        assert!(!tracker.record(600.0, false));
        assert!(!tracker.slow_timer());
    }

    #[test]
    fn flags_slow_timer_above_125ms_and_fails_above_500ms() {
        let mut tracker = DriftTracker::default();
        tracker.set_monitoring(true);

        assert!(!tracker.record(125.0, true));
        assert!(!tracker.slow_timer());

        assert!(!tracker.record(126.0, true));
        assert!(tracker.slow_timer());

        assert!(tracker.record(501.0, true));
    }

    #[test]
    fn fails_after_more_than_five_ticks_above_250ms() {
        let mut tracker = DriftTracker::default();
        tracker.set_monitoring(true);

        for _ in 0..5 {
            assert!(!tracker.record(251.0, true));
            assert!(tracker.slow_timer());
        }
        assert!(tracker.record(251.0, true));
    }

    #[test]
    fn reset_run_and_clear_last_clear_only_their_fields() {
        let mut tracker = DriftTracker::default();
        tracker.set_monitoring(true);
        assert!(!tracker.record(260.0, true));
        assert!(tracker.slow_timer());
        assert_eq!(tracker.last_drift(), Some(260.0));

        tracker.clear_last();
        assert_eq!(tracker.last_drift(), None);
        assert!(tracker.slow_timer());

        tracker.reset_run();
        assert!(!tracker.slow_timer());
        // Monitoring setting persists across runs.
        assert!(tracker.record(501.0, true));
    }
}
