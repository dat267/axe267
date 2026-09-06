# GUI Testing Pipeline

Two layers of GUI testing:

## 1. Component Tests (vitest + jsdom + @testing-library/svelte)

Fast, headless tests for individual Svelte components. Run in vitest with jsdom DOM simulation.

```
cd frontend && npm run test:component
# or from root: npm run test:component
```

### Pattern

- Tests live beside components: `src/lib/components/<Name>.test.js`
- Use `render(Component, { props: {...} })` from `@testing-library/svelte`
- Use `text(str)` helper from `test-utils.js` for passing children as snippets
- Use `userEvent` from `@testing-library/user-event` for user interactions
- Assert with `expect(...).toBeInTheDocument()` from `@testing-library/jest-dom`

### Example

```js
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { text } from "./test-utils.js";
import Button from "./Button.svelte";

it("calls onclick when clicked", async () => {
  const user = userEvent.setup();
  let clicked = false;
  render(Button, {
    props: {
      children: text("Click"),
      onclick: () => {
        clicked = true;
      },
    },
  });
  await user.click(screen.getByRole("button"));
  expect(clicked).toBe(true);
});
```

## 2. E2E Tests (Playwright)

Full browser tests against the running dev server.

```
cd frontend && npm run test:e2e
# or from root: npm run test:e2e
```

### Setup

Playwright config: `frontend/playwright.config.js`
Test files: `frontend/e2e/`

### Pattern

- Tests use `@playwright/test` with page-level assertions
- Dev server auto-starts via `webServer` config
- Use `data-testid` attributes for targeting (or text/role queries)

## CI Integration

- Component tests: `npm run test:component` (fast, no browser needed)
- E2E tests: `npm run test:e2e` (requires Playwright browsers installed)
