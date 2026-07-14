# LazyTrae v0.17 Handoff

Use this handoff with the package's actual evidence files. It records package observations, not a substitute for opening a Trae host session.

## Public capability status contract

Attach canonical read-only capability records with `schema_version`, `contract_version`, `contract_digest`, `host`, `capability`, nullable `provider`, `status`, nullable `reason_code`, `message`, nullable receipt summary, and object `details`. The allowed statuses are `host-ready`, `owned-ready`, `missing`, `incompatible`, `disabled`, `failed-optional`, and `not-initialized`.

## Optional capability policy

Record only observed optional capability state. Do not describe a status, doctor, or load-check as enabling a provider, installing dependencies, registering MCP, or changing global state. Normal CI is self-contained; sibling parity is release-only and must receive its sibling reference explicitly.

## Receipt and safe removal

State the receipt outcome and any preserved paths. Exact receipt-owned assets may be removed; mutable entries are accepted only when already receipt-owned. Preserve unknown, tampered, symlinked, hardlinked, host-owned, user-configured, lockfile, and caller-owned CodeGraph entries. Host registrations are removed manually through the host.

## Package readiness versus host verification

Name package readiness separately from host discovery and live MCP connection. `lazytrae load-check` and `lazytrae doctor` validate package evidence only. Include the user-observed Trae session/MCP result separately, or mark it unverified.

## JSON-RPC resilience

For MCP evidence, retain the same-stream sequence: malformed JSON (`-32700`, `id: null`), invalid request (`-32600`), notification (no response), then a valid request. Confirm stdout contains only JSON-RPC messages.

## Host-specific exclusions

Retain Trae names and layouts: `.trae/`, `.lazytrae/`, `trae-cli mcp add-json`, and the explicit macOS `lazytrae work install` flow. The project declares ten MCP entries; only the core `lazytrae` entry exposes 15 tools after a host connection. Filesystem and Playwright are optional templates, not automatically activated services.

## Known unverified host behavior

Do not infer Trae IDE discovery, Trae Work reload/discovery, or MCP connectivity from package checks. Record non-macOS Trae Work behavior as unverified unless a host-specific manual observation accompanies the handoff.

## macOS verification scope

Treat the Trae Work global-skills path and behavior as **macOS only**. Do not extrapolate that result to Linux or Windows.
