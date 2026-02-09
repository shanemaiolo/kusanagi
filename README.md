# Kusanagi

Inline AI prompting for VS Code.

Kusanagi uses AI CLI tools to generate and modify code directly in your editor. Select code (or place your cursor in a block), trigger the prompt, and the AI streams changes inline — no copy-pasting, no side panels.

Supports multiple backends — currently **Claude Code** and **OpenCode**, with more easily added.

## Prerequisites

- **VS Code** 1.85.0+
- **Bun** — [bun.sh](https://bun.sh)
- **One of the supported AI CLIs:**
  - **Claude Code** (default) — `npm install -g @anthropic-ai/claude-code`
  - **OpenCode** — `go install github.com/opencode-ai/opencode@latest`

## Installation

```bash
bun install
bun run compile
```

## Usage

**Keybinding:** `Ctrl+Shift+I` (macOS: `Cmd+Shift+I`)

With code selected or your cursor inside a block, press the keybinding to open the prompt. You can:

- **Pick a quick action** — Document, Refactor, Explain, or Fix
- **Type a custom prompt** — free-text instructions for the AI
- **Use a slash command** — e.g. `/refactor extract helper`, `/fix handle null case`

When no code is selected, Kusanagi uses the enclosing block as context. On an empty line, it inserts the result at your cursor.

### Choosing a provider

Open **Settings** and search for `kusanagi.provider`. Pick from the dropdown:

| Provider   | CLI command | Install                                              |
|------------|-------------|------------------------------------------------------|
| `claude`   | `claude`    | `npm install -g @anthropic-ai/claude-code`           |
| `opencode` | `opencode`  | `go install github.com/opencode-ai/opencode@latest`  |

The provider can be switched at runtime — no reload required. The status bar reflects the active provider.

### Model selection

Each provider has its own model setting so your choice persists when switching providers.

| Setting                  | Example values                                  |
|--------------------------|-------------------------------------------------|
| `kusanagi.claude.model`  | `opus`, `sonnet`, `haiku`, `claude-opus-4-6`    |
| `kusanagi.opencode.model`| `opencode/big-pickle`                           |

Leave a setting empty to use the provider's default model.

**Finding available model names:**

- **Claude Code** — run `claude model` or pass aliases like `opus`, `sonnet`, `haiku`. Full model IDs (e.g. `claude-opus-4-6`) also work. See the [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for details.
- **OpenCode** — run `opencode models` to see available models. Values use `provider/model` format (e.g. `opencode/big-pickle`).

### Slash commands

| Command      | Description                                   |
|--------------|-----------------------------------------------|
| `/document`  | Add documentation comments                    |
| `/refactor`  | Improve readability and maintainability       |
| `/explain`   | Add inline comments explaining the code       |
| `/fix`       | Identify and fix bugs                         |

Slash commands accept extra instructions: `/refactor extract validation into a helper`

## Development

```bash
bun run compile    # Build the extension
bun run watch      # Rebuild on file changes
bun run package    # Compile + package as .vsix
```

### Testing & installing

**Extension Development Host (F5)** — Press **F5** in VS Code to launch a sandboxed instance with the extension loaded. Best for active development.

**Symlink** — Link the project into your extensions directory so VS Code loads it directly:

```bash
ln -s "$(pwd)" ~/.vscode/extensions/shanemaiolo.kusanagi-0.3.1
```

Restart VS Code (or run **Developer: Reload Window**) to detect the extension. After that, recompile and reload to pick up changes.

**Install as .vsix** — Package and install a standalone build:

```bash
bun run package
code --install-extension kusanagi-0.3.1.vsix
```

You'll need to re-package and re-install to pick up changes.

## License

[Apache-2.0](LICENSE)
