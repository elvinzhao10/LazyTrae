'use strict';

const DOUBLE_QUOTED_CREDENTIAL = /(["']?\b(?:password|secret|token|api[_-]?key|credential|authorization|proxy-authorization|x-api-key|x-auth-token|access-token|id[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|cookie)\b["']?\s*[:=]\s*)"(?:(?:\\.)|[^"\\])*"/gi;
const SINGLE_QUOTED_CREDENTIAL = /(["']?\b(?:password|secret|token|api[_-]?key|credential|authorization|proxy-authorization|x-api-key|x-auth-token|access-token|id[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|cookie)\b["']?\s*[:=]\s*)'(?:(?:\\.)|[^'\\])*'/gi;
const BARE_CREDENTIAL = /(["']?\b(?:password|secret|token|api[_-]?key|credential|authorization|proxy-authorization|x-api-key|x-auth-token|access-token|id[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|cookie)\b["']?\s*[:=]\s*)([^\s,;'"{}\[\]\)]+)/gi;

function redactText(value) {
  return String(value)
    .replace(/\b(?:Bearer|Basic|Token)\s+[^\s,;'"\x60{}\[\]\)]+/gi, match => match.split(/\s+/, 1)[0] + ' [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
    .replace(DOUBLE_QUOTED_CREDENTIAL, '$1"[REDACTED]"')
    .replace(SINGLE_QUOTED_CREDENTIAL, "$1'[REDACTED]'")
    .replace(BARE_CREDENTIAL, '$1[REDACTED]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED]');
}

module.exports = { redactText };
