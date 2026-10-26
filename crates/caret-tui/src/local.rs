//! App-owned persistence state and recoverable write queue.
use crate::{
    Result,
    engine::EngineHost,
    history::History,
    input::Capabilities,
    setup::Setup,
    storage::{self, Settings, Store},
};
use serde_json::Value;

pub struct Local {
    pub store: Store,
    pub preferences: Settings,
    pub history: History,
    pub pending: Vec<Value>,
    pub latest_result: Option<Value>,
    pub replay: Option<crate::replay::Replay>,
    captured: bool,
}
impl Local {
    pub fn new(store: Store, preferences: Settings) -> Self {
        Self {
            store,
            preferences,
            history: History::default(),
            pending: vec![],
            latest_result: None,
            replay: None,
            captured: false,
        }
    }
    pub fn capture(
        &mut self,
        host: &EngineHost,
        capabilities: &Capabilities,
        date: f64,
    ) -> Result<bool> {
        if !host.state().ended || self.captured {
            return Ok(false);
        }
        let record = storage::record(host, capabilities, self.preferences.record_replay, date)?;
        self.captured = true;
        self.latest_result = Some(record.clone());
        self.pending.push(record);
        self.retry()?;
        Ok(true)
    }
    pub fn retry(&mut self) -> Result<()> {
        while let Some(record) = self.pending.first() {
            self.store.save(record)?;
            self.pending.remove(0);
        }
        Ok(())
    }
    pub fn restarted(&mut self) {
        self.captured = false;
        self.latest_result = None;
    }
    pub fn configure_setup(&self, setup: &mut Setup) {
        setup.theme = self.preferences.theme.clone();
        setup.reduced_animation = self.preferences.reduced_animation;
        setup.record_replay = self.preferences.record_replay;
    }
    pub fn apply(&mut self, setup: &Setup) -> Result<()> {
        let preferences = Settings {
            config: setup.config.clone(),
            theme: setup.theme.clone(),
            reduced_animation: setup.reduced_animation,
            record_replay: setup.record_replay,
            format_version: 1,
        };
        self.store.save_settings(&preferences)?;
        self.preferences = preferences;
        Ok(())
    }
}
