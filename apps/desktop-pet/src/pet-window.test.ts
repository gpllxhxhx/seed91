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
    const closeWindow = vi.fn(async () => {});
    const togglePlayback = vi.fn();

    bindPetWindowInteractions(target, {
      startDragging,
      closeWindow,
      togglePlayback
    });
    target.dispatchEvent(createMouseLikeEvent("mousedown", { button: 0, buttons: 1, clientX: 10, clientY: 10 }));
    target.dispatchEvent(createMouseLikeEvent("mouseup", { button: 0, buttons: 0, clientX: 12, clientY: 13 }));

    expect(togglePlayback).toHaveBeenCalledTimes(1);
    expect(startDragging).not.toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("starts dragging and does not toggle playback when left click movement exceeds 4px", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const closeWindow = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const moveEvent = createMouseLikeEvent("mousemove", { clientX: 18, clientY: 18 });

    bindPetWindowInteractions(target, {
      startDragging,
      closeWindow,
      togglePlayback
    });
    target.dispatchEvent(createMouseLikeEvent("mousedown", { button: 0, buttons: 1, clientX: 10, clientY: 10 }));
    target.dispatchEvent(moveEvent);
    target.dispatchEvent(createMouseLikeEvent("mouseup", { button: 0, buttons: 0, clientX: 18, clientY: 18 }));

    await Promise.resolve();

    expect(startDragging).toHaveBeenCalledTimes(1);
    expect(togglePlayback).not.toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("closes the window when the pet surface is right-clicked", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const closeWindow = vi.fn(async () => {});
    const togglePlayback = vi.fn();
    const event = createMouseLikeEvent("contextmenu", { button: 2 });

    bindPetWindowInteractions(target, {
      startDragging,
      closeWindow,
      togglePlayback
    });
    const dispatchResult = target.dispatchEvent(event);

    await Promise.resolve();

    expect(dispatchResult).toBe(false);
    expect(closeWindow).toHaveBeenCalledTimes(1);
    expect(startDragging).not.toHaveBeenCalled();
    expect(togglePlayback).not.toHaveBeenCalled();
  });
});
