'use strict';

function invalidJson() {
  return new Error('Invalid .trae/mcp.json; repair the JSON or remove the file before retrying init/sync.');
}

function stringEnd(content, start) {
  let escaped = false;
  for (let index = start + 1; index < content.length; index += 1) {
    if (!escaped && content[index] === '"') return index + 1;
    if (!escaped && content[index] === '\\') escaped = true;
    else escaped = false;
  }
  throw invalidJson();
}

function valueEnd(content, start, limit) {
  if (content[start] === '"') return stringEnd(content, start);
  if (content[start] !== '{' && content[start] !== '[') {
    let index = start;
    while (index < limit && !',}]'.includes(content[index])) index += 1;
    return index;
  }
  const pairs = { '{': '}', '[': ']' };
  const stack = [pairs[content[start]]];
  for (let index = start + 1; index < limit; index += 1) {
    if (content[index] === '"') {
      index = stringEnd(content, index) - 1;
    } else if (content[index] === '{' || content[index] === '[') {
      stack.push(pairs[content[index]]);
    } else if (content[index] === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }
  throw invalidJson();
}

function propertySpans(content, key, start, end) {
  const spans = [];
  let index = start + 1;
  while (index < end - 1) {
    while (index < end - 1 && /[\s,]/.test(content[index])) index += 1;
    if (index >= end - 1) break;
    if (content[index] !== '"') throw invalidJson();
    const tokenEnd = stringEnd(content, index);
    const token = JSON.parse(content.slice(index, tokenEnd));
    let colon = tokenEnd;
    while (colon < end && /\s/.test(content[colon])) colon += 1;
    if (content[colon] !== ':') throw invalidJson();
    let valueStart = colon + 1;
    while (valueStart < end && /\s/.test(content[valueStart])) valueStart += 1;
    const endOfValue = valueEnd(content, valueStart, end);
    if (token === key) spans.push({ valueStart, valueEnd: endOfValue });
    index = endOfValue;
  }
  return spans;
}

function managedSpans(content) {
  const objectStart = content.indexOf('{');
  const objectEnd = content.lastIndexOf('}') + 1;
  const roots = propertySpans(content, 'mcpServers', objectStart, objectEnd);
  if (roots.length > 1) throw new Error('Duplicate mcpServers keys in .trae/mcp.json; repair the file before retrying init/sync.');
  if (roots.length === 0) return { root: null, managed: null };
  const root = roots[0];
  const managed = propertySpans(content, 'lazytrae', root.valueStart, root.valueEnd);
  if (managed.length > 1) throw new Error('Duplicate LazyTrae entries in .trae/mcp.json; repair the file before retrying init/sync.');
  return { root, managed: managed[0] || null };
}

function insertProperty(content, objectSpan, key, value) {
  const close = objectSpan.valueEnd - 1;
  const object = JSON.parse(content.slice(objectSpan.valueStart, objectSpan.valueEnd));
  const separator = Object.keys(object).length === 0 ? '' : ',';
  return `${content.slice(0, close)}${separator}\n    ${JSON.stringify(key)}: ${value}\n  ${content.slice(close)}`;
}

function assertUniqueManagedEntry(content) {
  managedSpans(content);
}

function replaceManagedEntry(content, server) {
  const spans = managedSpans(content);
  const value = JSON.stringify(server, null, 2);
  if (spans.managed) {
    return `${content.slice(0, spans.managed.valueStart)}${value}${content.slice(spans.managed.valueEnd)}`;
  }
  if (spans.root) return insertProperty(content, spans.root, 'lazytrae', value);
  const root = { valueStart: content.indexOf('{'), valueEnd: content.lastIndexOf('}') + 1 };
  return insertProperty(content, root, 'mcpServers', `{\n    "lazytrae": ${value}\n  }`);
}

module.exports = { assertUniqueManagedEntry, replaceManagedEntry };
