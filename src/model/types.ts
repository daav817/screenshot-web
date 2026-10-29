export type Tool =
  | "select"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "freehand"
  | "text"
  | "highlight"
  | "obfuscate"
  | "step"
  | "crop";

export type ObfuscateMode = "pixelate" | "blur";

/** Style applied to new shapes and, when a shape is selected, to that shape. */
export interface Style {
  stroke: string;
  fill: string;
  strokeWidth: number;
  fontSize: number;
  shadow: boolean;
  highlight: string;
  obfuscateMode: ObfuscateMode;
}

interface ShapeBase {
  id: string;
  shadow: boolean;
}

export interface BoxShape extends ShapeBase {
  kind: "rect" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface HighlightShape extends ShapeBase {
  kind: "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

export interface ObfuscateShape extends ShapeBase {
  kind: "obfuscate";
  x: number;
  y: number;
  width: number;
  height: number;
  mode: ObfuscateMode;
}

export interface PathShape extends ShapeBase {
  kind: "line" | "arrow" | "freehand";
  points: number[];
  stroke: string;
  strokeWidth: number;
}

export interface TextShape extends ShapeBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
}

export interface StepShape extends ShapeBase {
  kind: "step";
  x: number;
  y: number;
  number: number;
  fill: string;
  radius: number;
}

export type Shape = BoxShape | HighlightShape | ObfuscateShape | PathShape | TextShape | StepShape;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The screenshot being edited: the captured image plus the annotations drawn on it. */
export interface Doc {
  image: HTMLCanvasElement;
  shapes: Shape[];
}
