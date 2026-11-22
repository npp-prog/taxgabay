import { describe, expect, it } from "vitest";
import { changedFields } from "./audit";

describe("changedFields", () => {
  it("lists changed keys, ignoring search and updated_at", () => {
    expect(changedFields({ old_row: { a: 1, b: [1], search: "x", updated_at: 1 }, new_row: { a: 2, b: [1], search: "y", updated_at: 2, c: 3 } })).toEqual(["a", "c"]);
    expect(changedFields({ old_row: null, new_row: { a: 1 } })).toEqual([]);
  });
});
