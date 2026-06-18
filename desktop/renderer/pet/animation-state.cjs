(function initPetAnimationState(globalScope) {
  const CLICK_STATE_DURATION_MS = 240;

  function playbackStatusToAnimation(status) {
    if (status === 'error') return 'error';
    if (status === 'loading') return 'loading';
    if (status === 'playing') return 'playing';
    if (status === 'paused') return 'paused';
    return 'idle';
  }

  function resolveAnimationState({
    playbackStatus = 'idle',
    hovering = false,
    clickedAt = 0,
    now = Date.now(),
    clickDurationMs = CLICK_STATE_DURATION_MS,
  } = {}) {
    const baseState = playbackStatusToAnimation(playbackStatus);
    if (baseState === 'error') return 'error';
    if (clickedAt && now - clickedAt < clickDurationMs) return 'click';
    if (baseState === 'loading') return 'loading';
    if (hovering) return 'hover';
    return baseState;
  }

  const api = {
    CLICK_STATE_DURATION_MS,
    playbackStatusToAnimation,
    resolveAnimationState,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.PetAnimationState = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
