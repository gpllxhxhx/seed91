type PointerLikeEvent = Event & {
  button?: number;
  buttons?: number;
  clientX?: number;
  clientY?: number;
};

type PetWindowCallbacks = {
  startDragging: () => Promise<void> | void;
  closeWindow: () => Promise<void> | void;
  togglePlayback: () => Promise<void> | void;
};

type DragSession = {
  dragged: boolean;
  startX: number;
  startY: number;
};

const CLICK_DISTANCE_THRESHOLD = 4;

export function bindPetWindowInteractions(
  target: EventTarget,
  callbacks: PetWindowCallbacks,
  movementTarget: EventTarget = target
): void {
  let dragSession: DragSession | null = null;

  target.addEventListener("mousedown", (event) => {
    const mouseEvent = event as PointerLikeEvent;

    if (mouseEvent.button !== 0) {
      return;
    }

    dragSession = {
      dragged: false,
      startX: mouseEvent.clientX ?? 0,
      startY: mouseEvent.clientY ?? 0
    };
  });

  movementTarget.addEventListener("mousemove", async (event) => {
    if (!dragSession || dragSession.dragged) {
      return;
    }

    const mouseEvent = event as PointerLikeEvent;
    const deltaX = Math.abs((mouseEvent.clientX ?? 0) - dragSession.startX);
    const deltaY = Math.abs((mouseEvent.clientY ?? 0) - dragSession.startY);

    if (Math.max(deltaX, deltaY) <= CLICK_DISTANCE_THRESHOLD) {
      return;
    }

    dragSession.dragged = true;
    event.preventDefault();
    await callbacks.startDragging();
  });

  movementTarget.addEventListener("mouseup", async (event) => {
    const mouseEvent = event as PointerLikeEvent;

    if (!dragSession || mouseEvent.button !== 0) {
      return;
    }

    const deltaX = Math.abs((mouseEvent.clientX ?? 0) - dragSession.startX);
    const deltaY = Math.abs((mouseEvent.clientY ?? 0) - dragSession.startY);
    const shouldToggle =
      !dragSession.dragged &&
      Math.max(deltaX, deltaY) <= CLICK_DISTANCE_THRESHOLD;

    dragSession = null;

    if (shouldToggle) {
      await callbacks.togglePlayback();
    }
  });

  target.addEventListener("contextmenu", async (event) => {
    dragSession = null;
    event.preventDefault();
    event.stopPropagation();
    await callbacks.closeWindow();
  });
}
