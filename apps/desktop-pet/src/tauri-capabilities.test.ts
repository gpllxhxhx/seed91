import { describe, expect, it } from "vitest";
import defaultCapability from "../src-tauri/capabilities/default.json";

describe("tauri window capabilities", () => {
  it("grants event and window permissions to picker windows", () => {
    expect(defaultCapability.windows).toEqual(
      expect.arrayContaining([
        "main",
        "pet-menu",
        "pet-playlist-picker",
        "pet-song-picker"
      ])
    );
    expect(defaultCapability.permissions).toEqual(
      expect.arrayContaining([
        "core:event:allow-emit-to",
        "core:event:allow-listen",
        "core:window:allow-close",
        "core:window:allow-hide"
      ])
    );
  });
});
