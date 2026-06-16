function playbackStatusToAnimation(status) {
  if (status === 'playing') return 'playing';
  if (status === 'paused') return 'paused';
  if (status === 'loading') return 'next';
  if (status === 'error') return 'error';
  return 'idle';
}

module.exports = { playbackStatusToAnimation };
