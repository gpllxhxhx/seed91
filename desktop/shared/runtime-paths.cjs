function normalizeExecPath(value) {
  return String(value || '').trim().replace(/^"(.*)"$/, '$1');
}

function resolveNodeExecPath(env = process.env, execPath = process.execPath) {
  const npmNodeExecPath = normalizeExecPath(env?.npm_node_execpath);
  if (npmNodeExecPath) return npmNodeExecPath;

  const currentExecPath = normalizeExecPath(execPath);
  if (currentExecPath) return currentExecPath;

  return 'node';
}

module.exports = {
  resolveNodeExecPath,
};
