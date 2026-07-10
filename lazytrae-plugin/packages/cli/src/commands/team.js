const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assertSafeRepoWritePath } = require('../lib/path-boundary');

const LENSES = ['area', 'ownership', 'perspective'];
const MIN_MEMBERS = 2;

function teamDir(root) { return path.join(root, '.lazytrae', 'team'); }
function teamPath(root) { return path.join(teamDir(root), 'team.json'); }
function memberDir(root, id) { return path.join(teamDir(root), 'members', id); }

function readTeam(root) {
  const tp = teamPath(root);
  return fs.existsSync(tp) ? JSON.parse(fs.readFileSync(tp, 'utf-8')) : null;
}

function writeTeam(root, team) {
  team.updatedAt = new Date().toISOString();
  assertSafeRepoWritePath(root, teamPath(root));
  fs.writeFileSync(teamPath(root), JSON.stringify(team, null, 2) + '\n');
}

function appendLog(team, event, detail) {
  team.log.push({ ts: new Date().toISOString(), event, detail });
}

function norm(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

function printUsage() {
  console.log(`Usage: lazytrae team <command> [options]

Commands:
  create   --name "<team>" [--session <id>] [--worktree] [--base-branch <branch>]
  spawn    <team-id> --id <id> --name "<role>" --focus "<slice>" --lens area|ownership|perspective --deliverable "<...>" [--branch <branch>]
  status   [<team-id>]
  collect  <team-id>
  archive  <team-id> [--note "<...>"]
  delete   <team-id> [--force]
`);
}

function repoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function ensureTeamDirs(root) {
  const td = teamDir(root);
  assertSafeRepoWritePath(root, td);
  ['', 'members', 'mailbox', 'worktrees'].forEach(d => {
    const dp = path.join(td, d);
    assertSafeRepoWritePath(root, dp);
    if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
  });
}

function cmdCreate(args, root) {
  let teamName = '', sessionId = null, worktree = false, baseBranch = 'dev';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) teamName = args[++i];
    else if (args[i] === '--session' && args[i + 1]) sessionId = args[++i];
    else if (args[i] === '--worktree') worktree = true;
    else if (args[i] === '--base-branch' && args[i + 1]) baseBranch = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') { printUsage(); return; }
  }
  if (!teamName) { console.error('Error: --name is required'); process.exit(1); }
  if (fs.existsSync(teamPath(root))) { console.log(`Team already exists at ${teamPath(root)}`); return; }

  ensureTeamDirs(root);
  const now = new Date().toISOString();
  const team = {
    schemaVersion: 2, teamId: crypto.randomUUID(), teamName: teamName.trim(),
    sessionName: `team-${teamName.trim()}`, sessionId,
    threadTitleConvention: `[${teamName.trim()}] <member name>`,
    status: 'active', createdAt: now, updatedAt: now, archivedAt: null,
    leader: { kind: 'main-session', sessionId },
    communication: { memberLanguage: 'english', replyToUserInUserLanguage: true },
    worktree: { enabled: worktree, baseBranch, root: worktree ? path.join(teamDir(root), 'worktrees') : null },
    members: [],
    log: [{ ts: now, event: 'created', detail: `team ${teamName.trim()}` }],
  };
  writeTeam(root, team);
  console.log(`Team "${teamName}" created (id: ${team.teamId})`);
  console.log(`State: ${teamPath(root)}`);
}

function cmdSpawn(args, root) {
  const team = readTeam(root);
  if (!team) { console.error('Error: No team found. Run "lazytrae team create" first.'); process.exit(1); }
  if (team.status === 'archived') { console.error('Error: Cannot spawn members into an archived team.'); process.exit(1); }

  let id = '', name = '', focus = '', lens = '', deliverable = '', branch = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && args[i + 1]) id = args[++i];
    else if (args[i] === '--name' && args[i + 1]) name = args[++i];
    else if (args[i] === '--focus' && args[i + 1]) focus = args[++i];
    else if (args[i] === '--lens' && args[i + 1]) lens = args[++i];
    else if (args[i] === '--deliverable' && args[i + 1]) deliverable = args[++i];
    else if (args[i] === '--branch' && args[i + 1]) branch = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') { printUsage(); return; }
  }
  if (!id || !focus || !lens) { console.error('Error: --id, --focus, and --lens are required'); process.exit(1); }
  if (!LENSES.includes(lens)) { console.error(`Error: Invalid lens "${lens}". Use one of: ${LENSES.join(', ')}`); process.exit(1); }

  const memberId = id.trim(), memberFocus = focus.trim();
  const memberName = name.trim() || memberFocus;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(memberId)) { console.error('Error: --id must use letters, numbers, hyphens, or underscores'); process.exit(1); }
  if (team.members.some(m => m.id === memberId)) { console.error(`Error: Member id "${memberId}" already exists`); process.exit(1); }
  if (team.members.find(m => norm(m.focus) === norm(memberFocus))) { console.error(`Error: Member focus "${memberFocus}" duplicates existing member`); process.exit(1); }
  if (team.members.find(m => norm(m.name || m.focus || '') === norm(memberName))) { console.error(`Error: Member name "${memberName}" duplicates existing member`); process.exit(1); }

  const member = {
    id: memberId, name: memberName, focus: memberFocus, lens,
    deliverable: deliverable.trim(), threadId: null,
    threadTitle: `[${team.teamName}] ${memberName}`,
    cwd: null, worktree: { path: null, branch }, status: 'pending',
  };
  team.members.push(member);
  if (branch) {
    team.worktree.enabled = true;
    if (!team.worktree.root) team.worktree.root = path.join(teamDir(root), 'worktrees');
  }
  appendLog(team, 'add-member', `member ${memberId} (${lens}): ${memberFocus}`);
  writeTeam(root, team);

  const md = memberDir(root, memberId);
  assertSafeRepoWritePath(root, md);
  if (!fs.existsSync(md)) fs.mkdirSync(md, { recursive: true });
  const mb = path.join(teamDir(root), 'mailbox', memberId);
  assertSafeRepoWritePath(root, mb);
  if (!fs.existsSync(mb)) fs.mkdirSync(mb, { recursive: true });

  console.log(`Member "${memberName}" (id: ${memberId}) added to "${team.teamName}"`);
  console.log(`  Lens: ${lens} | Focus: ${memberFocus} | Title: ${member.threadTitle}`);
  console.log(`  Deliverable: ${deliverable.trim() || '(none)'}`);
}

function cmdStatus(args, root) {
  const team = readTeam(root);
  if (!team) { console.error('Error: No team found.'); process.exit(1); }

  console.log(`Team: ${team.teamName} (${team.teamId})`);
  console.log(`Status: ${team.status} | Members: ${team.members.length} | Worktree: ${team.worktree.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Created: ${team.createdAt} | Updated: ${team.updatedAt}\n`);

  if (team.members.length === 0) {
    console.log('No members (minimum 2 required).');
    return;
  }
  console.log('Members:');
  for (const m of team.members) {
    const icon = { reported: '✓', blocked: '✗', active: '●' }[m.status] || '○';
    console.log(`  ${icon} [${m.id}] ${m.name} — ${m.focus} (${m.lens}) — ${m.status}`);
    if (m.worktree.branch) console.log(`       worktree: ${m.worktree.branch}${m.worktree.path ? ' @ ' + m.worktree.path : ''}`);
  }
}

function cmdCollect(args, root) {
  const team = readTeam(root);
  if (!team) { console.error('Error: No team found.'); process.exit(1); }
  if (team.members.length === 0) { console.error('Error: No members to collect from.'); process.exit(1); }

  console.log(`=== Synthesis Digest for "${team.teamName}" ===\n`);

  let totalReports = 0;
  for (const m of team.members) {
    const rp = path.join(memberDir(root, m.id), 'report.md');
    if (fs.existsSync(rp)) {
      totalReports++;
      const content = fs.readFileSync(rp, 'utf-8').trim();
      const preview = content.length > 400 ? content.slice(0, 397) + '...' : content;
      console.log(`--- ${m.name} (${m.id}) [${m.lens}: ${m.focus}] ---`);
      console.log(preview);
      const mb = path.join(teamDir(root), 'mailbox', m.id, 'outbox.md');
      if (fs.existsSync(mb)) {
        const hb = fs.readFileSync(mb, 'utf-8').trim();
        if (hb) console.log(`  Heartbeat: ${hb.slice(0, 120)}`);
      }
      console.log('');
    }
  }

  const unreported = team.members.filter(m => !fs.existsSync(path.join(memberDir(root, m.id), 'report.md')));
  if (unreported.length > 0) console.log(`Members without reports: ${unreported.map(m => m.id).join(', ')}`);

  console.log(`---`);
  console.log(`Total members: ${team.members.length} | Reports: ${totalReports} | Unreported: ${unreported.length}`);
  console.log(`\nTo synthesize: review each report, resolve conflicts, integrate into final deliverable.`);
}

function cmdArchive(args, root) {
  const team = readTeam(root);
  if (!team) { console.error('Error: No team found.'); process.exit(1); }
  if (team.status === 'archived') { console.log('Team is already archived.'); return; }

  let note = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--note' && args[i + 1]) note = args[++i];
  }
  for (const m of team.members) m.status = 'archived';
  team.status = 'archived';
  team.archivedAt = new Date().toISOString();
  appendLog(team, 'archive', note || 'team archived; all members closed');
  writeTeam(root, team);
  console.log(`Team "${team.teamName}" archived.${note ? ` Note: ${note}` : ''}`);
}

function cmdDelete(args, root) {
  const team = readTeam(root);
  if (!team) { console.error('Error: No team found.'); process.exit(1); }

  const force = args.includes('--force');
  if (team.status !== 'archived' && !force) {
    console.error('Error: Cannot delete an unarchived team. Archive first, or use --force.');
    process.exit(1);
  }
  const active = team.members.filter(m => !['archived', 'reported'].includes(m.status));
  if (active.length > 0 && !force) {
    console.error(`Error: ${active.length} member(s) still active. Archive/wait, or use --force.`);
    process.exit(1);
  }
  assertSafeRepoWritePath(root, teamDir(root));
  fs.rmSync(teamDir(root), { recursive: true, force: true });
  console.log(`Team "${team.teamName}" deleted.`);
}

function run(args) {
  const root = repoRoot();
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') { printUsage(); return; }

  switch (sub) {
    case 'create': cmdCreate(args.slice(1), root); break;
    case 'spawn': cmdSpawn(args.slice(1), root); break;
    case 'status': cmdStatus(args.slice(1), root); break;
    case 'collect': cmdCollect(args.slice(1), root); break;
    case 'archive': cmdArchive(args.slice(1), root); break;
    case 'delete': cmdDelete(args.slice(1), root); break;
    default: console.error(`Error: Unknown team command '${sub}'`); printUsage(); process.exit(1);
  }
}

module.exports = { run };
