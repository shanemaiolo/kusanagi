# Kusanagi

Inline AI prompting for VS Code.

Kusanagi uses the Claude CLI to generate and modify code directly in your editor. Select code (or place your cursor in a block), trigger the prompt, and Claude streams changes inline — no copy-pasting, no side panels.

## Prerequisites

- **VS Code** 1.85.0+
- **Bun** — [bun.sh](https://bun.sh)
- **Claude CLI** — `npm install -g @anthropic-ai/claude-code`

## Installation

```bash
bun install
bun run compile
```

## Usage

**Keybinding:** `Ctrl+Shift+I` (macOS: `Cmd+Shift+I`)

With code selected or your cursor inside a block, press the keybinding to open the prompt. You can:

- **Pick a quick action** — Document, Refactor, Explain, or Fix
- **Type a custom prompt** — free-text instructions for Claude
- **Use a slash command** — e.g. `/refactor extract helper`, `/fix handle null case`

When no code is selected, Kusanagi uses the enclosing block as context. On an empty line, it inserts the result at your cursor.

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
ln -s "$(pwd)" ~/.vscode/extensions/kusanagi
```

Restart VS Code (or run **Developer: Reload Window**) to detect the extension. After that, recompile and reload to pick up changes.

**Install as .vsix** — Package and install a standalone build:

```bash
bun run package
code --install-extension kusanagi-0.2.0.vsix
```

You'll need to re-package and re-install to pick up changes.

## License

[Apache-2.0](LICENSE)
