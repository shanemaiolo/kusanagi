import * as vscode from "vscode";

interface PendingInsertion {
  id: string;
  uri: string;
  range: vscode.Range;
}

/**
 * Tracks pending text insertions in VS Code documents and adjusts their
 * target ranges as the document changes, ensuring insertions land at the
 * correct position even after concurrent edits.
 */
export class InsertionTracker implements vscode.Disposable {
  private pending = new Map<string, PendingInsertion>();
  private disposable: vscode.Disposable;

  constructor() {
    this.disposable = vscode.workspace.onDidChangeTextDocument((e) => {
      this.adjustForChanges(e);
    });
  }

  /**
   * Begins tracking a pending insertion.
   * @param id - Unique identifier for this insertion.
   * @param uri - The string URI of the target document.
   * @param range - The document range where the insertion will be applied.
   */
  track(id: string, uri: string, range: vscode.Range): void {
    this.pending.set(id, { id, uri, range });
  }

  /**
   * Stops tracking a pending insertion without applying it.
   * @param id - The identifier of the insertion to remove.
   */
  remove(id: string): void {
    this.pending.delete(id);
  }

  /**
   * Applies a pending insertion by replacing its tracked range with the given text.
   * The insertion is removed from tracking regardless of success or failure.
   * @param id - The identifier of the pending insertion.
   * @param text - The replacement text to insert.
   * @returns `true` if the edit was applied successfully, `false` if the entry
   *          was not found or the document/editor could not be resolved.
   */
  async applyResult(
    id: string,
    text: string
  ): Promise<boolean> {
    const entry = this.pending.get(id);
    if (!entry) {
      return false;
    }

    const uri = vscode.Uri.parse(entry.uri);
    const doc = vscode.workspace.textDocuments.find(
      (d) => d.uri.toString() === uri.toString()
    );
    if (!doc) {
      this.pending.delete(id);
      return false;
    }

    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document.uri.toString() === uri.toString()
    );
    if (!editor) {
      this.pending.delete(id);
      return false;
    }

    const success = await editor.edit((editBuilder) => {
      editBuilder.replace(entry.range, text);
    });

    this.pending.delete(id);
    return success;
  }

  /**
   * Adjusts all tracked ranges for the affected document whenever
   * its content changes, keeping pending insertions aligned.
   * @param e - The text document change event.
   */
  private adjustForChanges(e: vscode.TextDocumentChangeEvent): void {
    const docUri = e.document.uri.toString();

    for (const [, entry] of this.pending) {
      if (entry.uri !== docUri) {
        continue;
      }

      for (const change of e.contentChanges) {
        entry.range = this.shiftRange(entry.range, change);
      }
    }
  }

  /**
   * Computes a new range by shifting the given range to account for a
   * single content change. Handles changes that occur before, after, or
   * overlapping with the range.
   * @param range - The original range to shift.
   * @param change - The content change to account for.
   * @returns The adjusted range.
   */
  private shiftRange(
    range: vscode.Range,
    change: vscode.TextDocumentContentChangeEvent
  ): vscode.Range {
    const changeStart = change.range.start;
    const changeEnd = change.range.end;
    const newText = change.text;

    // Count lines and last-line length in the new text
    const newLines = newText.split("\n");
    const addedLineCount = newLines.length - 1;
    const removedLineCount = changeEnd.line - changeStart.line;
    const lineDelta = addedLineCount - removedLineCount;

    // If the change is entirely after our range, no adjustment needed
    if (changeStart.line > range.end.line ||
        (changeStart.line === range.end.line && changeStart.character >= range.end.character)) {
      return range;
    }

    // If the change is entirely before our range start line
    if (changeEnd.line < range.start.line) {
      return new vscode.Range(
        range.start.translate(lineDelta, 0),
        range.end.translate(lineDelta, 0)
      );
    }

    // If the change ends on the same line as our range starts
    if (changeEnd.line === range.start.line && changeEnd.character <= range.start.character) {
      const lastNewLineLength = newLines[newLines.length - 1].length;
      let newStartChar: number;
      let newEndChar: number;

      if (addedLineCount === 0) {
        // Change on same line: shift character position
        const charDelta = lastNewLineLength - (changeEnd.character - changeStart.character);
        newStartChar = range.start.character + charDelta;
        newEndChar = range.start.line === range.end.line
          ? range.end.character + charDelta
          : range.end.character;
      } else {
        // Change introduced new lines
        newStartChar = range.start.character - changeEnd.character + lastNewLineLength;
        newEndChar = range.start.line === range.end.line
          ? range.end.character - changeEnd.character + lastNewLineLength
          : range.end.character;
      }

      const newStart = new vscode.Position(range.start.line + lineDelta, newStartChar);
      const newEnd = new vscode.Position(range.end.line + lineDelta, newEndChar);
      return new vscode.Range(newStart, newEnd);
    }

    // The change overlaps with our range — keep the range as-is
    // (the edit may have invalidated it, but we'll do our best)
    return new vscode.Range(
      new vscode.Position(
        Math.max(0, range.start.line + lineDelta),
        range.start.character
      ),
      new vscode.Position(
        Math.max(0, range.end.line + lineDelta),
        range.end.character
      )
    );
  }

  /** The number of insertions currently being tracked. */
  get activeCount(): number {
    return this.pending.size;
  }

  /** Disposes the document change listener and clears all tracked insertions. */
  dispose(): void {
    this.disposable.dispose();
    this.pending.clear();
  }
}
