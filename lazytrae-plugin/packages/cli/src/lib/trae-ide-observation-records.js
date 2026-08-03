'use strict';

const ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, required, optional, name) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') fail(`${name} must be an object`);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter(key => !Object.hasOwn(value, key));
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (missing.length > 0) fail(`${name} missing ${missing.join(', ')}`);
  if (unknown.length > 0) fail(`${name} has unknown fields: ${unknown.join(', ')}`);
}

function oneOf(value, allowed, name) {
  if (!allowed.includes(value)) fail(`${name} is unsupported`);
}

function identifier(value, name, pattern = ID) {
  if (typeof value !== 'string' || !pattern.test(value)) fail(`${name} is malformed`);
}

function unique(values, key, name) {
  if (!Array.isArray(values)) fail(`${name} must be an array`);
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value[key])) fail(`duplicate ${name}: ${value[key]}`);
    seen.add(value[key]);
  }
}

function mcpRecord(value) {
  exactKeys(value, ['oauth_state', 'project_scope'], [], 'mcp');
  oneOf(value.oauth_state, ['connected', 'required', 'unavailable'], 'mcp.oauth_state');
  oneOf(value.project_scope, ['workspace', 'global', 'none'], 'mcp.project_scope');
  return { oauth_state: value.oauth_state, project_scope: value.project_scope, read_only: true };
}

function modelRecord(value) {
  if (!Number.isSafeInteger(value.context_window_tokens) || value.context_window_tokens <= 0) fail('model.context_window_tokens must be a positive integer');
  if (typeof value.tool_rounds_supported !== 'boolean') fail('model.tool_rounds_supported must be boolean');
  return { context_window_tokens: value.context_window_tokens, tool_rounds_supported: value.tool_rounds_supported, read_only: true };
}

function planSpecRecord(value) {
  exactKeys(value, ['commands'], [], 'plan_spec');
  unique(value.commands, 'command_id', 'plan_spec commands');
  const commands = value.commands.map((command, index) => {
    exactKeys(command, ['command_id', 'kind', 'status'], [], `plan_spec.commands[${index}]`);
    identifier(command.command_id, `plan_spec.commands[${index}].command_id`);
    oneOf(command.kind, ['plan', 'spec'], `plan_spec.commands[${index}].kind`);
    oneOf(command.status, ['available', 'unsupported'], `plan_spec.commands[${index}].status`);
    return { ...command, read_only: true };
  });
  if (!['plan', 'spec'].every(kind => commands.some(command => command.kind === kind))) fail('plan_spec must describe plan and spec commands');
  return { commands };
}

function taskRecord(value) {
  exactKeys(value, ['cards', 'subagents', 'retries'], [], 'task');
  unique(value.cards, 'host_card_id', 'task cards');
  unique(value.subagents, 'subagent_id', 'task subagents');
  unique(value.retries, 'retry_id', 'task retries');
  const cards = value.cards.map((card, index) => {
    exactKeys(card, ['host_card_id', 'canonical_task_id', 'status'], [], `task.cards[${index}]`);
    identifier(card.host_card_id, `task.cards[${index}].host_card_id`);
    identifier(card.canonical_task_id, `task.cards[${index}].canonical_task_id`);
    oneOf(card.status, ['pending', 'running', 'failed'], `task.cards[${index}].status`);
    return { host_card_id: card.host_card_id, canonical_task_id: card.canonical_task_id, observed_status: card.status, read_only: true };
  });
  const subagents = value.subagents.map((subagent, index) => {
    exactKeys(subagent, ['subagent_id', 'canonical_task_id', 'status'], [], `task.subagents[${index}]`);
    identifier(subagent.subagent_id, `task.subagents[${index}].subagent_id`);
    identifier(subagent.canonical_task_id, `task.subagents[${index}].canonical_task_id`);
    oneOf(subagent.status, ['running', 'stopped', 'failed'], `task.subagents[${index}].status`);
    return { subagent_id: subagent.subagent_id, canonical_task_id: subagent.canonical_task_id, observed_status: subagent.status, read_only: true };
  });
  const retries = value.retries.map((retry, index) => {
    exactKeys(retry, ['retry_id', 'canonical_task_id', 'attempt', 'status'], [], `task.retries[${index}]`);
    identifier(retry.retry_id, `task.retries[${index}].retry_id`);
    identifier(retry.canonical_task_id, `task.retries[${index}].canonical_task_id`);
    if (!Number.isSafeInteger(retry.attempt) || retry.attempt < 1) fail(`task.retries[${index}].attempt must be a positive integer`);
    if (retry.status === 'complete') fail('retry status complete cannot claim canonical completion');
    oneOf(retry.status, ['pending', 'running', 'failed'], `task.retries[${index}].status`);
    return { retry_id: retry.retry_id, canonical_task_id: retry.canonical_task_id, attempt: retry.attempt, observed_status: retry.status, canonical_completion: 'unclaimed', read_only: true };
  });
  return { cards, subagents, retries };
}

function diffRecord(value) {
  exactKeys(value, ['view_status', 'history'], [], 'diff');
  oneOf(value.view_status, ['open', 'closed', 'unavailable'], 'diff.view_status');
  unique(value.history, 'canonical_diff_id', 'diff history');
  const history = value.history.map((entry, index) => {
    exactKeys(entry, ['canonical_diff_id', 'revision_fingerprint', 'status'], [], `diff.history[${index}]`);
    identifier(entry.canonical_diff_id, `diff.history[${index}].canonical_diff_id`);
    identifier(entry.revision_fingerprint, `diff.history[${index}].revision_fingerprint`, SHA256);
    oneOf(entry.status, ['available', 'closed'], `diff.history[${index}].status`);
    return { ...entry, read_only: true };
  });
  return { view_status: value.view_status, history, read_only: true };
}

function remoteIdentityRecord(value) {
  exactKeys(value, ['host_key_fingerprint', 'profile_fingerprint'], [], 'remote.identity');
  identifier(value.host_key_fingerprint, 'remote.identity.host_key_fingerprint', SHA256);
  identifier(value.profile_fingerprint, 'remote.identity.profile_fingerprint', SHA256);
  return { ...value, read_only: true };
}

function buildSurfaceRecords(snapshot) {
  return {
    sandbox: { filesystem_mode: snapshot.sandbox.filesystem_mode, terminal_mode: snapshot.sandbox.terminal_mode, read_only: true },
    mcp: mcpRecord(snapshot.mcp),
    model: modelRecord(snapshot.model),
    plan_spec: planSpecRecord(snapshot.plan_spec),
    task: taskRecord(snapshot.task),
    diff: diffRecord(snapshot.diff),
    remote_ssh: { identity: remoteIdentityRecord(snapshot.remote.identity), read_only: true },
  };
}

module.exports = { buildSurfaceRecords };
