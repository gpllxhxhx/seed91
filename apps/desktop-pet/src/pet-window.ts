type PointerLikeEvent = Event & {
  button?: number;
  buttons?: number;
  clientX?: number;
  clientY?: number;
  deltaY?: number;
};

type PetWindowCallbacks = {
  startDragging: () => Promise<void> | void;
  togglePlayback: () => Promise<void> | void;
  playNext?: () => Promise<void> | void;
  playPrevious?: () => Promise<void> | void;
  changeVolume?: (delta: number) => Promise<void> | void;
  openContextMenu?: (position: { x: number; y: number }) => Promise<void> | void;
  setDragging?: (isDragging: boolean) => void;
};

type DragSession = {
  dragged: boolean;
  startX: number;
  startY: number;
};

const CLICK_DISTANCE_THRESHOLD = 4;
const CLICK_CONFIRM_DELAY_MS = 240;
const VOLUME_STEP = 0.05;

export function bindPetWindowInteractions(
  target: EventTarget,
  callbacks: PetWindowCallbacks,
  movementTarget: EventTarget = target
): void {
  let dragSession: DragSession | null = null;
  let leftClickTimer: ReturnType<typeof setTimeout> | null = null;
  let rightClickTimer: ReturnType<typeof setTimeout> | null = null;

  function clearLeftClickTimer(): void {
    if (leftClickTimer) {
      clearTimeout(leftClickTimer);
      leftClickTimer = null;
    }
  }

  function clearRightClickTimer(): void {
    if (rightClickTimer) {
      clearTimeout(rightClickTimer);
      rightClickTimer = null;
    }
  }

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
    callbacks.setDragging?.(true);

    try {
      await callbacks.startDragging();
    } finally {
      callbacks.setDragging?.(false);
    }
  });

  movementTarget.addEventListener("mouseup", (event) => {
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
      clearLeftClickTimer();
      leftClickTimer = setTimeout(() => {
        leftClickTimer = null;
        void callbacks.togglePlayback();
      }, CLICK_CONFIRM_DELAY_MS);
    }
  });

  target.addEventListener("dblclick", async (event) => {
    const mouseEvent = event as PointerLikeEvent;

    if (mouseEvent.button !== 0) {
      return;
    }

    clearLeftClickTimer();
    event.preventDefault();
    event.stopPropagation();
    await callbacks.playNext?.();
  });

  target.addEventListener("contextmenu", async (event) => {
    const mouseEvent = event as PointerLikeEvent;
    dragSession = null;
    event.preventDefault();
    event.stopPropagation();

    if (rightClickTimer) {
      clearRightClickTimer();
      await callbacks.playPrevious?.();
      return;
    }

    rightClickTimer = setTimeout(() => {
      rightClickTimer = null;
      void callbacks.openContextMenu?.({
        x: mouseEvent.clientX ?? 0,
        y: mouseEvent.clientY ?? 0
      });
    }, CLICK_CONFIRM_DELAY_MS);
  });

  target.addEventListener("wheel", async (event) => {
    const wheelEvent = event as PointerLikeEvent;
    const delta = (wheelEvent.deltaY ?? 0) < 0 ? VOLUME_STEP : -VOLUME_STEP;

    event.preventDefault();
    event.stopPropagation();
    await callbacks.changeVolume?.(delta);
  });
}
