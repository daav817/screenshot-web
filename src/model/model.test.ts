import { describe, expect, it } from "vitest";
import { clampRect } from "./crop";
import { initHistory, push, redo, undo } from "./history";
import { dragShape, isTooSmall, nextStepNumber, normalizeRect, restyleShape, startShape, translateShape } from "./shapes";
import type { Shape, Style } from "./types";

const style: Style = { stroke: "#ff0000", fill: "", strokeWidth: 4, fontSize: 24, shadow: true, highlight: "#ffeb3b", obfuscateMode: "pixelate" };

describe("history", () => {
  it("undoes and redoes", () => {
    let h = initHistory(1);
    h = push(h, 2);
    h = push(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
  });

  it("drops the redo stack on a new change", () => {
    let h = push(push(initHistory(1), 2), 3);
    h = push(undo(h), 4);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual([1, 2]);
  });

  it("ignores undo with nothing to undo", () => {
    const h = initHistory(1);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});

describe("shapes", () => {
  it("normalizes a rectangle dragged up and left", () => {
    expect(normalizeRect(50, 40, 10, 20)).toEqual({ x: 10, y: 20, width: 40, height: 20 });
  });

  it("draws a square while Shift is held", () => {
    const start = startShape("rect", 10, 10, style)!;
    const s = dragShape(start, 10, 10, 50, 30, true);
    expect(s).toMatchObject({ x: 10, y: 10, width: 40, height: 40 });
  });

  it("snaps lines to 45 degrees while Shift is held", () => {
    const start = startShape("line", 0, 0, style)!;
    const s = dragShape(start, 0, 0, 100, 5, true) as Extract<Shape, { points: number[] }>;
    expect(s.points[3]).toBeCloseTo(0);
  });

  it("drops shapes made by a click", () => {
    expect(isTooSmall(startShape("rect", 5, 5, style)!)).toBe(true);
    expect(isTooSmall(dragShape(startShape("arrow", 0, 0, style)!, 0, 0, 40, 0, false))).toBe(false);
  });

  it("numbers steps after the highest existing one", () => {
    const steps: Shape[] = [
      { id: "a", kind: "step", x: 0, y: 0, number: 1, fill: "#000", radius: 10, shadow: false },
      { id: "b", kind: "step", x: 0, y: 0, number: 4, fill: "#000", radius: 10, shadow: false },
    ];
    expect(nextStepNumber(steps)).toBe(5);
    expect(nextStepNumber([])).toBe(1);
  });

  it("moves point and box shapes alike", () => {
    const line = dragShape(startShape("line", 0, 0, style)!, 0, 0, 10, 10, false);
    expect((translateShape(line, 5, -5) as Extract<Shape, { points: number[] }>).points).toEqual([5, -5, 15, 5]);
    const box = dragShape(startShape("rect", 0, 0, style)!, 0, 0, 10, 10, false);
    expect(translateShape(box, 5, -5)).toMatchObject({ x: 5, y: -5, width: 10, height: 10 });
  });

  it("restyles only what a shape has", () => {
    const hl = startShape("highlight", 0, 0, style)!;
    const changed = restyleShape(hl, { stroke: "#00ff00", highlight: "#b2ff59", shadow: true });
    expect(changed).toMatchObject({ fill: "#b2ff59", shadow: false });
    expect(changed).not.toHaveProperty("stroke");
  });
});

describe("crop", () => {
  it("clamps the crop area to the image", () => {
    expect(clampRect({ x: -10, y: 5.4, width: 200, height: 50 }, 100, 40)).toEqual({ x: 0, y: 5, width: 100, height: 35 });
  });
});
