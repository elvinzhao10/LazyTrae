---
pattern: \.(css|scss|less)$
---

# CSS/Style Rules

CSS and styling rules for LazyTrae frontend projects.

## Naming

- Use consistent naming convention (BEM, utility classes, or CSS modules — pick one).
- BEM: `block__element--modifier`.
- Lowercase with hyphens: `.my-component`, not `.MyComponent`.
- No camelCase in class names.

## Specificity

- Keep specificity low.
- Avoid nesting beyond 2-3 levels.
- Never use `!important` as a shortcut.
- Prefer class selectors over element selectors.
- Don't use IDs for styling.

## Layout

- Use flexbox for one-dimensional layouts.
- Use CSS Grid for two-dimensional layouts.
- Don't use floats for layout (use them only for text wrapping).
- Use relative units (`rem`, `%`, `fr`), not fixed pixels for layout.
- Mobile-first media queries (`min-width`).

## Design Tokens

- Use CSS variables / design tokens for colors, spacing, typography.
- No magic numbers — define variables with meaningful names.
- Maintain a consistent spacing scale.
- Maintain a consistent color palette.

## Accessibility

- Don't remove focus outlines (restyle them if needed).
- Ensure color contrast meets WCAG AA.
- Respect `prefers-reduced-motion`.
- Don't rely on color alone to convey information.

## Performance

- Avoid expensive properties in animations: `box-shadow`, `filter`, `width`, `height`.
- Use `transform` and `opacity` for smooth animations.
- Minimize reflows and repaints.
- Use `will-change` sparingly, only for known animations.
