//! Compiles 3DMigoto INI code for GPU-accelerated interactive in-game menus.

use crate::ui_generator::model::{ControlType, ModMenuDefinition};

pub fn build_interactive_menu_ini(def: &ModMenuDefinition, hud_key: &str) -> String {
    let safe_id = &def.safe_id;
    let mut ini = String::new();

    // 1. Namespace Isolation
    ini.push_str(&format!("namespace = ZzzManagerUI_{}\n\n", safe_id));

    // 2. Constants
    ini.push_str("[Constants]\n");
    ini.push_str(&format!("global $active_ZzzManagerUI_{} = 0\n", safe_id));
    ini.push_str(&format!("global persist $menu_ZzzManagerUI_{} = 0\n", safe_id));
    ini.push_str(&format!("global persist $page_ZzzManagerUI_{} = 0\n", safe_id));
    ini.push_str(&format!("global $first_run_ZzzManagerUI_{} = 1\n", safe_id));
    ini.push_str("global $ww = 0\n");
    ini.push_str("global $wh = 0\n");
    ini.push_str("global $cpx = 0\n");
    ini.push_str("global $cpy = 0\n");
    ini.push_str("global $mx = 0\n");
    ini.push_str("global $my = 0\n");
    ini.push_str("global $hold = 0\n");
    ini.push_str("global $drag = 0\n");
    ini.push_str("global $cox = 0\n");
    ini.push_str("global $coy = 0\n");
    ini.push_str("global $hovering = 0\n");
    ini.push_str("global $hoveredSlot = 0\n");
    ini.push_str("global $clickedSlot = 0\n");
    ini.push_str("global $hoveredPageBtn = 0\n\n");

    // 3. Texture Override Trackers
    for (i, target) in def.tracking_targets.iter().enumerate() {
        ini.push_str(&format!("[TextureOverride_ZzzManagerUI_Tracker_{}_{}]\n", safe_id, i));
        ini.push_str(&format!("hash = {}\n", target.hash));
        if target.has_draw_type_1 {
            ini.push_str("if DRAW_TYPE == 1\n");
            ini.push_str(&format!("    $active_ZzzManagerUI_{} = 1\n", safe_id));
            ini.push_str("endif\n\n");
        } else {
            ini.push_str(&format!("$active_ZzzManagerUI_{} = 1\n\n", safe_id));
        }
    }

    // 4. Present Loop
    ini.push_str("[Present]\n");
    ini.push_str(&format!("if $active_ZzzManagerUI_{} == 1\n", safe_id));
    ini.push_str(&format!("    if $first_run_ZzzManagerUI_{} == 1\n", safe_id));
    ini.push_str("        $mx = 50 / 1920.0\n");
    ini.push_str("        $my = 160 / 1080.0\n");
    ini.push_str(&format!("        $first_run_ZzzManagerUI_{} = 0\n", safe_id));
    ini.push_str("    endif\n");
    ini.push_str(&format!("    if $menu_ZzzManagerUI_{} == 1\n", safe_id));
    ini.push_str(&format!("        run = CommandListDimensions_ZzzManagerUI_{}\n", safe_id));
    ini.push_str(&format!("        run = CommandListMenu_ZzzManagerUI_{}\n", safe_id));
    ini.push_str("    endif\n");
    ini.push_str("else\n");
    ini.push_str(&format!("    $menu_ZzzManagerUI_{} = 0\n", safe_id));
    ini.push_str("endif\n");
    ini.push_str(&format!("post $active_ZzzManagerUI_{} = 0\n\n", safe_id));

    // 5. Keybinds (Toggle Menu, Drag, Click Slot, Click Page, Reset Pos)
    let condition_base = if !def.tracking_targets.is_empty() {
        format!("$active_ZzzManagerUI_{} == 1", safe_id)
    } else if !def.base_condition.is_empty() {
        def.base_condition.clone()
    } else {
        "1 == 1".to_string()
    };

    // Toggle Menu Key
    ini.push_str(&format!("[KeyToggleMenu_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("condition = {}\n", condition_base));
    ini.push_str(&format!("key = {}\n", hud_key));
    ini.push_str("type = cycle\n");
    ini.push_str(&format!("$menu_ZzzManagerUI_{} = 0,1\n\n", safe_id));

    // Drag Hold Key
    ini.push_str(&format!("[KeyHold_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("condition = $active_ZzzManagerUI_{} == 1 && $menu_ZzzManagerUI_{} == 1 && $hovering == 0\n", safe_id, safe_id));
    ini.push_str("key = no_ctrl no_shift VK_LBUTTON\n");
    ini.push_str("type = hold\n");
    ini.push_str("$hold = 1\n\n");

    // Click Slot Key
    ini.push_str(&format!("[KeyClickSlot_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("condition = $active_ZzzManagerUI_{} == 1 && $menu_ZzzManagerUI_{} == 1 && $hovering == 1\n", safe_id, safe_id));
    ini.push_str("key = no_ctrl no_shift VK_LBUTTON\n");
    ini.push_str(&format!("run = CommandListClickedSlot_ZzzManagerUI_{}\n\n", safe_id));

    // Click Pagination Key
    if def.total_pages() > 1 {
        ini.push_str(&format!("[KeyClickPage_ZzzManagerUI_{}]\n", safe_id));
        ini.push_str(&format!("condition = $active_ZzzManagerUI_{} == 1 && $menu_ZzzManagerUI_{} == 1 && $hovering == 3\n", safe_id, safe_id));
        ini.push_str("key = no_ctrl no_shift VK_LBUTTON\n");
        ini.push_str(&format!("run = CommandListClickedPage_ZzzManagerUI_{}\n\n", safe_id));
    }

    // Reset Position Key (Shift + Right Arrow)
    ini.push_str(&format!("[KeyResetPos_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("condition = $active_ZzzManagerUI_{} == 1 && $menu_ZzzManagerUI_{} == 1\n", safe_id, safe_id));
    ini.push_str("key = no_ctrl shift VK_RIGHT\n");
    ini.push_str(&format!("run = CommandListResetPos_ZzzManagerUI_{}\n\n", safe_id));

    // 6. CommandLists: Dimensions
    ini.push_str(&format!("[CommandListDimensions_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str("if window_width != 0\n    $ww = window_width\n    $wh = window_height\n");
    ini.push_str("elif rt_width != 0\n    $ww = rt_width\n    $wh = rt_height\n");
    ini.push_str("else\n    $ww = res_width\n    $wh = res_height\nendif\n\n");
    ini.push_str("if cursor_x != 0 && cursor_y != 0\n    $cpx = cursor_x\n    $cpy = cursor_y\n");
    ini.push_str("elif cursor_window_x != 0 && cursor_window_y != 0\n    $cpx = cursor_window_x / $ww\n    $cpy = cursor_window_y / $wh\n");
    ini.push_str("else\n    $cpx = cursor_screen_x / $ww\n    $cpy = cursor_screen_y / $wh\nendif\n\n");

    // 7. CommandLists: Menu & Background
    let total_pages = def.total_pages();
    let has_pagination = total_pages > 1;
    let menu_height = if has_pagination { 260 } else { 220 };

    ini.push_str(&format!("[CommandListMenu_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("run = CommandListBackground_ZzzManagerUI_{}\n", safe_id));
    ini.push_str(&format!("run = CommandListDrawPages_ZzzManagerUI_{}\n\n", safe_id));

    ini.push_str(&format!("[CommandListBackground_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("ps-t100 = ResourceMenuBG_ZzzManagerUI_{}\n", safe_id));
    ini.push_str("x87 = 340 / $ww\n");
    ini.push_str(&format!("y87 = {} / $wh\n", menu_height));
    ini.push_str("if $hovering == 0\n");
    ini.push_str("    if $drag == 0\n");
    ini.push_str("        if $cpx > $mx && $cpx < ($mx + x87) && $cpy > $my && $cpy < ($my + 38 / $wh)\n");
    ini.push_str("            if $hold\n");
    ini.push_str("                $cox = $cpx - $mx\n");
    ini.push_str("                $coy = $cpy - $my\n");
    ini.push_str("                $drag = 1\n");
    ini.push_str("            endif\n");
    ini.push_str("        endif\n");
    ini.push_str("    else\n");
    ini.push_str("        if $hold\n");
    ini.push_str("            $mx = $cpx - $cox\n");
    ini.push_str("            $my = $cpy - $coy\n");
    ini.push_str("        else\n");
    ini.push_str("            $drag = 0\n");
    ini.push_str("        endif\n");
    ini.push_str("    endif\n");
    ini.push_str("endif\n");
    ini.push_str("z87 = $mx\n");
    ini.push_str("w87 = $my\n");
    ini.push_str("run = CustomShaderElement\n\n");

    // 8. CommandLists: Draw Pages
    ini.push_str(&format!("[CommandListDrawPages_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str("$hovering = 0\n");

    for (page_idx, _page) in def.pages.iter().enumerate() {
        if page_idx == 0 {
            ini.push_str(&format!("if $page_ZzzManagerUI_{} == {}\n", safe_id, page_idx));
        } else {
            ini.push_str(&format!("elif $page_ZzzManagerUI_{} == {}\n", safe_id, page_idx));
        }
        ini.push_str(&format!("    run = CommandListDrawPage_{}_ZzzManagerUI_{}\n", page_idx, safe_id));
    }
    if !def.pages.is_empty() {
        ini.push_str("endif\n");
    }
    if has_pagination {
        ini.push_str(&format!("run = CommandListPagination_ZzzManagerUI_{}\n", safe_id));
    }
    ini.push('\n');

    // Slot positions (2 rows x 4 cols)
    let slot_coords = [
        (16, 48),  // Slot 1 (r0, c0)
        (94, 48),  // Slot 2 (r0, c1)
        (172, 48), // Slot 3 (r0, c2)
        (250, 48), // Slot 4 (r0, c3)
        (16, 126),  // Slot 5 (r1, c0)
        (94, 126),  // Slot 6 (r1, c1)
        (172, 126), // Slot 7 (r1, c2)
        (250, 126), // Slot 8 (r1, c3)
    ];

    let mut global_slot_id = 0;
    for (page_idx, page) in def.pages.iter().enumerate() {
        ini.push_str(&format!("[CommandListDrawPage_{}_ZzzManagerUI_{}]\n", page_idx, safe_id));
        for (i, control) in page.slots.iter().enumerate() {
            global_slot_id += 1;
            let (px, py) = slot_coords.get(i).copied().unwrap_or((16, 48));

            ini.push_str(&format!("; --- Slot {}: {} ---\n", global_slot_id, control.name));
            ini.push_str(&format!("z87 = $mx + {} / $ww\n", px));
            ini.push_str(&format!("w87 = $my + {} / $wh\n", py));
            ini.push_str("x87 = 64 / $ww\n");
            ini.push_str("y87 = 64 / $wh\n");
            ini.push_str("if $cpx > z87 && $cpx < (z87 + x87) && $cpy > w87 && $cpy < (w87 + y87)\n");
            ini.push_str("    $hovering = 1\n");
            ini.push_str(&format!("    $hoveredSlot = {}\n", global_slot_id));
            ini.push_str(&format!("    ps-t100 = ResourceSlotHover_ZzzManagerUI_{}\n", safe_id));
            ini.push_str("else\n");
            ini.push_str(&format!("    ps-t100 = ResourceSlot_ZzzManagerUI_{}\n", safe_id));
            ini.push_str("endif\n");
            ini.push_str("run = CustomShaderElement\n");

            // Draw Icon
            ini.push_str(&format!("ps-t100 = ResourceIcon_{}_ZzzManagerUI_{}\n", control.icon_hint, safe_id));
            if let Some(var_name) = control.control_type.variable_name() {
                ini.push_str(&format!("if {} > 0\n", var_name));
                ini.push_str("    run = CustomShaderElement\n");
                ini.push_str("else\n");
                ini.push_str("    run = CustomShaderDisabledElement\n");
                ini.push_str("endif\n");
            } else {
                ini.push_str("run = CustomShaderElement\n");
            }

            // Draw Slot Digit Badge (1..8)
            let badge_num = (i % 8) + 1;
            ini.push_str(&format!("ps-t100 = ResourceBadge_{}_ZzzManagerUI_{}\n", badge_num, safe_id));
            ini.push_str(&format!("z87 = $mx + {} / $ww\n", px + 42));
            ini.push_str(&format!("w87 = $my + {} / $wh\n", py + 42));
            ini.push_str("x87 = 18 / $ww\n");
            ini.push_str("y87 = 18 / $wh\n");
            ini.push_str("run = CustomShaderElement\n\n");
        }
    }

    // 9. Pagination Buttons (if needed)
    if has_pagination {
        ini.push_str(&format!("[CommandListPagination_ZzzManagerUI_{}]\n", safe_id));
        // Prev Button
        ini.push_str("z87 = $mx + 110 / $ww\n");
        ini.push_str("w87 = $my + 208 / $wh\n");
        ini.push_str("x87 = 32 / $ww\n");
        ini.push_str("y87 = 32 / $wh\n");
        ini.push_str("if $cpx > z87 && $cpx < (z87 + x87) && $cpy > w87 && $cpy < (w87 + y87)\n");
        ini.push_str("    $hovering = 3\n");
        ini.push_str("    $hoveredPageBtn = 1\n");
        ini.push_str("endif\n");
        ini.push_str(&format!("ps-t100 = ResourceBtnPrev_ZzzManagerUI_{}\n", safe_id));
        ini.push_str("run = CustomShaderElement\n\n");

        // Next Button
        ini.push_str("z87 = $mx + 198 / $ww\n");
        ini.push_str("w87 = $my + 208 / $wh\n");
        ini.push_str("x87 = 32 / $ww\n");
        ini.push_str("y87 = 32 / $wh\n");
        ini.push_str("if $cpx > z87 && $cpx < (z87 + x87) && $cpy > w87 && $cpy < (w87 + y87)\n");
        ini.push_str("    $hovering = 3\n");
        ini.push_str("    $hoveredPageBtn = 2\n");
        ini.push_str("endif\n");
        ini.push_str(&format!("ps-t100 = ResourceBtnNext_ZzzManagerUI_{}\n", safe_id));
        ini.push_str("run = CustomShaderElement\n\n");

        // Click Page CommandList
        ini.push_str(&format!("[CommandListClickedPage_ZzzManagerUI_{}]\n", safe_id));
        ini.push_str("if $hoveredPageBtn == 1\n");
        ini.push_str(&format!("    $page_ZzzManagerUI_{} = ($page_ZzzManagerUI_{} - 1 + {}) % {}\n", safe_id, safe_id, total_pages, total_pages));
        ini.push_str("elif $hoveredPageBtn == 2\n");
        ini.push_str(&format!("    $page_ZzzManagerUI_{} = ($page_ZzzManagerUI_{} + 1) % {}\n", safe_id, safe_id, total_pages));
        ini.push_str("endif\n\n");
    }

    // 10. Click Slot Action Dispatch
    ini.push_str(&format!("[CommandListClickedSlot_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str("$clickedSlot = $hoveredSlot\n");

    let mut click_slot_id = 0;
    for page in &def.pages {
        for control in &page.slots {
            click_slot_id += 1;
            let if_stmt = if click_slot_id == 1 { "if" } else { "elif" };
            ini.push_str(&format!("{} $clickedSlot == {}\n", if_stmt, click_slot_id));

            match &control.control_type {
                ControlType::Cycle { variable, max_value, .. } => {
                    ini.push_str(&format!("    {} = {} + 1\n", variable, variable));
                    ini.push_str(&format!("    if {} > {}\n", variable, max_value));
                    ini.push_str(&format!("        {} = 0\n", variable));
                    ini.push_str("    endif\n");
                }
                ControlType::Toggle { variable } => {
                    ini.push_str(&format!("    {} = 1 - {}\n", variable, variable));
                }
                ControlType::Action { command_list } => {
                    ini.push_str(&format!("    run = {}\n", command_list));
                }
                ControlType::Slider { .. } => {}
            }
        }
    }
    if click_slot_id > 0 {
        ini.push_str("endif\n\n");
    }

    // 11. Reset Position
    ini.push_str(&format!("[CommandListResetPos_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str("$mx = 50 / $ww\n");
    ini.push_str("$my = 160 / $wh\n\n");

    // 12. Shaders
    ini.push_str("[CustomShaderElement]\n");
    ini.push_str("vs = assets\\draw_2d.hlsl\n");
    ini.push_str("ps = assets\\draw_2d.hlsl\n");
    ini.push_str("run = BuiltInCommandListUnbindAllRenderTargets\n");
    ini.push_str("blend = ADD SRC_ALPHA INV_SRC_ALPHA\n");
    ini.push_str("cull = none\n");
    ini.push_str("topology = triangle_strip\n");
    ini.push_str("o0 = set_viewport bb\n");
    ini.push_str("Draw = 4,0\n\n");

    ini.push_str("[CustomShaderDisabledElement]\n");
    ini.push_str("vs = assets\\draw_2d_disabled.hlsl\n");
    ini.push_str("ps = assets\\draw_2d_disabled.hlsl\n");
    ini.push_str("run = BuiltInCommandListUnbindAllRenderTargets\n");
    ini.push_str("blend = ADD SRC_ALPHA INV_SRC_ALPHA\n");
    ini.push_str("cull = none\n");
    ini.push_str("topology = triangle_strip\n");
    ini.push_str("o0 = set_viewport bb\n");
    ini.push_str("Draw = 4,0\n\n");

    // 13. Resources
    ini.push_str(&format!("[ResourceMenuBG_ZzzManagerUI_{}]\nfilename = assets\\menu_bg.png\n\n", safe_id));
    ini.push_str(&format!("[ResourceSlot_ZzzManagerUI_{}]\nfilename = assets\\slot.png\n\n", safe_id));
    ini.push_str(&format!("[ResourceSlotHover_ZzzManagerUI_{}]\nfilename = assets\\slot_hover.png\n\n", safe_id));
    if has_pagination {
        ini.push_str(&format!("[ResourceBtnPrev_ZzzManagerUI_{}]\nfilename = assets\\button_prev.png\n\n", safe_id));
        ini.push_str(&format!("[ResourceBtnNext_ZzzManagerUI_{}]\nfilename = assets\\button_next.png\n\n", safe_id));
    }

    // Collect all unique icon hints needed
    let mut unique_icons = std::collections::HashSet::new();
    for page in &def.pages {
        for control in &page.slots {
            unique_icons.insert(control.icon_hint.clone());
        }
    }
    for icon in unique_icons {
        ini.push_str(&format!("[ResourceIcon_{}_ZzzManagerUI_{}]\nfilename = assets\\icon_{}.png\n\n", icon, safe_id, icon));
    }

    for digit in 1..=8 {
        ini.push_str(&format!("[ResourceBadge_{}_ZzzManagerUI_{}]\nfilename = assets\\badge_{}.png\n\n", digit, safe_id, digit));
    }

    ini
}

pub fn build_classic_text_ini(def: &ModMenuDefinition, hud_key: &str) -> String {
    let safe_id = &def.safe_id;
    let mut ini = String::new();

    ini.push_str(&format!("namespace = ZzzManagerUI_{}\n\n", safe_id));

    if !def.tracking_targets.is_empty() {
        ini.push_str("[Constants]\n");
        ini.push_str(&format!("global $active_ZzzManagerUI_{} = 0\n", safe_id));
        ini.push_str(&format!("global persist $menu_ZzzManagerUI_{} = 0\n", safe_id));
        ini.push_str(&format!("global persist $prev_menu_ZzzManagerUI_{} = 0\n\n", safe_id));
    }

    for (i, target) in def.tracking_targets.iter().enumerate() {
        ini.push_str(&format!("[TextureOverride_ZzzManagerUI_Tracker_{}_{}]\n", safe_id, i));
        ini.push_str(&format!("hash = {}\n", target.hash));
        if target.has_draw_type_1 {
            ini.push_str("if DRAW_TYPE == 1\n");
            ini.push_str(&format!("    $active_ZzzManagerUI_{} = 1\n", safe_id));
            ini.push_str("endif\n\n");
        } else {
            ini.push_str(&format!("$active_ZzzManagerUI_{} = 1\n\n", safe_id));
        }
    }

    let mut final_base_condition = String::from("1 == 1");
    if !def.tracking_targets.is_empty() {
        ini.push_str("[Present]\n");
        ini.push_str(&format!("if $active_ZzzManagerUI_{} == 1\n", safe_id));
        ini.push_str(&format!("    if $menu_ZzzManagerUI_{} == 1\n", safe_id));
        ini.push_str(&format!("        run = CommandListHelp_ZzzManagerUI_{}\n", safe_id));
        ini.push_str("    else\n");
        ini.push_str(&format!("        if $prev_menu_ZzzManagerUI_{} == 1\n", safe_id));
        ini.push_str("            Resource\\ShaderFixes\\help.ini\\Help = null\n");
        ini.push_str("        endif\n");
        ini.push_str("    endif\n");
        ini.push_str("else\n");
        ini.push_str(&format!("    if $prev_menu_ZzzManagerUI_{} == 1\n", safe_id));
        ini.push_str("        Resource\\ShaderFixes\\help.ini\\Help = null\n");
        ini.push_str("    endif\n");
        ini.push_str(&format!("    $menu_ZzzManagerUI_{} = 0\n", safe_id));
        ini.push_str("endif\n");
        ini.push_str(&format!("$prev_menu_ZzzManagerUI_{} = $menu_ZzzManagerUI_{}\n", safe_id, safe_id));
        ini.push_str(&format!("post $active_ZzzManagerUI_{} = 0\n\n", safe_id));
        final_base_condition = format!("$active_ZzzManagerUI_{} == 1", safe_id);
    } else if !def.base_condition.is_empty() {
        final_base_condition = def.base_condition.clone();
    }

    ini.push_str(&format!("[KeyHelp_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("condition = {}\n", final_base_condition));
    ini.push_str(&format!("key = {}\n", hud_key));

    if !def.tracking_targets.is_empty() {
        ini.push_str("type = cycle\n");
        ini.push_str(&format!("$menu_ZzzManagerUI_{} = 0,1\n\n", safe_id));
    } else {
        ini.push_str("type = toggle\n");
        ini.push_str(&format!("run = CommandListHelp_ZzzManagerUI_{}\n\n", safe_id));
    }

    ini.push_str(&format!("[CommandListHelp_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str(&format!("pre Resource\\ShaderFixes\\help.ini\\Help = ref ResourceNotesFull_ZzzManagerUI_{}\n", safe_id));
    ini.push_str(&format!("pre Resource\\ShaderFixes\\help.ini\\Params = ref ResourceParamsFull_ZzzManagerUI_{}\n", safe_id));
    ini.push_str("pre run = CustomShader\\ShaderFixes\\help.ini\\FormatText\n");
    ini.push_str("pre Resource\\ShaderFixes\\help.ini\\HelpShort = null\n\n");

    ini.push_str(&format!("[ResourceNotesFull_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str("type = buffer\nformat = R8_UINT\n");
    ini.push_str(&format!("filename = zzzmanager_ui_{}.txt\n\n", safe_id));

    ini.push_str(&format!("[ResourceParamsFull_ZzzManagerUI_{}]\n", safe_id));
    ini.push_str("type = StructuredBuffer\narray = 1\n");
    ini.push_str("data = R32_FLOAT -0.95 -0.50 -0.50 0.50 1.0 1.0 1.0 1.0 0.0 0.0 0.0 0.8 0.015 0.04 1 2 0 1.0\n");

    ini
}
