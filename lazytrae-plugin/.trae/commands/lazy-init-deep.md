# init-deep

## Usage

`/lazy-init-deep [--create-new]`

Triggers: `init-deep`, `initialize repo`, `generate AGENTS.md`, `understand this codebase`, `explore this repo`

## Inputs

- `--create-new` (optional): Request a destructive-recovery proposal; it does
  not itself authorize replacement. Otherwise, create only missing AGENTS.md
  files.
- Path (optional): Specify the directory to initialize. Defaults to project root.

## User-Owned AGENTS.md Safety

Content outside every delimited `lazytrae:managed:start` /
`lazytrae:managed:end` managed block is user-owned and preserved byte-for-byte,
including in malformed or unparseable files; report every exact affected path.
Do not delete, replace, regenerate, or edit that user-owned content
automatically. A complete delimited managed block itself is package-owned.

Any full-file replacement requires a separately confirmed destructive request
after listing the exact AGENTS.md files to be replaced. Before replacement,
create and report a byte-for-byte backup of every confirmed original at
`.lazytrae/backups/init-deep/<timestamp>/<relative-path>`. Leave every AGENTS.md
not included in that confirmation unchanged.

The release-owned local command described by the linked skill, with `init`,
updates a complete delimited package-owned
`lazytrae:managed:start` / `lazytrae:managed:end` block in AGENTS.md, or
appends a new delimited managed block when none is present, preserving all
existing surrounding bytes.

## Outputs

- One root AGENTS.md at the specified root.
- Zero or more nested AGENTS.md in high-complexity directories.
- Summary report with created files, file counts, and hierarchy.
- Package `load-check --host ide|work|cli` result through that release-owned
  local command before discovery begins; it does not establish host discovery
  or a live MCP connection.

## Integration Boundary

InitDeep may repair core LazyTrae assets only: the installed skills, commands,
rules, hooks, agents, schemas, and the base LazyTrae MCP declaration. It must
never provision package-owned tooling, enable optional MCP capabilities, or
install external dependencies. When an optional integration is genuinely
needed, report the explicit lifecycle command for the operator to trigger
outside InitDeep.

## Success Criteria

- Every directory with score > 15 has an AGENTS.md.
- All AGENTS.md are telegraphic (root ≤150 lines, subdir ≤80 lines).
- No generic content that applies to all projects.
- No duplicate content from parent in child AGENTS.md.
- All `WHERE TO LOOK` entries have correct paths.
- The package load check passes, or a reported repair is re-checked successfully before completion.

## Linked Skill

[lazy-init-deep](../skills/lazy-init-deep/SKILL.md)

## Workflow Phase

Explore — deep hierarchical repo discovery and understanding.
