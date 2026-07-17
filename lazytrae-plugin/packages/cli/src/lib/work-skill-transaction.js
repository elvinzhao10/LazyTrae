const fs = require('fs');
const path = require('path');

const STAGING_PREFIX = '.lazytrae-work-install-';

function rejectSymlink(target) {
  try {
    if (!fs.lstatSync(target).isSymbolicLink()) return;
    throw new Error(`Refusing to write through symlinked global skill path: ${target}`);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
}

function rejectHardLinkedFile(target) {
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.nlink <= 1) return;
    throw new Error(`Refusing to write through hard-linked global skill file: ${target}`);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
}

function assertSafeSkillPath(skillsDir, name) {
  const destinationDir = path.join(skillsDir, name);
  const destination = path.join(destinationDir, 'SKILL.md');
  rejectSymlink(skillsDir);
  rejectSymlink(destinationDir);
  rejectSymlink(destination);
  rejectHardLinkedFile(destination);
  return { destination, destinationDir };
}

function destinationSnapshot(destination) {
  let stat;
  try {
    stat = fs.lstatSync(destination);
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, content: Buffer.alloc(0), mode: 0 };
    throw error;
  }
  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to write through symlinked global skill path: ${destination}`);
  }
  if (!stat.isFile()) throw new Error(`Refusing to replace non-file global skill path: ${destination}`);
  if (stat.nlink > 1) {
    throw new Error(`Refusing to write through hard-linked global skill file: ${destination}`);
  }
  return {
    exists: true,
    content: fs.readFileSync(destination),
    mode: stat.mode & 0o777,
  };
}

function sourceSnapshot(source) {
  const stat = fs.statSync(source);
  if (!stat.isFile()) throw new Error(`Work skill source is not a file: ${source}`);
  return { exists: true, content: fs.readFileSync(source), mode: stat.mode & 0o777 };
}

function snapshotsMatch(left, right) {
  return left.exists === right.exists
    && (!left.exists || (left.mode === right.mode && left.content.equals(right.content)));
}

function skillState(source, destination) {
  const current = destinationSnapshot(destination);
  if (!current.exists) return 'missing';
  return current.content.equals(sourceSnapshot(source).content) ? 'current' : 'outdated';
}

function cleanupStaging(staging) {
  try {
    const stat = fs.lstatSync(staging);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error('Work skill staging root was replaced; preserved for inspection');
    }
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  fs.rmSync(staging, { recursive: true, force: true });
}

function restoreMovedOriginal(entry) {
  if (!entry.originalMoved || fs.existsSync(entry.destination)) return;
  fs.renameSync(entry.backup, entry.destination);
  entry.originalMoved = false;
}

function detachStagedLink(entry) {
  if (!entry.stagedLinkExists) return;
  fs.unlinkSync(entry.next);
  entry.stagedLinkExists = false;
}

function rollbackEntry(entry) {
  detachStagedLink(entry);
  if (entry.promoted) {
    const current = destinationSnapshot(entry.destination);
    if (snapshotsMatch(current, entry.after)) {
      if (entry.before.exists) {
        fs.renameSync(entry.backup, entry.destination);
        entry.originalMoved = false;
      } else {
        fs.unlinkSync(entry.destination);
      }
    }
  } else {
    restoreMovedOriginal(entry);
  }

  if (entry.createdDirectory && fs.existsSync(entry.destinationDir)
    && fs.readdirSync(entry.destinationDir).length === 0) {
    fs.rmdirSync(entry.destinationDir);
  }
}

function rollback(entries) {
  const errors = [];
  for (const entry of [...entries].reverse()) {
    try {
      rollbackEntry(entry);
    } catch (error) {
      errors.push(new Error(`rollback for ${entry.name} failed: ${error.message}`, { cause: error }));
    }
  }
  return errors;
}

function promote(entry, mutations, skillsDir) {
  assertSafeSkillPath(skillsDir, entry.name);
  if (!snapshotsMatch(destinationSnapshot(entry.destination), entry.before)) {
    throw new Error(`Work skill changed before promotion; preserved caller content: ${entry.destination}`);
  }

  entry.createdDirectory = !fs.existsSync(entry.destinationDir);
  fs.mkdirSync(entry.destinationDir, { recursive: true });
  assertSafeSkillPath(skillsDir, entry.name);

  if (entry.before.exists) {
    fs.renameSync(entry.destination, entry.backup);
    entry.originalMoved = true;
  }
  mutations.push(entry);

  if (entry.originalMoved && !snapshotsMatch(destinationSnapshot(entry.backup), entry.before)) {
    restoreMovedOriginal(entry);
    throw new Error(`Work skill changed during promotion; preserved caller content: ${entry.destination}`);
  }

  fs.linkSync(entry.next, entry.destination);
  entry.promoted = true;
  entry.stagedLinkExists = true;
  detachStagedLink(entry);
}

function transactionFailure(errors) {
  const details = errors.map(error => error.message).join('; ');
  return new AggregateError(errors, `Work skill installation failed: ${details}`);
}

function installWorkSkills(skillsDir, skills) {
  rejectSymlink(skillsDir);
  fs.mkdirSync(skillsDir, { recursive: true });
  rejectSymlink(skillsDir);

  const entries = skills.map(({ name, source }, index) => {
    const { destination, destinationDir } = assertSafeSkillPath(skillsDir, name);
    const before = destinationSnapshot(destination);
    const after = sourceSnapshot(source);
    return { after, before, destination, destinationDir, index, name, source };
  });
  const changed = entries.filter(entry => !entry.before.exists || !entry.before.content.equals(entry.after.content));
  const result = {
    installed: changed.filter(entry => !entry.before.exists).length,
    updated: changed.filter(entry => entry.before.exists).length,
    unchanged: entries.length - changed.length,
  };
  if (changed.length === 0) return result;

  let staging;
  const mutations = [];
  try {
    staging = fs.mkdtempSync(path.join(skillsDir, STAGING_PREFIX));
    for (const entry of changed) {
      entry.next = path.join(staging, `${entry.index}.next`);
      entry.backup = path.join(staging, `${entry.index}.previous`);
      fs.copyFileSync(entry.source, entry.next);
      fs.chmodSync(entry.next, entry.after.mode);
    }
    for (const entry of changed) promote(entry, mutations, skillsDir);
    cleanupStaging(staging);
    return result;
  } catch (error) {
    const errors = [error, ...rollback(mutations)];
    if (staging) {
      try {
        cleanupStaging(staging);
      } catch (cleanupError) {
        errors.push(new Error(`staging cleanup failed: ${cleanupError.message}`, { cause: cleanupError }));
      }
    }
    throw transactionFailure(errors);
  }
}

module.exports = {
  STAGING_PREFIX,
  assertSafeSkillPath,
  installWorkSkills,
  rejectHardLinkedFile,
  rejectSymlink,
  skillState,
};
