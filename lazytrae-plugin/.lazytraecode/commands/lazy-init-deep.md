# init-deep

## Usage

`/lazy-init-deep [--create-new]`

Triggers: `init-deep`, `initialize repo`, `generate AGENTS.md`, `understand this codebase`, `explore this repo`

## Inputs

- `--create-new` (optional): Delete all existing AGENTS.md files and regenerate from scratch. If omitted, update existing AGENTS.md.
- Path (optional): Specify the directory to initialize. Defaults to project root.

## Outputs

- One root AGENTS.md at the specified root.
- Zero or more nested AGENTS.md in high-complexity directories.
- Summary report with created files, file counts, and hierarchy.

## Success Criteria

- Every directory with score > 15 has an AGENTS.md.
- All AGENTS.md are telegraphic (root ≤150 lines, subdir ≤80 lines).
- No generic content that applies to all projects.
- No duplicate content from parent in child AGENTS.md.
- All `WHERE TO LOOK` entries have correct paths.

## Linked Skill

[lazy-init-deep](../skills/lazy-init-deep/SKILL.md)

## Workflow Phase

Explore — deep hierarchical repo discovery and understanding.