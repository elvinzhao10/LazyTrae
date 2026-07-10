# LazyTrae Setup Guide — Trae IDE, Trae Work, and Trae CLI

LazyTrae supports three release surfaces: **Trae IDE**, **Trae Work**, and **Trae CLI**. The project configuration is portable, while the `lazytrae` companion CLI supplies installation, verification gates, and the local MCP server.

## Install the CLI

```bash
git clone https://github.com/elvinzhao10/LazyTrae.git
cd LazyTrae
# Open this copied repository in your Trae host and type: onboard
```

AI onboarding is the supported first path. It uses an already-installed `lazytrae` companion command to create the project-local `.trae/` and `.lazytrae/` trees plus the retained `.omo/` workflow-compatibility runtime, then runs `lazytrae init --host ide|work|cli`. Its final load check is a **package-readiness** check: it validates bundled skills, commands, agents, hook scripts and configuration declarations, but cannot prove host discovery, MCP connection, or a live session. The `lazytrae` command must remain available because the generated MCP declaration launches `lazytrae mcp`; do not run `npm` or `npx` just to use the copied workflow repository. `.trae/` and `.lazytrae/` are canonical; do not migrate or delete `.omo/` in v0.15.

## Trae IDE

Run `lazytrae init --host ide`, then open or reopen the initialized project in Trae IDE. Its project `.trae/` configuration declares the skills, commands, agents, hooks, and MCP server; opening the project is the host-side discovery step and is not proven by package readiness. Run `lazytrae doctor` after opening the project and `lazytrae verify --must-pass` before declaring a workflow complete.

## Trae Work

1. Open the project locally in Trae Work Desktop. Local tasks can use workspace files and local MCP servers; cloud-only tasks cannot run a local `lazytrae mcp` process.
2. Install the 17 bundled skills globally, then restart or reload Trae Work:

   ```bash
   lazytrae work install
   lazytrae work status
   ```

   On macOS, `work install` copies each `lazy-*` `SKILL.md` bundle to `~/.trae-cn/skills/`, which Trae Work discovers globally. Trae Work has no global command registry: use the installed skills or natural-language requests instead of expecting `.trae/commands/` to appear globally.
3. Trae Work requires manual MCP registration. It does **not** auto-load the project `.trae/mcp.json`. Open **Settings → MCP** and add this server:

   ```json
   {
     "mcpServers": {
       "lazytrae": { "command": "lazytrae", "args": ["mcp"] }
     }
   }
   ```

4. Confirm the server connects, then invoke the installed skills or ask the agent to select the corresponding workflow. Run `lazytrae verify --must-pass` before declaring a task complete.

## Trae CLI

Install Trae CLI from the [official TRAE documentation](https://docs.trae.cn/), then configure the project and MCP server *before* opening an interactive `trae-cli` session:

```bash
lazytrae init --host cli
trae-cli mcp add-json lazytrae '{"type":"stdio","command":"lazytrae","args":["mcp"]}'
trae-cli
```

The registration command declares the local stdio MCP server. The new session is where Trae CLI attempts to connect; package readiness alone cannot prove that connection. It uses the same `lazytrae mcp` process referenced by the generated `.trae/mcp.json`. Run `lazytrae verify --must-pass` before declaring work complete.

---

## Verification

After setup on either platform:

```bash
lazytrae doctor
```

Expected: `0 FAIL`. Treat environmental warnings as a prompt to inspect the named condition rather than as proof that a host loaded the package.

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
lazytrae work install            # Install global Trae Work skills (macOS)
lazytrae work status             # Check global Trae Work skills
lazytrae load-check --host ide   # Re-check every host component after reload
lazytrae run --agent oracle --category ultrabrain "review current diff"
lazytrae mcp                     # Start MCP server
```
