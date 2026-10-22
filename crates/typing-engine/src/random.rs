use serde::{Deserialize, Serialize};

/// Stable Mulberry32 stream, matching the original generator fixtures. No host
/// RNG, hidden clock or library-selected algorithm participates in generation.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Random {
    Seeded { state: u32 },
    Stream { values: Vec<f64>, cursor: usize },
}
impl Random {
    pub fn seeded(seed: u32) -> Self {
        Self::Seeded { state: seed }
    }
    pub fn stream(values: Vec<f64>) -> Result<Self, String> {
        if values
            .iter()
            .any(|value| !value.is_finite() || !(0.0..1.0).contains(value))
        {
            return Err("Random stream values must be finite and in [0,1)".into());
        }
        Ok(Self::Stream { values, cursor: 0 })
    }
    pub fn draw(&mut self) -> Result<f64, String> {
        match self {
            Self::Seeded { state } => {
                *state = state.wrapping_add(0x6d2b79f5);
                let mut t = (*state ^ (*state >> 15)).wrapping_mul(1 | *state);
                t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
                Ok(f64::from(t ^ (t >> 14)) / 4294967296.0)
            }
            Self::Stream { values, cursor } => {
                let value = *values.get(*cursor).ok_or("Random stream exhausted")?;
                *cursor += 1;
                Ok(value)
            }
        }
    }
    pub fn index(&mut self, length: usize) -> Result<usize, String> {
        if length == 0 {
            return Err("Cannot choose from empty content".into());
        }
        Ok((self.draw()? * length as f64).floor() as usize)
    }
    pub fn zipf_index(&mut self, length: usize) -> Result<usize, String> {
        if length == 0 {
            return Err("Cannot choose from empty content".into());
        }
        let gamma = std::f64::consts::EULER_GAMMA;
        let harmonic = (length as f64 + 0.5).ln() + gamma;
        let index = ((self.draw()? * harmonic - gamma).exp() - 0.5).floor();
        if index < 0.0 || index >= length as f64 {
            return Err("Zipf draw outside wordset".into());
        }
        Ok(index as usize)
    }
    pub fn shuffle<T>(&mut self, values: &mut [T]) -> Result<(), String> {
        for index in (1..values.len()).rev() {
            let other = self.index(index + 1)?;
            values.swap(index, other);
        }
        Ok(())
    }
}
