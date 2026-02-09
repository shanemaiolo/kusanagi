import { describe, expect, test } from "bun:test";
import {
  makeComment,
  parseKusanagiComment,
  parseSlashCommand,
  getEnclosingBlock,
  COMMENT_SYNTAX,
} from "../src/extension";
import { Position, createMockDocument } from "./mocks/vscode";

describe("makeComment", () => {
  test("JS/TS uses // prefix", () => {
    expect(makeComment("javascript", "hello")).toBe("// hello");
    expect(makeComment("typescript", "hello")).toBe("// hello");
  });

  test("Python uses # prefix", () => {
    expect(makeComment("python", "hello")).toBe("# hello");
  });

  test("HTML uses <!-- --> delimiters", () => {
    expect(makeComment("html", "hello")).toBe("<!-- hello -->");
  });

  test("CSS uses /* */ delimiters", () => {
    expect(makeComment("css", "hello")).toBe("/* hello */");
  });

  test("SQL uses -- prefix", () => {
    expect(makeComment("sql", "hello")).toBe("-- hello");
  });

  test("unknown language falls back to // prefix", () => {
    expect(makeComment("unknown-lang", "hello")).toBe("// hello");
  });
});

describe("parseKusanagiComment", () => {
  test("parses valid JS Kusanagi comment", () => {
    expect(parseKusanagiComment("typescript", "// Kusanagi add docs")).toBe("add docs");
  });

  test("parses valid Python Kusanagi comment", () => {
    expect(parseKusanagiComment("python", "# Kusanagi refactor this")).toBe("refactor this");
  });

  test("parses valid HTML Kusanagi comment", () => {
    expect(parseKusanagiComment("html", "<!-- Kusanagi fix bug -->")).toBe("fix bug");
  });

  test("returns null for non-Kusanagi comment", () => {
    expect(parseKusanagiComment("typescript", "// some other comment")).toBeNull();
  });

  test("returns null for non-comment line", () => {
    expect(parseKusanagiComment("typescript", "const x = 1;")).toBeNull();
  });

  test("returns null for empty prompt", () => {
    expect(parseKusanagiComment("typescript", "// Kusanagi ")).toBeNull();
    expect(parseKusanagiComment("typescript", "// Kusanagi")).toBeNull();
  });

  test("handles slash command as prompt", () => {
    expect(parseKusanagiComment("typescript", "// Kusanagi /refactor")).toBe("/refactor");
  });

  test("handles leading whitespace", () => {
    expect(parseKusanagiComment("typescript", "  // Kusanagi hello")).toBe("hello");
  });

  test("CSS Kusanagi comment", () => {
    expect(parseKusanagiComment("css", "/* Kusanagi style fix */")).toBe("style fix");
  });
});

describe("parseSlashCommand", () => {
  test("parses /document", () => {
    const result = parseSlashCommand("/document");
    expect(result).not.toBeNull();
    expect(result!.action.slash).toBe("document");
    expect(result!.extra).toBe("");
  });

  test("parses /refactor", () => {
    const result = parseSlashCommand("/refactor");
    expect(result).not.toBeNull();
    expect(result!.action.slash).toBe("refactor");
  });

  test("parses /explain", () => {
    const result = parseSlashCommand("/explain");
    expect(result).not.toBeNull();
    expect(result!.action.slash).toBe("explain");
  });

  test("parses /fix", () => {
    const result = parseSlashCommand("/fix");
    expect(result).not.toBeNull();
    expect(result!.action.slash).toBe("fix");
  });

  test("parses command with extra args", () => {
    const result = parseSlashCommand("/refactor extract validation");
    expect(result).not.toBeNull();
    expect(result!.action.slash).toBe("refactor");
    expect(result!.extra).toBe("extract validation");
  });

  test("returns null for unknown command", () => {
    expect(parseSlashCommand("/unknown")).toBeNull();
  });

  test("returns null for non-slash input", () => {
    expect(parseSlashCommand("refactor")).toBeNull();
  });

  test("returns null for partial command name", () => {
    expect(parseSlashCommand("/doc")).toBeNull();
    expect(parseSlashCommand("/ref")).toBeNull();
  });

  test("trims surrounding whitespace", () => {
    const result = parseSlashCommand("  /fix  ");
    expect(result).not.toBeNull();
    expect(result!.action.slash).toBe("fix");
  });
});

describe("getEnclosingBlock", () => {
  test("cursor inside function body finds the block", () => {
    const code = `function foo() {\n  const x = 1;\n  return x;\n}`;
    const doc = createMockDocument(code);
    const pos = new Position(1, 5); // inside body
    const result = getEnclosingBlock(doc as any, pos as any);
    expect(result).not.toBeNull();
    expect(result!.text).toContain("function foo()");
    expect(result!.text).toContain("return x;");
  });

  test("returns null when no braces", () => {
    const code = `const x = 1;\nconst y = 2;`;
    const doc = createMockDocument(code);
    const pos = new Position(0, 5);
    const result = getEnclosingBlock(doc as any, pos as any);
    expect(result).toBeNull();
  });

  test("nested braces finds inner block", () => {
    const code = `function outer() {\n  function inner() {\n    return 1;\n  }\n}`;
    const doc = createMockDocument(code);
    const pos = new Position(2, 4); // inside inner function
    const result = getEnclosingBlock(doc as any, pos as any);
    expect(result).not.toBeNull();
    expect(result!.text).toContain("inner");
  });

  test("forward scan finds block on cursor line", () => {
    const code = `function foo() {\n  return 1;\n}`;
    const doc = createMockDocument(code);
    // Position before the opening brace on line 0
    const pos = new Position(0, 0);
    const result = getEnclosingBlock(doc as any, pos as any);
    expect(result).not.toBeNull();
    expect(result!.text).toContain("function foo()");
  });

  test("multi-line signature is included", () => {
    const code = `function foo(\n  a: number,\n  b: number\n) {\n  return a + b;\n}`;
    const doc = createMockDocument(code);
    const pos = new Position(4, 2); // inside body
    const result = getEnclosingBlock(doc as any, pos as any);
    expect(result).not.toBeNull();
    expect(result!.text).toContain("function foo(");
    expect(result!.text).toContain("a: number");
  });

  test("unmatched opening brace returns null", () => {
    const code = `function foo() {\n  const x = 1;`;
    const doc = createMockDocument(code);
    const pos = new Position(1, 5);
    const result = getEnclosingBlock(doc as any, pos as any);
    expect(result).toBeNull();
  });
});
