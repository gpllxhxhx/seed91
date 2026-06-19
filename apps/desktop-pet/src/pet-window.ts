export function bindPetWindowInteractions(
  target: EventTarget,
  startDragging: () => Promise<void> | void,
  closeWindow: () => Promise<void> | void
): void {
  target.addEventListener("mousedown", async (event) => {
    const mouseEvent = event as Event & { button?: number; buttons?: number };

    if (mouseEvent.button !== 0 && mouseEvent.buttons !== 1) {
      return;
    }

    event.preventDefault();
    await startDragging();
  });

  target.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await closeWindow();
  });
}
