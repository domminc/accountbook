import { describe, expect, it } from "vitest";
import { moveInOrder, txKindOf } from "./settings";

describe("moveInOrder", () => {
  it("한 칸씩 옮긴다", () => {
    expect(moveInOrder(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("끝에서는 그대로", () => {
    expect(moveInOrder(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveInOrder(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveInOrder(["a", "b"], "x", 1)).toEqual(["a", "b"]);
  });
});

describe("txKindOf", () => {
  it("고정·비고정지출은 지출", () => {
    expect(txKindOf("fixed_expense")).toBe("expense");
    expect(txKindOf("variable_expense")).toBe("expense");
    expect(txKindOf("income")).toBe("income");
    expect(txKindOf("saving")).toBe("saving");
  });
});
