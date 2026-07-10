const fs = require('fs');

const BLOCK_RE = /<!--\s*lazytrae:managed:start:(\w[\w-]*)\s*-->([\s\S]*?)<!--\s*lazytrae:managed:end:\1\s*-->/g;

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
  return content + '\n\n' + replacement;
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
    `\\n?<!--\\s*lazytrae:managed:start:[\\w-]+\\s*-->[\\s\\S]*?<!--\\s*lazytrae:managed:end:[\\w-]+\\s*-->\\n?`,
    'g'
  );
  return content.replace(re, '\n').replace(/\n{3,}/g, '\n\n');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { extractBlockNames, extractBlock, hasManagedBlock, replaceBlock, removeBlock, removeAllBlocks };