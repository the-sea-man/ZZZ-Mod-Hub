//! Bundles and installs GPU shaders and procedural UI textures for the In-Game Menu.

use image::{ImageFormat, Rgba, RgbaImage};
use std::fs;
use std::path::Path;

pub const DRAW_2D_HLSL: &str = r#"// **** ZzzModManager 2D GPU Quad Shader ****
Texture1D<float4> IniParams : register(t120);

#define SIZE IniParams[87].xy
#define OFFSET IniParams[87].zw

struct vs2ps {
	float4 pos : SV_Position0;
	float2 uv : TEXCOORD1;
};

#ifdef VERTEX_SHADER
void main(
		out vs2ps output,
		uint vertex : SV_VertexID)
{
	float2 BaseCoord,Offset;
	Offset.x = OFFSET.x*2-1;
	Offset.y = (1-OFFSET.y)*2-1;
	BaseCoord.xy = float2((2*SIZE.x),(2*(-SIZE.y)));
	switch(vertex) {
		case 0:
			output.pos.xy = float2(BaseCoord.x+Offset.x, BaseCoord.y+Offset.y);
			output.uv = float2(1,0);
			break;
		case 1:
			output.pos.xy = float2(BaseCoord.x+Offset.x, 0+Offset.y);
			output.uv = float2(1,1);
			break;
		case 2:
			output.pos.xy = float2(0+Offset.x, BaseCoord.y+Offset.y);
			output.uv = float2(0,0);
			break;
		case 3:
			output.pos.xy = float2(0+Offset.x, 0+Offset.y);
			output.uv = float2(0,1);
			break;
		default:
			output.pos.xy = 0;
			output.uv = float2(0,0);
			break;
	};
	output.pos.zw = float2(0, 1);
}
#endif

#ifdef PIXEL_SHADER
Texture2D<float4> tex : register(t100);

void main(vs2ps input, out float4 result : SV_Target0)
{
	uint width, height;
	tex.GetDimensions(width, height);
	if (!width || !height) discard;
	input.uv.y = 1 - input.uv.y;
	result = tex.Load(int3(input.uv.xy * float2(width, height), 0));
}
#endif
"#;

pub const DRAW_2D_DISABLED_HLSL: &str = r#"// **** ZzzModManager 2D Disabled Slot Shader (Dimmed 20% Alpha) ****
Texture1D<float4> IniParams : register(t120);

#define SIZE IniParams[87].xy
#define OFFSET IniParams[87].zw

struct vs2ps {
	float4 pos : SV_Position0;
	float2 uv : TEXCOORD1;
};

#ifdef VERTEX_SHADER
void main(
		out vs2ps output,
		uint vertex : SV_VertexID)
{
	float2 BaseCoord,Offset;
	Offset.x = OFFSET.x*2-1;
	Offset.y = (1-OFFSET.y)*2-1;
	BaseCoord.xy = float2((2*SIZE.x),(2*(-SIZE.y)));
	switch(vertex) {
		case 0:
			output.pos.xy = float2(BaseCoord.x+Offset.x, BaseCoord.y+Offset.y);
			output.uv = float2(1,0);
			break;
		case 1:
			output.pos.xy = float2(BaseCoord.x+Offset.x, 0+Offset.y);
			output.uv = float2(1,1);
			break;
		case 2:
			output.pos.xy = float2(0+Offset.x, BaseCoord.y+Offset.y);
			output.uv = float2(0,0);
			break;
		case 3:
			output.pos.xy = float2(0+Offset.x, 0+Offset.y);
			output.uv = float2(0,1);
			break;
		default:
			output.pos.xy = 0;
			output.uv = float2(0,0);
			break;
	};
	output.pos.zw = float2(0, 1);
}
#endif

#ifdef PIXEL_SHADER
Texture2D<float4> tex : register(t100);

void main(vs2ps input, out float4 result : SV_Target0)
{
	uint width, height;
	tex.GetDimensions(width, height);
	if (!width || !height) discard;
	input.uv.y = 1 - input.uv.y;
	float4 texColor = tex.Load(int3(input.uv.xy * float2(width, height), 0));
	texColor.a = texColor.a * 0.25;
	result = texColor;
}
#endif
"#;

// =========================================================================
// Procedural Graphic Generation
// =========================================================================

fn blend_pixel(img: &mut RgbaImage, x: i32, y: i32, color: [u8; 4]) {
    if x >= 0 && y >= 0 && (x as u32) < img.width() && (y as u32) < img.height() {
        let src_a = color[3] as f32 / 255.0;
        if src_a <= 0.0 { return; }
        let cur = img.get_pixel(x as u32, y as u32);
        let dst_a = cur[3] as f32 / 255.0;
        let out_a = src_a + dst_a * (1.0 - src_a);
        if out_a > 0.0 {
            let r = (color[0] as f32 * src_a + cur[0] as f32 * dst_a * (1.0 - src_a)) / out_a;
            let g = (color[1] as f32 * src_a + cur[1] as f32 * dst_a * (1.0 - src_a)) / out_a;
            let b = (color[2] as f32 * src_a + cur[2] as f32 * dst_a * (1.0 - src_a)) / out_a;
            img.put_pixel(x as u32, y as u32, Rgba([r as u8, g as u8, b as u8, (out_a * 255.0) as u8]));
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn draw_rect(img: &mut RgbaImage, x: i32, y: i32, w: i32, h: i32, fill: [u8; 4], border: [u8; 4], border_w: i32) {
    for py in y..y + h {
        for px in x..x + w {
            let is_border = px < x + border_w || px >= x + w - border_w || py < y + border_w || py >= y + h - border_w;
            if is_border && border[3] > 0 {
                blend_pixel(img, px, py, border);
            } else if fill[3] > 0 {
                blend_pixel(img, px, py, fill);
            }
        }
    }
}

fn draw_circle(img: &mut RgbaImage, cx: i32, cy: i32, radius: i32, fill: [u8; 4], border: [u8; 4], border_w: i32) {
    let r2 = radius * radius;
    let in_r = (radius - border_w).max(0);
    let in_r2 = in_r * in_r;

    for dy in -radius..=radius {
        for dx in -radius..=radius {
            let dist2 = dx * dx + dy * dy;
            if dist2 <= r2 {
                if dist2 > in_r2 && border[3] > 0 {
                    blend_pixel(img, cx + dx, cy + dy, border);
                } else if fill[3] > 0 {
                    blend_pixel(img, cx + dx, cy + dy, fill);
                }
            }
        }
    }
}

fn draw_triangle(img: &mut RgbaImage, p0: (i32, i32), p1: (i32, i32), p2: (i32, i32), color: [u8; 4]) {
    let min_x = p0.0.min(p1.0).min(p2.0).max(0);
    let max_x = p0.0.max(p1.0).max(p2.0).min(img.width() as i32 - 1);
    let min_y = p0.1.min(p1.1).min(p2.1).max(0);
    let max_y = p0.1.max(p1.1).max(p2.1).min(img.height() as i32 - 1);

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let d1 = (x - p1.0) * (p0.1 - p1.1) - (p0.0 - p1.0) * (y - p1.1);
            let d2 = (x - p2.0) * (p1.1 - p2.1) - (p1.0 - p2.0) * (y - p2.1);
            let d3 = (x - p0.0) * (p2.1 - p0.1) - (p2.0 - p0.0) * (y - p0.1);

            let has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
            let has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

            if !(has_neg && has_pos) {
                blend_pixel(img, x, y, color);
            }
        }
    }
}

// =========================================================================
// UI Textures
// =========================================================================

pub fn generate_menu_bg(w: u32, h: u32) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    // Outer subtle border
    draw_rect(&mut img, 0, 0, w as i32, h as i32, [14, 16, 22, 235], [55, 68, 92, 220], 2);
    // Header Bar (top 38px)
    draw_rect(&mut img, 2, 2, (w - 4) as i32, 34, [24, 28, 40, 245], [0, 0, 0, 0], 0);
    // Header divider line
    draw_rect(&mut img, 2, 36, (w - 4) as i32, 2, [0, 210, 255, 180], [0, 0, 0, 0], 0);
    // Header grip lines (3 dots in top center to indicate draggable window)
    let center_x = (w / 2) as i32;
    for i in -2..=2 {
        draw_circle(&mut img, center_x + i * 8, 18, 2, [140, 160, 190, 200], [0, 0, 0, 0], 0);
    }
    img
}

pub fn generate_slot_normal(size: u32) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    let s = size as i32;
    // Dark glassy slot frame
    draw_rect(&mut img, 0, 0, s, s, [22, 26, 36, 210], [48, 58, 78, 220], 2);
    // Subtle inner bevel
    draw_rect(&mut img, 2, 2, s - 4, s - 4, [0, 0, 0, 0], [32, 38, 52, 120], 1);
    img
}

pub fn generate_slot_hover(size: u32) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    let s = size as i32;
    // Glowing cyan highlight
    draw_rect(&mut img, 0, 0, s, s, [35, 45, 65, 235], [0, 220, 255, 255], 2);
    // Inner cyan glow line
    draw_rect(&mut img, 2, 2, s - 4, s - 4, [0, 0, 0, 0], [0, 220, 255, 100], 1);
    img
}

pub fn generate_button_prev(size: u32) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    let s = size as i32;
    draw_rect(&mut img, 0, 0, s, s, [28, 34, 48, 230], [55, 70, 95, 220], 1);
    // Left arrow triangle '<'
    draw_triangle(&mut img, (s / 3, s / 2), (2 * s / 3, s / 4), (2 * s / 3, 3 * s / 4), [0, 220, 255, 240]);
    img
}

pub fn generate_button_next(size: u32) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    let s = size as i32;
    draw_rect(&mut img, 0, 0, s, s, [28, 34, 48, 230], [55, 70, 95, 220], 1);
    // Right arrow triangle '>'
    draw_triangle(&mut img, (2 * s / 3, s / 2), (s / 3, s / 4), (s / 3, 3 * s / 4), [0, 220, 255, 240]);
    img
}

pub fn generate_slider_track(w: u32, h: u32) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    draw_rect(&mut img, 0, 0, w as i32, h as i32, [18, 22, 30, 240], [50, 60, 80, 200], 1);
    img
}

pub fn generate_slider_fill(w: u32, h: u32) -> RgbaImage {
    let mut img = RgbaImage::new(w, h);
    draw_rect(&mut img, 0, 0, w as i32, h as i32, [0, 210, 255, 240], [100, 240, 255, 255], 1);
    img
}

pub fn generate_slider_knob(size: u32) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    let radius = (size / 2) as i32;
    draw_circle(&mut img, radius, radius, radius - 1, [240, 250, 255, 255], [0, 210, 255, 255], 2);
    img
}

// =========================================================================
// Semantic Category Icons (64x64)
// =========================================================================

pub fn generate_icon(hint: &str, size: u32) -> RgbaImage {
    let mut img = RgbaImage::new(size, size);
    let s = size as i32;
    let white = [235, 240, 250, 230];
    let cyan = [0, 210, 255, 240];

    match hint.to_lowercase().as_str() {
        "outfit" | "dress" | "suit" => {
            // Torso / Jacket silhouette
            draw_triangle(&mut img, (s / 2, s / 5), (s / 5, 4 * s / 5), (4 * s / 5, 4 * s / 5), white);
            draw_rect(&mut img, s / 3, s / 4, s / 3, s / 2, cyan, [0, 0, 0, 0], 0);
        }
        "top" | "jacket" | "shirt" | "sweater" | "coat" => {
            draw_rect(&mut img, s / 4, s / 4, s / 2, s / 2, white, cyan, 2);
            draw_rect(&mut img, s / 6, s / 4, s / 8, s / 3, white, [0, 0, 0, 0], 0);
            draw_rect(&mut img, 5 * s / 6 - s / 8, s / 4, s / 8, s / 3, white, [0, 0, 0, 0], 0);
        }
        "bottom" | "skirt" | "pants" | "shorts" | "legs" => {
            draw_triangle(&mut img, (s / 2, s / 4), (s / 5, 3 * s / 4), (4 * s / 5, 3 * s / 4), cyan);
            draw_rect(&mut img, s / 3, s / 4, s / 3, s / 8, white, [0, 0, 0, 0], 0);
        }
        "hair" | "hairstyle" | "wig" => {
            draw_circle(&mut img, s / 2, 2 * s / 5, s / 4, white, cyan, 2);
            draw_triangle(&mut img, (s / 4, s / 2), (s / 5, 4 * s / 5), (2 * s / 5, 3 * s / 5), white);
            draw_triangle(&mut img, (3 * s / 4, s / 2), (4 * s / 5, 4 * s / 5), (3 * s / 5, 3 * s / 5), white);
        }
        "face" | "head" | "mask" | "eyes" | "blush" => {
            draw_circle(&mut img, s / 2, s / 2, s / 3, [0, 0, 0, 0], cyan, 3);
            draw_circle(&mut img, 3 * s / 8, 4 * s / 9, 3, white, [0, 0, 0, 0], 0);
            draw_circle(&mut img, 5 * s / 8, 4 * s / 9, 3, white, [0, 0, 0, 0], 0);
            draw_rect(&mut img, 3 * s / 8, 2 * s / 3, s / 4, 3, cyan, [0, 0, 0, 0], 0);
        }
        "glasses" | "eyewear" => {
            draw_rect(&mut img, s / 6, 3 * s / 8, s / 4, s / 4, [0, 0, 0, 0], cyan, 2);
            draw_rect(&mut img, 7 * s / 12, 3 * s / 8, s / 4, s / 4, [0, 0, 0, 0], cyan, 2);
            draw_rect(&mut img, 5 * s / 12, s / 2, s / 6, 2, white, [0, 0, 0, 0], 0);
        }
        "shoes" | "boots" | "heels" | "feet" => {
            draw_rect(&mut img, s / 4, s / 3, s / 4, s / 3, white, [0, 0, 0, 0], 0);
            draw_rect(&mut img, s / 4, 2 * s / 3, s / 2, s / 6, cyan, [0, 0, 0, 0], 0);
        }
        "weapon" | "sword" | "gun" | "fx" | "blade" => {
            // Diagonal blade
            for i in 0..s / 2 {
                draw_rect(&mut img, s / 4 + i, 3 * s / 4 - i, 4, 4, cyan, [0, 0, 0, 0], 0);
            }
            draw_circle(&mut img, s / 4, 3 * s / 4, 5, white, [0, 0, 0, 0], 0);
        }
        "slider" | "flat" | "scale" | "size" => {
            draw_rect(&mut img, s / 6, s / 2 - 2, 2 * s / 3, 4, white, [0, 0, 0, 0], 0);
            draw_circle(&mut img, s / 2, s / 2, 6, cyan, white, 2);
        }
        _ => {
            // Default toggle switch icon
            draw_rect(&mut img, s / 5, 3 * s / 8, 3 * s / 5, s / 4, [0, 0, 0, 0], cyan, 2);
            draw_circle(&mut img, 2 * s / 3, s / 2, s / 7, white, [0, 0, 0, 0], 0);
        }
    }
    img
}

/// Renders a crisp 20x20 slot badge showing a digit 1..8
pub fn generate_badge(digit: usize) -> RgbaImage {
    let mut img = RgbaImage::new(20, 20);
    draw_rect(&mut img, 0, 0, 20, 20, [15, 18, 25, 230], [0, 210, 255, 220], 1);

    // Simple 3x5 font pixel matrices for digits 1..8
    let font_3x5: [[u8; 15]; 8] = [
        [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1], // 1
        [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1], // 2
        [1,1,1, 0,0,1, 1,1,1, 0,0,1, 1,1,1], // 3
        [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1], // 4
        [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1], // 5
        [1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1], // 6
        [1,1,1, 0,0,1, 0,0,1, 0,1,0, 0,1,0], // 7
        [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1], // 8
    ];

    if (1..=8).contains(&digit) {
        let pattern = &font_3x5[digit - 1];
        for row in 0..5 {
            for col in 0..3 {
                if pattern[row * 3 + col] == 1 {
                    blend_pixel(&mut img, 7 + col as i32 * 2, 5 + row as i32 * 2, [255, 255, 255, 255]);
                    blend_pixel(&mut img, 8 + col as i32 * 2, 5 + row as i32 * 2, [255, 255, 255, 255]);
                }
            }
        }
    }

    img
}

// =========================================================================
// Assets Installer
// =========================================================================

pub fn ensure_ui_assets_installed(assets_dir: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(assets_dir)?;

    let hlsl_draw2d = assets_dir.join("draw_2d.hlsl");
    let hlsl_disabled = assets_dir.join("draw_2d_disabled.hlsl");

    if !hlsl_draw2d.exists() {
        fs::write(&hlsl_draw2d, DRAW_2D_HLSL)?;
    }
    if !hlsl_disabled.exists() {
        fs::write(&hlsl_disabled, DRAW_2D_DISABLED_HLSL)?;
    }

    // Generate and write textures
    let textures = [
        ("menu_bg.png", generate_menu_bg(340, 260)),
        ("slot.png", generate_slot_normal(64)),
        ("slot_hover.png", generate_slot_hover(64)),
        ("button_prev.png", generate_button_prev(32)),
        ("button_next.png", generate_button_next(32)),
        ("slider_track.png", generate_slider_track(240, 8)),
        ("slider_fill.png", generate_slider_fill(240, 8)),
        ("slider_knob.png", generate_slider_knob(20)),
        ("icon_outfit.png", generate_icon("outfit", 64)),
        ("icon_top.png", generate_icon("top", 64)),
        ("icon_bottom.png", generate_icon("bottom", 64)),
        ("icon_hair.png", generate_icon("hair", 64)),
        ("icon_face.png", generate_icon("face", 64)),
        ("icon_glasses.png", generate_icon("glasses", 64)),
        ("icon_shoes.png", generate_icon("shoes", 64)),
        ("icon_weapon.png", generate_icon("weapon", 64)),
        ("icon_slider.png", generate_icon("slider", 64)),
        ("icon_toggle.png", generate_icon("toggle", 64)),
    ];

    for (name, img) in textures {
        let path = assets_dir.join(name);
        if !path.exists() {
            let _ = img.save_with_format(&path, ImageFormat::Png);
        }
    }

    for digit in 1..=8 {
        let path = assets_dir.join(format!("badge_{}.png", digit));
        if !path.exists() {
            let badge = generate_badge(digit);
            let _ = badge.save_with_format(&path, ImageFormat::Png);
        }
    }

    Ok(())
}
