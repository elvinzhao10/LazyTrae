const fs = require('fs');

const BLOCK_RE = /<!--\s*lazytrae:managed:start:(\w[\w-]*)\s*-->([\s\S]*?)<!--\s*lazytrae:managed:end:\1\s*-->/g;
const MARKER_RE = /<!--\s*lazytrae:managed:(start|end):(\w[\w-]*)\s*-->/g;

function extractBlockNames(content) {
  const names = [];
  const re = new RegExp(BLOCK_RE.source, 'g');
  let match;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

function extractBlock(content, blockName) {
  const re = new RegExp(
    `<!--\\s*lazytrae:managed:start:${escapeRegExp(blockName)}\\s*-->([\\s\\S]*?)<!--\\s*lazytrae:managed:end:${escapeRegExp(blockName)}\\s*-->`,
    'g'
  );
  const match = re.exec(content);
  return match ? match[1] : null;
}

function hasManagedBlock(content, blockName) {
  const re = new RegExp(
    `<!--\\s*lazytrae:managed:start:${escapeRegExp(blockName)}\\s*-->`,
    'g'
  );
  return re.test(content);
}

function replaceBlock(content, blockName, newBlockContent) {
  const re = new RegExp(
    `<!--\\s*lazytrae:managed:start:${escapeRegExp(blockName)}\\s*-->[\\s\\S]*?<!--\\s*lazytrae:managed:end:${escapeRegExp(blockName)}\\s*-->`,
    'g'
  );
  const replacement = `<!-- lazytrae:managed:start:${blockName} -->\n${newBlockContent}\n<!-- lazytrae:managed:end:${blockName} -->`;
  if (re.test(content)) {
    return content.replace(re, replacement);
  }
  return content + replacement;
}

function removeBlock(content, blockName) {
  const re = new RegExp(
    `\\n?<!--\\s*lazytrae:managed:start:${escapeRegExp(blockName)}\\s*-->[\\s\\S]*?<!--\\s*lazytrae:managed:end:${escapeRegExp(blockName)}\\s*-->\\n?`,
    'g'
  );
  return content.replace(re, '\n');
}

function removeAllBlocks(content) {
  const re = new RegExp(
    `<!--\\s*lazytrae:managed:start:[\\w-]+\\s*-->[\\s\\S]*?<!--\\s*lazytrae:managed:end:[\\w-]+\\s*-->\\n?`,
    'g'
  );
  return content.replace(re, '').replace(/\n{3,}/g, '\n\n');
}

function normalizeBlockContent(content) {
  return String(content ?? '').replace(/\r\n/g, '\n').trim();
}

function sameBlockContent(left, right) {
  return normalizeBlockContent(left) === normalizeBlockContent(right);
}

function inspectManagedBlocks(content) {
  const markers = [];
  const re = new RegExp(MARKER_RE.source, 'g');
  let match;
  while ((match = re.exec(content)) !== null) {
    markers.push({ kind: match[1], name: match[2] });
  }

  const counts = new Map();
  for (const marker of markers) {
    const count = counts.get(marker.name) || { start: 0, end: 0 };
    count[marker.kind] += 1;
    counts.set(marker.name, count);
  }
  const malformed = new Set(
    [...counts.entries()]
      .filter(([, count]) => count.start !== 1 || count.end !== 1)
      .map(([name]) => name),
  );

  const stack = [];
  for (const marker of markers) {
    if (marker.kind === 'start') {
      if (stack.length > 0) {
        malformed.add(stack[stack.length - 1]);
        malformed.add(marker.name);
      }
      stack.push(marker.name);
      continue;
    }

    if (stack.length === 0) {
      malformed.add(marker.name);
      continue;
    }

    const expected = stack.pop();
    if (expected !== marker.name) {
      malformed.add(expected);
      malformed.add(marker.name);
    }
  }
  for (const name of stack) malformed.add(name);

  return { names: extractBlockNames(content), malformed: [...malformed], markers };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  extractBlockNames,
  extractBlock,
  hasManagedBlock,
  replaceBlock,
  removeBlock,
  removeAllBlocks,
  normalizeBlockContent,
  sameBlockContent,
  inspectManagedBlocks,
};
