const fs = require('fs');
const path = require('path');
const { assertSafeRepoWritePath } = require('./path-boundary');
const { atomicWriteFile, readExistingFile } = require('./safe-write');

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates');

function readTemplate(relativePath) {
  const fullPath = path.join(TEMPLATES_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf-8');
}

function readTemplateDir(relativePath) {
  const fullPath = path.join(TEMPLATES_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const result = {};
  for (const entry of entries) {
    if (entry.isFile()) {
      result[entry.name] = fs.readFileSync(path.join(fullPath, entry.name), 'utf-8');
    } else if (entry.isDirectory()) {
      result[entry.name] = readTemplateDir(path.join(relativePath, entry.name));
    }
  }
  return result;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFileIfChanged(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) {
    const srcContent = fs.readFileSync(src, 'utf-8');
    const destContent = fs.readFileSync(dest, 'utf-8');
    if (srcContent === destContent) return false;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return true;
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return { created: 0, updated: 0 };
  ensureDir(dest);
  let created = 0;
  let updated = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const result = copyDir(srcPath, destPath);
      created += result.created;
      updated += result.updated;
    } else {
      if (fs.existsSync(destPath)) {
        const srcContent = fs.readFileSync(srcPath, 'utf-8');
        const destContent = fs.readFileSync(destPath, 'utf-8');
        if (srcContent !== destContent) {
          fs.copyFileSync(srcPath, destPath);
          updated++;
        }
      } else {
        ensureDir(dest);
        fs.copyFileSync(srcPath, destPath);
        created++;
      }
    }
  }
  return { created, updated };
}

function ensureRepoDir(repoRoot, dirPath) {
  assertSafeRepoWritePath(repoRoot, dirPath);
  ensureDir(dirPath);
}

function copyRepoFileIfChanged(repoRoot, src, dest) {
  assertSafeRepoWritePath(repoRoot, dest);
  const sourceContent = fs.readFileSync(src, 'utf-8');
  const existing = readExistingFile(repoRoot, dest, 'utf-8');
  if (existing.exists && existing.content === sourceContent) return false;
  atomicWriteFile(repoRoot, dest, sourceContent, 'utf-8', fs.statSync(src).mode & 0o777);
  return true;
}

function copyRepoDir(repoRoot, src, dest, { overwrite = true } = {}) {
  if (!fs.existsSync(src)) return { created: 0, updated: 0, skipped: 0 };
  ensureRepoDir(repoRoot, dest);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const result = copyRepoDir(repoRoot, srcPath, destPath, { overwrite });
      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
    } else {
      const existing = readExistingFile(repoRoot, destPath, 'utf-8');
      if (!overwrite && existing.exists && existing.content !== fs.readFileSync(srcPath, 'utf-8')) {
        skipped++;
        continue;
      }
      const existed = fs.existsSync(destPath);
      if (copyRepoFileIfChanged(repoRoot, srcPath, destPath)) {
        if (existed) updated++;
        else created++;
      }
    }
  }
  return { created, updated, skipped };
}

function writeRepoFile(repoRoot, filePath, content, encoding = 'utf-8', mode) {
  atomicWriteFile(repoRoot, filePath, content, encoding, mode);
}

function copyRepoFile(repoRoot, src, dest) {
  atomicWriteFile(repoRoot, dest, fs.readFileSync(src));
}

function chmodRepoFile(repoRoot, filePath, mode) {
  assertSafeRepoWritePath(repoRoot, filePath);
  fs.chmodSync(filePath, mode);
}

module.exports = {
  TEMPLATES_DIR, readTemplate, readTemplateDir, ensureDir, copyFileIfChanged, copyDir,
  ensureRepoDir, copyRepoFileIfChanged, copyRepoDir, writeRepoFile, copyRepoFile, chmodRepoFile,
};
