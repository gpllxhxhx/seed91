import { describe, expect, it, vi } from "vitest";
import { bindPetWindowInteractions } from "./pet-window";

function createMouseLikeEvent(type: string, properties: Record<string, unknown>) {
  const event = new Event(type, { bubbles: true, cancelable: true });

  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(event, key, {
      configurable: true,
      value
    });
  }

  return event;
}

describe("bindPetWindowInteractions", () => {
  it("toggles playback when left click movement stays within 4px", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const openContextMenu = vi.fn();

    bindPetWindowInteractions(target, {
      startDragging,
      togglePlayback,
      openContextMenu
    });
    target.dispatchEvent(createMouseLikeEvent("mousedown", { button: 0, buttons: 1, clientX: 10, clientY: 10 }));
    target.dispatchEvent(createMouseLikeEvent("mouseup", { button: 0, buttons: 0, clientX: 12, clientY: 13 }));
    await new Promise((resolve) => setTimeout(resolve, 280));

    expect(togglePlayback).toHaveBeenCalledTimes(1);
    expect(startDragging).not.toHaveBeenCalled();
    expect(openContextMenu).not.toHaveBeenCalled();
  });

  it("plays next on left double-click without toggling playback", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const playNext = vi.fn();

    bindPetWindowInteractions(target, {
      startDragging,
      togglePlayback,
      playNext
    });
    target.dispatchEvent(createMouseLikeEvent("dblclick", { button: 0, clientX: 12, clientY: 12 }));

    await Promise.resolve();

    expect(playNext).toHaveBeenCalledTimes(1);
    expect(togglePlayback).not.toHaveBeenCalled();
    expect(startDragging).not.toHaveBeenCalled();
  });

  it("plays previous on right double-click without opening the context menu", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const playPrevious = vi.fn();
    const openContextMenu = vi.fn();

    bindPetWindowInteractions(target, {
      startDragging,
      togglePlayback,
      playPrevious,
      openContextMenu
    });
    target.dispatchEvent(createMouseLikeEvent("contextmenu", { button: 2, clientX: 21, clientY: 34 }));
    target.dispatchEvent(createMouseLikeEvent("contextmenu", { button: 2, clientX: 21, clientY: 34 }));

    await new Promise((resolve) => setTimeout(resolve, 280));

    expect(playPrevious).toHaveBeenCalledTimes(1);
    expect(openContextMenu).not.toHaveBeenCalled();
    expect(togglePlayback).not.toHaveBeenCalled();
  });

  it("changes volume with the wheel while the cursor is on the pet surface", async () => {
    const target = new EventTarget();
    const changeVolume = vi.fn();

    bindPetWindowInteractions(target, {
      startDragging: vi.fn(),
      togglePlayback: vi.fn(),
      changeVolume
    });
    const event = createMouseLikeEvent("wheel", { deltaY: -120 });
    const dispatchResult = target.dispatchEvent(event);

    expect(dispatchResult).toBe(false);
    expect(changeVolume).toHaveBeenCalledWith(0.05);
  });

  it("starts dragging and does not toggle playback when left click movement exceeds 4px", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const openContextMenu = vi.fn();
    const setDragging = vi.fn();
    const moveEvent = createMouseLikeEvent("mousemove", { clientX: 18, clientY: 18 });

    bindPetWindowInteractions(target, {
      startDragging,
      togglePlayback,
      openContextMenu,
      setDragging
    });
    target.dispatchEvent(createMouseLikeEvent("mousedown", { button: 0, buttons: 1, clientX: 10, clientY: 10 }));
    target.dispatchEvent(moveEvent);
    target.dispatchEvent(createMouseLikeEvent("mouseup", { button: 0, buttons: 0, clientX: 18, clientY: 18 }));

    await Promise.resolve();

    expect(startDragging).toHaveBeenCalledTimes(1);
    expect(togglePlayback).not.toHaveBeenCalled();
    expect(openContextMenu).not.toHaveBeenCalled();
    expect(setDragging).toHaveBeenNthCalledWith(1, true);
    expect(setDragging).toHaveBeenLastCalledWith(false);
  });

  it("opens the custom context menu when the pet surface is right-clicked", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const openContextMenu = vi.fn();
    const event = createMouseLikeEvent("contextmenu", { button: 2, clientX: 21, clientY: 34 });

    bindPetWindowInteractions(target, {
      startDragging,
      togglePlayback,
      openContextMenu
    });
    const dispatchResult = target.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 280));

    expect(dispatchResult).toBe(false);
    expect(openContextMenu).toHaveBeenCalledTimes(1);
    expect(openContextMenu).toHaveBeenCalledWith({
      x: 21,
      y: 34
    });
    expect(startDragging).not.toHaveBeenCalled();
    expect(togglePlayback).not.toHaveBeenCalled();
  });
});
