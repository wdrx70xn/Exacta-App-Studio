---
description: Build and package the Electron app for distribution
---

# Build & Package

// turbo-all

## Development Build (for E2E testing)

1. Clean previous build artifacts and package:

```sh
npm run build
```

This runs `npm run clean` + `electron-forge package` with `E2E_TEST_BUILD=true`.

## Production Package

1. Clean and create distributable packages:

```sh
npm run make
```

## Platform-Specific Notes

### Windows

- **Signing**: Set `WINDOWS_SIGN=true` and `AZURE_CODE_SIGNING_DLIB` for code signing.
- **Guardian Service** (native .NET 8 security layer):

```sh
npm run guardian:restore    # restore .NET dependencies
npm run guardian:build      # debug build
npm run guardian:installer  # full installer (requires WiX)
npm run guardian:sign       # sign native binaries
```

### macOS

- Requires `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` in `.env` for notarization.
- `osxSign` and `osxNotarize` are skipped for E2E test builds.

### Linux

- Generates `.deb`, `.rpm`, and `.AppImage` packages.

## Forge Configuration

The build is configured via `forge.config.ts`:

- Vite builds: `src/main.ts` (main), `src/preload.ts` (preload), `workers/tsc/tsc_worker.ts` (worker)
- Renderer: `vite.renderer.config.mts`
- Bundled node_modules: `better-sqlite3`, `bindings`, `dugite/git`, `@vscode`, `stacktrace-js`, `html-to-image`
- Electron Fuses enabled for security (no `runAsNode`, cookie encryption, ASAR integrity)
