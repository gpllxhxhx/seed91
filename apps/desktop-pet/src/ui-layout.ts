export type UiLayoutState = "compact" | "control" | "settings";

export type UiWindowSize = {
  width: number;
  height: number;
};

export type ContextMenuPosition = {
  x: number;
  y: number;
};

export type WorkAreaBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const WINDOW_EDGE_PADDING = 8;

const DEFAULT_PET_SIZE = 1;
const MIN_PET_SIZE = 0.5;
const MAX_PET_SIZE = 2;

export const uiLayoutSizes = {
  compact: { width: 260, height: 260 },
  control: { width: 320, height: 340 },
  settings: { width: 360, height: 520 }
} satisfies Record<UiLayoutState, UiWindowSize>;

export function getWindowSizeForUiState(state: UiLayoutState): UiWindowSize {
  return uiLayoutSizes[state];
}

function clampPetSize(petSize: number): number {
  if (!Number.isFinite(petSize)) {
    return DEFAULT_PET_SIZE;
  }

  return Math.min(MAX_PET_SIZE, Math.max(MIN_PET_SIZE, petSize));
}

export function getWindowSizeWithPetScale(
  state: UiLayoutState,
  petSize = DEFAULT_PET_SIZE
): UiWindowSize {
  const normalizedPetSize = clampPetSize(petSize);
  const scaledCompact = {
    width: Math.round(uiLayoutSizes.compact.width * normalizedPetSize),
    height: Math.round(uiLayoutSizes.compact.height * normalizedPetSize)
  };

  if (state === "compact") {
    return scaledCompact;
  }

  const baseSize = uiLayoutSizes[state];
  const baseCompact = uiLayoutSizes.compact;

  return {
    width: Math.max(baseSize.width, scaledCompact.width),
    height: Math.max(
      baseSize.height,
      scaledCompact.height + (baseSize.height - baseCompact.height)
    )
  };
}

export function clampContextMenuPosition(
  position: ContextMenuPosition,
  windowSize: UiWindowSize,
  menuSize: UiWindowSize
): ContextMenuPosition {
  const maxX = Math.max(WINDOW_EDGE_PADDING, windowSize.width - menuSize.width - WINDOW_EDGE_PADDING);
  const maxY = Math.max(WINDOW_EDGE_PADDING, windowSize.height - menuSize.height - WINDOW_EDGE_PADDING);

  return {
    x: Math.min(Math.max(WINDOW_EDGE_PADDING, position.x), maxX),
    y: Math.min(Math.max(WINDOW_EDGE_PADDING, position.y), maxY)
  };
}

export function clampWindowPositionToArea(
  position: ContextMenuPosition,
  windowSize: UiWindowSize,
  workArea: WorkAreaBounds
): ContextMenuPosition {
  const minX = workArea.x + WINDOW_EDGE_PADDING;
  const minY = workArea.y + WINDOW_EDGE_PADDING;
  const maxX = Math.max(minX, workArea.x + workArea.width - windowSize.width - WINDOW_EDGE_PADDING);
  const maxY = Math.max(minY, workArea.y + workArea.height - windowSize.height - WINDOW_EDGE_PADDING);

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY)
  };
}
