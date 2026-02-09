
# Kusanagi — VS Code Extension

Inline AI prompting extension for VS Code. Sends prompts to CLI backends (Claude Code, OpenCode) and applies results as inline edits.

## Tooling

Default to Bun instead of Node.js.

- `bun run compile` — bundle the extension to `dist/extension.js`
- `bun test` — run tests (uses `bun:test` with preload mock for `vscode`)
- `bun install` — install dependencies

## Architecture

```
src/
  extension.ts          — main entry: comment parsing, slash commands, block detection, activation
  provider.ts           — Provider interface and getProvider() factory
  providers/claude.ts   — Claude Code CLI backend
  providers/opencode.ts — OpenCode CLI backend
  utils.ts              — stripCodeFences utility
  insertion-tracker.ts  — tracks pending edits and adjusts ranges on concurrent document changes
tests/
  setup.ts              — bun:test preload that mocks the vscode module
  mocks/vscode.ts       — lightweight Position, Range, Uri, TextDocument mocks
  *.test.ts             — test files
```

The extension bundles with `bun build` using `--external vscode` (VS Code provides the module at runtime).

## Testing

Tests use `bun:test`. The `vscode` module is mocked via `tests/setup.ts` (configured as a preload in `bunfig.toml`). Use `tests/mocks/vscode.ts` helpers like `createMockDocument(content, languageId)` when testing functions that depend on VS Code types.

```ts
import { describe, expect, test } from "bun:test";
```

## Key patterns

- Functions that need testing are exported from their source files (`makeComment`, `parseKusanagiComment`, `parseSlashCommand`, `getEnclosingBlock`, `buildPrompt`, etc.)
- Provider backends spawn CLI processes and pipe prompts via stdin
- `InsertionTracker` listens to `onDidChangeTextDocument` to keep pending edit ranges accurate across concurrent changes
- `COMMENT_SYNTAX` maps VS Code language IDs to `[prefix, suffix]` pairs for comment generation/parsing
