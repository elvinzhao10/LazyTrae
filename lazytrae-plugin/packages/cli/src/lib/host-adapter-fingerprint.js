'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalDigest(value) {
  return sha256(Buffer.from(JSON.stringify(value)));
}

function fileMaterial(target) {
  try {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) return { status: 'conflict', sha256: canonicalDigest('symlink') };
    if (stat.isFile()) return { status: 'ready', sha256: sha256(fs.readFileSync(target)) };
    if (!stat.isDirectory()) return { status: 'conflict', sha256: canonicalDigest('special') };
    const entries = fs.readdirSync(target, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(entry => ({ name: entry.name, material: fileMaterial(path.join(target, entry.name)) }));
    return { status: entries.some(entry => entry.material.status === 'conflict') ? 'conflict' : 'ready', sha256: canonicalDigest(entries) };
  } catch (error) {
    return error.code === 'ENOENT'
      ? { status: 'missing', sha256: canonicalDigest('missing') }
      : { status: 'conflict', sha256: canonicalDigest(`error:${error.code || 'unknown'}`) };
  }
}

function packageMaterial(packageRoot, route) {
  const paths = route.package_paths.map(relative => ({ relative, ...fileMaterial(path.join(packageRoot, relative)) }));
  return { paths, sha256: canonicalDigest(paths) };
}

function generatedMaterial(repoRoot, route, status, workSkillsDir) {
  if (route.host === 'trae-work') {
    const target = workSkillsDir || '__missing_work_skills_dir__';
    return { ...status, target, sha256: canonicalDigest({ status, material: fileMaterial(target) }) };
  }
  const receipt = path.join(repoRoot, route.generated_receipt);
  const receiptMaterial = fileMaterial(receipt);
  let files = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    files = Array.isArray(parsed.files) ? parsed.files
      .filter(entry => entry && typeof entry.path === 'string' && !path.isAbsolute(entry.path) && !entry.path.split('/').includes('..'))
      .map(entry => ({ relative: entry.path, ...fileMaterial(path.join(repoRoot, entry.path)) }))
      .sort((left, right) => left.relative.localeCompare(right.relative)) : [];
  } catch (_) {
    files = [];
  }
  return { ...status, receipt: receiptMaterial, files, sha256: canonicalDigest({ status, receipt: receiptMaterial, files }) };
}

function jsonMaterial(target) {
  const material = fileMaterial(target);
  let value = null;
  if (material.status === 'ready') {
    try { value = JSON.parse(fs.readFileSync(target, 'utf8')); } catch (_) { material.status = 'conflict'; }
  }
  return { ...material, value };
}

module.exports = { canonicalDigest, fileMaterial, generatedMaterial, jsonMaterial, packageMaterial, sha256 };
