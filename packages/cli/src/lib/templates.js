const fs = require('fs');
const path = require('path');

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

module.exports = { TEMPLATES_DIR, readTemplate, readTemplateDir, ensureDir, copyFileIfChanged, copyDir };