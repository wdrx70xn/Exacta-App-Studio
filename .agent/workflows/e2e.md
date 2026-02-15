---
description: Build the app and run Playwright E2E tests
---

# E2E Tests

**IMPORTANT**: E2E tests run against the BUILT application binary. You MUST rebuild whenever app source code (anything outside `e2e-tests/`) changes.

// turbo-all

1. Build the app for E2E testing:

```sh
npm run build
```

2. Run the full E2E test suite (without auto-opening HTML report):

```powershell
$env:PLAYWRIGHT_HTML_OPEN="never"; npm run e2e
```

3. To run a specific test file:

```powershell
$env:PLAYWRIGHT_HTML_OPEN="never"; npx playwright test e2e-tests/your_test.spec.ts
```

4. To update snapshots:

```powershell
$env:PLAYWRIGHT_HTML_OPEN="never"; npx playwright test e2e-tests/your_test.spec.ts -- --update-snapshots
```

5. To get debug logs when a test fails:

```powershell
$env:DEBUG="pw:browser"; $env:PLAYWRIGHT_HTML_OPEN="never"; npm run e2e
```

## Key Gotchas

### PageObject Pattern

Use sub-component page objects, NOT direct `po` methods:

```ts
// Correct:
await po.appManagement.getTitleBarAppNameButton().click();
await po.navigation.goToChatTab();

// Wrong:
await po.getTitleBarAppNameButton().click();
```

Sub-components: `po.appManagement`, `po.navigation`, `po.chatActions`, `po.previewPanel`, `po.codeEditor`, `po.githubConnector`, `po.toastNotifications`, `po.settings`, `po.securityReview`, `po.modelPicker`.

### Base UI Radio Clicks

```ts
// Correct — click visible label text:
await page.getByText("Vue", { exact: true }).click();
// Wrong — hidden input, can't click:
await page.getByRole("radio", { name: "Vue" }).click();
```

### Lexical Editor

- Don't use `fill("")` to clear — use `po.clearChatInput()` helper.
- Use `po.openChatHistoryMenu()` for history menu.

### Snapshots

- NEVER edit snapshot files by hand — use `--update-snapshots`.
- Snapshots must be deterministic (no timestamps, temp paths, UUIDs).

### Accordion Settings

Call `expandBuildModeSettings()` before interacting with Pro mode build settings in `ProModeSelector`.

### Test Fixtures with `.dyad` directories

- `.dyad` is git-ignored — use `git add -f path/to/.dyad/file` to force-add.
