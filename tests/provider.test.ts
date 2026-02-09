import { describe, expect, test } from "bun:test";
import { getProvider } from "../src/provider";

describe("getProvider", () => {
  test("returns claude provider by id", () => {
    const provider = getProvider("claude");
    expect(provider.id).toBe("claude");
    expect(provider.name).toBe("Claude");
  });

  test("returns opencode provider by id", () => {
    const provider = getProvider("opencode");
    expect(provider.id).toBe("opencode");
    expect(provider.name).toBe("OpenCode");
  });

  test("throws for unknown provider id", () => {
    expect(() => getProvider("nonexistent")).toThrow("Unknown provider");
  });

  test("error message lists available providers", () => {
    try {
      getProvider("bad");
    } catch (e: any) {
      expect(e.message).toContain("claude");
      expect(e.message).toContain("opencode");
    }
  });
});
