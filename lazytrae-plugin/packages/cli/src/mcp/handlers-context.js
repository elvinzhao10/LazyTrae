const fs = require('fs');
const path = require('path');
const { resolveRepoPath } = require('../lib/path-boundary');

const TEXT_EXTENSIONS = new Set(['.js', '.json', '.md', '.sh', '.ts', '.tsx', '.mjs', '.cjs', '.html', '.css', '.toml', '.yaml', '.yml']);
const SKIP_DIRS = new Set(['.git', 'node_modules', 'reference', '.DS_Store']);

function walk(root, dir = root, files = []) {
  if (!fs.existsSync(dir) || files.length >= 1000) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(root, path.join(dir, entry.name), files);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name)) && files.length < 1000) {
      files.push(path.relative(root, path.join(dir, entry.name)));
    }
  }
  return files;
}

function readLines(root, rel) {
  try {
    const resolved = safeProjectPath(root, rel);
    if (!resolved.ok || !resolved.exists) return [];
    const text = fs.readFileSync(resolved.path, 'utf-8');
    return text.length > 200000 ? [] : text.split(/\r?\n/);
  } catch (_) {
    return [];
  }
}

function safeProjectPath(root, rel) {
  return resolveRepoPath(root, rel);
}

function matches(root, query, limit = 25, onlyFiles = null) {
  const needle = String(query || '').toLowerCase();
  if (!needle) return [];
  const results = [];
  for (const file of onlyFiles || walk(root)) {
    const lines = readLines(root, file);
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(needle)) continue;
      results.push({ file, line: i + 1, preview: lines[i].trim().slice(0, 240) });
      if (results.length >= limit) return results;
    }
  }
  return results;
}

function handleSymbolSearch(root, args) {
  return {
    provenance: 'heuristic',
    query: args.query || '',
    results: matches(root, args.query, args.limit || 25),
  };
}

function handleFindReferences(root, args) {
  const symbol = args.symbol || args.query || '';
  return {
    provenance: 'heuristic',
    symbol,
    references: matches(root, symbol, args.limit || 50),
  };
}

function handleGotoDefinition(root, args) {
  const symbol = String(args.symbol || '').trim();
  if (!symbol) return { provenance: 'heuristic', symbol, results: [] };
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b(function|class|const|let|var)\\s+${escaped}\\b|${escaped}\\s*[:=]\\s*(function|\\(|async|require)|module\\.exports\\.${escaped}\\b`);
  const results = [];
  for (const file of walk(root)) {
    const lines = readLines(root, file);
    for (let i = 0; i < lines.length; i++) {
      if (!pattern.test(lines[i])) continue;
      results.push({ file, line: i + 1, preview: lines[i].trim().slice(0, 240) });
      if (results.length >= (args.limit || 10)) return { provenance: 'heuristic', symbol, results };
    }
  }
  return { provenance: 'heuristic', symbol, results, no_result: results.length === 0 };
}

function handleDiagnostics(root, args) {
  const commands = [];
  for (const file of walk(root).filter(f => f.endsWith('package.json'))) {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(root, file), 'utf-8'));
    } catch (error) {
      commands.push({ cwd: path.dirname(file), command: null, reason: `invalid package.json: ${error.message}` });
      continue;
    }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
      commands.push({ cwd: path.dirname(file), command: null, reason: 'invalid package.json: expected object metadata' });
      continue;
    }
    if (pkg.scripts && pkg.scripts.test) commands.push({ cwd: path.dirname(file), command: 'npm test', reason: 'package.json test script' });
  }
  if (fs.existsSync(path.join(root, 'go.mod'))) commands.push({ cwd: '.', command: 'go test ./...', reason: 'go.mod present' });
  if (fs.existsSync(path.join(root, 'Cargo.toml'))) commands.push({ cwd: '.', command: 'cargo check', reason: 'Cargo.toml present' });
  if (fs.existsSync(path.join(root, 'pyproject.toml'))) commands.push({ cwd: '.', command: 'python -m py_compile', reason: 'pyproject.toml present' });
  return {
    provenance: 'project-tool-backed',
    executed: false,
    commands,
    note: args.run === true ? 'Execution is unavailable in the MCP handler; run listed commands from the CLI.' : 'Detected project-native diagnostic commands.',
  };
}

function handleDocsLookup(root, args) {
  const docs = walk(root).filter(f => f === 'README.md' || f.endsWith('package.json') || f.startsWith('docs/'));
  return {
    provenance: 'project-tool-backed',
    query: args.query || '',
    results: matches(root, args.query, args.limit || 25, docs),
  };
}

function parseImports(lines) {
  const imports = [];
  const pattern = /(?:require\(['"]([^'"]+)['"]\)|from ['"]([^'"]+)['"]|import ['"]([^'"]+)['"])/;
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) imports.push(match[1] || match[2] || match[3]);
  }
  return Array.from(new Set(imports));
}

function handleDependencyGraph(root, args) {
  const target = args.path || args.file || '';
  const targetPath = safeProjectPath(root, target);
  if (!targetPath.ok) {
    return {
      provenance: 'heuristic',
      path: target,
      imports: [],
      reverse_references: [],
      missing: true,
      error: targetPath.error,
    };
  }
  const lines = readLines(root, target);
  const basename = path.basename(target, path.extname(target));
  const reverse = matches(root, basename, args.limit || 25).filter(r => r.file !== target);
  return {
    provenance: 'heuristic',
    path: target,
    imports: parseImports(lines),
    reverse_references: reverse,
    missing: lines.length === 0,
  };
}

module.exports = {
  handleSymbolSearch,
  handleFindReferences,
  handleGotoDefinition,
  handleDiagnostics,
  handleDocsLookup,
  handleDependencyGraph,
};
