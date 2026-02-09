import { describe, expect, test } from "bun:test";
import { stripCodeFences } from "../src/utils";

describe("stripCodeFences", () => {
  test("strips fenced block with language tag", () => {
    const input = "```typescript\nconst x = 1;\n```";
    expect(stripCodeFences(input)).toBe("const x = 1;");
  });

  test("strips fenced block without language tag", () => {
    const input = "```\nconst x = 1;\n```";
    expect(stripCodeFences(input)).toBe("const x = 1;");
  });

  test("returns trimmed text when no fences present", () => {
    const input = "  const x = 1;  ";
    expect(stripCodeFences(input)).toBe("const x = 1;");
  });

  test("handles multi-line fenced content", () => {
    const input = "```js\nline1\nline2\nline3\n```";
    expect(stripCodeFences(input)).toBe("line1\nline2\nline3");
  });

  test("returns empty string for empty input", () => {
    expect(stripCodeFences("")).toBe("");
    expect(stripCodeFences("   ")).toBe("");
  });

  test("does not strip inline backticks", () => {
    const input = "use `const` for declarations";
    expect(stripCodeFences(input)).toBe("use `const` for declarations");
  });

  test("handles fenced block with trailing whitespace", () => {
    const input = "```ts\nconst x = 1;   \n```";
    expect(stripCodeFences(input)).toBe("const x = 1;");
  });
});
