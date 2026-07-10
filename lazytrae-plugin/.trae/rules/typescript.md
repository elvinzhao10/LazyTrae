<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

---
pattern: \.(ts|tsx|js|jsx)$
---

# TypeScript/JavaScript Rules

TypeScript and JavaScript coding rules for LazyTrae projects.

## Type Safety

- Use TypeScript's strict mode.
- Avoid `any` — use `unknown` instead, with type guards.
- Type external data at the boundary (API responses, config, user input).
- Use discriminated unions for state machines.
- Make invalid states unrepresentable in the type system.

## Modules and Imports

- Use ES modules (`import`/`export`), not CommonJS.
- Keep imports sorted: built-in → external → internal → relative.
- No circular dependencies.
- No side-effect imports (they make the code hard to reason about).

## Error Handling

- Every error path must be handled.
- Throw errors with specific messages that help debugging.
- Don't catch errors you can't handle — let them propagate.
- Use specific error classes, not generic `Error`.
- Never swallow errors with empty catch blocks.

## Async

- Prefer `async/await` over raw promises.
- Always handle promise rejections.
- No floating promises — always await or add `.catch()`.
- Use `Promise.all()` for parallel operations, not sequential awaits.

## Naming

- `camelCase` for variables and functions.
- `PascalCase` for classes, types, and React components.
- `UPPER_SNAKE_CASE` for constants.
- Booleans start with `is`, `has`, `can`, `should`.
- Functions are verbs; variables are nouns.

## Performance

- Avoid O(n^2) in hot paths.
- Use `Map`/`Set` for lookups, not array `find`/`includes`.
- Cache expensive computations.
- Profile before optimizing — guesses are usually wrong.
