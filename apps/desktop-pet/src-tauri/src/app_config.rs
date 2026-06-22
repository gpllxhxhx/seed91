use crate::app_logger::{append_log_entry, config_file_path};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{LazyLock, Mutex},
};
use tauri::{
    window::Monitor, AppHandle, PhysicalPosition, PhysicalSize, Position, Runtime, WebviewWindow,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSong {
    pub song_id: String,
    pub song_name: String,
    pub artist: String,
    pub cover: String,
    pub progress: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPlaylistTrack {
    pub id: u64,
    pub name: String,
    pub artists: String,
    pub album: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedPlaylist {
    pub id: String,
    pub name: String,
    pub cover: String,
    pub track_count: usize,
    pub tracks: Vec<SavedPlaylistTrack>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowConfig {
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub always_on_top: bool,
    pub opacity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerConfig {
    pub volume: f64,
    pub muted: bool,
    pub last_song: Option<PersistedSong>,
    pub playlist_id: Option<String>,
    pub playlist_name: Option<String>,
    pub current_playlist_id: Option<String>,
    pub saved_playlists: Vec<SavedPlaylist>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetConfig {
    pub selected_skin: String,
    pub pet_size: f64,
    pub show_floating_controls: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserConfig {
    pub window: WindowConfig,
    pub player: PlayerConfig,
    pub pet: PetConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserConfigPatch {
    pub window: Option<WindowConfigPatch>,
    pub player: Option<PlayerConfigPatch>,
    pub pet: Option<PetConfigPatch>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowConfigPatch {
    pub x: Option<Option<i32>>,
    pub y: Option<Option<i32>>,
    pub always_on_top: Option<bool>,
    pub opacity: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlayerConfigPatch {
    pub volume: Option<f64>,
    pub muted: Option<bool>,
    pub last_song: Option<Option<PersistedSong>>,
    pub playlist_id: Option<Option<String>>,
    pub playlist_name: Option<Option<String>>,
    pub current_playlist_id: Option<Option<String>>,
    pub saved_playlists: Option<Vec<SavedPlaylist>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PetConfigPatch {
    pub selected_skin: Option<String>,
    pub pet_size: Option<f64>,
    pub show_floating_controls: Option<bool>,
}

static USER_CONFIG_WRITE_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

pub fn default_user_config() -> UserConfig {
    UserConfig {
        window: WindowConfig {
            x: None,
            y: None,
            always_on_top: true,
            opacity: 1.0,
        },
        player: PlayerConfig {
            volume: 0.7,
            muted: false,
            last_song: None,
            playlist_id: None,
            playlist_name: None,
            current_playlist_id: None,
            saved_playlists: Vec::new(),
        },
        pet: PetConfig {
            selected_skin: "default".to_string(),
            pet_size: 1.0,
            show_floating_controls: true,
        },
    }
}

fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn normalize_non_empty_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        _ => None,
    }
}

fn normalize_optional_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => {
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Some(Value::Number(number)) => Some(number.to_string()),
        _ => None,
    }
}

fn normalize_persisted_song_value(value: Option<&Value>) -> Option<PersistedSong> {
    let song_value = value?.as_object()?;
    let song_id = normalize_non_empty_string(song_value.get("songId"))?;
    let song_name = normalize_non_empty_string(song_value.get("songName"))?;
    let artist = normalize_non_empty_string(song_value.get("artist")).unwrap_or_default();
    let cover = normalize_non_empty_string(song_value.get("cover")).unwrap_or_default();
    let progress = song_value.get("progress").and_then(Value::as_f64);

    Some(PersistedSong {
        song_id,
        song_name,
        artist,
        cover,
        progress,
    })
}

fn normalize_saved_playlist_track_value(value: Option<&Value>) -> Option<SavedPlaylistTrack> {
    let track_value = value?.as_object()?;
    let id = track_value.get("id").and_then(|value| {
        value
            .as_u64()
            .or_else(|| value.as_i64().and_then(|id| u64::try_from(id).ok()))
    })?;
    let name = normalize_non_empty_string(track_value.get("name"))?;
    let artists = normalize_non_empty_string(track_value.get("artists"))
        .unwrap_or_else(|| "未知歌手".to_string());
    let album = normalize_optional_string(track_value.get("album"));

    Some(SavedPlaylistTrack {
        id,
        name,
        artists,
        album,
    })
}

fn normalize_timestamp_string(value: Option<&Value>, fallback: &str) -> String {
    normalize_non_empty_string(value).unwrap_or_else(|| fallback.to_string())
}

fn normalize_saved_playlist_value(value: Option<&Value>) -> Option<SavedPlaylist> {
    let playlist_value = value?.as_object()?;
    let id = normalize_optional_string(playlist_value.get("id"))?;
    let name = normalize_non_empty_string(playlist_value.get("name"))?;
    let cover = normalize_optional_string(playlist_value.get("cover")).unwrap_or_default();
    let tracks = playlist_value
        .get("tracks")
        .and_then(Value::as_array)?
        .iter()
        .filter_map(|track| normalize_saved_playlist_track_value(Some(track)))
        .collect::<Vec<_>>();

    if tracks.is_empty() {
        return None;
    }

    let created_at =
        normalize_timestamp_string(playlist_value.get("createdAt"), "1970-01-01T00:00:00.000Z");
    let updated_at = normalize_timestamp_string(playlist_value.get("updatedAt"), &created_at);

    Some(SavedPlaylist {
        id,
        name,
        cover,
        track_count: tracks.len(),
        tracks,
        created_at,
        updated_at,
    })
}

fn normalize_saved_playlists_value(value: Option<&Value>) -> Vec<SavedPlaylist> {
    let Some(playlists) = value.and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut seen_playlist_ids = Vec::<String>::new();
    let mut normalized_playlists = Vec::<SavedPlaylist>::new();

    for playlist_value in playlists {
        let Some(playlist) = normalize_saved_playlist_value(Some(playlist_value)) else {
            continue;
        };

        if seen_playlist_ids.iter().any(|id| id == &playlist.id) {
            continue;
        }

        seen_playlist_ids.push(playlist.id.clone());
        normalized_playlists.push(playlist);
    }

    normalized_playlists
}

pub fn normalize_user_config_value(value: &Value) -> UserConfig {
    let defaults = default_user_config();
    let root = match value.as_object() {
        Some(object) => object,
        None => return defaults,
    };
    let window_value = root.get("window").and_then(Value::as_object);
    let player_value = root.get("player").and_then(Value::as_object);
    let pet_value = root.get("pet").and_then(Value::as_object);
    let playlist_id =
        normalize_optional_string(player_value.and_then(|entry| entry.get("playlistId")));

    UserConfig {
        window: WindowConfig {
            x: window_value
                .and_then(|entry| entry.get("x"))
                .and_then(Value::as_i64)
                .map(|value| value as i32),
            y: window_value
                .and_then(|entry| entry.get("y"))
                .and_then(Value::as_i64)
                .map(|value| value as i32),
            always_on_top: window_value
                .and_then(|entry| entry.get("alwaysOnTop"))
                .and_then(Value::as_bool)
                .unwrap_or(defaults.window.always_on_top),
            opacity: window_value
                .and_then(|entry| entry.get("opacity"))
                .and_then(Value::as_f64)
                .map(|value| clamp_f64(value, 0.2, 1.0))
                .unwrap_or(defaults.window.opacity),
        },
        player: PlayerConfig {
            volume: player_value
                .and_then(|entry| entry.get("volume"))
                .and_then(Value::as_f64)
                .map(|value| clamp_f64(value, 0.0, 1.0))
                .unwrap_or(defaults.player.volume),
            muted: player_value
                .and_then(|entry| entry.get("muted"))
                .and_then(Value::as_bool)
                .unwrap_or(defaults.player.muted),
            last_song: normalize_persisted_song_value(
                player_value.and_then(|entry| entry.get("lastSong")),
            ),
            playlist_id: playlist_id.clone(),
            playlist_name: normalize_optional_string(
                player_value.and_then(|entry| entry.get("playlistName")),
            ),
            current_playlist_id: normalize_optional_string(
                player_value.and_then(|entry| entry.get("currentPlaylistId")),
            )
            .or(playlist_id),
            saved_playlists: normalize_saved_playlists_value(
                player_value.and_then(|entry| entry.get("savedPlaylists")),
            ),
        },
        pet: PetConfig {
            selected_skin: normalize_non_empty_string(
                pet_value.and_then(|entry| entry.get("selectedSkin")),
            )
            .unwrap_or(defaults.pet.selected_skin),
            pet_size: pet_value
                .and_then(|entry| entry.get("petSize"))
                .and_then(Value::as_f64)
                .map(|value| clamp_f64(value, 0.5, 2.0))
                .unwrap_or(defaults.pet.pet_size),
            show_floating_controls: pet_value
                .and_then(|entry| entry.get("showFloatingControls"))
                .and_then(Value::as_bool)
                .unwrap_or(defaults.pet.show_floating_controls),
        },
    }
}

fn normalize_persisted_song(song: PersistedSong) -> Option<PersistedSong> {
    let song_id = song.song_id.trim();
    let song_name = song.song_name.trim();

    if song_id.is_empty() || song_name.is_empty() {
        return None;
    }

    Some(PersistedSong {
        song_id: song_id.to_string(),
        song_name: song_name.to_string(),
        artist: song.artist.trim().to_string(),
        cover: song.cover.trim().to_string(),
        progress: song.progress,
    })
}

fn normalize_saved_playlist_track(track: SavedPlaylistTrack) -> Option<SavedPlaylistTrack> {
    let name = track.name.trim();

    if name.is_empty() {
        return None;
    }

    Some(SavedPlaylistTrack {
        id: track.id,
        name: name.to_string(),
        artists: {
            let artists = track.artists.trim();
            if artists.is_empty() {
                "未知歌手".to_string()
            } else {
                artists.to_string()
            }
        },
        album: track.album.and_then(|album| {
            let trimmed = album.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }),
    })
}

fn normalize_saved_playlist(playlist: SavedPlaylist) -> Option<SavedPlaylist> {
    let id = playlist.id.trim();
    let name = playlist.name.trim();
    let cover = playlist.cover.trim();
    let tracks = playlist
        .tracks
        .into_iter()
        .filter_map(normalize_saved_playlist_track)
        .collect::<Vec<_>>();

    if id.is_empty() || name.is_empty() || tracks.is_empty() {
        return None;
    }

    let created_at = {
        let trimmed = playlist.created_at.trim();
        if trimmed.is_empty() {
            "1970-01-01T00:00:00.000Z".to_string()
        } else {
            trimmed.to_string()
        }
    };
    let updated_at = {
        let trimmed = playlist.updated_at.trim();
        if trimmed.is_empty() {
            created_at.clone()
        } else {
            trimmed.to_string()
        }
    };

    Some(SavedPlaylist {
        id: id.to_string(),
        name: name.to_string(),
        cover: cover.to_string(),
        track_count: tracks.len(),
        tracks,
        created_at,
        updated_at,
    })
}

fn normalize_saved_playlists(playlists: Vec<SavedPlaylist>) -> Vec<SavedPlaylist> {
    let mut normalized_playlists = Vec::new();
    let mut seen_playlist_ids = Vec::<String>::new();

    for playlist in playlists {
        let Some(normalized_playlist) = normalize_saved_playlist(playlist) else {
            continue;
        };

        if seen_playlist_ids
            .iter()
            .any(|id| id == &normalized_playlist.id)
        {
            continue;
        }

        seen_playlist_ids.push(normalized_playlist.id.clone());
        normalized_playlists.push(normalized_playlist);
    }

    normalized_playlists
}

pub fn apply_config_patch(config: &mut UserConfig, patch: UserConfigPatch) {
    if let Some(window_patch) = patch.window {
        if let Some(x) = window_patch.x {
            config.window.x = x;
        }
        if let Some(y) = window_patch.y {
            config.window.y = y;
        }
        if let Some(always_on_top) = window_patch.always_on_top {
            config.window.always_on_top = always_on_top;
        }
        if let Some(opacity) = window_patch.opacity {
            config.window.opacity = clamp_f64(opacity, 0.2, 1.0);
        }
    }

    if let Some(player_patch) = patch.player {
        if let Some(volume) = player_patch.volume {
            config.player.volume = clamp_f64(volume, 0.0, 1.0);
        }
        if let Some(muted) = player_patch.muted {
            config.player.muted = muted;
        }
        if let Some(last_song) = player_patch.last_song {
            config.player.last_song = last_song.and_then(normalize_persisted_song);
        }
        if let Some(playlist_id) = player_patch.playlist_id {
            config.player.playlist_id = playlist_id.and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            });
        }
        if let Some(playlist_name) = player_patch.playlist_name {
            config.player.playlist_name = playlist_name.and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            });
        }
        if let Some(current_playlist_id) = player_patch.current_playlist_id {
            config.player.current_playlist_id = current_playlist_id.and_then(|value| {
                let trimmed = value.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            });
        }
        if let Some(saved_playlists) = player_patch.saved_playlists {
            config.player.saved_playlists = normalize_saved_playlists(saved_playlists);
        }
    }

    if let Some(pet_patch) = patch.pet {
        if let Some(selected_skin) = pet_patch.selected_skin {
            let trimmed = selected_skin.trim();
            if !trimmed.is_empty() {
                config.pet.selected_skin = trimmed.to_string();
            }
        }
        if let Some(pet_size) = pet_patch.pet_size {
            config.pet.pet_size = clamp_f64(pet_size, 0.5, 2.0);
        }
        if let Some(show_floating_controls) = pet_patch.show_floating_controls {
            config.pet.show_floating_controls = show_floating_controls;
        }
    }
}

fn config_file<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    config_file_path(app)
}

fn save_user_config_to_path(config_path: &Path, config: &UserConfig) -> Result<(), String> {
    if let Some(parent_dir) = config_path.parent() {
        fs::create_dir_all(parent_dir).map_err(|error| format!("无法创建配置目录: {error}"))?;
    }

    let serialized =
        serde_json::to_string_pretty(config).map_err(|error| format!("无法序列化配置: {error}"))?;
    fs::write(config_path, serialized).map_err(|error| format!("无法保存配置文件: {error}"))
}

fn load_user_config_from_path(config_path: &Path) -> Result<UserConfig, String> {
    if !config_path.exists() {
        return Ok(default_user_config());
    }

    let content = fs::read_to_string(config_path).map_err(|error| format!("无法读取配置文件: {error}"))?;
    let parsed: Value =
        serde_json::from_str(&content).map_err(|error| format!("配置文件格式损坏: {error}"))?;

    Ok(normalize_user_config_value(&parsed))
}

fn update_user_config_at_path<F>(config_path: &Path, updater: F) -> Result<UserConfig, String>
where
    F: FnOnce(&mut UserConfig),
{
    let _guard = USER_CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| "配置写入锁已损坏".to_string())?;
    let mut config = load_user_config_from_path(config_path).unwrap_or_else(|_| default_user_config());

    updater(&mut config);
    save_user_config_to_path(config_path, &config)?;

    Ok(config)
}

pub fn load_user_config<R: Runtime>(app: &AppHandle<R>) -> Result<UserConfig, String> {
    let config_path = config_file(app)?;
    load_user_config_from_path(&config_path)
}

pub fn load_user_config_or_default<R: Runtime>(app: &AppHandle<R>) -> UserConfig {
    match load_user_config(app) {
        Ok(config) => config,
        Err(error) => {
            let _ = append_log_entry(
                app,
                "warn",
                "配置读取失败",
                Some(&json!({
                    "detail": error
                })),
            );
            default_user_config()
        }
    }
}

pub fn read_user_config_for_frontend<R: Runtime>(app: &AppHandle<R>) -> Result<UserConfig, String> {
    load_user_config(app).map_err(|error| {
        let _ = append_log_entry(
            app,
            "warn",
            "配置读取失败",
            Some(&json!({
                "detail": error
            })),
        );
        error
    })
}

pub fn update_user_config_for_frontend<R: Runtime>(
    app: &AppHandle<R>,
    patch: UserConfigPatch,
) -> Result<UserConfig, String> {
    let config_path = config_file(app)?;
    update_user_config_at_path(&config_path, |config| {
        apply_config_patch(config, patch);
    })
    .map_err(|error| {
        let _ = append_log_entry(
            app,
            "error",
            "配置保存失败",
            Some(&json!({
                "detail": error
            })),
        );
        error
    })
}

pub fn reset_user_config_for_frontend<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<UserConfig, String> {
    let config_path = config_file(app)?;
    let config = default_user_config();
    let _guard = USER_CONFIG_WRITE_LOCK
        .lock()
        .map_err(|_| "配置写入锁已损坏".to_string())?;

    save_user_config_to_path(&config_path, &config).map_err(|error| {
        let _ = append_log_entry(
            app,
            "error",
            "配置保存失败",
            Some(&json!({
                "detail": error,
                "reason": "reset-defaults"
            })),
        );
        error
    })?;

    Ok(config)
}

pub fn update_window_position<R: Runtime>(
    app: &AppHandle<R>,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let config_path = config_file(app)?;

    update_user_config_at_path(&config_path, |config| {
        config.window.x = Some(x);
        config.window.y = Some(y);
    })
    .map(|_| ())
    .map_err(|error| {
        let _ = append_log_entry(
            app,
            "error",
            "配置保存失败",
            Some(&json!({
                "detail": error,
                "reason": "window-position"
            })),
        );
        error
    })
}

fn distance_to_work_area(point_x: i32, point_y: i32, monitor: &Monitor) -> i64 {
    let work_area = monitor.work_area();
    let left = work_area.position.x;
    let top = work_area.position.y;
    let right = left + work_area.size.width as i32;
    let bottom = top + work_area.size.height as i32;
    let delta_x = if point_x < left {
        (left - point_x) as i64
    } else if point_x > right {
        (point_x - right) as i64
    } else {
        0
    };
    let delta_y = if point_y < top {
        (top - point_y) as i64
    } else if point_y > bottom {
        (point_y - bottom) as i64
    } else {
        0
    };

    delta_x.pow(2) + delta_y.pow(2)
}

fn choose_monitor<'a>(monitors: &'a [Monitor], x: i32, y: i32) -> Option<&'a Monitor> {
    monitors
        .iter()
        .min_by_key(|monitor| distance_to_work_area(x, y, monitor))
}

pub fn resolve_window_position(
    saved_x: i32,
    saved_y: i32,
    window_size: PhysicalSize<u32>,
    monitors: &[Monitor],
) -> (i32, i32) {
    if monitors.is_empty() {
        return (saved_x, saved_y);
    }

    let monitor = choose_monitor(monitors, saved_x, saved_y).unwrap_or(&monitors[0]);
    let work_area = monitor.work_area();
    let min_x = work_area.position.x;
    let min_y = work_area.position.y;
    let max_x = min_x + work_area.size.width as i32 - window_size.width as i32;
    let max_y = min_y + work_area.size.height as i32 - window_size.height as i32;
    let clamped_x = saved_x.max(min_x).min(max_x.max(min_x));
    let clamped_y = saved_y.max(min_y).min(max_y.max(min_y));

    (clamped_x, clamped_y)
}

pub fn apply_window_config<R: Runtime>(
    window: &WebviewWindow<R>,
    config: &UserConfig,
) -> Result<(), String> {
    window
        .set_always_on_top(config.window.always_on_top)
        .map_err(|error| format!("无法恢复窗口置顶状态: {error}"))?;

    let (Some(saved_x), Some(saved_y)) = (config.window.x, config.window.y) else {
        return Ok(());
    };
    let window_size = window
        .outer_size()
        .map_err(|error| format!("无法读取窗口尺寸: {error}"))?;
    let monitors = window
        .available_monitors()
        .map_err(|error| format!("无法读取显示器信息: {error}"))?;
    let (x, y) = resolve_window_position(saved_x, saved_y, window_size, &monitors);

    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| format!("无法恢复窗口位置: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        thread,
        time::{Duration, SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn normalize_user_config_falls_back_to_defaults_for_invalid_root() {
        let config = normalize_user_config_value(&Value::String("broken".to_string()));
        assert_eq!(config.player.volume, 0.7);
        assert!(config.window.x.is_none());
    }

    #[test]
    fn apply_patch_clamps_numeric_fields() {
        let mut config = default_user_config();
        apply_config_patch(
            &mut config,
            UserConfigPatch {
                player: Some(PlayerConfigPatch {
                    volume: Some(9.0),
                    ..Default::default()
                }),
                pet: Some(PetConfigPatch {
                    pet_size: Some(0.1),
                    ..Default::default()
                }),
                ..Default::default()
            },
        );

        assert_eq!(config.player.volume, 1.0);
        assert_eq!(config.pet.pet_size, 0.5);
    }

    #[test]
    fn update_user_config_at_path_serializes_concurrent_writes() {
        let temp_dir = std::env::temp_dir().join(format!(
            "music-pet-config-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let config_path = temp_dir.join("user-config.json");

        fs::create_dir_all(&temp_dir).unwrap();
        fs::write(&config_path, serde_json::to_string_pretty(&default_user_config()).unwrap())
            .unwrap();

        let first_path = config_path.clone();
        let first_writer = thread::spawn(move || {
            update_user_config_at_path(&first_path, |config| {
                thread::sleep(Duration::from_millis(30));
                config.player.volume = 0.4;
            })
            .unwrap();
        });

        thread::sleep(Duration::from_millis(5));

        let second_path = config_path.clone();
        let second_writer = thread::spawn(move || {
            update_user_config_at_path(&second_path, |config| {
                config.window.x = Some(120);
                config.window.y = Some(240);
            })
            .unwrap();
        });

        first_writer.join().unwrap();
        second_writer.join().unwrap();

        let saved_config = load_user_config_from_path(&config_path).unwrap();

        assert_eq!(saved_config.player.volume, 0.4);
        assert_eq!(saved_config.window.x, Some(120));
        assert_eq!(saved_config.window.y, Some(240));

        fs::remove_dir_all(temp_dir).unwrap();
    }
}
