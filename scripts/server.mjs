// Starts, stops and reports on the local dev server.
//
//   npm start        run the site in the background
//   npm stop         stop it
//   npm restart      stop, then start
//   npm run status   say whether it is running
//
// The server runs detached, so it keeps going after the terminal closes.
// Nothing is remembered between commands: each one looks at who is listening
// on the port right now. Stop only ends a process that is both listening on
// the port and running this project's own Vite. Anything else on the port is
// reported and left alone.
//
// Set PORT to use a port other than 5173.

import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 5173);
const url = `http://localhost:${port}/`;
const logFile = join(root, '.dev', 'server.log');
const isWindows = process.platform === 'win32';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Runs a system tool and returns what it printed, or '' if it reported nothing. */
function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  } catch (err) {
    if (err.code === 'ENOENT') fail(`Cannot check the port: "${cmd}" was not found on this computer.`);
    return typeof err.stdout === 'string' ? err.stdout : '';
  }
}

/** PIDs of the processes listening on the port. */
function listenerPids() {
  const pids = new Set();
  if (isWindows) {
    // A listening row has a remote address ending in ":0". The word
    // "LISTENING" is not matched because Windows translates it.
    for (const line of run('netstat', ['-ano']).split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      if (cols[0] === 'TCP' && cols.length >= 4 && cols[1].endsWith(`:${port}`) && cols[2].endsWith(':0')) {
        pids.add(Number(cols.at(-1)));
      }
    }
  } else {
    for (const pid of run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).split(/\s+/)) {
      if (pid) pids.add(Number(pid));
    }
  }
  return [...pids];
}

function commandLine(pid) {
  const out = isWindows
    ? run('powershell', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
      ])
    : run('ps', ['-ww', '-o', 'command=', '-p', String(pid)]);
  return out.trim();
}

/** True when a command line is Vite run from this project's node_modules. */
function isThisProject(cmd) {
  const tidy = (s) => {
    const slashed = s.replace(/[\\/]+/g, '/');
    return isWindows ? slashed.toLowerCase() : slashed;
  };
  const c = tidy(cmd);
  return c.includes(`${tidy(root)}/node_modules/`) && c.includes('vite');
}

/** Splits the port's listeners into this project's server and everything else. */
function look() {
  const mine = [];
  const others = [];
  for (const pid of listenerPids()) {
    const cmd = commandLine(pid);
    (isThisProject(cmd) ? mine : others).push({ pid, cmd });
  }
  return { mine, others };
}

const describe = (procs) =>
  procs.map((p) => `  PID ${p.pid}: ${p.cmd || '(command line not readable)'}`).join('\n');

function logTail() {
  try {
    return readFileSync(logFile, 'utf8').trim().split(/\r?\n/).slice(-20).join('\n') || '(the log is empty)';
  } catch {
    return '(no log was written)';
  }
}

function kill(pid) {
  if (isWindows) {
    // /T takes Vite's helper process with it. /F is needed because a
    // background process has no window to ask politely.
    run('taskkill', ['/PID', String(pid), '/T', '/F']);
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
}

async function start() {
  const { mine, others } = look();
  if (mine.length) {
    console.log(`Already running at ${url} (PID ${mine[0].pid}).`);
    return;
  }
  if (others.length) {
    fail(
      `Not starting: port ${port} is in use by another program.\n${describe(others)}\n` +
        'Close that program, or set PORT to a free port and try again.',
    );
  }
  const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(vite)) fail('Vite is not installed yet. Run "npm install" first.');

  mkdirSync(dirname(logFile), { recursive: true });
  const log = openSync(logFile, 'w');
  // --strictPort makes Vite fail instead of quietly moving to another port,
  // so status and stop always know where to look.
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  closeSync(log);
  let exited = false;
  child.once('exit', () => (exited = true));
  child.once('error', () => (exited = true));
  child.unref();

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await sleep(250);
    if (exited) fail(`The server stopped while starting. Its log says:\n${logTail()}`);
    if (listenerPids().includes(child.pid)) {
      console.log(`Started at ${url} (PID ${child.pid}).`);
      console.log(`Log: ${relative(root, logFile)}   Stop with: npm stop`);
      return;
    }
  }
  kill(child.pid);
  fail(`The server did not come up within 30 seconds, so it was stopped. Its log says:\n${logTail()}`);
}

async function stop() {
  const { mine, others } = look();
  if (!mine.length) {
    if (others.length) {
      fail(
        `Nothing stopped: port ${port} is held by another program, not this project's server.\n${describe(others)}`,
      );
    }
    console.log(`Not running (nothing is listening on port ${port}).`);
    return;
  }
  const pids = mine.map((p) => p.pid);
  pids.forEach(kill);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await sleep(200);
    const left = listenerPids();
    if (!pids.some((pid) => left.includes(pid))) {
      console.log(`Stopped (PID ${pids.join(', ')}).`);
      return;
    }
  }
  fail(`Could not stop PID ${pids.join(', ')}; it is still listening on port ${port}.`);
}

function status() {
  const { mine, others } = look();
  if (mine.length) {
    console.log(`Running at ${url} (PID ${mine[0].pid}).`);
  } else if (others.length) {
    console.log(`Not running. Port ${port} is in use by another program:\n${describe(others)}`);
  } else {
    console.log(`Not running (nothing is listening on port ${port}).`);
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`PORT must be a number from 1 to 65535, not "${process.env.PORT}".`);

const commands = { start, stop, status };
const command = commands[process.argv[2]];
if (!command) fail('Usage: node scripts/server.mjs start|stop|status');
await command();
