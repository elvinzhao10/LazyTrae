<!-- Derived from omo/lazycodex (MIT, © 2026 Yeongyu Kim) -->

---
pattern: \.py$
---

# Python Rules

Python coding rules for LazyTrae projects.

## Style

- Follow PEP 8.
- Use 4-space indentation (no tabs).
- Line length: 88 characters (black-compatible).
- `snake_case` for functions and variables.
- `PascalCase` for classes.
- `UPPER_SNAKE_CASE` for constants.

## Type Hints

- Use type hints for all public functions.
- Use `mypy` for type checking (strict mode preferred).
- Type external data at boundaries.
- Use `Optional[...]` for values that can be None.
- Prefer `Protocol` over inheritance for duck typing.

## Error Handling

- Raise specific exceptions, not generic `Exception`.
- Don't use bare `except:` — catch specific exceptions.
- Don't catch exceptions you can't handle.
- Use `finally` for cleanup.
- Never silently swallow errors.

## Imports

- Standard library first, then third-party, then local.
- No circular imports.
- No wildcard imports (`from module import *`).
- Use absolute imports for clarity.

## Performance

- Use comprehensions, not for-loops with append.
- Use `dict`/`set` for O(1) lookups.
- Avoid global mutable state.
- Use generators for large datasets.
- Profile before optimizing.
