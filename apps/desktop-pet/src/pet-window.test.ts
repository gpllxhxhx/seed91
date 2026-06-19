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
  it("starts dragging when the pet surface is left-clicked", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const closeWindow = vi.fn(async () => {});

    const event = createMouseLikeEvent("mousedown", { button: 0, buttons: 1, detail: 1 });

    bindPetWindowInteractions(target, startDragging, closeWindow);
    const dispatchResult = target.dispatchEvent(event);

    await Promise.resolve();

    expect(dispatchResult).toBe(false);
    expect(startDragging).toHaveBeenCalledTimes(1);
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("closes the window when the pet surface is right-clicked", async () => {
    const target = new EventTarget();
    const startDragging = vi.fn(async () => {});
    const closeWindow = vi.fn(async () => {});
    const event = createMouseLikeEvent("contextmenu", { button: 2 });

    bindPetWindowInteractions(target, startDragging, closeWindow);
    const dispatchResult = target.dispatchEvent(event);

    await Promise.resolve();

    expect(dispatchResult).toBe(false);
    expect(closeWindow).toHaveBeenCalledTimes(1);
    expect(startDragging).not.toHaveBeenCalled();
  });
});
