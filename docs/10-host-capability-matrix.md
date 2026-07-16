# Host capability matrix

LazyTrae deliberately aligns policy and package safety across Trae surfaces while keeping host adapters distinct. The same project assets may be present on two surfaces without both hosts exposing the same discovery or registration behavior.

## What each host needs

| Capability | Trae IDE | Trae Work | Trae CLI | Package assertion |
| --- | --- | --- | --- | --- |
| Project assets | `.trae/` and `.lazytrae/` | Global Work skills plus project state | Local project configuration | Templates and managed copies are present. |
| Skills/commands/agents | Project discovery | Global skill discovery; no global command registry | CLI/session discovery | Files are present; host must load them. |
| MCP | Project declaration and reopened project | Manual Settings → MCP entry | Explicit `mcp add-json` and new session | Core launcher and protocol tests are present. |
| Hooks | Host event lifecycle | Host-specific behavior | CLI/project behavior | Hooks are advisory declarations. |
| Removal | Project assets only | Bounded skills removal plus manual registration removal | Project assets plus manual registration removal | Package never guesses host locations. |

## Structural differences

The host adapter differs, but the safety model does not:

- **Host integration:** IDE, Work, and CLI each own discovery, registration, session lifetime, and event delivery.
- **State/path:** project assets live in `.trae/` and `.lazytrae/`; the verified Work skills path is macOS `~/.trae-cn/skills/`; host settings and credentials remain user-owned.
- **Inventory:** eight MCP declarations are shipped: one executable core server and seven disabled placeholders. Optional providers remain explicit lifecycle decisions.

## macOS-only scope

The package evidence is verified on macOS only. It does not claim equivalent Trae Work paths, discovery, hook execution, or MCP connection on other operating systems. Those are observed per selected host session.
