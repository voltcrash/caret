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
