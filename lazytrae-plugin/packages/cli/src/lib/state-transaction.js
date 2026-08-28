const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { assertSafeRepoWritePath } = require('./path-boundary');

const HASH = /^[a-f0-9]{64}$/;
const WAIT_BUFFER = new Int32Array(new SharedArrayBuffer(4));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileHash(filePath) {
  return fs.existsSync(filePath) ? sha256(fs.readFileSync(filePath)) : null;
}

function transactionRoot(repoRoot) {
  return path.join(repoRoot, '.lazytrae', 'state', 'transactions');
}

function syncDirectory(directory) {
  let descriptor;
  try {
    descriptor = fs.openSync(directory, 'r');
    fs.fsyncSync(descriptor);
  } catch (error) {
    if (!['EINVAL', 'EPERM', 'EBADF'].includes(error.code)) throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function durableWrite(repoRoot, filePath, content) {
  assertSafeRepoWritePath(repoRoot, filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function replaceJournal(repoRoot, txDir, journal) {
  const target = path.join(txDir, 'journal.json');
  const temporary = path.join(txDir, 'journal.tmp');
  fs.rmSync(temporary, { force: true });
  durableWrite(repoRoot, temporary, `${JSON.stringify(journal, null, 2)}\n`);
  fs.renameSync(temporary, target);
  syncDirectory(txDir);
}

function crashAt(boundary) {
  if (process.env.LAZYTRAE_TRANSACTION_CRASH_AT === boundary) process.exit(86);
}

function runKey(runId) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    throw new Error('Transaction run_id must be a safe path segment.');
  }
  return sha256(runId).slice(0, 32);
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function withRunLock(repoRoot, key, callback) {
  const locks = path.join(transactionRoot(repoRoot), 'locks');
  assertSafeRepoWritePath(repoRoot, locks);
  fs.mkdirSync(locks, { recursive: true });
  const lockDir = path.join(locks, `${key}.lock`);
  const deadline = Date.now() + 10000;
  while (true) {
    try {
      fs.mkdirSync(lockDir);
      durableWrite(repoRoot, path.join(lockDir, 'owner.json'), `${JSON.stringify({ pid: process.pid, key })}\n`);
      syncDirectory(locks);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner = null;
      try { owner = JSON.parse(fs.readFileSync(path.join(lockDir, 'owner.json'), 'utf8')); } catch {}
      if (owner && owner.key === key && Number.isSafeInteger(owner.pid) && !processAlive(owner.pid)) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        continue;
      }
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for transaction lock ${key}.`);
      Atomics.wait(WAIT_BUFFER, 0, 0, 10);
    }
  }
  try {
    return callback();
  } finally {
    fs.rmSync(lockDir, { recursive: true, force: true });
    syncDirectory(locks);
  }
}

function readJournal(txDir) {
  const journalPath = path.join(txDir, 'journal.json');
  let journal;
  try {
    journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unreadable transaction journal at ${journalPath}: ${error.message}`);
  }
  const valid = journal && journal.version === 1
    && journal.tx_id === path.basename(txDir)
    && typeof journal.run_id === 'string' && journal.run_key === runKey(journal.run_id)
    && ['staged', 'committed'].includes(journal.status)
    && Array.isArray(journal.members) && journal.members.length > 0
    && journal.members.every((member, index) => member && member.stage === `member-${index}`
      && typeof member.target === 'string' && !path.isAbsolute(member.target)
      && (member.before_sha256 === null || HASH.test(member.before_sha256))
      && HASH.test(member.after_sha256));
  if (!valid) throw new Error(`Invalid transaction journal at ${journalPath}.`);
  return journal;
}

function cleanupTransaction(txDir, journalsRoot) {
  fs.rmSync(txDir, { recursive: true, force: true });
  syncDirectory(journalsRoot);
}

function recoverJournal(repoRoot, txDir, journal, injectFaults = false) {
  const journalsRoot = path.dirname(txDir);
  const members = journal.members.map(member => {
    const target = assertSafeRepoWritePath(repoRoot, path.resolve(repoRoot, member.target));
    const stage = path.join(txDir, member.stage);
    assertSafeRepoWritePath(repoRoot, stage);
    return { ...member, target, stage, targetHash: fileHash(target) };
  });
  if (journal.status === 'staged') {
    const inconsistent = members.find(member => member.targetHash !== member.before_sha256);
    if (inconsistent) throw new Error(`Hash-inconsistent uncommitted transaction journal for ${inconsistent.target}.`);
    cleanupTransaction(txDir, journalsRoot);
    return;
  }
  for (const member of members) {
    if (member.targetHash === member.after_sha256) continue;
    if (member.targetHash !== member.before_sha256 || fileHash(member.stage) !== member.after_sha256) {
      throw new Error(`Hash-inconsistent committed transaction journal for ${member.target}.`);
    }
  }
  members.forEach((member, index) => {
    if (member.targetHash !== member.after_sha256) {
      fs.mkdirSync(path.dirname(member.target), { recursive: true });
      assertSafeRepoWritePath(repoRoot, member.target);
      fs.renameSync(member.stage, member.target);
      syncDirectory(path.dirname(member.target));
    }
    if (injectFaults) crashAt(`install:${index + 1}`);
  });
  cleanupTransaction(txDir, journalsRoot);
}

function recoverRunLocked(repoRoot, key) {
  const journals = path.join(transactionRoot(repoRoot), 'journals');
  if (!fs.existsSync(journals)) return;
  for (const entry of fs.readdirSync(journals).sort()) {
    if (!entry.startsWith(`${key}-`)) continue;
    const txDir = path.join(journals, entry);
    const journalPath = path.join(txDir, 'journal.json');
    if (!fs.existsSync(journalPath)) cleanupTransaction(txDir, journals);
    else recoverJournal(repoRoot, txDir, readJournal(txDir));
  }
}

function recoverTransactions(repoRoot) {
  const journals = path.join(transactionRoot(repoRoot), 'journals');
  if (!fs.existsSync(journals)) return;
  for (const entry of fs.readdirSync(journals).sort()) {
    const txDir = path.join(journals, entry);
    if (!fs.existsSync(txDir)) continue;
    if (!fs.statSync(txDir).isDirectory()) throw new Error(`Invalid transaction journal entry at ${txDir}.`);
    const journalPath = path.join(txDir, 'journal.json');
    if (!fs.existsSync(journalPath)) {
      const match = /^([a-f0-9]{32})-/.exec(entry);
      if (!match) throw new Error(`Unreadable transaction journal at ${journalPath}.`);
      withRunLock(repoRoot, match[1], () => recoverRunLocked(repoRoot, match[1]));
      continue;
    }
    const journal = readJournal(txDir);
    withRunLock(repoRoot, journal.run_key, () => recoverRunLocked(repoRoot, journal.run_key));
  }
}

function runTransaction(repoRoot, runId, prepare) {
  const key = runKey(runId);
  return withRunLock(repoRoot, key, () => {
    recoverRunLocked(repoRoot, key);
    const prepared = prepare();
    if (!prepared || !Array.isArray(prepared.members) || prepared.members.length === 0) {
      throw new Error('Transaction must contain at least one member.');
    }
    const journals = path.join(transactionRoot(repoRoot), 'journals');
    assertSafeRepoWritePath(repoRoot, journals);
    fs.mkdirSync(journals, { recursive: true });
    const txId = `${key}-${crypto.randomUUID()}`;
    const txDir = path.join(journals, txId);
    fs.mkdirSync(txDir);
    syncDirectory(journals);
    const members = prepared.members.map((member, index) => {
      const target = assertSafeRepoWritePath(repoRoot, member.path);
      const relative = path.relative(path.resolve(repoRoot), target);
      const content = Buffer.isBuffer(member.content) ? member.content : Buffer.from(member.content);
      const stage = `member-${index}`;
      durableWrite(repoRoot, path.join(txDir, stage), content);
      crashAt(`stage:${index + 1}`);
      return { target: relative, stage, before_sha256: fileHash(target), after_sha256: sha256(content) };
    });
    const journal = { version: 1, tx_id: txId, run_id: runId, run_key: key, status: 'staged', members };
    replaceJournal(repoRoot, txDir, journal);
    crashAt('journal');
    journal.status = 'committed';
    replaceJournal(repoRoot, txDir, journal);
    crashAt('commit');
    recoverJournal(repoRoot, txDir, journal, true);
    return prepared.result;
  });
}

module.exports = { recoverTransactions, runTransaction };
