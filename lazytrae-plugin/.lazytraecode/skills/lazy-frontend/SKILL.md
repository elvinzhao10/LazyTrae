---
name: lazy-frontend
description: "Frontend development best practices. Use for UI, web frontend, and client-side implementation work. Triggers: frontend, UI, component, page, layout, style, CSS, React, Vue, web, browser."
---

# frontend

Frontend development discipline for LazyTrae. Ensures UI work follows best practices for accessibility, responsiveness, performance, and user experience. Frontend code is user-facing — quality directly impacts perception.

## Canonical LazyCodex Source

`lazycodex/plugins/omo/skills/frontend/SKILL.md` — frontend best practices: accessibility, responsive design, performance, component architecture, state management, testing, browser compatibility.

## Purpose

Build user interfaces that are accessible, fast, responsive, and maintainable. Frontend work has unique constraints: diverse devices, varying network conditions, accessibility requirements, and immediate user perception.

## Required Context to Inspect

- The design or UI specification.
- The frontend framework and its conventions.
- Existing component patterns in the codebase.
- The styling approach (CSS, CSS-in-JS, utility classes).
- The state management solution.
- Accessibility requirements and standards.
- Browser and device support targets.

## Step-by-Step Procedure

### 1. Accessibility First

1. **Semantic HTML first.** Use the right element for the job: `<button>` for buttons, `<nav>` for navigation, `<article>` for content.
2. **All interactive elements are keyboard accessible.** Tab order makes sense. Focus states are visible.
3. **Images have alt text.** Decorative images have empty alt (`alt=""`).
4. **Forms have labels.** Every input has an associated `<label>`.
5. **Color is never the only indicator.** Use icons, text, or patterns too.
6. **Contrast meets WCAG AA standards.** 4.5:1 for normal text, 3:1 for large text.
7. **Screen reader testing.** Use semantic landmarks and ARIA where needed (but prefer native HTML).

### 2. Responsive Design

1. **Mobile-first approach.** Design for small screens first, then enhance for larger ones.
2. **Use relative units.** `rem` for typography, `%` / `fr` / `flex` for layout. Avoid fixed widths.
3. **Responsive breakpoints.** Choose breakpoints based on content, not devices.
4. **Touch targets are at least 44x44px.** No tiny buttons on mobile.
5. **Text is readable without zooming.** Minimum 16px body text on mobile.
6. **Layout doesn't break on resize.** Test at 320px, 768px, 1024px, 1440px.

### 3. Component Architecture

1. **Components are single-responsibility.** One component does one thing well.
2. **Props are the public API.** Keep them minimal and well-typed.
3. **State lives as low as possible.** Lift state only when shared between siblings.
4. **Pure components by default.** Same props → same output. No side effects in render.
5. **Composition over inheritance.** Use children, render props, slots — not deep hierarchies.
6. **Naming: PascalCase for components, camelCase for props and state.**
7. **Component file = component name.** One component per file, or one directory with index.

### 4. State Management

1. **Local state first.** Use component state before reaching for global state.
2. **Separate concerns:** UI state (isModalOpen), data state (user, items), URL state (route, query).
3. **URL is the source of truth for navigation state.** Deep-linkable, shareable.
4. **No derived state in state.** If you can compute it, don't store it.
5. **Immutability.** Never mutate state directly — always create new references.
6. **Side effects are isolated.** Use effects/ lifecycle hooks, not in render.

### 5. Performance

1. **Minimize re-renders.** Only re-render what changed.
2. **Lazy load what's not immediately needed.** Code splitting, route-based splitting.
3. **Images are optimized.** Use modern formats (WebP, AVIF). Serve appropriate sizes.
4. **No layout shift.** Reserve space for images and dynamic content.
5. **Debounce/throttle expensive operations.** Search, scroll handlers, resize.
6. **Avoid layout thrashing.** Batch DOM reads, then writes.
7. **Bundle size matters.** Audit dependencies. Tree-shake.

### 6. Styling

1. **Follow the existing styling approach** in the codebase.
2. **Use a consistent naming convention.** BEM, utility classes, CSS modules — pick one and stick with it.
3. **No magic numbers.** Use design tokens / variables for colors, spacing, typography.
4. **Avoid `!important`.** If you need it, something is wrong with the cascade.
5. **Keep specificity low.** Flat selectors are easier to override.
6. **Mobile-first media queries.** `min-width`, not `max-width`.

### 7. Testing

1. **Component tests** test behavior, not implementation.
2. **Test the user-visible behavior**, not internal state.
3. **Accessibility tests** check for common a11y issues.
4. **Visual regression tests** catch unintended style changes.
5. **E2E tests** cover critical user flows end-to-end.
6. **Test on real browsers and devices**, not just emulators.

### 8. Browser Compatibility

1. **Know your target browsers.** Check analytics if available.
2. **Use progressive enhancement.** Core functionality works everywhere; enhancements layer on top.
3. **Feature detection, not browser detection.**
4. **Polyfill only what's needed.** Don't ship a polyfill for something no one uses.
5. **Test in your target browsers** before shipping.

## Frontend Quality Checklist

- [ ] Semantic HTML used correctly
- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] All images have alt text
- [ ] Forms have labels
- [ ] Color contrast meets WCAG AA
- [ ] Layout works at 320px width
- [ ] Touch targets are 44x44px minimum
- [ ] No console errors or warnings
- [ ] Images are optimized
- [ ] No layout shift on load
- [ ] Performance: LCP < 2.5s, CLS < 0.1
- [ ] Components are well-typed (TypeScript/PropTypes)
- [ ] No prop drilling through 3+ levels
- [ ] Side effects are in the right place

## Allowed Edits

- Frontend component files (React/Vue/etc.).
- CSS / styling files.
- Test files for frontend components.
- Static assets (images, icons, fonts).
- Configuration (build, lint, typecheck).

## Forbidden Behavior

- Do NOT skip accessibility checks.
- Do NOT use `div` for everything — use semantic HTML.
- Do NOT hardcode colors, spacing, or font sizes — use design tokens.
- Do NOT add global styles that affect unrelated components.
- Do NOT ignore responsive design — test on mobile.
- Do NOT use `!important` to override styles.
- Do NOT ship with console.log or debug statements.
- Do NOT add large dependencies without checking bundle size impact.

## Verification Gates

1. **Plan reread**: UI matches the design specification.
2. **Automated verification**: Component tests pass, lint clean, typecheck passes, build succeeds.
3. **Manual-QA**: Visual check on multiple viewports, keyboard navigation works, no console errors.
4. **Adversarial QA**: Edge cases (empty states, loading states, error states, long text, small screens).
5. **Cleanup**: No debug code, no unused styles, no dead components.

## Failure Handling

- If a component doesn't render: check the props, check the state, check the render condition.
- If styles don't apply: check specificity, check the cascade, check if styles are loaded.
- If it works on desktop but not mobile: check viewport meta tag, check touch events, check responsive breakpoints.
- If there's a performance issue: profile first, then optimize. Don't guess.
- If accessibility is broken: start with semantic HTML fixes before adding ARIA.

## Output Format

```
FRONTEND IMPLEMENTATION REPORT
==============================

Feature: <what was built>
Framework: <React / Vue / etc.>

Components:
  - <ComponentName>: <purpose>, <file path>
  ...

Quality Checklist:
  - Accessibility: PASS / ISSUES
  - Responsive design: PASS / ISSUES
  - Performance: PASS / ISSUES
  - Type safety: PASS / ISSUES
  - Tests: PASS / FAIL

Screenshots:
  - Desktop: <evidence path>
  - Mobile: <evidence path>

Verification:
  - Component tests: PASS / FAIL
  - Lint: PASS / FAIL
  - Build: PASS / FAIL
  - Manual-QA: PASS / FAIL
```

## Handoff Target

After frontend implementation, hand off to `verifier` for formal verification, then to `reviewer` for code quality and accessibility review. If it's a full feature, hand off to `review-work` for the full multi-lane review.
