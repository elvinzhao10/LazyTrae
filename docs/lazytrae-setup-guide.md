# LazyTrae Setup Guide — Trae IDE, Trae Work, and Trae CLI

LazyTrae supports three release surfaces: **Trae IDE**, **Trae Work**, and **Trae CLI**. The project configuration is portable, while the `lazytrae` companion CLI supplies installation, verification gates, and the local MCP server.

## Install the CLI

```bash
git clone https://github.com/elvinzhao10/Trae.git
cd Trae/lazytrae-plugin/packages/cli
npm install
npm install -g .
cd /path/to/your/project
lazytrae init
lazytrae doctor
```

`lazytrae init` creates the project-local `.trae/` and `.lazytrae/` trees plus an `AGENTS.md` setup guide. Keep the global `lazytrae` executable installed, because `.trae/mcp.json` launches its `mcp` subcommand.

## Trae IDE

Open the initialized project in Trae IDE. Its project `.trae/` configuration provides the skills, commands, agents, hooks, and MCP configuration. Run `lazytrae doctor` after opening the project and `lazytrae verify --must-pass` before declaring a workflow complete.

## Trae Work

1. Open the project locally in Trae Work Desktop. Local tasks can use workspace files and local MCP servers; cloud-only tasks cannot run a local `lazytrae mcp` process.
2. In the Skills UI, import the required `SKILL.md` bundles from `.trae/skills/`. Trae Work supports skills, slash-command workflows, rules, and MCP; do not assume that every project file is auto-registered by every app build.
3. Keep the generated `.trae/mcp.json` in the project. Trae Work supports project MCP configuration for local work. If your installed build does not discover it, add this equivalent server through **Settings → MCP**:

   ```json
   {
     "mcpServers": {
       "lazytrae": { "command": "lazytrae", "args": ["mcp"] }
     }
   }
   ```

4. Invoke `/lazy-init-deep`, `/lazy-ulw-plan`, `/lazy-start-work`, and `/lazy-review-work`, or ask the agent to select the corresponding skill. Run `lazytrae verify --must-pass` before declaring a task complete.

## Trae CLI

Install Trae CLI from the official TRAE installer, then use `trae-cli` for the agent session and `lazytrae` for the companion workflow gates:

```bash
trae-cli
lazytrae init
lazytrae doctor
lazytrae verify --must-pass
lazytrae loop status
trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'
```

The last command registers the local stdio MCP server. It uses the same `lazytrae mcp` process referenced by the generated `.trae/mcp.json`.

---

## Verification

After setup on either platform:

```bash
lazytrae doctor
```

Expected: 33+ PASS, 1-4 WARN (team mode, parity ledger warnings are normal in consumer projects), 0 FAIL.

---

## CLI Tools (both platforms)

The CLI works independently of any host app:

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
