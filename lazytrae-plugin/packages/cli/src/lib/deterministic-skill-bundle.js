'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const FORBIDDEN_CONTENT = /(?:\/Users\/|[A-Za-z]:\\Users\\|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|access[_-]?token|password)\s*[:=]\s*[^<\s][^\s]*)/i;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function collectSkills(sourceDir) {
  const root = fs.realpathSync(sourceDir);
  if (fs.lstatSync(sourceDir).isSymbolicLink()) {
    throw new Error('Canonical Skills source must not be a symlink.');
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('lazy-'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => {
      const skillDir = path.join(root, entry.name);
      const skillPath = path.join(skillDir, 'SKILL.md');
      if (fs.lstatSync(skillDir).isSymbolicLink() || !fs.existsSync(skillPath)) {
        throw new Error(`Canonical Skill '${entry.name}' is incomplete or linked.`);
      }
      const stat = fs.lstatSync(skillPath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
        throw new Error(`Canonical Skill '${entry.name}' must be one regular, unlinked SKILL.md.`);
      }
      const content = fs.readFileSync(skillPath);
      if (FORBIDDEN_CONTENT.test(content.toString('utf8'))) {
        throw new Error(`Canonical Skill '${entry.name}' contains a path or credential-shaped value.`);
      }
      return { name: entry.name, path: `${entry.name}/SKILL.md`, content };
    });
}

function zipEntries(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const checksum = crc32(entry.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(entry.content.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, entry.content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(entry.content.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0x81a40000, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.content.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

function writeBundle(sourceDir, outputPath) {
  if (!path.isAbsolute(outputPath)) throw new Error('--output must be an absolute .skill path.');
  if (path.extname(outputPath) !== '.skill') throw new Error('--output must end in .skill.');
  const parent = path.dirname(outputPath);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('Bundle output directory must already exist.');
  if (fs.existsSync(outputPath) && fs.lstatSync(outputPath).isSymbolicLink()) {
    throw new Error('Refusing to replace a symlinked bundle output.');
  }
  const skills = collectSkills(sourceDir);
  if (skills.length === 0) throw new Error('Canonical Skills source is empty.');
  const manifest = Buffer.from(`${JSON.stringify({ schema_version: 1, format: 'trae-work-skill-bundle', skills: skills.map(skill => ({ name: skill.name, sha256: crypto.createHash('sha256').update(skill.content).digest('hex') })) }, null, 2)}\n`);
  const bundle = zipEntries([{ path: 'manifest.json', content: manifest }, ...skills]);
  const temporary = path.join(parent, `.${path.basename(outputPath)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(temporary, bundle, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, outputPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return { bytes: bundle.length, sha256: crypto.createHash('sha256').update(bundle).digest('hex'), skills: skills.length };
}

module.exports = { collectSkills, writeBundle, zipEntries };
