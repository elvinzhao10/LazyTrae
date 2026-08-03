'use strict';

const VALID_HOSTS = new Set(['ide', 'work', 'cli']);

function readHost(args) {
  const hostIndex = args.indexOf('--host');
  if (hostIndex === -1) return 'ide';
  const host = args[hostIndex + 1];
  if (!VALID_HOSTS.has(host)) throw new Error('--host must be ide, work, or cli.');
  return host;
}

module.exports = { readHost };
