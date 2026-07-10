# LazyTrae Setup Guide — Trae IDE and Trae Work

> **Note:** `AGENTS.md` has been removed; the [README](../README.md) is now the agent onboarding guide. References to `AGENTS.md` below mean the onboarding guide in `README.md`.

LazyTrae supports both **Trae IDE** and **Trae Work Desktop**. The setup differs because the two products read different configuration files.

## Compatibility Matrix

| Feature | Trae IDE | Trae Work Desktop | Files |
|---|---|---|---|
| Skills | Auto-loaded | Auto-loaded | `.trae/skills/*/SKILL.md` |
| AGENTS.md | Auto-loaded | Enable in Settings | `AGENTS.md` |
| MCP server | Auto-loaded (`.trae/mcp.json`) | Manual via Settings UI | `.trae/mcp.json` (IDE only) |
| Commands | Auto-loaded | Manual creation (optional) | `.trae/commands/*.md` |
| Rules (pattern-based) | Auto-loaded | Not supported (use AGENTS.md) | `.trae/rules/*.md` |
| Custom agents | Auto-loaded | Not supported | `.trae/agents/*.md` |
| Hooks | Auto-loaded | Not supported | `.trae/hooks/*.sh` |

**Key:** Skills carry the core workflow logic. Commands are thin wrappers that point to skills. On Trae Work, invoke skills directly with `/lazy-init-deep`, `/lazy-ulw-plan`, etc.

---

## Trae IDE Setup

Trae IDE reads all files from `.trae/` automatically. No manual configuration needed.

### Steps

1. Install LazyTrae into your project:
   ```bash
   cd /path/to/lazytrae-plugin/packages/cli
   npm install
   node src/index.js init
   ```

2. Open the project in Trae IDE.

3. Everything is active:
   - Slash commands: type `/lazy-init-deep`, `/lazy-ulw-plan`, `/lazy-start-work`, `/lazy-ulw-loop`
   - Skills: auto-loaded from `.trae/skills/`
   - Rules: pattern-based, auto-injected when matching files are edited
   - Custom agents: Atlas, Oracle, Prometheus, etc. available as subagents
   - Hooks: SessionStart, PostToolUse, etc. fire automatically
   - MCP: configured via `.trae/mcp.json`

4. Verify with:
   ```bash
   lazytrae doctor
   ```

### Using Commands

Type `/` in the chat and select a command:

| Command | Purpose |
|---|---|
| `/lazy-init-deep` | Explore codebase, generate AGENTS.md |
| `/lazy-ulw-plan` | Socratic planning interview |
| `/lazy-start-work` | Execute one checklist item |
| `/lazy-ulw-loop` | Start long-horizon loop |
| `/lazy-ralph-loop` | Alias for ulw-loop |
| `/lazy-review-work` | Run Oracle reviewer |
| `/lazy-remove-ai-slops` | Clean up AI-generated slop |
| `/lazy-handoff` | Generate handoff summary |
| `/lazy-stop-continuation` | Stop active loop |

---

## Trae Work Desktop Setup

Trae Work reads `.trae/skills/` and `AGENTS.md` but does NOT read `.trae/commands/`, `.trae/rules/`, `.trae/agents/`, or `.trae/hooks/`. You need to configure a few things manually.

### Step 1: Install files into your project

```bash
cd /path/to/lazytrae-plugin/packages/cli
npm install
node src/index.js init
```

This creates `.trae/skills/`, `.trae/commands/`, `.trae/rules/`, `.trae/agents/`, `.trae/hooks/`, `.lazytrae/`, and `AGENTS.md` in your project. Trae Work will read the skills; the other files are for Trae IDE compatibility.

### Step 2: Enable AGENTS.md

1. Open Trae Work Desktop.
2. Go to **Settings** (click avatar in bottom-left → Settings).
3. Navigate to **Rules** (规则).
4. Under **Import Settings** (导入设置), turn on **"Include AGENTS.md in context"** (将 AGENTS.md 包含在上下文中).

This injects the project constitution (operating rules, workflow phases, evidence gates) into every conversation.

### Step 3: Configure the MCP server (manual — required)

Trae Work does **not** read `.trae/mcp.json`. MCP servers must be added through the Settings UI. An agent cannot automate this step — you must paste the config yourself.

1. Go to **Settings** → **MCP** (头像 → 设置 → MCP).
2. Click **创建** (Create) → **手动配置** (Manual configuration).
3. Paste this JSON (uses `${workspaceFolder}` so it works regardless of where your project lives):

   ```json
   {
     "mcpServers": {
       "lazytrae": {
         "command": "node",
         "args": ["${workspaceFolder}/lazytrae-plugin/packages/mcp/src/index.js"]
       }
     }
   }
   ```

   > `${workspaceFolder}` is auto-replaced with your project root path by Trae Work at launch time. This is officially documented at [docs.trae.cn](https://docs.trae.cn/work_remote-mcp-server).

4. If you installed the CLI globally (`npm link`), you can use the shorter form instead:
   ```json
   {
     "mcpServers": {
       "lazytrae": {
         "command": "lazytrae",
         "args": ["mcp"]
       }
     }
   }
   ```

5. Click **确认** (Confirm).

This provides 15 tools: state access, evidence recording, review gates, handoff generation, and context tools (symbol search, find references, diagnostics, etc.).

> **Why manual?** Trae Work has no file-based MCP config mechanism — the only entry point is the Settings UI. This is a platform limitation, not a LazyTrae choice. An agent can prepare the JSON config for you, but cannot inject it into Trae Work's MCP registry.
>
> **Contrast: WorkBuddy.** The sibling [LazyWorkBuddy](https://github.com/elvinzhao10/LazyWorkBuddy) project runs on WorkBuddy, which **does** support file-based MCP config (`.mcp.json` at user/project/plugin scopes). On WorkBuddy, an agent can write the config file automatically — only a one-click "Trust" step in the UI remains manual. Trae Work has no equivalent file-based path, which is why MCP setup here is fully manual.

### Step 4: Use skills instead of commands

In Trae Work, type `/` in the dialog and select a skill. The LazyTrae skills are:

| Skill | Replaces command | Purpose |
|---|---|---|
| `/lazy-init-deep` | `$init-deep` | Explore codebase, generate AGENTS.md |
| `/lazy-ulw-plan` | `$ulw-plan` | Socratic planning interview |
| `/lazy-start-work` | `$start-work` | Execute one checklist item |
| `/lazy-ulw-loop` | `$ulw-loop` | Start long-horizon loop |
| `/reviewer` | `review-work` | Run Oracle reviewer (5 evidence gates) |
| `/verifier` | — | Automated + manual QA verification |
| `/lazy-remove-ai-slops` | `remove-ai-slops` | Clean up AI-generated slop |
| `/librarian` | — | Research external documentation |
| `/migration-planner` | — | Plan framework migrations |

Skills are auto-loaded by Trae Work from `.trae/skills/`. No manual creation needed.

### Step 5 (Optional): Create commands in Trae Work

If you prefer commands over skills, create them manually in Trae Work:

1. Go to **Settings** → **Commands** (命令).
2. Click **Create** (创建).
3. Command names must be lowercase with hyphens (e.g., `init-deep`, `ulw-plan`).
4. Copy the instructions from the corresponding `.trae/commands/*.md` file.
5. Save.

Note: This is optional. Skills already contain the full workflow logic.

### What doesn't work in Trae Work

- **Pattern-based rules** (`.trae/rules/*.md`) — Trae Work only supports global rules via Settings. The project rules in `AGENTS.md` cover this gap.
- **Custom agents** (`.trae/agents/*.md`) — Trae Work doesn't have file-based custom agents. The agent role descriptions are embedded in the skills instead.
- **Hooks** (`.trae/hooks/*.sh`) — Trae Work has a different automation system. The CLI (`lazytrae doctor`, `lazytrae verify --must-pass`) provides enforcement instead.

### Trae Work limitations

- No hook-based enforcement (use `lazytrae verify --must-pass` as a manual gate)
- No custom agent subagents (the main AI assistant handles all roles)
- No pattern-based rule injection (AGENTS.md covers project rules)
- PostCompact recovery is heuristic-only (no hook to detect compaction)

---

## Verification

After setup on either platform:

```bash
lazytrae doctor
```

Expected: 33+ PASS, 1-4 WARN (team mode, parity ledger warnings are normal in consumer projects), 0 FAIL.

---

## CLI Tools (both platforms)

The CLI works independently of Trae IDE or Work:

```bash
lazytrae init                    # Install plugin
lazytrae doctor                  # Health check
lazytrae sync                    # Sync templates
lazytrae verify                  # Run verification
lazytrae verify --must-pass      # Hard completion gate
lazytrae handoff                 # Generate handoff summary
lazytrae loop status             # Check loop state
lazytrae loop cancel             # Cancel active loop
lazytrae loop pause/resume       # Pause/resume loop
lazytrae team create             # Create parallel-work team
lazytrae run --agent oracle --category ultrabrain "review current diff"
lazytrae mcp                     # Start MCP server
```
