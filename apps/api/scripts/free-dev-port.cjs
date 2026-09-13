/**
 * Dev-only: release a TCP port left behind by a previous Nest watch process (common on Windows).
 */
const { execSync } = require('child_process');

function collectListeningPids(port) {
  const pids = new Set();
  if (process.platform === 'win32') {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue;
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== '0') pids.add(pid);
      }
    } catch {
      return pids;
    }
    return pids;
  }

  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
    for (const pid of out.split(/\s+/)) {
      if (pid) pids.add(pid.trim());
    }
  } catch {
    // port free
  }
  return pids;
}

function freeDevPort(port) {
  const self = String(process.pid);
  const pids = [...collectListeningPids(port)].filter((pid) => pid !== self);
  if (!pids.length) return false;

  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      } else {
        process.kill(Number(pid), 'SIGTERM');
      }
      console.warn(`[dev] Freed port ${port} (stopped PID ${pid})`);
    } catch {
      // already gone
    }
  }
  return true;
}

module.exports = { freeDevPort };
