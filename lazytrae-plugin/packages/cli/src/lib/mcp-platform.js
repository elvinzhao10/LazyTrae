// Typed, host-rule-driven validation of a materialized MCP declaration. This mirrors
// the verified Trae IDE rule (https://docs.trae.ai/ide/add-mcp-servers, retrieved
// 2026-09-14): the `command` field must be a single space-free executable token, and
// only the ${workspaceFolder} variable is expanded. Disabled placeholders are excluded from package readiness validation.
const SUPPORTED_TRAE_VARIABLES = ['workspaceFolder'];
const VARIABLE_PATTERN = /\$\{([^}]*)\}/g;
const TRAE_HTTP_TYPES = new Set(['http', 'sse']);

class McpPlatformValidationError extends Error {
  constructor(code, server, message) {
    super(message);
    this.name = 'McpPlatformValidationError';
    this.code = code;
    this.server = server;
  }
}

function isTraeHttpTransport(server) {
  if (!server || typeof server !== 'object') return false;
  if (TRAE_HTTP_TYPES.has(server.type)) return true;
  return server.type === undefined && 'url' in server;
}

function isLaunchString(value) {
  return typeof value === 'string' && !value.includes('\0');
}

function isStringMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, item]) => isLaunchString(key) && isLaunchString(item));
}

function collectTraePlatformErrors(declaration) {
  const errors = [];
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration) || !declaration.mcpServers
    || typeof declaration.mcpServers !== 'object' || Array.isArray(declaration.mcpServers)) {
    return [{ code: 'MCP_DECLARATION_INVALID', message: 'MCP declaration must be an object with an mcpServers object.' }];
  }
  for (const [name, server] of Object.entries(declaration.mcpServers)) {
    if (!server || typeof server !== 'object' || Array.isArray(server)) {
      errors.push({ code: 'MCP_SERVER_INVALID', server: name, message: `mcpServers.${name} must be an object.` });
      continue;
    }
    if (server.disabled === true) continue;
    const invalid = (code, field, requirement) => errors.push({
      code, server: name, message: `mcpServers.${name}.${field} ${requirement}`,
    });
    if (server.type !== undefined && !['stdio', 'http', 'sse'].includes(server.type)) {
      invalid('MCP_TRANSPORT_INVALID', 'type', 'must be stdio, http, or sse.');
    }
    if (server.args !== undefined && (!Array.isArray(server.args) || !server.args.every(isLaunchString))) {
      invalid('MCP_ARGS_INVALID', 'args', 'must be an array of strings without NUL characters.');
    }

    const scanVariables = (value) => {
      if (typeof value !== 'string') return;
      VARIABLE_PATTERN.lastIndex = 0;
      let match;
      while ((match = VARIABLE_PATTERN.exec(value)) !== null) {
        const variable = match[1];
        if (!SUPPORTED_TRAE_VARIABLES.includes(variable)) {
          errors.push({
            code: 'MCP_UNKNOWN_VARIABLE',
            server: name,
            message: `mcpServers.${name} references an unsupported variable. `
              + 'Trae expands only ${workspaceFolder} (substituted with the project root at server start).',
          });
        }
      }
    };

    for (const field of ['env', 'headers']) {
      if (server[field] === undefined) continue;
      if (!isStringMap(server[field])) {
        invalid(`MCP_${field.toUpperCase()}_INVALID`, field, 'must be an object of strings without NUL characters.');
      } else Object.values(server[field]).forEach(scanVariables);
    }
    if (isTraeHttpTransport(server)) {
      const url = server.url;
      if (!isLaunchString(url) || url.trim() === '') {
        errors.push({
          code: 'MCP_HTTP_URL_REQUIRED',
          server: name,
          message: `mcpServers.${name} is an HTTP transport and requires a non-empty "url".`,
        });
      }
      scanVariables(server.url);
      if (Array.isArray(server.args)) server.args.forEach(scanVariables);
      continue;
    }

    const command = server.command;
    if (typeof command !== 'string' || command.trim() === '') {
      errors.push({
        code: 'MCP_COMMAND_EMPTY',
        server: name,
        message: `mcpServers.${name}.command is required and must be a single non-empty executable token. `
          + 'Set command to an executable on PATH or an absolute path.',
      });
      continue;
    }
    if (!isLaunchString(command)) {
      invalid('MCP_COMMAND_INVALID', 'command', 'must not contain NUL characters.');
      continue;
    }
    if (/\s/.test(command)) {
      errors.push({
        code: 'MCP_COMMAND_NOT_SPACE_FREE',
        server: name,
        message: `mcpServers.${name}.command must not contain spaces; Trae parses the command `
          + 'as one executable token and fails otherwise. Remediation: use a single executable token and '
          + 'move spaced values into args.',
      });
      continue;
    }
    scanVariables(command);
    if (Array.isArray(server.args)) server.args.forEach(scanVariables);
  }
  return errors;
}

// Validate a declaration against the verified Trae host rule. Returns a list of typed
// error objects ({ code, server, message }); an empty list means the declaration passes.
function validateDeclarationForPlatform(declaration) {
  return collectTraePlatformErrors(declaration);
}

module.exports = { McpPlatformValidationError, collectTraePlatformErrors, validateDeclarationForPlatform };
