'use strict';

function redactText(value) {
  return String(value)
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
    .replace(/\b(?:password|secret|token|api[_-]?key|credential|authorization)\s*[:=]\s*[^\s,;]+/gi, match => `${match.split(/\s*[:=]\s*/, 1)[0]}=[REDACTED]`)
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED]');
}

module.exports = { redactText };
