'use strict';
const { executableIdentity, started, removeReceipt } = require('./dashboard-service-identity');
const { secret } = require('./dashboard-service-auth');
const { listen } = require('./dashboard-service-http');
const { DashboardError: ServiceError } = require('./dashboard-files');

async function serve() {
  if (!process.send) throw new ServiceError('OWNED_LAUNCH_REQUIRED');
  let server; let promoted = false; let options; let identity; let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    if (!promoted && options && identity) await removeReceipt(options, identity.instance);
    if (server) await server.close();
    process.exit(0);
  };
  const watchdog = setTimeout(() => stop(), 12000);
  process.on('disconnect', () => { if (!promoted) stop(); });
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  process.on('message', async message => {
    try {
      switch (message.action) {
        case 'initialize': {
          if (options) throw new ServiceError('ALREADY_INITIALIZED'); options = message.options;
          identity = { projectRoot: options.projectRoot, projectId: options.projectId, runId: options.runId,
            pid: process.pid, started: await started(process.pid), instance: secret(), ...await executableIdentity() };
          server = await listen(options, { identity, credential: message.credential, closed: () => process.exit(0) });
          process.send({ ready: true, identity }); break;
        }
        case 'promote': promoted = true; clearTimeout(watchdog); process.send({ promoted: true }); break;
        case 'abort': await stop(); break;
        default: throw new ServiceError('UNKNOWN_CONTROL');
      }
    } catch { await stop(); }
  });
}

serve().catch(() => { process.exitCode = 1; });

