//! Domain models for the Universal Interactive In-Game Menu Engine.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrackingTarget {
    pub hash: String,
    pub has_draw_type_1: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ControlType {
    /// A multi-state cycle (e.g. 0, 1, 2, 3 or custom values)
    Cycle {
        variable: String,
        values: Vec<i64>,
        max_value: i64,
    },
    /// A binary toggle (0 or 1)
    Toggle {
        variable: String,
    },
    /// A continuous floating-point slider (e.g. morph, flat, scale)
    Slider {
        variable: String,
        min: f32,
        max: f32,
        step: f32,
    },
    /// A command list action without an explicit variable
    Action {
        command_list: String,
    },
}

impl ControlType {
    pub fn variable_name(&self) -> Option<&str> {
        match self {
            ControlType::Cycle { variable, .. } => Some(variable.as_str()),
            ControlType::Toggle { variable } => Some(variable.as_str()),
            ControlType::Slider { variable, .. } => Some(variable.as_str()),
            ControlType::Action { .. } => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct MenuControl {
    pub id: String,
    pub name: String,
    pub keys: Vec<String>,
    pub back_keys: Vec<String>,
    pub control_type: ControlType,
    pub icon_hint: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct MenuPage {
    pub page_index: usize,
    pub slots: Vec<MenuControl>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ModMenuDefinition {
    pub safe_id: String,
    pub mod_display_name: String,
    pub category_name: String,
    pub tracking_targets: Vec<TrackingTarget>,
    pub pages: Vec<MenuPage>,
    pub sliders: Vec<MenuControl>,
    pub base_condition: String,
    pub raw_txt_cheat_sheet: String,
}

impl ModMenuDefinition {
    #[allow(dead_code)]
    pub fn total_pages(&self) -> usize {
        self.pages.len()
    }

    #[allow(dead_code)]
    pub fn total_controls(&self) -> usize {
        self.pages.iter().map(|p| p.slots.len()).sum::<usize>() + self.sliders.len()
    }
}
