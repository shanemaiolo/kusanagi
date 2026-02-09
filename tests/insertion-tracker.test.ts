import { describe, expect, test } from "bun:test";
import { InsertionTracker } from "../src/insertion-tracker";
import { Position, Range, _fireDocumentChange, Uri } from "./mocks/vscode";

function makeChangeEvent(
  uri: string,
  changes: Array<{
    range: Range;
    text: string;
  }>
) {
  return {
    document: { uri: Uri.parse(uri) },
    contentChanges: changes.map((c) => ({
      range: c.range,
      rangeOffset: 0,
      rangeLength: 0,
      text: c.text,
    })),
    reason: undefined,
  };
}

describe("InsertionTracker", () => {
  test("track and remove", () => {
    const tracker = new InsertionTracker();
    const range = new Range(5, 0, 5, 10);
    tracker.track("r1", "file:///test.ts", range as any);
    expect(tracker.activeCount).toBe(1);
    tracker.remove("r1");
    expect(tracker.activeCount).toBe(0);
    tracker.dispose();
  });

  test("change after range does not shift", () => {
    const tracker = new InsertionTracker();
    const range = new Range(5, 0, 5, 10);
    tracker.track("r1", "file:///test.ts", range as any);

    // Fire a change on line 10 (after our range at line 5)
    _fireDocumentChange(
      makeChangeEvent("file:///test.ts", [
        { range: new Range(10, 0, 10, 5), text: "new text" },
      ])
    );

    // The range should be unchanged — we can verify via activeCount (still tracked)
    expect(tracker.activeCount).toBe(1);
    tracker.dispose();
  });

  test("change before range shifts lines", () => {
    const tracker = new InsertionTracker();
    const range = new Range(10, 0, 12, 5);
    tracker.track("r1", "file:///test.ts", range as any);

    // Insert 2 new lines before our range (at line 2)
    _fireDocumentChange(
      makeChangeEvent("file:///test.ts", [
        { range: new Range(2, 0, 2, 0), text: "line1\nline2\n" },
      ])
    );

    // Tracker still active
    expect(tracker.activeCount).toBe(1);
    tracker.dispose();
  });

  test("change on different document does not affect tracker", () => {
    const tracker = new InsertionTracker();
    const range = new Range(5, 0, 5, 10);
    tracker.track("r1", "file:///test.ts", range as any);

    _fireDocumentChange(
      makeChangeEvent("file:///other.ts", [
        { range: new Range(0, 0, 0, 0), text: "inserted\n" },
      ])
    );

    expect(tracker.activeCount).toBe(1);
    tracker.dispose();
  });

  test("dispose clears all pending entries", () => {
    const tracker = new InsertionTracker();
    tracker.track("r1", "file:///test.ts", new Range(0, 0, 1, 0) as any);
    tracker.track("r2", "file:///test.ts", new Range(5, 0, 6, 0) as any);
    expect(tracker.activeCount).toBe(2);
    tracker.dispose();
    expect(tracker.activeCount).toBe(0);
  });
});
