function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim();
  }

  return typeof error === "string" ? error.trim() : "";
}

export function getRequestFriendlyMessage(error: unknown): string {
  const text = getErrorText(error);

  if (/超时|timeout/i.test(text)) {
    return "请求超时，请稍后重试。";
  }

  if (/请求失败|http|network|cors|连接/i.test(text)) {
    return "网络连接失败，请检查网络后重试。";
  }

  return "请求失败，请稍后重试。";
}

export function getPlaylistFriendlyMessage(error: unknown): string {
  const text = getErrorText(error);

  if (/无法解析歌单 ID/i.test(text)) {
    return "歌单导入失败，请检查链接或歌单 ID 是否正确。";
  }

  if (/歌单为空/i.test(text)) {
    return "歌单导入失败，当前歌单没有可播放的歌曲。";
  }

  if (/请求失败|超时|http|连接/i.test(text)) {
    return getRequestFriendlyMessage(error);
  }

  return "歌单导入失败，请检查链接或歌单 ID 是否正确。";
}

export function getPlaybackFriendlyMessage(error: unknown): string {
  const text = getErrorText(error);

  if (/请求失败|超时|http|连接/i.test(text)) {
    return getRequestFriendlyMessage(error);
  }

  if (/播放失败|url|歌曲|audio|mock play failure/i.test(text)) {
    return "当前歌曲暂时无法播放。";
  }

  return "当前歌曲暂时无法播放。";
}

export function getConfigFallbackMessage(type: "read" | "write"): string {
  return type === "read"
    ? "本地配置读取失败，已使用默认设置。"
    : "本地配置保存失败。";
}
