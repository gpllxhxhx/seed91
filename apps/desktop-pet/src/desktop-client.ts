import { invoke } from "@tauri-apps/api/core";
import { normalizeUserConfig, type UserConfig } from "./user-config";

export type UserConfigPatch = {
  window?: {
    x?: number | null;
    y?: number | null;
    alwaysOnTop?: boolean;
    opacity?: number;
  };
  player?: {
    volume?: number;
    muted?: boolean;
    lastSong?: UserConfig["player"]["lastSong"];
    playlistId?: string | null;
    playlistName?: string | null;
    currentPlaylistId?: string | null;
    savedPlaylists?: UserConfig["player"]["savedPlaylists"];
  };
  pet?: {
    selectedSkin?: string;
    petSize?: number;
    showFloatingControls?: boolean;
  };
};

export type StoragePaths = {
  appDataDir: string;
  configFilePath: string;
  logDir: string;
  currentLogFilePath: string;
};

export async function readUserConfig(): Promise<UserConfig> {
  const result = await invoke<unknown>("read_user_config");
  return normalizeUserConfig(result);
}

export async function updateUserConfig(
  patch: UserConfigPatch
): Promise<UserConfig> {
  const result = await invoke<unknown>("update_user_config", {
    patch
  });

  return normalizeUserConfig(result);
}

export async function appendLogEntry(
  level: "info" | "warn" | "error",
  message: string,
  context?: unknown
): Promise<void> {
  await invoke("append_log_entry", {
    level,
    message,
    context: context ?? null
  });
}

export async function getStoragePaths(): Promise<StoragePaths> {
  return invoke<StoragePaths>("get_storage_paths");
}

export async function openLogDirectory(): Promise<void> {
  await invoke("open_log_directory");
}

export async function openConfigDirectory(): Promise<void> {
  await invoke("open_config_directory");
}

export async function applyWindowPreferences(alwaysOnTop: boolean): Promise<void> {
  await invoke("apply_window_preferences", {
    alwaysOnTop
  });
}

export async function resetUserConfig(): Promise<UserConfig> {
  const result = await invoke<unknown>("reset_user_config");
  return normalizeUserConfig(result);
}
