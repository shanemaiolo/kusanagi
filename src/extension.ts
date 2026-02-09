import * as vscode from "vscode";
import { getProvider, type Provider } from "./provider";
import { InsertionTracker } from "./insertion-tracker";

const COMMENT_SYNTAX: Record<string, [string, string]> = {
  javascript: ["// ", ""],
  typescript: ["// ", ""],
  javascriptreact: ["// ", ""],
  typescriptreact: ["// ", ""],
  java: ["// ", ""],
  c: ["// ", ""],
  cpp: ["// ", ""],
  csharp: ["// ", ""],
  go: ["// ", ""],
  rust: ["// ", ""],
  swift: ["// ", ""],
  kotlin: ["// ", ""],
  scala: ["// ", ""],
  dart: ["// ", ""],
  php: ["// ", ""],
  python: ["# ", ""],
  ruby: ["# ", ""],
  shellscript: ["# ", ""],
  bash: ["# ", ""],
  perl: ["# ", ""],
  r: ["# ", ""],
  yaml: ["# ", ""],
  coffeescript: ["# ", ""],
  html: ["<!-- ", " -->"],
  xml: ["<!-- ", " -->"],
  css: ["/* ", " */"],
  scss: ["/* ", " */"],
  less: ["/* ", " */"],
  sql: ["-- ", ""],
  lua: ["-- ", ""],
  haskell: ["-- ", ""],
  clojure: ["; ", ""],
  lisp: ["; ", ""],
  scheme: ["; ", ""],
  erlang: ["% ", ""],
  latex: ["% ", ""],
  matlab: ["% ", ""],
  vim: ['" ', ""],
};

function makeComment(language: string, text: string): string {
  const [prefix, suffix] = COMMENT_SYNTAX[language] ?? ["// ", ""];
  return `${prefix}${text}${suffix}`;
}

interface QuickAction {
  label: string;
  icon: string;
  prompt: string;
  slash: string;
}

const REPLACE_SUFFIX = "\n\nIMPORTANT: Your output will REPLACE the focused code. Return ONLY the modified version of the focus code — do not include any surrounding code. If no changes are needed, return the original code exactly as-is. Never return explanations or prose — always return valid code.";

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Document",
    icon: "$(book)",
    prompt: "Add documentation comments to this code. Use the appropriate doc comment style for the language (JSDoc, docstring, etc.). Do not change the code itself.",
    slash: "document",
  },
  {
    label: "Refactor",
    icon: "$(edit)",
    prompt: "Refactor this code to improve readability and maintainability. Preserve the exact same external behavior.",
    slash: "refactor",
  },
  {
    label: "Explain",
    icon: "$(comment-discussion)",
    prompt: "Add inline comments explaining what this code does. Explain non-obvious logic and edge cases. Do not change the code itself, only add comments.",
    slash: "explain",
  },
  {
    label: "Fix",
    icon: "$(debug-alt)",
    prompt: "Identify and fix bugs or issues in this code. Preserve the intended behavior.",
    slash: "fix",
  },
];

/**
 * Parses a slash command from user input and returns the matched action with any extra arguments.
 *
 * @param input - The raw user input string to parse.
 * @returns An object containing the matched {@link QuickAction} and any extra text after the command,
 *          or `null` if the input does not match a known slash command.
 */
function parseSlashCommand(input: string): { action: QuickAction; extra: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  for (const action of QUICK_ACTIONS) {
    const prefix = `/${action.slash}`;
    if (trimmed === prefix || trimmed.startsWith(prefix + " ")) {
      return { action, extra: trimmed.slice(prefix.length).trim() };
    }
  }
  return null;
}

/**
 * Finds the nearest enclosing brace-delimited block around the given position.
 *
 * Scans backwards from the cursor for an unmatched opening brace, then forward
 * to find the matching closing brace. The returned range is extended to include
 * the full declaration (e.g., function signature) preceding the opening brace.
 *
 * @param document - The text document to search within.
 * @param position - The cursor position to find the enclosing block for.
 * @returns An object containing the block text and its range, or `null` if no enclosing block is found.
 */
function getEnclosingBlock(
  document: vscode.TextDocument,
  position: vscode.Position
): { text: string; range: vscode.Range } | null {
  const text = document.getText();
  const offset = document.offsetAt(position);

  // Scan backwards for unmatched opening brace
  let depth = 0;
  let blockStart = -1;

  for (let i = offset - 1; i >= 0; i--) {
    if (text[i] === "}") depth++;
    else if (text[i] === "{") {
      if (depth === 0) {
        blockStart = i;
        break;
      }
      depth--;
    }
  }

  // If backward scan failed, check forward on the current line for a `{`
  if (blockStart === -1) {
    for (let i = offset; i < text.length; i++) {
      if (text[i] === "\n") break;
      if (text[i] === "{") {
        blockStart = i;
        break;
      }
    }
  }

  if (blockStart === -1) return null;

  // Find matching closing brace
  depth = 1;
  let blockEnd = -1;
  for (let i = blockStart + 1; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        blockEnd = i + 1;
        break;
      }
    }
  }

  if (blockEnd === -1) return null;

  // Extend to include full line of opening brace (captures function signature, etc.)
  const startPos = document.positionAt(blockStart);
  let firstLine = startPos.line;

  // Walk backwards to include preceding declaration lines (multi-line signatures)
  for (let line = startPos.line - 1; line >= 0; line--) {
    const lineText = document.lineAt(line).text.trimEnd();
    if (
      lineText === "" ||
      lineText.endsWith(";") ||
      lineText.endsWith("}") ||
      lineText.endsWith("{")
    ) {
      break;
    }
    firstLine = line;
  }

  const endPos = document.positionAt(blockEnd);
  const endLine = document.lineAt(endPos.line);

  const range = new vscode.Range(
    new vscode.Position(firstLine, 0),
    endLine.range.end
  );

  return { text: document.getText(range), range };
}

/**
 * Determines the most relevant code context around the cursor in the active editor.
 *
 * Returns the selected text if there is an active selection, otherwise attempts to find
 * the nearest enclosing brace-delimited block, and finally falls back to the current line
 * if it is non-empty.
 *
 * @param editor - The active text editor to extract context from.
 * @returns An object containing the context text, its type (`"selection"`, `"block"`, or `"line"`),
 *          and the corresponding range, or `null` if no meaningful context is found.
 */
function getEditorContext(
  editor: vscode.TextEditor
): { text: string; type: "selection" | "block" | "line"; range: vscode.Range } | null {
  const document = editor.document;
  const selection = editor.selection;

  if (!selection.isEmpty) {
    return { text: document.getText(selection), type: "selection", range: new vscode.Range(selection.start, selection.end) };
  }

  const block = getEnclosingBlock(document, selection.active);
  if (block) {
    return { text: block.text, type: "block", range: block.range };
  }

  const line = document.lineAt(selection.active.line);
  if (!line.isEmptyOrWhitespace) {
    return { text: line.text, type: "line", range: line.range };
  }

  return null;
}

let tracker: InsertionTracker;
let statusBarItem: vscode.StatusBarItem;
let activeRequests = 0;
let requestCounter = 0;
const abortControllers = new Map<string, AbortController>();
let currentProvider: Provider;

function loadProvider(): void {
  const config = vscode.workspace.getConfiguration("kusanagi");
  const id = config.get<string>("provider", "claude");
  currentProvider = getProvider(id);
}

function updateStatusBar(): void {
  if (activeRequests > 0) {
    statusBarItem.text = `$(sync~spin) ${currentProvider.name}: ${activeRequests} working...`;
    statusBarItem.show();
  } else {
    statusBarItem.text = `$(sparkle) ${currentProvider.name}: Ready`;
    statusBarItem.show();
  }
}

/**
 * Handles the main prompt command for the Kusanagi extension.
 *
 * Presents the user with quick actions or accepts free-text/slash-command input
 * based on the current editor context (selection, enclosing block, or cursor line).
 * Sends the resulting prompt to Claude and applies the response as an inline edit
 * or insertion in the active editor.
 */
async function handlePromptCommand(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor");
    return;
  }

  const selection = editor.selection;
  const hasSelection = !selection.isEmpty;
  const editorContext = getEditorContext(editor);

  let prompt: string;
  let commentLabel: string = "";
  let useContextRange = false;

  if (editorContext) {
    // Show QuickPick with quick actions — also accepts slash commands and free text
    type ActionItem = vscode.QuickPickItem & { action: QuickAction | null };
    const items: ActionItem[] = QUICK_ACTIONS.map((a) => ({
      label: `${a.icon} ${a.label}`,
      description: a.prompt,
      action: a,
    }));

    const result = await new Promise<{ type: "pick"; action: QuickAction } | { type: "text"; text: string } | null>((resolve) => {
      const qp = vscode.window.createQuickPick<ActionItem>();
      qp.items = items;
      qp.placeholder = `Quick action or /command (context: ${editorContext.type})`;
      qp.onDidAccept(() => {
        const selected = qp.activeItems[0];
        if (selected?.action) {
          resolve({ type: "pick", action: selected.action });
        } else if (qp.value.trim()) {
          resolve({ type: "text", text: qp.value.trim() });
        } else {
          resolve(null);
        }
        qp.dispose();
      });
      qp.onDidHide(() => {
        resolve(null);
        qp.dispose();
      });
      qp.show();
    });

    if (!result) {
      return; // User cancelled
    }

    if (result.type === "pick") {
      prompt = result.action.prompt + REPLACE_SUFFIX;
      commentLabel = "/" + result.action.slash;
      useContextRange = true;
    } else {
      const slashCmd = parseSlashCommand(result.text);
      if (slashCmd) {
        const basePrompt = slashCmd.extra
          ? `${slashCmd.action.prompt}\n\nAdditional instructions: ${slashCmd.extra}`
          : slashCmd.action.prompt;
        prompt = basePrompt + REPLACE_SUFFIX;
        commentLabel = "/" + slashCmd.action.slash + (slashCmd.extra ? " " + slashCmd.extra : "");
        useContextRange = true;
      } else {
        prompt = result.text;
        commentLabel = result.text;
      }
    }
  } else {
    // No context (empty line) — skip QuickPick, show input box directly
    const input = await vscode.window.showInputBox({
      prompt: "Enter prompt (will insert at cursor)",
      placeHolder: "e.g., /refactor extract validation into a helper",
    });
    if (!input) {
      return;
    }
    const slashCmd = parseSlashCommand(input);
    if (slashCmd) {
      prompt = slashCmd.extra
        ? `${slashCmd.action.prompt}\n\nAdditional instructions: ${slashCmd.extra}`
        : slashCmd.action.prompt;
      commentLabel = "/" + slashCmd.action.slash + (slashCmd.extra ? " " + slashCmd.extra : "");
    } else {
      prompt = input;
      commentLabel = input;
    }
  }

  const requestId = `req-${++requestCounter}`;
  const cursorLine = editor.document.lineAt(selection.active.line);
  const isEmptyLine = !hasSelection && cursorLine.isEmptyOrWhitespace;

  let range: vscode.Range;
  if (useContextRange && editorContext) {
    // Quick action: replace the context range directly
    range = editorContext.range;
  } else if (hasSelection) {
    range = new vscode.Range(selection.start, selection.end);
  } else if (isEmptyLine) {
    // Insert a comment placeholder and track the full line.
    // Use WorkspaceEdit since editor.edit() can fail after showInputBox steals focus.
    const comment = makeComment(editor.document.languageId, `Kusanagi ${commentLabel}`);
    const wsEdit = new vscode.WorkspaceEdit();
    wsEdit.insert(editor.document.uri, selection.active, comment);
    await vscode.workspace.applyEdit(wsEdit);
    const updatedLine = editor.document.lineAt(selection.active.line);
    range = updatedLine.range;
  } else {
    // Custom prompt on block/line: insert at cursor
    range = new vscode.Range(selection.active, selection.active);
  }

  tracker.track(requestId, editor.document.uri.toString(), range);

  const ac = new AbortController();
  abortControllers.set(requestId, ac);
  activeRequests++;
  updateStatusBar();

  try {
    const language = editor.document.languageId;
    const fileContent = editor.document.getText();
    const contextText = editorContext?.text ?? "";
    const contextType = editorContext?.type ?? null;
    const model = vscode.workspace.getConfiguration("kusanagi").get<string>(`${currentProvider.id}.model`, "");
    const result = await currentProvider.run({
      prompt,
      context: contextText,
      language,
      signal: ac.signal,
      fileContent,
      contextType,
      model: model || undefined,
    });

    if (result.cancelled) {
      tracker.remove(requestId);
      return;
    }

    if (!result.text.trim()) {
      tracker.remove(requestId);
      vscode.window.showWarningMessage(`${currentProvider.name} returned an empty response.`);
      return;
    }

    const applied = await tracker.applyResult(requestId, result.text);
    if (!applied) {
      // Fallback: show in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: result.text,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }
  } catch (err: unknown) {
    tracker.remove(requestId);
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`${currentProvider.name} error: ${message}`);
  } finally {
    abortControllers.delete(requestId);
    activeRequests--;
    updateStatusBar();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  tracker = new InsertionTracker();
  context.subscriptions.push(tracker);

  loadProvider();

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  context.subscriptions.push(statusBarItem);
  updateStatusBar();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("kusanagi.provider")) {
        loadProvider();
        updateStatusBar();
      }
    })
  );

  const command = vscode.commands.registerCommand(
    "kusanagi.prompt",
    handlePromptCommand
  );
  context.subscriptions.push(command);
}

export function deactivate(): void {
  for (const [, ac] of abortControllers) {
    ac.abort();
  }
  abortControllers.clear();
  activeRequests = 0;
}
