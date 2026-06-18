const { spawn } = require('child_process');
const path = require('path');
const { resolveNodeExecPath } = require('./runtime-paths.cjs');

const nodePath = resolveNodeExecPath(process.env, process.execPath);
const electronCliPath = path.join(__dirname, '..', 'node_modules', 'electron', 'cli.js');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(nodePath, [electronCliPath, '.'], {
  cwd: path.resolve(__dirname, '..'),
  env,
  stdio: 'inherit',
  shell: false,
  windowsHide: false,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
