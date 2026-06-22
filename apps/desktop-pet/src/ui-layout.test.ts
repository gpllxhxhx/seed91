import { describe, expect, it } from "vitest";
import {
  clampContextMenuPosition,
  clampWindowPositionToArea,
  getWindowSizeForUiState,
  getWindowSizeWithPetScale,
  uiLayoutSizes,
  type UiLayoutState
} from "./ui-layout";

describe("ui-layout", () => {
  it.each([
    ["compact", 260, 260],
    ["control", 320, 340],
    ["settings", 360, 520]
  ] satisfies Array<[UiLayoutState, number, number]>)(
    "maps %s state to a bounded window size",
    (state, width, height) => {
      expect(getWindowSizeForUiState(state)).toEqual({ width, height });
    }
  );

  it("expands the compact pet window when the pet is scaled up", () => {
    expect(getWindowSizeWithPetScale("compact", 1.6)).toEqual({
      width: 416,
      height: 416
    });
  });

  it("keeps the settings window large enough for both the scaled pet and settings card", () => {
    expect(getWindowSizeWithPetScale("settings", 1.6)).toEqual({
      width: 416,
      height: 676
    });
  });

  it("keeps context menu coordinates inside the current window", () => {
    expect(
      clampContextMenuPosition(
        { x: 330, y: 500 },
        uiLayoutSizes.settings,
        { width: 156, height: 320 }
      )
    ).toEqual({
      x: 196,
      y: 192
    });
  });

  it("keeps a floating window inside a monitor work area", () => {
    expect(
      clampWindowPositionToArea(
        { x: 1880, y: 1030 },
        { width: 360, height: 430 },
        {
          x: 0,
          y: 0,
          width: 1920,
          height: 1080
        }
      )
    ).toEqual({
      x: 1552,
      y: 642
    });
  });

  it("supports monitor work areas with negative coordinates", () => {
    expect(
      clampWindowPositionToArea(
        { x: -1900, y: 50 },
        { width: 190, height: 318 },
        {
          x: -1920,
          y: 0,
          width: 1920,
          height: 1040
        }
      )
    ).toEqual({
      x: -1900,
      y: 50
    });
  });
});
