import { describe, expect, test } from "bun:test";
import { buildPrompt as claudeBuildPrompt } from "../src/providers/claude";
import { buildPrompt as opencodeBuildPrompt } from "../src/providers/opencode";
import type { ProviderRunParams } from "../src/provider";

const baseParams: ProviderRunParams = {
  prompt: "Add types",
  context: "",
  language: "typescript",
};

describe("claude buildPrompt", () => {
  test("includes language and prompt", () => {
    const result = claudeBuildPrompt(baseParams);
    expect(result).toContain("Language: typescript");
    expect(result).toContain("Add types");
  });

  test("includes file content when provided", () => {
    const result = claudeBuildPrompt({
      ...baseParams,
      fileContent: "const x = 1;",
    });
    expect(result).toContain("File:");
    expect(result).toContain("const x = 1;");
  });

  test("includes focus context", () => {
    const result = claudeBuildPrompt({
      ...baseParams,
      context: "function foo() {}",
      contextType: "selection",
    });
    expect(result).toContain("Focus (selection):");
    expect(result).toContain("function foo() {}");
  });

  test("omits file section when no fileContent", () => {
    const result = claudeBuildPrompt(baseParams);
    expect(result).not.toContain("File:");
  });

  test("omits focus section when no context", () => {
    const result = claudeBuildPrompt(baseParams);
    expect(result).not.toContain("Focus");
  });

  test("omits focus section when contextType is null", () => {
    const result = claudeBuildPrompt({
      ...baseParams,
      context: "some code",
      contextType: null,
    });
    expect(result).not.toContain("Focus");
  });
});

describe("opencode buildPrompt", () => {
  test("includes language and prompt", () => {
    const result = opencodeBuildPrompt(baseParams);
    expect(result).toContain("Language: typescript");
    expect(result).toContain("Add types");
  });

  test("includes file content when provided", () => {
    const result = opencodeBuildPrompt({
      ...baseParams,
      fileContent: "const x = 1;",
    });
    expect(result).toContain("Full file context:");
    expect(result).toContain("const x = 1;");
  });

  test("includes REPLACE instruction before focus section", () => {
    const result = opencodeBuildPrompt({
      ...baseParams,
      context: "function foo() {}",
      contextType: "block",
    });
    expect(result).toContain("REPLACE the focused code");
    expect(result).toContain("Focus (block):");
    // REPLACE instruction should appear before Focus
    const replaceIdx = result.indexOf("REPLACE");
    const focusIdx = result.indexOf("Focus (block):");
    expect(replaceIdx).toBeLessThan(focusIdx);
  });

  test("omits focus section when no context", () => {
    const result = opencodeBuildPrompt(baseParams);
    expect(result).not.toContain("Focus");
    expect(result).not.toContain("REPLACE");
  });
});
