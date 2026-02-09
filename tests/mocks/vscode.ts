/**
 * Lightweight mock implementations of VS Code types for testing.
 */

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}

  translate(lineDelta: number = 0, characterDelta: number = 0): Position {
    return new Position(this.line + lineDelta, this.character + characterDelta);
  }

  isEqual(other: Position): boolean {
    return this.line === other.line && this.character === other.character;
  }

  isBefore(other: Position): boolean {
    return (
      this.line < other.line ||
      (this.line === other.line && this.character < other.character)
    );
  }

  isAfter(other: Position): boolean {
    return (
      this.line > other.line ||
      (this.line === other.line && this.character > other.character)
    );
  }
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;

  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  constructor(start: Position, end: Position);
  constructor(
    startOrLine: Position | number,
    endOrChar: Position | number,
    endLine?: number,
    endChar?: number
  ) {
    if (typeof startOrLine === "number") {
      this.start = new Position(startOrLine, endOrChar as number);
      this.end = new Position(endLine!, endChar!);
    } else {
      this.start = startOrLine;
      this.end = endOrChar as Position;
    }
  }

  get isEmpty(): boolean {
    return this.start.isEqual(this.end);
  }
}

export class Uri {
  private constructor(
    public readonly scheme: string,
    public readonly authority: string,
    public readonly path: string,
    public readonly query: string,
    public readonly fragment: string
  ) {}

  static parse(value: string): Uri {
    try {
      const url = new URL(value);
      return new Uri(url.protocol.replace(":", ""), url.hostname, url.pathname, url.search, url.hash);
    } catch {
      return new Uri("file", "", value, "", "");
    }
  }

  static file(path: string): Uri {
    return new Uri("file", "", path, "", "");
  }

  toString(): string {
    if (this.scheme === "file") {
      return `file://${this.path}`;
    }
    return `${this.scheme}://${this.authority}${this.path}${this.query}${this.fragment}`;
  }
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

type ChangeListener = (e: any) => void;

const changeListeners: ChangeListener[] = [];

export const workspace = {
  onDidChangeTextDocument(listener: ChangeListener) {
    changeListeners.push(listener);
    return { dispose() { const i = changeListeners.indexOf(listener); if (i >= 0) changeListeners.splice(i, 1); } };
  },
  onDidChangeConfiguration() {
    return { dispose() {} };
  },
  getConfiguration() {
    return { get: (_key: string, defaultValue?: any) => defaultValue };
  },
  applyEdit: async () => true,
  textDocuments: [] as any[],
};

export const window = {
  activeTextEditor: undefined as any,
  visibleTextEditors: [] as any[],
  createStatusBarItem() {
    return { text: "", show() {}, hide() {}, dispose() {} };
  },
  showWarningMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showInformationMessage: async () => undefined,
  showInputBox: async () => undefined,
  createQuickPick: () => ({
    items: [],
    placeholder: "",
    onDidAccept: () => ({ dispose() {} }),
    onDidHide: () => ({ dispose() {} }),
    show() {},
    dispose() {},
  }),
};

export const commands = {
  registerCommand: (_id: string, _handler: Function) => ({ dispose() {} }),
};

/** Fire a simulated document change event to all registered listeners. */
export function _fireDocumentChange(event: any): void {
  for (const listener of changeListeners) {
    listener(event);
  }
}

export interface TextLine {
  text: string;
  range: Range;
  lineNumber: number;
  isEmptyOrWhitespace: boolean;
}

export function createMockDocument(content: string, languageId: string = "typescript") {
  const lines = content.split("\n");

  const lineAt = (lineOrPos: number | Position): TextLine => {
    const lineNum = typeof lineOrPos === "number" ? lineOrPos : lineOrPos.line;
    const text = lines[lineNum] ?? "";
    return {
      text,
      lineNumber: lineNum,
      range: new Range(lineNum, 0, lineNum, text.length),
      isEmptyOrWhitespace: text.trim().length === 0,
    };
  };

  const getText = (range?: Range): string => {
    if (!range) return content;
    const startOffset = offsetAt(range.start);
    const endOffset = offsetAt(range.end);
    return content.slice(startOffset, endOffset);
  };

  const offsetAt = (position: Position): number => {
    let offset = 0;
    for (let i = 0; i < position.line && i < lines.length; i++) {
      offset += lines[i].length + 1; // +1 for \n
    }
    offset += Math.min(position.character, (lines[position.line] ?? "").length);
    return offset;
  };

  const positionAt = (offset: number): Position => {
    let remaining = offset;
    for (let i = 0; i < lines.length; i++) {
      if (remaining <= lines[i].length) {
        return new Position(i, remaining);
      }
      remaining -= lines[i].length + 1;
    }
    return new Position(lines.length - 1, (lines[lines.length - 1] ?? "").length);
  };

  return {
    languageId,
    lineCount: lines.length,
    uri: Uri.file("/test/file.ts"),
    getText,
    offsetAt,
    positionAt,
    lineAt,
  };
}
