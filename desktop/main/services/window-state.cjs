function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distanceToDisplay(point, workArea) {
  const clampedX = clampValue(point.x, workArea.x, workArea.x + workArea.width);
  const clampedY = clampValue(point.y, workArea.y, workArea.y + workArea.height);
  return Math.hypot(point.x - clampedX, point.y - clampedY);
}

function selectTargetDisplay(displays, point) {
  const visibleDisplay = displays.find(({ workArea }) => (
    point.x >= workArea.x
    && point.x <= workArea.x + workArea.width
    && point.y >= workArea.y
    && point.y <= workArea.y + workArea.height
  ));
  if (visibleDisplay) return visibleDisplay;

  return displays.reduce((bestDisplay, currentDisplay) => {
    if (!bestDisplay) return currentDisplay;
    return distanceToDisplay(point, currentDisplay.workArea) < distanceToDisplay(point, bestDisplay.workArea)
      ? currentDisplay
      : bestDisplay;
  }, null);
}

function clampWindowToVisibleArea({ bounds, displays }) {
  const safeDisplays = Array.isArray(displays) && displays.length
    ? displays
    : [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const width = Math.max(1, Number(bounds?.width) || 1);
  const height = Math.max(1, Number(bounds?.height) || 1);
  const requestedX = Number(bounds?.x);
  const requestedY = Number(bounds?.y);

  if (!Number.isFinite(requestedX) || !Number.isFinite(requestedY)) {
    return { x: null, y: null };
  }

  const targetDisplay = selectTargetDisplay(safeDisplays, { x: requestedX, y: requestedY }) || safeDisplays[0];
  const workArea = targetDisplay.workArea;
  const minX = workArea.x;
  const minY = workArea.y;
  const maxX = workArea.x + Math.max(0, workArea.width - width);
  const maxY = workArea.y + Math.max(0, workArea.height - height);

  return {
    x: clampValue(requestedX, minX, maxX),
    y: clampValue(requestedY, minY, maxY),
  };
}

module.exports = { clampWindowToVisibleArea };
