import { describe, expect, it } from "vitest";
import {
  getConfigFallbackMessage,
  getPlaybackFriendlyMessage,
  getPlaylistFriendlyMessage,
  getRequestFriendlyMessage
} from "./friendly-messages";

describe("friendly message helpers", () => {
  it("maps request failures to user-friendly text", () => {
    expect(getRequestFriendlyMessage(new Error("请求失败：HTTP 502"))).toBe(
      "网络连接失败，请检查网络后重试。"
    );
    expect(getRequestFriendlyMessage(new Error("请求超时：后端响应过慢"))).toBe(
      "请求超时，请稍后重试。"
    );
  });

  it("maps playlist import failures without leaking technical details", () => {
    expect(getPlaylistFriendlyMessage(new Error("无法解析歌单 ID"))).toBe(
      "歌单导入失败，请检查链接或歌单 ID 是否正确。"
    );
    expect(getPlaylistFriendlyMessage(new Error("歌单为空"))).toBe(
      "歌单导入失败，当前歌单没有可播放的歌曲。"
    );
  });

  it("maps playback failures to a stable user-facing fallback", () => {
    expect(getPlaybackFriendlyMessage(new Error("后端未返回歌曲 URL"))).toBe(
      "当前歌曲暂时无法播放。"
    );
    expect(getPlaybackFriendlyMessage(new Error("mock play failure"))).toBe(
      "当前歌曲暂时无法播放。"
    );
  });

  it("returns stable config fallback messages", () => {
    expect(getConfigFallbackMessage("read")).toBe(
      "本地配置读取失败，已使用默认设置。"
    );
    expect(getConfigFallbackMessage("write")).toBe("本地配置保存失败。");
  });
});
